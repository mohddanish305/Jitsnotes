import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

type AdminContext =
  | { admin: ReturnType<typeof createClient>; user: { id: string; email?: string } }
  | { error: string; status: number };

const getAdmin = async (request: Request): Promise<AdminContext> => {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return { error: "Your session has expired. Please sign in again.", status: 401 };
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) {
    return { error: "Server configuration missing.", status: 500 };
  }
  const admin = createClient(supabaseUrl, serviceKey);
  const token = authorization.slice(7);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    return { error: "Your session has expired. Please sign in again.", status: 401 };
  }
  const { data: profile } = await admin
    .from("admin_profiles")
    .select("id,email,is_super_admin,is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.is_super_admin || profile.is_active === false) {
    return { error: "You do not have permission to perform this action.", status: 403 };
  }
  return { admin, user: data.user };
};

const writeActivity = async (
  admin: ReturnType<typeof createClient>,
  actorId: string,
  action: string,
  resourceId: string | null,
  metadata: Record<string, unknown> = {}
) => {
  try {
    await admin.from("admin_activity").insert({
      actor_id: actorId,
      action,
      resource_type: "admin_invitation",
      resource_id: resourceId,
      metadata,
    });
  } catch (err) {
    console.warn("[admin-teachers] Notice while logging activity:", (err as Error)?.message);
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  const authResult = await getAdmin(request);
  if ("error" in authResult) {
    return json({ success: false, error: authResult.error }, authResult.status);
  }
  const { admin, user } = authResult;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "list").trim().toLowerCase();

    // 1. LIST ADMINISTRATORS & INVITATIONS
    if (action === "list") {
      const [{ data: profiles, error: profileError }, { data: invitations, error: invitationError }] = await Promise.all([
        admin.from("admin_profiles").select("id,email,is_super_admin,is_active,created_at").order("created_at", { ascending: true }),
        admin.from("admin_invitations").select("id,email,teacher_name,auth_user_id,status,expires_at,accepted_at,cancelled_at,created_at,updated_at").order("created_at", { ascending: false }),
      ]);
      if (profileError || invitationError) return json({ success: false, error: "Unable to load administrator records." }, 500);
      return json({ success: true, profiles: profiles || [], invitations: invitations || [] });
    }

    // 2. INVITE TEACHER ADMIN
    if (action === "invite") {
      const email = normalizeEmail(body.email);
      const teacherName = String(body.teacher_name || "").trim() || null;
      if (!isEmail(email)) return json({ success: false, error: "Enter a valid email address." }, 400);

      // Check if email belongs to Super Admin
      if (email === "muhammeddanish305@gmail.com") {
        return json({ success: false, error: "This email belongs to the Super Administrator." }, 409);
      }

      // Check if email belongs to an existing active administrator profile
      const { data: existingProfile } = await admin
        .from("admin_profiles")
        .select("id,email,is_super_admin,is_active")
        .ilike("email", email)
        .maybeSingle();

      if (existingProfile) {
        if (existingProfile.is_super_admin) {
          return json({ success: false, error: "This email belongs to the Super Administrator." }, 409);
        }
        if (existingProfile.is_active === true) {
          return json({ success: false, error: "This email already belongs to an active administrator." }, 409);
        }
        return json({ success: false, error: "This administrator account exists but is currently disabled. You can reactivate it in the list below." }, 409);
      }

      // Check if an invitation is currently pending
      const { data: pending } = await admin
        .from("admin_invitations")
        .select("id,auth_user_id,status,expires_at")
        .ilike("email", email)
        .eq("status", "pending")
        .maybeSingle();

      if (pending) {
        return json({ success: false, error: "An invitation is already pending for this email. You can resend it from the pending invitations list." }, 409);
      }

      // Check if an invitation was already accepted and completed
      const { data: acceptedInvite } = await admin
        .from("admin_invitations")
        .select("id")
        .ilike("email", email)
        .eq("status", "accepted")
        .maybeSingle();

      if (acceptedInvite) {
        return json({ success: false, error: "This email already belongs to an active administrator." }, 409);
      }

      // Look for any existing temporary Auth user or public.users record for this email
      let orphanUserId: string | null = null;
      const { data: existingUser } = await admin
        .from("users")
        .select("id,email,role")
        .ilike("email", email)
        .maybeSingle();

      if (existingUser) {
        orphanUserId = existingUser.id;
      }

      if (!orphanUserId) {
        for (let page = 1; page <= 5; page++) {
          const { data: paged } = await admin.auth.admin.listUsers({ page, perPage: 100 });
          const matched = paged?.users?.find((u) => normalizeEmail(u.email) === email);
          if (matched) {
            orphanUserId = matched.id;
            break;
          }
          if (!paged?.users || paged.users.length < 100) break;
        }
      }

      // Clean up orphaned temporary Auth user from previous tests/cancellations FIRST
      if (orphanUserId) {
        const { data: prof } = await admin
          .from("admin_profiles")
          .select("id,is_super_admin,is_active")
          .eq("id", orphanUserId)
          .maybeSingle();

        if (prof?.is_super_admin || email === "muhammeddanish305@gmail.com") {
          return json({ success: false, error: "This email belongs to the Super Administrator." }, 409);
        }
        if (prof?.is_active === true) {
          return json({ success: false, error: "This email already belongs to an active administrator." }, 409);
        }

        console.log(`[admin-teachers] Cleaning up leftover/orphaned temporary user: ${orphanUserId} (${email})`);
        await admin.auth.admin.deleteUser(orphanUserId).catch((err) => {
          console.warn("[admin-teachers] Notice while deleting orphan Auth user:", err?.message);
        });
        await admin.from("users").delete().eq("id", orphanUserId);
        await admin.from("admin_profiles").delete().eq("id", orphanUserId);
        await admin.from("admin_invitations").delete().ilike("email", email).neq("status", "accepted");
      }

      const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") || "https://jitsnotes.web.app/admin/invite";
      console.log(`[admin-teachers] Dispatching single inviteUserByEmail for ${email} with redirectTo=${redirectTo}`);

      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

      if (inviteError || !invited?.user) {
        console.error("[admin-teachers] Supabase inviteUserByEmail failed:", inviteError);
        const errMsg = String(inviteError?.message || "");
        if (/already.*registered|already.*exists/i.test(errMsg)) {
          return json({ success: false, error: "This email is already registered." }, 409);
        }
        if (/rate.*limit/i.test(errMsg)) {
          return json({ success: false, error: "Email rate limit exceeded. Please wait a moment before sending another invitation." }, 429);
        }
        if (/smtp|email.*provider|send.*email|transport/i.test(errMsg)) {
          return json({ success: false, error: `Invitation email could not be sent. Please check your Supabase Auth SMTP configuration (${errMsg}).` }, 502);
        }
        return json({ success: false, error: errMsg || "Unable to send the invitation email. Please check your Supabase Auth email settings." }, 502);
      }

      const { data: invitation, error: insertError } = await admin
        .from("admin_invitations")
        .insert({
          email,
          teacher_name: teacherName,
          auth_user_id: invited.user.id,
          invited_by: user.id,
          status: "pending",
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[admin-teachers] Failed to insert invitation record:", insertError);
        return json({ success: false, error: "Invitation email was sent, but failed to create the record in the database." }, 500);
      }

      await writeActivity(admin, user.id, "teacher_invited", invitation.id, { email });
      return json({ success: true, invitation_id: invitation.id, message: "Invitation sent successfully." });
    }

    // 3. RESEND INVITATION
    if (action === "resend") {
      const email = normalizeEmail(body.email);
      if (!isEmail(email)) return json({ success: false, error: "Enter a valid email address." }, 400);

      const { data: pending } = await admin
        .from("admin_invitations")
        .select("id,email,teacher_name,auth_user_id,status,expires_at")
        .ilike("email", email)
        .eq("status", "pending")
        .maybeSingle();

      if (!pending) {
        return json({ success: false, error: "No pending invitation exists for this email." }, 404);
      }

      const redirectTo = Deno.env.get("INVITE_REDIRECT_URL") || "https://jitsnotes.web.app/admin/invite";
      console.log(`[admin-teachers] Resending invitation to ${email}`);

      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

      if (inviteError && !/already.*registered|already.*exists/i.test(String(inviteError.message || ""))) {
        console.error("[admin-teachers] Resend inviteUserByEmail failed:", inviteError);
        const errMsg = String(inviteError.message || "");
        if (/rate.*limit/i.test(errMsg)) {
          return json({ success: false, error: "Email rate limit exceeded. Please wait a moment before resending." }, 429);
        }
        return json({ success: false, error: errMsg || "Unable to resend the invitation email." }, 502);
      }

      const { error: updateError } = await admin
        .from("admin_invitations")
        .update({
          auth_user_id: invited?.user?.id || pending.auth_user_id,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", pending.id);

      if (updateError) {
        console.error("[admin-teachers] Failed to update pending invitation expiration:", updateError);
        return json({ success: false, error: "Failed to update invitation expiration date." }, 500);
      }

      await writeActivity(admin, user.id, "teacher_invitation_resent", pending.id, { email });
      return json({ success: true, invitation_id: pending.id, message: "Invitation resent successfully." });
    }

    // 4. CANCEL PENDING INVITATION
    if (action === "cancel") {
      const invitationId = String(body.invitation_id || body.invitationId || "").trim();
      if (!invitationId || !/^[0-9a-f-]{36}$/i.test(invitationId)) {
        return json({ success: false, error: "A valid invitation ID is required." }, 400);
      }

      const { data: invitation } = await admin
        .from("admin_invitations")
        .select("id,email,auth_user_id,status,expires_at")
        .eq("id", invitationId)
        .maybeSingle();

      if (!invitation) return json({ success: false, error: "Invitation not found." }, 404);

      if (invitation.status !== "pending") {
        return json({ success: false, error: "Only pending invitations can be cancelled." }, 409);
      }

      let targetAuthId = invitation.auth_user_id;
      const targetEmail = normalizeEmail(invitation.email);

      // If auth_user_id was null on the record, look up by email in Auth
      if (!targetAuthId) {
        for (let page = 1; page <= 5; page++) {
          const { data: paged } = await admin.auth.admin.listUsers({ page, perPage: 100 });
          const matched = paged?.users?.find((u) => normalizeEmail(u.email) === targetEmail);
          if (matched) {
            targetAuthId = matched.id;
            break;
          }
          if (!paged?.users || paged.users.length < 100) break;
        }
      }

      // Verify the target user is only a temporary invited user before deleting
      if (targetAuthId) {
        const { data: targetProfile } = await admin
          .from("admin_profiles")
          .select("id,email,is_super_admin,is_active")
          .eq("id", targetAuthId)
          .maybeSingle();

        if (targetProfile) {
          if (targetProfile.is_super_admin || targetEmail === "muhammeddanish305@gmail.com") {
            return json({ success: false, error: "The Super Administrator account is protected and cannot be cancelled." }, 403);
          }
          if (targetProfile.is_active === true) {
            return json({ success: false, error: "This email already belongs to an active administrator." }, 409);
          }
        }

        const { data: targetUser } = await admin
          .from("users")
          .select("id,email,role")
          .eq("id", targetAuthId)
          .maybeSingle();

        if (targetUser?.role === "admin" && targetProfile?.is_active === true) {
          return json({ success: false, error: "This email already belongs to an active administrator." }, 409);
        }

        // Verify this invitation was NOT accepted
        const { data: acceptedInvite } = await admin
          .from("admin_invitations")
          .select("id")
          .ilike("email", targetEmail)
          .eq("status", "accepted")
          .maybeSingle();

        if (acceptedInvite) {
          return json({ success: false, error: "This invitation was already accepted and cannot be cancelled." }, 409);
        }

        console.log(`[admin-teachers] Safely deleting temporary pending Auth user: ${targetAuthId} (${targetEmail})`);
        const { error: deleteAuthError } = await admin.auth.admin.deleteUser(targetAuthId);
        if (deleteAuthError && !/not.*found/i.test(String(deleteAuthError.message || ""))) {
          console.error("[admin-teachers] Failed to delete temporary Auth user:", deleteAuthError);
        }

        // Clean up public tables for this temporary user
        await Promise.all([
          admin.from("users").delete().eq("id", targetAuthId),
          admin.from("admin_profiles").delete().eq("id", targetAuthId),
        ]);
      }

      // Mark invitation as cancelled so the partial unique index is freed
      const { error: updateError } = await admin
        .from("admin_invitations")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invitationId);

      if (updateError) {
        console.error("[admin-teachers] Failed to update invitation to cancelled:", updateError);
        return json({ success: false, error: "Unable to cancel the invitation record." }, 500);
      }

      await writeActivity(admin, user.id, "teacher_invitation_cancelled", invitationId, { email: targetEmail });
      return json({ success: true, message: "Invitation cancelled successfully." });
    }

    // 5. ACTIVATE / DEACTIVATE ADMINISTRATOR
    if (action === "activate" || action === "deactivate") {
      const targetUserId = String(
        body.user_id ||
        body.target_user_id ||
        body.profile_id ||
        body.userId ||
        ""
      ).trim();

      if (!targetUserId || !/^[0-9a-f-]{36}$/i.test(targetUserId)) {
        return json({ success: false, error: "A valid administrator account is required." }, 400);
      }

      if (targetUserId === user.id) {
        return json({ success: false, error: "You cannot change the status of your own account." }, 400);
      }

      const { data: targetProfile } = await admin
        .from("admin_profiles")
        .select("id,email,is_super_admin")
        .eq("id", targetUserId)
        .maybeSingle();

      if (!targetProfile) {
        return json({ success: false, error: "Administrator account not found." }, 404);
      }

      if (targetProfile.is_super_admin || targetProfile.email === "muhammeddanish305@gmail.com") {
        return json({ success: false, error: "The Super Admin is protected and cannot be modified." }, 403);
      }

      const active = action === "activate";
      const [{ error: profileError }, { error: userError }] = await Promise.all([
        admin.from("admin_profiles").update({ is_active: active }).eq("id", targetUserId),
        admin.from("users").update({ role: active ? "admin" : "user" }).eq("id", targetUserId),
      ]);

      if (profileError || userError) return json({ success: false, error: "Unable to update administrator access." }, 500);

      await writeActivity(admin, user.id, active ? "admin_activated" : "admin_disabled", targetUserId, { email: targetProfile.email });
      return json({ success: true, message: active ? "Administrator enabled successfully." : "Administrator disabled successfully." });
    }

    // 6. CHANGE ROLE (SUPER ADMIN <-> TEACHER ADMIN)
    if (action === "change_role") {
      const targetUserId = String(
        body.user_id ||
        body.target_user_id ||
        body.profile_id ||
        body.userId ||
        ""
      ).trim();

      if (!targetUserId || !/^[0-9a-f-]{36}$/i.test(targetUserId)) {
        return json({ success: false, error: "A valid administrator account is required." }, 400);
      }

      if (targetUserId === user.id) {
        return json({ success: false, error: "You cannot change the role of your own Super Admin account." }, 400);
      }

      const { data: targetProfile } = await admin
        .from("admin_profiles")
        .select("id,email,is_super_admin")
        .eq("id", targetUserId)
        .maybeSingle();

      if (!targetProfile) return json({ success: false, error: "Administrator record not found." }, 404);

      if (targetProfile.email === "muhammeddanish305@gmail.com") {
        return json({ success: false, error: "The primary Super Admin account is protected." }, 403);
      }

      const makeSuper = Boolean(body.is_super_admin);
      const { error: updateError } = await admin
        .from("admin_profiles")
        .update({ is_super_admin: makeSuper })
        .eq("id", targetUserId);

      if (updateError) return json({ success: false, error: "Unable to update administrator role." }, 500);

      await writeActivity(admin, user.id, "admin_role_changed", targetUserId, {
        email: targetProfile.email,
        new_role: makeSuper ? "super_admin" : "teacher_admin",
      });
      return json({ success: true, is_super_admin: makeSuper, message: "Role updated successfully." });
    }

    // 7. REMOVE TEACHER ADMIN (REVOKE ACCESS SAFELY)
    if (action === "remove") {
      const targetUserId = String(
        body.user_id ||
        body.target_user_id ||
        body.userId ||
        body.profile_id ||
        ""
      ).trim();

      // Validate target UUID format
      if (!targetUserId || !/^[0-9a-f-]{36}$/i.test(targetUserId)) {
        return json({ success: false, error: "A valid teacher user ID is required." }, 400);
      }

      // Prevent removing Super Admin's own account
      if (targetUserId === user.id) {
        return json({ success: false, error: "You cannot remove your own administrator account." }, 400);
      }

      // Query target profile
      const { data: targetProfile, error: profileErr } = await admin
        .from("admin_profiles")
        .select("id,email,is_super_admin,is_active")
        .eq("id", targetUserId)
        .maybeSingle();

      if (profileErr) {
        console.error("[admin-teachers] Error fetching target profile:", profileErr);
        return json({ success: false, error: "Unable to verify administrator record." }, 500);
      }

      // Check if profile exists
      if (!targetProfile) {
        // Idempotency check: see if invitation still exists
        const { data: targetInvite } = await admin
          .from("admin_invitations")
          .select("id,email,auth_user_id")
          .eq("auth_user_id", targetUserId)
          .maybeSingle();

        if (targetInvite) {
          await admin.from("admin_invitations").delete().eq("id", targetInvite.id);
          await admin.from("users").update({ role: "user" }).eq("id", targetUserId);
          await writeActivity(admin, user.id, "teacher_admin_removed", targetUserId, { email: targetInvite.email });
          return json({ success: true, message: "Teacher Admin removed successfully." });
        }

        return json({ success: false, error: "Teacher Admin not found or already removed." }, 404);
      }

      // Prevent removing Super Admin
      if (targetProfile.is_super_admin || targetProfile.email === "muhammeddanish305@gmail.com") {
        return json({ success: false, error: "Super Administrator accounts cannot be removed." }, 403);
      }

      const targetEmail = targetProfile.email || "";

      // Revoke Teacher Admin privileges:
      // a) Remove admin_profile record
      // b) Demote role to 'user' in public.users mirror table
      // c) Clean up any associated admin_invitations records for this user/email
      const [delProfileRes, updateUserRes] = await Promise.all([
        admin.from("admin_profiles").delete().eq("id", targetUserId),
        admin.from("users").update({ role: "user" }).eq("id", targetUserId),
        admin.from("admin_invitations").delete().or(`auth_user_id.eq.${targetUserId},email.ilike.${targetEmail}`),
      ]);

      if (delProfileRes.error) {
        console.error("[admin-teachers] Failed to delete admin profile:", delProfileRes.error);
        return json({ success: false, error: "Unable to remove Teacher Admin. Please try again." }, 500);
      }

      if (updateUserRes.error) {
        console.warn("[admin-teachers] Notice while updating users role:", updateUserRes.error.message);
      }

      // Write audit log
      await writeActivity(admin, user.id, "teacher_admin_removed", targetUserId, { email: targetEmail });

      return json({
        success: true,
        message: "Teacher Admin removed successfully."
      });
    }

    // 8. CLEANUP ORPHANED INVITE
    if (action === "cleanup_orphaned_invite") {
      const email = normalizeEmail(body.email);
      if (!isEmail(email)) return json({ success: false, error: "Enter a valid email address." }, 400);

      // Verify not Super Admin or active administrator
      if (email === "muhammeddanish305@gmail.com") {
        return json({ success: false, error: "The Super Administrator is protected." }, 403);
      }

      const { data: prof } = await admin.from("admin_profiles").select("id,is_super_admin,is_active").ilike("email", email).maybeSingle();
      if (prof?.is_super_admin) return json({ success: false, error: "The Super Administrator is protected." }, 403);
      if (prof?.is_active === true) return json({ success: false, error: "This email belongs to an active administrator." }, 409);

      const { data: accepted } = await admin.from("admin_invitations").select("id").ilike("email", email).eq("status", "accepted").maybeSingle();
      if (accepted) return json({ success: false, error: "This administrator account is active." }, 409);

      // Look up Auth user across pages
      let cleanedId: string | null = null;
      for (let page = 1; page <= 10; page++) {
        const { data: paged } = await admin.auth.admin.listUsers({ page, perPage: 100 });
        const matched = paged?.users?.find((u) => normalizeEmail(u.email) === email);
        if (matched) {
          cleanedId = matched.id;
          await admin.auth.admin.deleteUser(matched.id).catch(() => {});
          await admin.from("users").delete().eq("id", matched.id);
          await admin.from("admin_profiles").delete().eq("id", matched.id);
          break;
        }
        if (!paged?.users || paged.users.length < 100) break;
      }

      // Also clean up public tables if matched by email
      const { data: pubUser } = await admin.from("users").select("id").ilike("email", email).maybeSingle();
      if (pubUser) {
        cleanedId = cleanedId || pubUser.id;
        await admin.auth.admin.deleteUser(pubUser.id).catch(() => {});
        await admin.from("users").delete().eq("id", pubUser.id);
        await admin.from("admin_profiles").delete().eq("id", pubUser.id);
      }

      await admin.from("admin_invitations").delete().ilike("email", email).neq("status", "accepted");
      await writeActivity(admin, user.id, "orphan_invite_cleaned", cleanedId, { email });
      return json({ success: true, cleaned: Boolean(cleanedId), message: "Orphaned invitation cleaned up." });
    }

    return json({ success: false, error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("[admin-teachers] Unhandled exception:", error);
    return json({ success: false, error: "Unable to complete administrator operation." }, 500);
  }
});
