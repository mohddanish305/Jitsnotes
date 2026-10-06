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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  console.log("[accept-teacher-admin] started");

  try {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      console.error("[accept-teacher-admin] ERROR: Missing or invalid authorization header");
      return json({ error: "Authentication is required to process this invitation.", code: "UNAUTHORIZED" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      console.error("[accept-teacher-admin] ERROR: Server configuration missing");
      return json({ error: "Server configuration missing.", code: "CONFIG_ERROR" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const token = authorization.slice(7);
    const { data: authData, error: authError } = await admin.auth.getUser(token);

    if (authError || !authData.user?.email) {
      console.error("[accept-teacher-admin] ERROR: User verification failed", authError?.message);
      return json({ error: "Your invitation session has expired.", code: "AUTH_FAILED" }, 401);
    }

    const authenticatedUser = authData.user;
    console.log("[accept-teacher-admin] authenticated user:", authenticatedUser.id);
    console.log("[accept-teacher-admin] authenticated email:", authenticatedUser.email);

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is acceptable
    }

    const action = String(body.action || "activate");
    const requestedInvitationId = (body.invitation_id as string) || (body.invitationId as string) || null;

    // 1. Invitation lookup
    console.log("[accept-teacher-admin] invitation lookup started");
    let invitation: any = null;

    // Strategy A: Lookup by explicit invitation_id UUID
    if (requestedInvitationId && typeof requestedInvitationId === "string" && requestedInvitationId.trim().length > 0) {
      const cleanId = requestedInvitationId.trim();
      const { data: invById, error: idErr } = await admin
        .from("admin_invitations")
        .select("id,email,teacher_name,auth_user_id,status,expires_at")
        .eq("id", cleanId)
        .maybeSingle();

      if (invById) {
        invitation = invById;
        console.log("[accept-teacher-admin] invitation found by invitation_id:", invitation.id);
      } else if (idErr) {
        console.warn("[accept-teacher-admin] Notice on ID lookup:", idErr.message);
      }
    }

    // Strategy B: Lookup by auth_user_id
    if (!invitation) {
      const { data: invByAuth, error: authErr } = await admin
        .from("admin_invitations")
        .select("id,email,teacher_name,auth_user_id,status,expires_at")
        .eq("auth_user_id", authenticatedUser.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (invByAuth) {
        invitation = invByAuth;
        console.log("[accept-teacher-admin] invitation found by auth_user_id:", invitation.id);
      } else if (authErr) {
        console.warn("[accept-teacher-admin] Notice on auth_user_id lookup:", authErr.message);
      }
    }

    // Strategy C: Lookup by email match
    if (!invitation && authenticatedUser.email) {
      const { data: invByEmail, error: emailErr } = await admin
        .from("admin_invitations")
        .select("id,email,teacher_name,auth_user_id,status,expires_at")
        .ilike("email", authenticatedUser.email.trim())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (invByEmail) {
        invitation = invByEmail;
        console.log("[accept-teacher-admin] invitation found by email:", invitation.id);
      } else if (emailErr) {
        console.warn("[accept-teacher-admin] Notice on email lookup:", emailErr.message);
      }
    }

    if (!invitation) {
      // Check if user already has an active Teacher Admin profile
      const { data: profile } = await admin
        .from("admin_profiles")
        .select("id,is_active,is_super_admin")
        .eq("id", authenticatedUser.id)
        .maybeSingle();

      if (profile?.is_active) {
        console.log("[accept-teacher-admin] User already has active admin profile, returning idempotent success");
        return json({
          success: true,
          status: "active",
          role: "teacher_admin",
          message: "Account already active.",
        });
      }

      console.error("[accept-teacher-admin] ERROR: No invitation found for user");
      return json({ error: "This invitation is invalid or has already been used.", code: "NOT_FOUND" }, 404);
    }

    console.log("[accept-teacher-admin] invitation found");
    console.log("[accept-teacher-admin] invitation id:", invitation.id);
    console.log("[accept-teacher-admin] invitation status:", invitation.status);
    console.log("[accept-teacher-admin] invitation auth_user_id:", invitation.auth_user_id);
    console.log("[accept-teacher-admin] invitation role: Teacher Admin");

    // 2. Identity Verification
    console.log("[accept-teacher-admin] identity verification started");

    if (invitation.email && authenticatedUser.email) {
      if (invitation.email.toLowerCase().trim() !== authenticatedUser.email.toLowerCase().trim()) {
        console.error("[accept-teacher-admin] ERROR: Email mismatch", {
          invitationEmail: invitation.email,
          authEmail: authenticatedUser.email,
        });
        return json({ error: "This invitation does not belong to this account.", code: "USER_MISMATCH" }, 403);
      }
    }

    if (invitation.auth_user_id && invitation.auth_user_id !== authenticatedUser.id) {
      console.error("[accept-teacher-admin] ERROR: auth_user_id mismatch", {
        invitationAuthUser: invitation.auth_user_id,
        authUserId: authenticatedUser.id,
      });
      return json({ error: "This invitation does not belong to this account.", code: "USER_MISMATCH" }, 403);
    }

    // Bind auth_user_id if not yet set
    if (!invitation.auth_user_id) {
      await admin
        .from("admin_invitations")
        .update({ auth_user_id: authenticatedUser.id, updated_at: new Date().toISOString() })
        .eq("id", invitation.id);
      invitation.auth_user_id = authenticatedUser.id;
    }

    console.log("[accept-teacher-admin] identity verification successful");

    // 3. Status checks
    if (invitation.status === "cancelled") {
      console.error("[accept-teacher-admin] ERROR: Invitation cancelled");
      return json({ error: "This invitation was cancelled by the administrator.", code: "CANCELLED" }, 400);
    }

    // IDEMPOTENT HANDLING: If already accepted or active, return success safely with real UUID
    if (invitation.status === "accepted" || invitation.status === "active") {
      console.log("[accept-teacher-admin] Invitation is already accepted/active, returning idempotent success");
      const { data: existingProf } = await admin
        .from("admin_profiles")
        .select("id,is_active,is_super_admin")
        .eq("id", authenticatedUser.id)
        .maybeSingle();

      if (!existingProf || !existingProf.is_active) {
        await admin.from("admin_profiles").upsert(
          {
            id: authenticatedUser.id,
            email: authenticatedUser.email,
            is_super_admin: existingProf?.is_super_admin ?? false,
            is_active: true,
          },
          { onConflict: "id" }
        );
        await admin.from("users").upsert(
          {
            id: authenticatedUser.id,
            email: authenticatedUser.email,
            role: "admin",
          },
          { onConflict: "id" }
        );
      }

      return json({
        success: true,
        valid: true,
        invitation_id: invitation.id,
        auth_user_id: authenticatedUser.id,
        email: invitation.email,
        teacher_name: invitation.teacher_name || "",
        status: "active",
        role: "teacher_admin",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          teacher_name: invitation.teacher_name || "",
          role: "Teacher Admin",
          status: "active",
        },
        message: "Teacher Admin account is active.",
      });
    }

    // 4. Expiration check
    if (invitation.expires_at && new Date(invitation.expires_at).getTime() <= Date.now()) {
      console.error("[accept-teacher-admin] ERROR: Invitation expired");
      await admin
        .from("admin_invitations")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", invitation.id);
      return json({ error: "This invitation has expired. Please ask the administrator to send a new invitation.", code: "EXPIRED" }, 410);
    }

    // 5. Verification only request (Returns full metadata with invitation_id UUID)
    if (action === "verify") {
      return json({
        success: true,
        valid: true,
        invitation_id: invitation.id,
        auth_user_id: authenticatedUser.id,
        email: invitation.email,
        teacher_name: invitation.teacher_name || "",
        role: "teacher_admin",
        status: invitation.status,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          teacher_name: invitation.teacher_name || "",
          role: "Teacher Admin",
          status: invitation.status,
        },
      });
    }

    // 6. Role activation
    console.log("[accept-teacher-admin] role activation started");

    const { data: existingProfile } = await admin
      .from("admin_profiles")
      .select("id,is_super_admin,is_active")
      .eq("id", authenticatedUser.id)
      .maybeSingle();

    console.log("[accept-teacher-admin] existing admin profile checked");

    const isSuperAdmin = existingProfile?.is_super_admin ?? false;

    // Upsert admin profile as Teacher Admin (is_super_admin: false, unless already super admin)
    const { error: profileError } = await admin.from("admin_profiles").upsert(
      {
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        is_super_admin: isSuperAdmin,
        is_active: true,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.error("[accept-teacher-admin] ERROR: profile upsert failed", profileError.message);
      return json({ error: "Failed to activate administrator profile.", code: "PROFILE_ERROR" }, 500);
    }

    // Upsert public.users table with role admin
    const { error: userError } = await admin.from("users").upsert(
      {
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        role: "admin",
      },
      { onConflict: "id" }
    );

    if (userError) {
      console.error("[accept-teacher-admin] ERROR: users upsert failed", userError.message);
      return json({ error: "Failed to sync user role.", code: "USER_SYNC_ERROR" }, 500);
    }

    console.log("[accept-teacher-admin] role/profile activation successful");

    // 7. Update invitation status to 'accepted'
    console.log("[accept-teacher-admin] invitation update started");

    const { error: invitationError } = await admin
      .from("admin_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        auth_user_id: authenticatedUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (invitationError) {
      console.warn("[accept-teacher-admin] Notice updating invitation record:", invitationError.message);
    } else {
      console.log("[accept-teacher-admin] invitation update successful");
    }

    // 8. Safely log admin activity
    try {
      await admin.from("admin_activity").insert({
        actor_id: authenticatedUser.id,
        action: "teacher_activated",
        resource_type: "admin_invitation",
        resource_id: invitation.id,
        metadata: {
          email: authenticatedUser.email,
          teacher_name: invitation.teacher_name || null,
        },
      });
    } catch (actErr) {
      console.warn("[accept-teacher-admin] Notice writing activity log:", (actErr as Error)?.message);
    }

    console.log("[accept-teacher-admin] completed successfully");

    return json({
      success: true,
      status: "active",
      role: "teacher_admin",
      invitation_id: invitation.id,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        teacher_name: invitation.teacher_name || "",
        role: "Teacher Admin",
        status: "accepted",
      },
      message: "Teacher Admin account activated successfully.",
    });
  } catch (err) {
    const errorObj = err as Error;
    console.error("[accept-teacher-admin] ERROR: Unexpected exception", errorObj?.message);
    return json({ error: "Unable to activate the Teacher Admin account.", details: errorObj?.message }, 500);
  }
});
