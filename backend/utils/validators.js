import { ApiError } from "./apiError.js";

export const sanitizeText = (value) => String(value ?? "").trim().replace(/\s+/g, " ");

export const validateDriveLink = (link) => {
  const safeLink = sanitizeText(link);
  if (!safeLink.includes("drive.google.com")) {
    throw new ApiError(400, "drive_link must contain drive.google.com");
  }
  return safeLink;
};

export const validateSubjectPayload = (payload, isUpdate = false) => {
  const result = {};

  if (!isUpdate || payload.name !== undefined) {
    const name = sanitizeText(payload.name);
    if (!name) throw new ApiError(400, "name cannot be empty");
    result.name = name;
  }

  if (!isUpdate || payload.drive_link !== undefined) {
    result.drive_link = validateDriveLink(payload.drive_link);
  }

  if (payload.short_name !== undefined) {
    result.short_name = sanitizeText(payload.short_name) || null;
  }

  if (payload.year_id !== undefined) {
    const yearId = Number(payload.year_id);
    if (!Number.isInteger(yearId) || yearId <= 0) {
      throw new ApiError(400, "year_id must be a positive integer");
    }
    result.year_id = yearId;
  }

  if (payload.is_active !== undefined) {
    if (typeof payload.is_active !== "boolean") {
      throw new ApiError(400, "is_active must be boolean");
    }
    result.is_active = payload.is_active;
  }

  return result;
};

