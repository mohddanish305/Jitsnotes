import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Authentication is required to accept this invitation." }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const admin = createClient(supabaseUrl, serviceKey);
    const { data, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !data.user?.email) return json({ error: "Authentication is required to accept this invitation." }, 401);
    if (!data.user.email_confirmed_at) return json({ error: "Verify your email before accepting this invitation." }, 403);

    const { data: invitation } = await admin.from("admin_invitations").select("id,email,auth_user_id,status,expires_at").eq("auth_user_id", data.user.id).eq("status", "pending").maybeSingle();
    if (!invitation || invitation.email.toLowerCase() !== data.user.email.toLowerCase()) return json({ error: "This invitation is invalid or has already been used." }, 404);
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      await admin.from("admin_invitations").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", invitation.id);
      return json({ error: "This invitation has expired." }, 410);
    }

    const { error: profileError } = await admin.from("admin_profiles").upsert({ id: data.user.id, email: data.user.email, is_super_admin: false, is_active: true }, { onConflict: "id" });
    const { error: userError } = await admin.from("users").upsert({ id: data.user.id, email: data.user.email, role: "admin" }, { onConflict: "id" });
    if (profileError || userError) return json({ error: "Unable to activate the teacher account." }, 500);
    const { error: invitationError } = await admin.from("admin_invitations").update({ status: "accepted", accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", invitation.id);
    if (invitationError) return json({ error: "Teacher activated, but invitation status could not be updated." }, 500);
    await admin.from("admin_activity").insert({ actor_id: data.user.id, action: "teacher_activated", resource_type: "admin_invitation", resource_id: invitation.id, metadata: { email: data.user.email } });
    return json({ success: true });
  } catch (_error) {
    return json({ error: "Unable to accept the invitation." }, 500);
  }
});
