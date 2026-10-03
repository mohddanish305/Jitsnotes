import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getAdmin = async (request: Request) => {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return null;
  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.auth.getUser(authorization.slice(7));
  if (error || !data.user) return null;
  const { data: profile } = await admin.from("admin_profiles").select("id,is_super_admin,is_active").eq("id", data.user.id).maybeSingle();
  if (!profile?.is_super_admin || profile.is_active === false) return null;
  return { admin, user: data.user };
};

const writeActivity = async (admin: ReturnType<typeof createClient>, actorId: string, action: string, resourceId: string | null, metadata: Record<string, unknown> = {}) => {
  await admin.from("admin_activity").insert({ actor_id: actorId, action, resource_type: "admin_invitation", resource_id: resourceId, metadata });
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const context = await getAdmin(request);
  if (!context) return json({ error: "You do not have permission to perform this action." }, 403);
  const { admin, user } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "list");
    if (action === "list") {
      const [{ data: profiles, error: profileError }, { data: invitations, error: invitationError }] = await Promise.all([
        admin.from("admin_profiles").select("id,email,is_super_admin,is_active,created_at").order("created_at", { ascending: true }),
        admin.from("admin_invitations").select("id,email,teacher_name,auth_user_id,status,expires_at,accepted_at,cancelled_at,created_at,updated_at").order("created_at", { ascending: false }),
      ]);
      if (profileError || invitationError) return json({ error: "Unable to load administrator records." }, 500);
      return json({ profiles: profiles || [], invitations: invitations || [] });
    }

    if (action === "invite" || action === "resend") {
      const email = normalizeEmail(body.email);
      const teacherName = String(body.teacher_name || "").trim() || null;
      if (!isEmail(email)) return json({ error: "Enter a valid email address." }, 400);
      const { data: existingProfile } = await admin.from("admin_profiles").select("id,is_super_admin,is_active").eq("email", email).maybeSingle();
      if (existingProfile?.is_active !== false) return json({ error: "This email already has administrator access." }, 409);
      const { data: pending } = await admin.from("admin_invitations").select("id,auth_user_id,status,expires_at").eq("email", email).eq("status", "pending").maybeSingle();
      if (action === "invite" && pending) return json({ error: "An invitation is already pending for this email." }, 409);
      if (action === "resend" && !pending) return json({ error: "No pending invitation exists for this email." }, 404);

      const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") || "https://jitsnotes.web.app/admin/accept-invitation";
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (inviteError || !invited.user) return json({ error: "Unable to send the invitation email." }, 502);
      let invitationId = pending?.id || null;
      if (pending) {
        const { error } = await admin.from("admin_invitations").update({ auth_user_id: invited.user.id, teacher_name: teacherName, expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), updated_at: new Date().toISOString() }).eq("id", pending.id);
        if (error) return json({ error: "Invitation sent, but its status could not be updated." }, 500);
        await writeActivity(admin, user.id, "teacher_invitation_resent", pending.id, { email });
      } else {
        const { data: invitation, error } = await admin.from("admin_invitations").insert({ email, teacher_name: teacherName, auth_user_id: invited.user.id, invited_by: user.id }).select("id").single();
        if (error) return json({ error: "Invitation email sent, but its record could not be created." }, 500);
        invitationId = invitation.id;
        await writeActivity(admin, user.id, "teacher_invited", invitation.id, { email });
      }
      return json({ invitation_id: invitationId });
    }

    const invitationId = String(body.invitation_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(invitationId)) return json({ error: "A valid invitation is required." }, 400);
    const { data: invitation } = await admin.from("admin_invitations").select("id,email,auth_user_id,status,expires_at").eq("id", invitationId).maybeSingle();
    if (!invitation) return json({ error: "Invitation not found." }, 404);

    if (action === "cancel") {
      if (invitation.status !== "pending") return json({ error: "Only pending invitations can be cancelled." }, 409);
      const { error } = await admin.from("admin_invitations").update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", invitationId);
      if (error) return json({ error: "Unable to cancel the invitation." }, 500);
      await writeActivity(admin, user.id, "teacher_invitation_cancelled", invitationId, { email: invitation.email });
      return json({ success: true });
    }

    if (action === "activate" || action === "deactivate") {
      const targetUserId = String(body.target_user_id || body.profile_id || "");
      let resolvedUserId = targetUserId;
      let emailForAudit = "";

      if (!resolvedUserId && invitationId) {
        resolvedUserId = invitation.auth_user_id || "";
        emailForAudit = invitation.email;
      }

      if (!resolvedUserId || !/^[0-9a-f-]{36}$/i.test(resolvedUserId)) {
        return json({ error: "A valid administrator account is required." }, 400);
      }

      if (resolvedUserId === user.id) {
        return json({ error: "You cannot change the status of your own account." }, 400);
      }

      const { data: targetProfile } = await admin
        .from("admin_profiles")
        .select("id,email,is_super_admin")
        .eq("id", resolvedUserId)
        .maybeSingle();

      if (targetProfile?.is_super_admin) {
        return json({ error: "The Super Admin is protected and cannot be modified." }, 403);
      }

      emailForAudit = emailForAudit || targetProfile?.email || "";
      const active = action === "activate";

      const [{ error: profileError }, { error: userError }] = await Promise.all([
        admin.from("admin_profiles").update({ is_active: active }).eq("id", resolvedUserId),
        admin.from("users").update({ role: active ? "admin" : "user" }).eq("id", resolvedUserId),
      ]);

      if (profileError || userError) return json({ error: "Unable to update administrator access." }, 500);

      await writeActivity(admin, user.id, active ? "admin_activated" : "admin_disabled", resolvedUserId, { email: emailForAudit });
      return json({ success: true });
    }

    if (action === "change_role") {
      const targetUserId = String(body.target_user_id || body.profile_id || "");
      if (!targetUserId || !/^[0-9a-f-]{36}$/i.test(targetUserId)) {
        return json({ error: "A valid administrator account is required." }, 400);
      }

      if (targetUserId === user.id) {
        return json({ error: "You cannot change the role of your own Super Admin account." }, 400);
      }

      const { data: targetProfile } = await admin
        .from("admin_profiles")
        .select("id,email,is_super_admin")
        .eq("id", targetUserId)
        .maybeSingle();

      if (!targetProfile) return json({ error: "Administrator record not found." }, 404);

      const makeSuper = Boolean(body.is_super_admin);
      const { error: updateError } = await admin
        .from("admin_profiles")
        .update({ is_super_admin: makeSuper })
        .eq("id", targetUserId);

      if (updateError) return json({ error: "Unable to update administrator role." }, 500);

      await writeActivity(admin, user.id, "admin_role_changed", targetUserId, {
        email: targetProfile.email,
        new_role: makeSuper ? "super_admin" : "teacher_admin",
      });
      return json({ success: true, is_super_admin: makeSuper });
    }

    if (action === "remove") {
      const targetUserId = String(body.target_user_id || body.profile_id || "");
      let resolvedUserId = targetUserId;
      let emailForAudit = "";

      if (!resolvedUserId && invitationId) {
        resolvedUserId = invitation.auth_user_id || "";
        emailForAudit = invitation.email;
      }

      if (!resolvedUserId || !/^[0-9a-f-]{36}$/i.test(resolvedUserId)) {
        return json({ error: "A valid administrator account is required." }, 400);
      }

      if (resolvedUserId === user.id) {
        return json({ error: "You cannot remove your own Super Admin account." }, 400);
      }

      const { data: targetProfile } = await admin
        .from("admin_profiles")
        .select("id,email,is_super_admin")
        .eq("id", resolvedUserId)
        .maybeSingle();

      if (targetProfile?.is_super_admin) {
        return json({ error: "The primary Super Admin is protected and cannot be removed." }, 403);
      }

      emailForAudit = emailForAudit || targetProfile?.email || "";

      await Promise.all([
        admin.from("admin_profiles").delete().eq("id", resolvedUserId),
        admin.from("users").update({ role: "user" }).eq("id", resolvedUserId),
        admin.from("admin_invitations").delete().eq("auth_user_id", resolvedUserId),
      ]);

      await writeActivity(admin, user.id, "admin_removed", resolvedUserId, { email: emailForAudit });
      return json({ success: true });
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (_error) {
    return json({ error: "Unable to complete administrator operation." }, 500);
  }
});
