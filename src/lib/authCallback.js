/**
 * Auth Callback & Invitation Flow Utilities
 * Provides synchronous detection and lifecycle persistence for invitation flows.
 */

let invitationFlowDetectedOnLoad = false;

/**
 * Detects whether the current page load is part of an invitation flow.
 * Must run synchronously before any auth bootstrap or background lock acquisition.
 * Persists true across URL hash clearing by Supabase until clearInvitationFlow() is called.
 */
export const isInvitationFlow = () => {
  if (typeof window === "undefined") return false;

  // If already flagged on this page load and still on an admin path, preserve invitation mode
  if (invitationFlowDetectedOnLoad) {
    if (window.location.pathname.startsWith("/admin")) {
      return true;
    }
  }

  const { pathname, search, hash } = window.location;

  // Dedicated invite callback routes
  if (
    pathname === "/admin/invite" ||
    pathname === "/admin/invite/" ||
    pathname === "/admin/accept-invite" ||
    pathname === "/admin/accept-invitation"
  ) {
    invitationFlowDetectedOnLoad = true;
    return true;
  }

  // Supabase URL hash or search params from Supabase invitation email
  if (
    hash.includes("type=invite") ||
    search.includes("type=invite") ||
    hash.includes("error_code=otp_expired") ||
    (hash.includes("access_token=") && pathname.startsWith("/admin")) ||
    (search.includes("code=") && pathname.startsWith("/admin/invite"))
  ) {
    invitationFlowDetectedOnLoad = true;
    return true;
  }

  return false;
};

/**
 * Explicitly clears the invitation flow flag once account activation is complete.
 */
export const clearInvitationFlow = () => {
  invitationFlowDetectedOnLoad = false;
};

/**
 * Extracts non-sensitive error and type parameters from the URL
 */
export const getInvitationParams = () => {
  if (typeof window === "undefined") return {};
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(search);

  const authType = hashParams.get("type") || searchParams.get("type") || null;
  const errorCode = hashParams.get("error_code") || searchParams.get("error_code") || null;
  const errorDescription = hashParams.get("error_description") || searchParams.get("error_description") || null;
  const invitationId = hashParams.get("invitation_id") || searchParams.get("invitation_id") || hashParams.get("invitationId") || searchParams.get("invitationId") || null;

  return {
    authType,
    errorCode,
    errorDescription,
    invitationId,
    hasTokens: hashParams.has("access_token") && hashParams.has("refresh_token"),
    hasCode: searchParams.has("code"),
  };
};
