import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateSubjectPayload } from "../utils/validators.js";

const ensureYearExists = async (supabaseClient, yearId) => {
  const { data, error } = await supabaseClient
    .from("years")
    .select("id")
    .eq("id", yearId)
    .maybeSingle();

  if (error) throw new ApiError(500, "Failed to validate year", error.message);
  if (!data) throw new ApiError(400, "year_id does not exist");
};

export const addSubject = asyncHandler(async (req, res) => {
  const payload = validateSubjectPayload(req.body);
  if (!payload.year_id) throw new ApiError(400, "year_id is required");

  await ensureYearExists(req.supabase, payload.year_id);

  const insertPayload = {
    ...payload,
    created_by: req.user.id,
    is_deleted: false,
  };

  const { data, error } = await req.supabase
    .from("subjects")
    .insert(insertPayload)
    .select("id, name, short_name, year_id, thumbnail_url, is_active, is_deleted, last_updated")
    .single();

  if (error) throw error;

  res.status(201).json({ success: true, data });
});

export const updateSubject = asyncHandler(async (req, res) => {
  const subjectId = req.params.id;
  const payload = validateSubjectPayload(req.body, true);

  if (!Object.keys(payload).length) {
    throw new ApiError(400, "Provide at least one valid field to update");
  }

  if (payload.year_id) {
    await ensureYearExists(req.supabase, payload.year_id);
  }

  payload.last_updated = new Date().toISOString().slice(0, 10);
  payload.is_deleted = false;

  const { data, error } = await req.supabase
    .from("subjects")
    .update(payload)
    .eq("id", subjectId)
    .select("id, name, short_name, year_id, thumbnail_url, is_active, is_deleted, last_updated")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new ApiError(404, "Subject not found");

  res.json({ success: true, data });
});

export const deleteSubject = asyncHandler(async (req, res) => {
  const subjectId = req.params.id;

  const { data, error } = await req.supabase
    .from("subjects")
    .update({ is_deleted: true })
    .eq("id", subjectId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new ApiError(404, "Subject not found");

  res.json({ success: true, message: "Subject deleted successfully" });
});

