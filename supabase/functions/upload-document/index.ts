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
  new Response(JSON.stringify(body), { status, headers: { ...headersFor(request), "Content-Type": "application/json" } });

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);
const safeFileName = (value: string) => {
  const base = value.trim().split(/[\\/]/).pop() || "document.pdf";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-120) || "document.pdf";
};
const sha1Hex = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest("SHA-1", bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const isSafeStorageKey = (value: string) => Boolean(value) && !value.includes("..") && !value.includes("\\") && !value.startsWith("/") && !value.includes("\0");

const getAdminUser = async (request: Request, admin: ReturnType<typeof createClient>) => {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;

  const [{ data: userProfile }, { data: adminProfile }] = await Promise.all([
    admin.from("users").select("role").eq("id", data.user.id).maybeSingle(),
    admin.from("admin_profiles").select("id,is_super_admin").eq("id", data.user.id).maybeSingle(),
  ]);
  if (userProfile?.role !== "admin" && !adminProfile?.id) return null;
  return data.user;
};

const removeUploadedFile = async (apiUrl: string, accountToken: string, fileId: string, fileName: string) => {
  if (!fileId || !fileName) return false;
  const response = await fetch(`${apiUrl}/b2api/v2/b2_delete_file_version`, {
    method: "POST",
    headers: { Authorization: accountToken, "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, fileName }),
  });
  return response.ok;
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headersFor(request) });
  if (request.method !== "POST") return json(request, { error: "Method not allowed. Use POST." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const admin = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;
  if (!admin) return json(request, { error: "Upload service temporarily unavailable." }, 503);

  const user = await getAdminUser(request, admin);
  if (!user) return json(request, { error: "Admin access required." }, 403);

  let uploadedFileId = "";
  let uploadedFileName = "";
  let b2ApiUrl = "";
  let b2AccountToken = "";

  try {
    const form = await request.formData();
    const fileValue = form.get("file");
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const yearId = String(form.get("year_id") || "").trim();
    const subjectId = String(form.get("subject_id") || "").trim();
    const folderIdRaw = String(form.get("folder_id") || form.get("unit_id") || "").trim();
    const folderId = isUuid(folderIdRaw) ? folderIdRaw : null;
    const categoryId = String(form.get("category_id") || "").trim();
    const pageCountValue = String(form.get("page_count") || "").trim();

    if (!(fileValue instanceof File) || !title || !isUuid(subjectId) || !isUuid(categoryId) || !/^[0-9]+$/.test(yearId)) {
      return json(request, { error: "File, title, category, and subject are required." }, 400);
    }
    if (fileValue.type !== "application/pdf" || !fileValue.name.toLowerCase().endsWith(".pdf")) {
      return json(request, { error: "Only PDF files are supported." }, 400);
    }

    const maxBytes = Number(Deno.env.get("B2_MAX_UPLOAD_BYTES") || 25 * 1024 * 1024);
    if (!Number.isSafeInteger(maxBytes) || fileValue.size <= 0 || fileValue.size > maxBytes) {
      return json(request, { error: `PDF must be smaller than ${Math.floor(maxBytes / (1024 * 1024))}MB.` }, 400);
    }
    const bytes = new Uint8Array(await fileValue.arrayBuffer());
    const signature = new TextDecoder().decode(bytes.slice(0, 5));
    if (signature !== "%PDF-") return json(request, { error: "The selected file is not a valid PDF." }, 400);

    const [yearRes, subjectRes, categoryRes, folderRes] = await Promise.all([
      admin.from("years").select("id").eq("id", Number(yearId)).maybeSingle(),
      admin.from("subjects").select("id,year_id,is_deleted").eq("id", subjectId).maybeSingle(),
      admin.from("document_categories").select("id").eq("id", categoryId).maybeSingle(),
      folderId
        ? admin.from("folders").select("id,subject_id").eq("id", folderId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const year = yearRes.data;
    const subject = subjectRes.data;
    const category = categoryRes.data;
    let folder = folderRes.data;

    if (folderId && !folder) {
      const unitRes = await admin.from("units").select("id,subject_id").eq("id", folderId).maybeSingle();
      folder = unitRes.data;
    }

    if (!year || !subject || subject.is_deleted || String(subject.year_id) !== yearId || !category) {
      return json(request, { error: "The selected year, subject, or category relationship is invalid." }, 400);
    }
    if (folderId && (!folder || folder.subject_id !== subjectId)) {
      return json(request, { error: "The selected folder is invalid for this subject." }, 400);
    }

    const keyId = (Deno.env.get("B2_KEY_ID") || Deno.env.get("B2_APPLICATION_KEY_ID") || "").trim();
    const applicationKey = (Deno.env.get("B2_APPLICATION_KEY") || "").trim();
    let bucketId = (Deno.env.get("B2_BUCKET_ID") || "").trim();
    let bucketName = (Deno.env.get("B2_BUCKET_NAME") || "jitsnotes-pdfs").trim();
    if (!keyId || !applicationKey) return json(request, { error: "Upload storage is not configured." }, 503);

    const authResponse = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
      headers: { Authorization: `Basic ${btoa(`${keyId}:${applicationKey}`)}` },
    });
    if (!authResponse.ok) return json(request, { error: "Storage service temporarily unavailable." }, 502);
    const auth = await authResponse.json();
    b2ApiUrl = auth.apiUrl;
    b2AccountToken = auth.authorizationToken;

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
    if (!bucketId) return json(request, { error: "Upload storage bucket could not be resolved." }, 503);

    const uploadUrlResponse = await fetch(`${b2ApiUrl}/b2api/v2/b2_get_upload_url`, {
      method: "POST",
      headers: { Authorization: b2AccountToken, "Content-Type": "application/json" },
      body: JSON.stringify({ bucketId }),
    });
    if (!uploadUrlResponse.ok) return json(request, { error: "Unable to prepare secure storage upload." }, 502);
    const uploadTarget = await uploadUrlResponse.json();

    const folderSubpath = folderId ? `folders/${folderId}` : "direct";
    const storageKey = `subjects/${subjectId}/${folderSubpath}/${crypto.randomUUID()}-${safeFileName(fileValue.name)}`;
    if (!isSafeStorageKey(storageKey)) return json(request, { error: "Unable to create a safe storage key." }, 500);
    const uploadResponse = await fetch(uploadTarget.uploadUrl, {
      method: "POST",
      headers: {
        Authorization: uploadTarget.authorizationToken,
        "X-Bz-File-Name": encodeURIComponent(storageKey),
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.byteLength),
        "X-Bz-Content-Sha1": await sha1Hex(bytes),
      },
      body: bytes,
    });
    if (!uploadResponse.ok) return json(request, { error: "PDF upload failed. Please try again." }, 502);
    const uploaded = await uploadResponse.json();
    uploadedFileId = uploaded.fileId || "";
    uploadedFileName = uploaded.fileName || storageKey;

    const pageCount =
      pageCountValue && /^[0-9]+$/.test(pageCountValue) && Number(pageCountValue) > 0
        ? Number(pageCountValue)
        : undefined;

    const isActiveRaw = form.get("is_active");
    const isActive = isActiveRaw === null ? true : (isActiveRaw === "true" || isActiveRaw === "1" || String(isActiveRaw).toLowerCase() === "true");

    const documentPayload = {
      title,
      description: description || null,
      subject_id: subjectId,
      folder_id: folderId,
      unit_id: folderId,
      category_id: categoryId,
      storage_provider: "b2",
      storage_object_key: uploadedFileName,
      mime_type: "application/pdf",
      file_size: fileValue.size,
      ...(pageCount ? { page_count: pageCount } : {}),
      is_active: isActive,
      created_by: user.id,
    };
    const { data: document, error: documentError } = await admin
      .from("documents")
      .insert(documentPayload)
      .select("id,title,description,subject_id,folder_id,unit_id,category_id,storage_provider,mime_type,file_size,page_count,is_active,created_at,updated_at")
      .single();
    if (documentError || !document) {
      const cleaned = await removeUploadedFile(b2ApiUrl, b2AccountToken, uploadedFileId, uploadedFileName);
      console.error("Document insert failed after B2 upload", { cleaned, documentError: documentError?.message || "missing document" });
      return json(request, { error: "PDF was uploaded, but document registration failed. Please contact an administrator." }, 502);
    }

    const { error: activityError } = await admin.from("admin_activity").insert({
      actor_id: user.id,
      action: "document_created",
      resource_type: "document",
      resource_id: document.id,
      metadata: { subject_id: subjectId, folder_id: folderId, unit_id: folderId, category_id: categoryId, storage_provider: "b2", file_size: fileValue.size },
    });
    if (activityError) {
      console.error("Document activity insert failed", { documentId: document.id, error: activityError.message });
      return json(request, { error: "Document was created, but audit logging failed. Please contact an administrator." }, 502);
    }

    return json(request, { document });
  } catch (error) {
    if (uploadedFileId && b2ApiUrl && b2AccountToken) {
      const cleaned = await removeUploadedFile(b2ApiUrl, b2AccountToken, uploadedFileId, uploadedFileName);
      console.error("Upload workflow failed", { cleaned, message: error instanceof Error ? error.message : "unknown error" });
    }
    return json(request, { error: "Unable to complete document upload." }, 500);
  }
});
