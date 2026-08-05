import { ApiError } from "../utils/apiError.js";
import { logger } from "../utils/logger.js";

const mapSupabaseError = (error) => {
  if (error?.code === "23505") {
    return new ApiError(409, "Duplicate subject for this year");
  }
  if (error?.code === "23503") {
    return new ApiError(400, "Invalid reference value");
  }
  return null;
};

export const notFoundHandler = (_req, _res, next) => {
  next(new ApiError(404, "Route not found"));
};

export const errorHandler = (err, _req, res, _next) => {
  const mapped = mapSupabaseError(err) || err;
  const statusCode = mapped.statusCode || 500;
  const message = mapped.message || "Internal server error";

  logger.error(message, mapped.details || err?.stack || "");

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      details: mapped.details || undefined,
    },
  });
};

