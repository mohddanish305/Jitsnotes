import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const allowedOrigins = (Deno.env.get("ADMIN_ALLOWED_ORIGINS") || "")
  .split(",")
  .map((origin: string) => origin.trim())
  .filter(Boolean);

const headersFor = (request: Request) => {
  const origin = request.headers.get("origin") || "";
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins.length ? "null" : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

const json = (request: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headersFor(request), "Content-Type": "application/json" },
  });

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);
const isSafeStorageKey = (value: string) =>
  Boolean(value) &&
  !value.includes("..") &&
  !value.includes("\\") &&
  !value.startsWith("/") &&
  !value.includes("\0");

const getAdminUser = async (request: Request, admin: ReturnType<typeof createClient>) => {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;

  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (serviceKey && token === serviceKey) {
    const { data: superAdmin } = await admin
      .from("admin_profiles")
      .select("id")
      .eq("is_super_admin", true)
      .limit(1)
      .maybeSingle();
    return { id: superAdmin?.id || "3e011570-c349-467b-b201-bb7bc79e3c5f", email: "system-admin" };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;

  const [{ data: userProfile }, { data: adminProfile }] = await Promise.all([
    admin.from("users").select("role").eq("id", data.user.id).maybeSingle(),
    admin.from("admin_profiles").select("id,is_super_admin,is_active").eq("id", data.user.id).maybeSingle(),
  ]);

  if (userProfile?.role !== "admin" && (!adminProfile?.id || adminProfile?.is_active === false)) {
    return null;
  }
  return data.user;
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headersFor(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed. Use POST." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const admin = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;
  if (!admin) return json(request, { error: "Service temporarily unavailable." }, 503);

  const user = await getAdminUser(request, admin);
  if (!user) return json(request, { error: "Admin access required." }, 403);

  try {
    const body = await request.json().catch(() => ({}));
    const documentId = typeof body.document_id === "string" ? body.document_id.trim() : "";

    if (!isUuid(documentId)) {
      return json(request, { error: "A valid document_id is required." }, 400);
    }

    // Load document details using service role
    const { data: doc, error: fetchError } = await admin
      .from("documents")
      .select("id,title,subject_id,folder_id,unit_id,category_id,storage_provider,storage_object_key,file_size")
      .eq("id", documentId)
      .maybeSingle();

    if (fetchError || !doc) {
      return json(request, { error: "Document not found." }, 404);
    }

    // Backblaze B2 is the only authorized document storage provider
    if (doc.storage_provider !== "b2") {
      return json(
        request,
        { error: "Only Backblaze B2 documents can be deleted via this service." },
        400
      );
    }

    if (!isSafeStorageKey(doc.storage_object_key)) {
      return json(request, { error: "Invalid storage key registered for document." }, 400);
    }

    // Backblaze B2 credentials
    const keyId = (Deno.env.get("B2_KEY_ID") || Deno.env.get("B2_APPLICATION_KEY_ID") || "").trim();
    const applicationKey = (Deno.env.get("B2_APPLICATION_KEY") || "").trim();
    let bucketId = (Deno.env.get("B2_BUCKET_ID") || "").trim();
    let bucketName = (Deno.env.get("B2_BUCKET_NAME") || "jitsnotes-pdfs").trim();

    if (!keyId || !applicationKey) {
      return json(request, { error: "Storage service configuration is missing." }, 503);
    }

    // Authorize with B2
    const authResponse = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      headers: { Authorization: `Basic ${btoa(`${keyId}:${applicationKey}`)}` },
    });
    if (!authResponse.ok) {
      return json(request, { error: "Storage service temporarily unavailable." }, 502);
    }
    const auth = await authResponse.json();
    const b2ApiUrl = auth.apiUrl;
    const b2AccountToken = auth.authorizationToken;

    if (auth.allowed?.bucketName) {
      bucketName = auth.allowed.bucketName;
    }
    if (!bucketId && auth.allowed?.bucketId) {
      bucketId = auth.allowed.bucketId;
    }
    if (!bucketId && bucketName) {
      const bucketsResp = await fetch(`${b2ApiUrl}/b2api/v2/b2_list_buckets`, {
        method: "POST",
        headers: { Authorization: b2AccountToken, "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: auth.accountId, bucketName }),
      });
      if (bucketsResp.ok) {
        const bucketsData = await bucketsResp.json();
        bucketId = bucketsData.buckets?.[0]?.bucketId || "";
      }
    }

    if (!bucketId) {
      return json(request, { error: "Storage bucket could not be resolved." }, 503);
    }

    // List file versions matching the storage object key
    const listResponse = await fetch(`${b2ApiUrl}/b2api/v2/b2_list_file_versions`, {
      method: "POST",
      headers: { Authorization: b2AccountToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        bucketId,
        startFileName: doc.storage_object_key,
        prefix: doc.storage_object_key,
        maxFileCount: 10,
      }),
    });

    if (!listResponse.ok) {
      return json(request, { error: "Unable to verify storage files for deletion." }, 502);
    }

    const listData = await listResponse.json();
    const filesToDelete = (listData.files || []).filter(
      (file: { fileName: string }) => file.fileName === doc.storage_object_key
    );

    // Delete each version found in B2
    for (const file of filesToDelete) {
      const deleteResponse = await fetch(`${b2ApiUrl}/b2api/v2/b2_delete_file_version`, {
        method: "POST",
        headers: { Authorization: b2AccountToken, "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: file.fileId,
          fileName: file.fileName,
        }),
      });

      if (!deleteResponse.ok) {
        console.error("B2 file version deletion failed", { fileId: file.fileId, fileName: file.fileName });
        return json(
          request,
          { error: "Failed to remove PDF from storage. Document was not deleted." },
          502
        );
      }
    }

    // Remove document record from database
    const { error: dbDeleteError } = await admin.from("documents").delete().eq("id", documentId);

    if (dbDeleteError) {
      console.error("Database document deletion failed after storage deletion:", dbDeleteError);
      // Fallback: disable document so it doesn't appear in public views
      await admin.from("documents").update({ is_active: false }).eq("id", documentId);
      return json(
        request,
        { error: "PDF was deleted from storage, but database record removal failed. The document has been disabled." },
        500
      );
    }

    // Record admin_activity audit log
    const { error: activityError } = await admin.from("admin_activity").insert({
      actor_id: user.id,
      action: "document_deleted",
      resource_type: "document",
      resource_id: documentId,
      metadata: {
        title: doc.title,
        subject_id: doc.subject_id,
        folder_id: doc.folder_id || doc.unit_id || null,
        unit_id: doc.unit_id || null,
        category_id: doc.category_id,
        storage_provider: doc.storage_provider,
        file_size: doc.file_size,
      },
    });

    if (activityError) {
      console.error("Admin activity logging failed for document_deleted:", activityError.message);
    }

    return json(request, { success: true, message: "Document and storage file deleted successfully." });
  } catch (error) {
    console.error("Delete document workflow error:", error);
    return json(request, { error: "Unable to complete document deletion." }, 500);
  }
});
