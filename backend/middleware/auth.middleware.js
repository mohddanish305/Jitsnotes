import { getAuthClient, supabaseService } from "../config/supabase.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getTokenFromHeader = (authorization = "") => {
  if (!authorization.startsWith("Bearer ")) return null;
  return authorization.slice(7).trim();
};

export const verifySupabaseJwt = asyncHandler(async (req, _res, next) => {
  const token = getTokenFromHeader(req.headers.authorization);
  if (!token) throw new ApiError(401, "Missing Bearer token");

  const { data, error } = await supabaseService.auth.getUser(token);
  if (error || !data?.user) throw new ApiError(401, "Invalid or expired token");

  req.user = data.user;
  req.token = token;
  req.supabase = getAuthClient(token);
  next();
});

export const requireAdmin = asyncHandler(async (req, _res, next) => {
  const [{ data: userProfile, error: userError }, { data: adminProfile, error: adminError }] = await Promise.all([
    supabaseService
      .from("users")
      .select("role")
      .eq("id", req.user.id)
      .maybeSingle(),
    supabaseService
      .from("admin_profiles")
      .select("id, is_super_admin")
      .eq("id", req.user.id)
      .maybeSingle(),
  ]);

  if (userError && adminError) {
    throw new ApiError(500, "Unable to verify admin role", userError.message);
  }

  const role = userProfile?.role;
  const isAdmin = role === "admin" || Boolean(adminProfile?.id);
  if (!isAdmin) throw new ApiError(403, "Admin access required");

  req.adminRole = adminProfile?.is_super_admin ? "super_admin" : role || "admin";

  next();
});

