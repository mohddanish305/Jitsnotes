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

const isSafeObjectKey = (value: string) =>
  Boolean(value) && !value.includes("..") && !value.includes("\\") && !value.startsWith("/") && !value.includes("\0");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed. Use POST." }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const documentId = typeof body.document_id === "string" ? body.document_id.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(documentId)) return json({ error: "A valid document_id is required." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) return json({ error: "Storage service temporarily unavailable." }, 503);
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: doc, error: dbError } = await admin
      .from("documents")
      .select("id,storage_object_key,is_active,storage_provider")
      .eq("id", documentId)
      .maybeSingle();
    if (dbError || !doc) return json({ error: "Document not found." }, 404);
    if (!doc.is_active) {
      const authHeader = req.headers.get("authorization") || "";
      let isCallerAdmin = false;
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7).trim();
        const { data: authData } = await admin.auth.getUser(token);
        if (authData?.user) {
          const [{ data: userProfile }, { data: adminProfile }] = await Promise.all([
            admin.from("users").select("role").eq("id", authData.user.id).maybeSingle(),
            admin.from("admin_profiles").select("id,is_active").eq("id", authData.user.id).maybeSingle(),
          ]);
          if (userProfile?.role === "admin" || (adminProfile?.id && adminProfile?.is_active !== false)) {
            isCallerAdmin = true;
          }
        }
      }
      if (!isCallerAdmin) {
        return json({ error: "Document is inactive or restricted." }, 403);
      }
    }
    if (doc.storage_provider !== "b2") return json({ error: "Document is not hosted on B2 storage." }, 400);
    if (!isSafeObjectKey(doc.storage_object_key)) return json({ error: "Invalid storage key registered for document." }, 400);

    const keyId = (Deno.env.get("B2_KEY_ID") || Deno.env.get("B2_APPLICATION_KEY_ID") || "").trim();
    const applicationKey = (Deno.env.get("B2_APPLICATION_KEY") || "").trim();
    let bucketName = (Deno.env.get("B2_BUCKET_NAME") || "jitsnotes-pdfs").trim();
    let bucketId = (Deno.env.get("B2_BUCKET_ID") || "").trim();
    if (!keyId || !applicationKey) return json({ error: "Storage service temporarily unavailable." }, 503);

    const authResponse = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      headers: { Authorization: `Basic ${btoa(`${keyId}:${applicationKey}`)}` },
    });
    if (!authResponse.ok) return json({ error: "Storage service temporarily unavailable." }, 502);
    const auth = await authResponse.json();

    if (auth.allowed?.bucketName) {
      bucketName = auth.allowed.bucketName;
    }
    if (!bucketId && auth.allowed?.bucketId) {
      bucketId = auth.allowed.bucketId;
    }
    if (!bucketId && bucketName) {
      const bucketsResp = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
        method: "POST",
        headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: auth.accountId, bucketName }),
      });
      if (bucketsResp.ok) {
        const bucketsData = await bucketsResp.json();
        bucketId = bucketsData.buckets?.[0]?.bucketId || "";
      }
    }
    if (!bucketId) return json({ error: "Storage service temporarily unavailable." }, 503);

    const authorizationResponse = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
      method: "POST",
      headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
      body: JSON.stringify({ bucketId, fileNamePrefix: doc.storage_object_key, validDurationInSeconds: 900 }),
    });
    if (!authorizationResponse.ok) return json({ error: "Unable to generate download authorization." }, 502);
    const downloadAuthorization = await authorizationResponse.json();
    const encodedKey = encodeURIComponent(doc.storage_object_key).replace(/%2F/g, "/");
    const downloadUrl = `${auth.downloadUrl}/file/${bucketName}/${encodedKey}?Authorization=${downloadAuthorization.authorizationToken}`;

    return json({
      download_url: downloadUrl,
      expires_at: new Date(Date.now() + 900000).toISOString(),
      provider: "b2",
    });
  } catch (_error) {
    return json({ error: "Internal server error." }, 500);
  }
});
