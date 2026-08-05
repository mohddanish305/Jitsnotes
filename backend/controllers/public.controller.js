import { supabase } from "../config/supabase.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getYears = asyncHandler(async (_req, res) => {
  const { data, error } = await supabase
    .from("years")
    .select("id, name")
    .order("id", { ascending: true });

  if (error) throw new ApiError(500, "Failed to fetch years", error.message);

  res.json({ success: true, data });
});

export const getSubjectsByYear = asyncHandler(async (req, res) => {
  const yearId = Number(req.params.yearId);
  if (!Number.isInteger(yearId) || yearId <= 0) {
    throw new ApiError(400, "yearId must be a positive integer");
  }

  const { data, error } = await supabase
    .from("subjects")
    .select("id, name, short_name, drive_link, thumbnail_url")
    .eq("year_id", yearId)
    .eq("is_deleted", false)
    .order("name", { ascending: true });

  if (error) throw new ApiError(500, "Failed to fetch subjects", error.message);

  res.json({ success: true, data });
});

