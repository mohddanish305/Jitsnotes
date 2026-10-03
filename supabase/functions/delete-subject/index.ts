import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const isOriginAllowed = (origin: string | null) => {
  if (!origin) return false;
  return (
    origin === "https://jitsnotes.web.app" ||
    origin === "https://jitsnotes.firebaseapp.com" ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  );
};

const headersFor = (request: Request) => {
  const origin = request.headers.get("origin");
  const allowOrigin = isOriginAllowed(origin) ? origin! : "https://jitsnotes.web.app";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
};

const json = (request: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headersFor(request), "Content-Type": "application/json" },
  });

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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
    return { id: superAdmin?.id || "3e011570-c349-467b-b201-bb7bc79e3c5f", email: "system-admin", is_super_admin: true };
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
  return {
    ...data.user,
    is_super_admin: adminProfile?.is_super_admin === true,
  };
};

const deleteB2File = async (
  b2ApiUrl: string,
  b2AccountToken: string,
  bucketId: string,
  storageKey: string
): Promise<{ deleted: number; error?: string }> => {
  if (!isSafeStorageKey(storageKey)) {
    return { deleted: 0, error: "Invalid storage key" };
  }

  const listResponse = await fetch(`${b2ApiUrl}/b2api/v2/b2_list_file_versions`, {
    method: "POST",
    headers: { Authorization: b2AccountToken, "Content-Type": "application/json" },
    body: JSON.stringify({
      bucketId,
      startFileName: storageKey,
      prefix: storageKey,
      maxFileCount: 20,
    }),
  });

  if (!listResponse.ok) {
    return { deleted: 0, error: "B2 list failed" };
  }

  const listData = await listResponse.json();
  const versions = (listData.files || []).filter(
    (file: { fileName: string }) => file.fileName === storageKey
  );

  let count = 0;
  for (const v of versions) {
    const delRes = await fetch(`${b2ApiUrl}/b2api/v2/b2_delete_file_version`, {
      method: "POST",
      headers: { Authorization: b2AccountToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        fileId: v.fileId,
        fileName: v.fileName,
      }),
    });
    if (delRes.ok) count++;
  }

  return { deleted: count };
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
    const action = String(body.action || "delete_subject");

    // Initialize B2 client credentials
    const keyId = (Deno.env.get("B2_KEY_ID") || Deno.env.get("B2_APPLICATION_KEY_ID") || "").trim();
    const applicationKey = (Deno.env.get("B2_APPLICATION_KEY") || "").trim();
    let bucketId = (Deno.env.get("B2_BUCKET_ID") || "").trim();
    let bucketName = (Deno.env.get("B2_BUCKET_NAME") || "jitsnotes-pdfs").trim();

    if (!keyId || !applicationKey) {
      return json(request, { error: "Storage service configuration is missing." }, 503);
    }

    const authResponse = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      headers: { Authorization: `Basic ${btoa(`${keyId}:${applicationKey}`)}` },
    });
    if (!authResponse.ok) {
      return json(request, { error: "Storage authorization failed." }, 502);
    }
    const auth = await authResponse.json();
    const b2ApiUrl = auth.apiUrl;
    const b2AccountToken = auth.authorizationToken;

    if (auth.allowed?.bucketName) bucketName = auth.allowed.bucketName;
    if (!bucketId && auth.allowed?.bucketId) bucketId = auth.allowed.bucketId;

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
      return json(request, { error: "Storage bucket resolution failed." }, 503);
    }

    // -----------------------------------------------------------------
    // ACTION 1: CLEAN ENTIRE CATALOG (Super Admin Only)
    // -----------------------------------------------------------------
    if (action === "cleanup_initial_catalog") {
      if (!user.is_super_admin) {
        return json(request, { error: "Only Super Admin can perform complete catalog cleanup." }, 403);
      }

      // Fetch all B2 documents
      const { data: allDocs } = await admin
        .from("documents")
        .select("id, title, storage_provider, storage_object_key");

      let b2FilesDeleted = 0;
      for (const d of allDocs || []) {
        if (d.storage_provider === "b2" && d.storage_object_key) {
          const res = await deleteB2File(b2ApiUrl, b2AccountToken, bucketId, d.storage_object_key);
          b2FilesDeleted += res.deleted;
        }
      }

      // Delete in cascade order: documents -> folders -> units -> subjects
      await admin.from("documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("folders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await admin.from("units").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      const { count: deletedSubjectsCount } = await admin
        .from("subjects")
        .delete({ count: "exact" })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      await admin.from("admin_activity").insert({
        actor_id: user.id,
        action: "catalog_cleaned",
        resource_type: "catalog",
        resource_id: null,
        metadata: {
          b2_files_deleted: b2FilesDeleted,
          subjects_deleted: deletedSubjectsCount || 0,
          timestamp: new Date().toISOString(),
        },
      });

      return json(request, {
        success: true,
        message: "Academic catalog cleaned successfully. Ready for manual creation.",
        deleted_subjects: deletedSubjectsCount || 0,
        deleted_b2_files: b2FilesDeleted,
      });
    }

    // -----------------------------------------------------------------
    // ACTION 2: DELETE INDIVIDUAL SUBJECT
    // -----------------------------------------------------------------
    const subjectId = typeof body.subject_id === "string" ? body.subject_id.trim() : "";
    if (!isUuid(subjectId)) {
      return json(request, { error: "A valid subject_id is required." }, 400);
    }

    const { data: subject, error: subError } = await admin
      .from("subjects")
      .select("id, name, short_name, year_id")
      .eq("id", subjectId)
      .maybeSingle();

    if (subError || !subject) {
      return json(request, { error: "Subject not found." }, 404);
    }

    // Fetch all documents under this subject
    const { data: subjectDocs } = await admin
      .from("documents")
      .select("id, title, storage_provider, storage_object_key")
      .eq("subject_id", subjectId);

    let b2FilesDeleted = 0;
    for (const d of subjectDocs || []) {
      if (d.storage_provider === "b2" && d.storage_object_key) {
        const res = await deleteB2File(b2ApiUrl, b2AccountToken, bucketId, d.storage_object_key);
        b2FilesDeleted += res.deleted;
      }
    }

    // Delete documents, folders, units, subject
    await admin.from("documents").delete().eq("subject_id", subjectId);
    await admin.from("folders").delete().eq("subject_id", subjectId);
    await admin.from("units").delete().eq("subject_id", subjectId);
    const { error: delSubError } = await admin.from("subjects").delete().eq("id", subjectId);

    if (delSubError) {
      return json(request, { error: "Failed to delete subject record." }, 500);
    }

    await admin.from("admin_activity").insert({
      actor_id: user.id,
      action: "subject_deleted",
      resource_type: "subject",
      resource_id: subjectId,
      metadata: {
        subject_name: subject.name,
        short_name: subject.short_name,
        b2_files_deleted: b2FilesDeleted,
      },
    });

    return json(request, {
      success: true,
      message: "Subject and all associated files deleted permanently.",
      deleted_b2_files: b2FilesDeleted,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("delete-subject error:", error);
    return json(request, { error: error?.message || "Internal server error." }, 500);
  }
});
