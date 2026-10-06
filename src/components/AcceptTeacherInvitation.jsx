import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { getInvitationParams, clearInvitationFlow } from "../lib/authCallback";

// Module-level persistent state machine
// Ensures idempotency across React re-renders, strict mode remounts, and background auth events
let globalInvitationSession = null;
let globalInvitationData = null;
let globalInvitationId = null;
// Lifecycle: 'idle' | 'initializing' | 'verifying' | 'password_required' | 'activating' | 'role_activation_failed' | 'completed' | 'error'
let globalInvitationState = "idle";
let globalErrorMessage = "";
let globalErrorType = "INVALID";
let globalPasswordUpdated = false;

const logInvite = (message, ...args) => {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[invite ${ts}] ${message}`, ...args);
};

// Helper to call backend edge function with fallback and invitation ID payload
const invokeTeacherAdmin = async (action, targetInvitationId) => {
  const payload = { action };
  if (targetInvitationId) {
    payload.invitation_id = targetInvitationId;
  }

  let res = await supabase.functions.invoke("accept-teacher-admin", {
    body: payload,
  });

  if (res.error) {
    const errorMsg = res.error.message || "";
    const isEndpointMissing = errorMsg.includes("Function not found") ||
      (res.error.context?.status === 404 && !res.error.context?.headers?.get?.("content-type")?.includes("json"));

    if (isEndpointMissing) {
      logInvite(`accept-teacher-admin endpoint missing, falling back to accept-teacher-invitation`);
      const fallbackRes = await supabase.functions.invoke("accept-teacher-invitation", {
        body: payload,
      });
      if (!fallbackRes.error || fallbackRes.data) {
        return fallbackRes;
      }
    }
  }

  return res;
};

export default function AcceptTeacherInvitation() {
  const navigate = useNavigate();
  const { refreshUserRole } = useAuth();

  const [viewState, setViewState] = useState(() => {
    if (globalInvitationState === "role_activation_failed") return "ROLE_ACTIVATION_FAILED";
    if (globalInvitationState === "password_required") return "PASSWORD_SCREEN";
    if (globalInvitationState === "activating") return "ACTIVATING";
    if (globalInvitationState === "completed") return "SUCCESS";
    if (globalInvitationState === "error") return "INVALID";
    return "INITIALIZING";
  });

  const [session, setSession] = useState(() => globalInvitationSession);
  const [invitationData, setInvitationData] = useState(() => globalInvitationData);
  const [invitationId, setInvitationId] = useState(() => globalInvitationId);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState(() => globalErrorMessage);
  const [errorType, setErrorType] = useState(() => globalErrorType);
  const [passwordUpdated, setPasswordUpdated] = useState(() => globalPasswordUpdated);
  const [isRetrying, setIsRetrying] = useState(false);

  const fallbackTimerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    // 1. If already resolved to password_required or role_activation_failed, preserve state
    if (globalInvitationState === "password_required" || globalInvitationState === "role_activation_failed") {
      logInvite(`PASSWORD_PAGE_MOUNTED (state preserved as ${globalInvitationState}, skipping re-init)`);
      setViewState(globalInvitationState === "role_activation_failed" ? "ROLE_ACTIVATION_FAILED" : "PASSWORD_SCREEN");
      setSession(globalInvitationSession);
      setInvitationData(globalInvitationData);
      setInvitationId(globalInvitationId);
      setPasswordUpdated(globalPasswordUpdated);
      return;
    }

    if (globalInvitationState === "activating" || globalInvitationState === "completed") {
      return;
    }

    if (globalInvitationState === "error") {
      setViewState("INVALID");
      setErrorMessage(globalErrorMessage);
      setErrorType(globalErrorType);
      return;
    }

    logInvite("callback detected");
    logInvite("initialization started");
    globalInvitationState = "initializing";

    const { errorCode, errorDescription, invitationId: urlInvitationId } = getInvitationParams();
    if (urlInvitationId && !globalInvitationId) {
      globalInvitationId = urlInvitationId;
    }

    // 2. Differentiate explicit URL errors from Supabase
    if (errorCode || errorDescription) {
      logInvite("URL contained explicit error:", { errorCode, errorDescription });
      globalInvitationState = "error";
      if (errorCode === "otp_expired") {
        globalErrorType = "EXPIRED";
        globalErrorMessage = "This invitation link has expired or has already been used. Please ask the Super Administrator to send a new invitation.";
      } else {
        globalErrorType = "INVALID";
        globalErrorMessage = errorDescription || "This invitation link is invalid. Please request a new invitation.";
      }
      if (isMounted) {
        setErrorType(globalErrorType);
        setErrorMessage(globalErrorMessage);
        setViewState("INVALID");
      }
      return;
    }

    logInvite("session resolution started");

    // 3. Central session verification handler
    const handleSession = async (activeSession) => {
      if (!activeSession?.user) return;

      // STRICT STATE GUARD: Never restart verification once password_required, activating, or role_activation_failed
      if (
        globalInvitationState === "password_required" ||
        globalInvitationState === "role_activation_failed" ||
        globalInvitationState === "activating" ||
        globalInvitationState === "completed"
      ) {
        logInvite(`session event ignored, state is already: ${globalInvitationState}`);
        return;
      }

      if (globalInvitationState === "verifying") {
        logInvite("session verification already in progress, ignoring concurrent trigger");
        return;
      }

      globalInvitationState = "verifying";
      logInvite("session resolved");
      logInvite("authenticated user ID: " + activeSession.user.id);
      logInvite("invitation verification started");

      // Cancel fallback timer as soon as session is obtained
      if (fallbackTimerRef.current) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }

      try {
        const { data, error: invokeError } = await invokeTeacherAdmin("verify", globalInvitationId);

        // Guard: check if state changed during await
        if (
          globalInvitationState === "password_required" ||
          globalInvitationState === "role_activation_failed" ||
          globalInvitationState === "activating" ||
          globalInvitationState === "completed"
        ) {
          return;
        }

        if (invokeError) {
          let errorMsg = invokeError.message || "Failed to verify invitation.";
          let code = "UNKNOWN";
          let status = invokeError.context?.status;

          if (invokeError.context && typeof invokeError.context.json === "function") {
            try {
              const body = await invokeError.context.json();
              if (body?.error) errorMsg = body.error;
              if (body?.code) code = body.code;
            } catch {
              // ignore
            }
          }

          logInvite("invitation verification failed: " + errorMsg + " (code: " + code + ", status: " + status + ")");

          globalInvitationState = "error";
          if (status === 404 && code !== "NOT_FOUND") {
            globalErrorType = "SERVICE_UNAVAILABLE";
            globalErrorMessage = "Activation service is temporarily unavailable.";
          } else if (code === "USER_MISMATCH" || status === 403) {
            globalErrorType = "USER_MISMATCH";
            globalErrorMessage = "This invitation does not belong to this account.";
          } else if (code === "EXPIRED" || status === 410) {
            globalErrorType = "EXPIRED";
            globalErrorMessage = "This invitation has expired. Please ask the Super Administrator to resend your invitation.";
          } else if (code === "ALREADY_ACCEPTED") {
            globalErrorType = "ALREADY_ACCEPTED";
            globalErrorMessage = "This invitation has already been accepted. You can log in using your password.";
          } else if (code === "NOT_FOUND") {
            globalErrorType = "INVALID";
            globalErrorMessage = "This invitation is invalid or has already been used.";
          } else if (status === 500) {
            globalErrorType = "INVALID";
            globalErrorMessage = "Unable to activate the Teacher Admin account.";
          } else {
            globalErrorType = "INVALID";
            globalErrorMessage = errorMsg || "Unable to initialize your invitation. Please try again or request a new invitation link.";
          }

          if (isMounted) {
            setErrorType(globalErrorType);
            setErrorMessage(globalErrorMessage);
            setViewState("INVALID");
          }
          return;
        }

        if (data?.error) {
          logInvite("invitation verification returned error: " + data.error);
          globalInvitationState = "error";
          if (data.code === "USER_MISMATCH") {
            globalErrorType = "USER_MISMATCH";
            globalErrorMessage = "This invitation does not belong to this account.";
          } else if (data.code === "EXPIRED") {
            globalErrorType = "EXPIRED";
            globalErrorMessage = "This invitation has expired. Please ask the Super Administrator to resend your invitation.";
          } else if (data.code === "ALREADY_ACCEPTED") {
            globalErrorType = "ALREADY_ACCEPTED";
            globalErrorMessage = "This invitation has already been accepted. You can log in using your password.";
          } else if (data.code === "NOT_FOUND") {
            globalErrorType = "INVALID";
            globalErrorMessage = "This invitation is invalid or has already been used.";
          } else {
            globalErrorType = "INVALID";
            globalErrorMessage = data.error;
          }

          if (isMounted) {
            setErrorType(globalErrorType);
            setErrorMessage(globalErrorMessage);
            setViewState("INVALID");
          }
          return;
        }

        const invId = data?.invitation_id || data?.invitation?.id;
        const inv = data?.invitation || (invId ? { id: invId, email: data?.email, teacher_name: data?.teacher_name } : null);

        logInvite("invitation ID: " + invId);

        // Verification validation:
        // invitationId !== undefined && invitationId !== null && invitationId !== ''
        // AND authenticated user exists
        // AND invitation belongs to authenticated user
        if (!invId || typeof invId !== "string" || invId.trim().length === 0) {
          logInvite("invitation verification rejected: invitation ID is missing or undefined");
          globalInvitationState = "error";
          globalErrorType = "INVALID";
          globalErrorMessage = "Invitation information is incomplete.";
          if (isMounted) {
            setErrorType(globalErrorType);
            setErrorMessage(globalErrorMessage);
            setViewState("INVALID");
          }
          return;
        }

        if (!activeSession?.user?.id) {
          logInvite("invitation verification rejected: authenticated user missing");
          globalInvitationState = "error";
          globalErrorType = "INVALID";
          globalErrorMessage = "Your invitation session has expired.";
          if (isMounted) {
            setErrorType(globalErrorType);
            setErrorMessage(globalErrorMessage);
            setViewState("INVALID");
          }
          return;
        }

        if (data?.auth_user_id && data.auth_user_id !== activeSession.user.id) {
          logInvite("invitation verification rejected: auth_user_id mismatch");
          globalInvitationState = "error";
          globalErrorType = "USER_MISMATCH";
          globalErrorMessage = "This invitation does not belong to this account.";
          if (isMounted) {
            setErrorType(globalErrorType);
            setErrorMessage(globalErrorMessage);
            setViewState("INVALID");
          }
          return;
        }

        logInvite("invitation verified");
        logInvite("state=password_required");
        logInvite("PASSWORD_PAGE_MOUNTED");

        globalInvitationSession = activeSession;
        globalInvitationData = inv;
        globalInvitationId = invId;
        globalInvitationState = "password_required";

        if (isMounted) {
          setSession(activeSession);
          setInvitationData(inv);
          setInvitationId(invId);
          setViewState("PASSWORD_SCREEN");
        }
      } catch (err) {
        logInvite("invitation verification exception: " + err?.message);
        if (globalInvitationState !== "password_required" && globalInvitationState !== "role_activation_failed") {
          globalInvitationState = "error";
          globalErrorType = "LOCK_ERROR";
          globalErrorMessage = "Unable to initialize your invitation. Please try again.";
          if (isMounted) {
            setErrorType(globalErrorType);
            setErrorMessage(globalErrorMessage);
            setViewState("INVALID");
          }
        }
      }
    };

    // 4. Listen for Supabase GoTrue auto-detected session event
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      logInvite(`auth event: ${event}, user: ${Boolean(currentSession?.user)}`);

      if (
        globalInvitationState === "password_required" ||
        globalInvitationState === "role_activation_failed" ||
        globalInvitationState === "activating" ||
        globalInvitationState === "completed"
      ) {
        logInvite(`ignoring auth event ${event}, invitation is already in ${globalInvitationState}`);
        return;
      }

      if (currentSession?.user) {
        await handleSession(currentSession);
      }
    });

    // 5. Check getSession() in case GoTrue already parsed it
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (
        globalInvitationState === "password_required" ||
        globalInvitationState === "role_activation_failed" ||
        globalInvitationState === "activating" ||
        globalInvitationState === "completed"
      ) {
        return;
      }

      if (existingSession?.user) {
        handleSession(existingSession);
      }
    }).catch((err) => {
      logInvite("getSession initial notice: " + err?.message);
    });

    // 6. Safe fallback timer if session detection is delayed
    fallbackTimerRef.current = window.setTimeout(async () => {
      if (
        globalInvitationState === "password_required" ||
        globalInvitationState === "role_activation_failed" ||
        globalInvitationState === "activating" ||
        globalInvitationState === "completed" ||
        globalInvitationState === "error"
      ) {
        return;
      }

      try {
        const { data: { session: delayedSession } } = await supabase.auth.getSession();
        if (delayedSession?.user) {
          await handleSession(delayedSession);
          return;
        }

        const hash = window.location.hash || "";
        const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");

        if (access_token && refresh_token) {
          logInvite("fallback manual session parse");
          const { data: parsed, error: parseError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (!parseError && parsed?.session?.user) {
            await handleSession(parsed.session);
            return;
          }
        }

        logInvite("no valid invitation session found after fallback timeout");
        globalInvitationState = "error";
        globalErrorType = "INVALID";
        globalErrorMessage = "Unable to verify invitation session. Please click the link directly from your invitation email.";
        if (isMounted) {
          setErrorType(globalErrorType);
          setErrorMessage(globalErrorMessage);
          setViewState("INVALID");
        }
      } catch (err) {
        logInvite("fallback error: " + err?.message);
        if (globalInvitationState !== "password_required" && globalInvitationState !== "role_activation_failed") {
          globalInvitationState = "error";
          globalErrorType = "LOCK_ERROR";
          globalErrorMessage = "Unable to initialize your invitation. Please try again.";
          if (isMounted) {
            setErrorType(globalErrorType);
            setErrorMessage(globalErrorMessage);
            setViewState("INVALID");
          }
        }
      }
    }, 4000);

    return () => {
      isMounted = false;
      if (fallbackTimerRef.current) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Dedicated role activation caller (Never touches updateUser / password)
  const triggerRoleActivation = async () => {
    const targetInvitationId = invitationId || globalInvitationId || invitationData?.id;
    const authUserId = session?.user?.id || globalInvitationSession?.user?.id;

    logInvite("activating invitation:");
    logInvite("invitationId: " + targetInvitationId);
    logInvite("authUserId: " + authUserId);

    if (!targetInvitationId) {
      logInvite("role activation failed: invitation ID is missing");
      globalInvitationState = "role_activation_failed";
      setViewState("ROLE_ACTIVATION_FAILED");
      setErrorMessage("Invitation information is incomplete.");
      return false;
    }

    logInvite("role activation started");

    const { data, error: functionError } = await invokeTeacherAdmin("activate", targetInvitationId);

    if (functionError) {
      let msg = functionError.message || "Unable to activate teacher account.";
      let code = "UNKNOWN";
      let status = functionError.context?.status;

      if (functionError.context && typeof functionError.context.json === "function") {
        try {
          const bodyData = await functionError.context.json();
          if (bodyData?.error) msg = bodyData.error;
          if (bodyData?.code) code = bodyData.code;
        } catch {
          // ignore
        }
      }

      // Differentiate errors strictly:
      if (status === 404) {
        if (code === "NOT_FOUND") {
          msg = "This invitation is invalid or has already been used.";
        } else {
          msg = "Activation service is temporarily unavailable.";
        }
      } else if (status === 401 || code === "AUTH_FAILED") {
        msg = "Your invitation session has expired.";
      } else if (status === 403 || code === "USER_MISMATCH") {
        msg = "This invitation does not belong to this account.";
      } else if (code === "MISSING_ID") {
        msg = "Invitation information is incomplete.";
      } else if (status === 500) {
        msg = "Unable to activate the Teacher Admin account.";
      }

      logInvite("role activation failed: " + msg);
      globalInvitationState = "role_activation_failed";
      setViewState("ROLE_ACTIVATION_FAILED");
      setErrorMessage(msg);
      return false;
    }

    if (data?.error) {
      logInvite("role activation returned error: " + data.error);
      let msg = data.error;
      if (data.code === "NOT_FOUND") {
        msg = "This invitation is invalid or has already been used.";
      } else if (data.code === "AUTH_FAILED") {
        msg = "Your invitation session has expired.";
      } else if (data.code === "USER_MISMATCH") {
        msg = "This invitation does not belong to this account.";
      } else if (data.code === "MISSING_ID") {
        msg = "Invitation information is incomplete.";
      }
      globalInvitationState = "role_activation_failed";
      setViewState("ROLE_ACTIVATION_FAILED");
      setErrorMessage(msg);
      return false;
    }

    logInvite("role activation successful");
    globalInvitationState = "completed";
    globalInvitationSession = null;
    globalInvitationData = null;
    globalInvitationId = null;

    logInvite("redirecting to admin dashboard");
    clearInvitationFlow();

    if (typeof refreshUserRole === "function") {
      await refreshUserRole();
    }

    setViewState("SUCCESS");
    window.setTimeout(() => {
      navigate("/admin", { replace: true });
    }, 1500);

    return true;
  };

  // Called when user clicks "Retry Activation"
  const handleRetryActivation = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    setErrorMessage("");

    try {
      await triggerRoleActivation();
    } finally {
      setIsRetrying(false);
    }
  };

  // Called on form submit
  const handleActivate = async (e) => {
    e.preventDefault();
    if (viewState === "ACTIVATING" || globalInvitationState === "activating") return;

    // If password was already updated, call role activation directly without updating password again
    if (passwordUpdated || globalPasswordUpdated) {
      logInvite("Password already updated, executing role activation directly");
      globalInvitationState = "activating";
      setViewState("ACTIVATING");
      setErrorMessage("");
      await triggerRoleActivation();
      return;
    }

    if (!password || password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    globalInvitationState = "activating";
    setViewState("ACTIVATING");
    setErrorMessage("");

    try {
      logInvite("password update started");

      // 1. Update user password in Supabase Auth (exactly once)
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        // If error indicates password is already set to this, treat as updated
        if (/different from the old password/i.test(updateError.message)) {
          logInvite("Password already updated previously, proceeding to role activation");
          globalPasswordUpdated = true;
          setPasswordUpdated(true);
        } else {
          logInvite("password update failed: " + updateError.message);
          globalInvitationState = "password_required";
          setViewState("PASSWORD_SCREEN");
          setErrorMessage(updateError.message || "Failed to set your account password.");
          return;
        }
      } else {
        logInvite("password update successful");
        globalPasswordUpdated = true;
        setPasswordUpdated(true);
      }

      // 2. Perform role activation
      await triggerRoleActivation();
    } catch (err) {
      logInvite("activation exception: " + err?.message);
      globalInvitationState = "role_activation_failed";
      setViewState("ROLE_ACTIVATION_FAILED");
      setErrorMessage(err?.message || "Failed to activate your account. Please try again.");
    }
  };

  const teacherName = invitationData?.teacher_name || session?.user?.user_metadata?.full_name || "Faculty Member";
  const teacherEmail = invitationData?.email || session?.user?.email || "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F2F4F7] px-4 dark:bg-[#0F1012]">
      <div className="w-full max-w-md rounded-2xl border border-[#E4E7EB] bg-white p-8 shadow-sm dark:border-[#2B2F34] dark:bg-[#141517]">
        {/* BRAND BADGE */}
        <div className="text-center">
          <span className="inline-block rounded-full bg-[#F7F7F7] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#111111] dark:text-white dark:bg-[#111111] dark:text-[#111111] dark:text-white">
            JITS Notes
          </span>

          {viewState === "SUCCESS" ? (
            <>
              <div className="mx-auto mt-4 mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-[#141517] dark:text-white">
                Account Activated!
              </h1>
              <p className="mt-1.5 text-xs text-[#5F6368] dark:text-[#8A8F98]">
                Your Teacher Admin account has been activated. Redirecting to admin dashboard...
              </p>
            </>
          ) : viewState === "ROLE_ACTIVATION_FAILED" ? (
            <>
              <div className="mx-auto mt-4 mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-[#141517] dark:text-white">
                Account Activation Pending
              </h1>
              <p className="mt-1.5 text-xs text-[#5F6368] dark:text-[#8A8F98]">
                Your password has been set successfully, but your Teacher Admin account could not be activated yet.
              </p>
            </>
          ) : viewState === "INVALID" ? (
            <>
              <div className="mx-auto mt-4 mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-[#141517] dark:text-white">
                {errorType === "EXPIRED" ? "Invitation Expired" : errorType === "USER_MISMATCH" ? "Account Mismatch" : errorType === "ALREADY_ACCEPTED" ? "Already Accepted" : "Unable to Verify Invitation"}
              </h1>
              <p className="mt-1.5 text-xs text-[#5F6368] dark:text-[#8A8F98]">
                {errorMessage}
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-3 text-2xl font-bold text-[#141517] dark:text-white">
                Activate Teacher Admin Account
              </h1>
              <p className="mt-1.5 text-xs text-[#5F6368] dark:text-[#8A8F98]">
                Set your password to complete your academic administrator account setup
              </p>
            </>
          )}
        </div>

        {/* 1. INITIALIZING STATE */}
        {viewState === "INITIALIZING" && (
          <div className="my-10 flex flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#E4E7EB] border-t-[#111111] dark:border-t-white" />
            <p className="text-xs font-medium text-[#5F6368] dark:text-[#8A8F98]">
              Verifying your invitation session...
            </p>
          </div>
        )}

        {/* 2. INVALID STATE */}
        {viewState === "INVALID" && (
          <div className="mt-6 text-center">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              {errorMessage}
            </div>
            <button
              type="button"
              onClick={() => navigate("/admin-login")}
              className="mt-6 w-full rounded-xl bg-[#141517] py-2.5 text-xs font-semibold text-white hover:bg-[#202328] dark:bg-white dark:text-[#141517] dark:hover:bg-gray-100 transition min-h-[44px]"
            >
              Return to Admin Login
            </button>
          </div>
        )}

        {/* 3. SUCCESS STATE */}
        {viewState === "SUCCESS" && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => navigate("/admin", { replace: true })}
              className="w-full rounded-xl bg-[#111111] hover:bg-[#222222] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-[#111111] py-2.5 text-xs font-medium shadow-sm transition min-h-[44px]"
            >
              Go to Admin Dashboard →
            </button>
          </div>
        )}

        {/* 4. ROLE ACTIVATION FAILED (PASSWORD ALREADY SET, RETRY ROLE ACTIVATION DIRECTLY) */}
        {viewState === "ROLE_ACTIVATION_FAILED" && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 space-y-1">
              <p className="font-semibold">Password Saved Successfully</p>
              <p>Your password is set, but the server encountered an issue while finalizing your Teacher Admin role.</p>
              {errorMessage && (
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400 font-mono mt-1">
                  Reason: {errorMessage}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[#E4E7EB] bg-[#F9FAFB] p-3.5 dark:border-[#2B2F34] dark:bg-[#1A1C1E] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#5F6368] dark:text-[#8A8F98]">Teacher</span>
                <span className="font-semibold text-[#141517] dark:text-white">{teacherName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#5F6368] dark:text-[#8A8F98]">Email</span>
                <span className="font-semibold text-[#141517] dark:text-white">{teacherEmail}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRetryActivation}
              disabled={isRetrying}
              className="w-full rounded-xl bg-[#111111] hover:bg-[#222222] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-[#111111] py-2.5 text-xs font-medium shadow-sm transition disabled:opacity-50 min-h-[44px]"
            >
              {isRetrying ? "Activating Account..." : "Retry Activation"}
            </button>
          </div>
        )}

        {/* 5. PASSWORD CREATION SCREEN */}
        {(viewState === "PASSWORD_SCREEN" || viewState === "ACTIVATING") && (
          <form onSubmit={handleActivate} className="mt-6 space-y-4">
            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                {errorMessage}
              </div>
            )}

            {/* Teacher Details Display */}
            <div className="rounded-xl border border-[#E4E7EB] bg-[#F9FAFB] p-3.5 dark:border-[#2B2F34] dark:bg-[#1A1C1E] space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#5F6368] dark:text-[#8A8F98]">Teacher Name</span>
                <span className="font-semibold text-[#141517] dark:text-white">{teacherName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#5F6368] dark:text-[#8A8F98]">Email</span>
                <span className="font-semibold text-[#141517] dark:text-white">{teacherEmail}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-[#E4E7EB] dark:border-[#2B2F34]">
                <span className="text-[#5F6368] dark:text-[#8A8F98]">Role</span>
                <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  Teacher Admin (Academic Content Only)
                </span>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-[#141517] dark:text-[#B8BDCA]">
                New Password *
              </label>
              <input
                type="password"
                required
                autoFocus
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={viewState === "ACTIVATING"}
                className="mt-1.5 w-full rounded-xl border border-[#E4E7EB] bg-white px-3.5 py-2.5 text-xs text-[#141517] outline-none focus:border-[#111111] dark:focus:border-white focus:ring-2 focus:ring-[#111111]/15 dark:focus:ring-white/15 dark:border-[#2B2F34] dark:bg-[#1B1D20] dark:text-white"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-[#141517] dark:text-[#B8BDCA]">
                Confirm Password *
              </label>
              <input
                type="password"
                required
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={viewState === "ACTIVATING"}
                className="mt-1.5 w-full rounded-xl border border-[#E4E7EB] bg-white px-3.5 py-2.5 text-xs text-[#141517] outline-none focus:border-[#111111] dark:focus:border-white focus:ring-2 focus:ring-[#111111]/15 dark:focus:ring-white/15 dark:border-[#2B2F34] dark:bg-[#1B1D20] dark:text-white"
              />
            </div>

            {/* Password Requirements Notice */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-[11px] text-[#5F6368] dark:border-[#2B2F34] dark:bg-[#1A1C1E] dark:text-[#8A8F98] space-y-1">
              <p className="font-semibold text-[#141517] dark:text-white">Password Requirements:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li className={password.length >= 8 ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                  Minimum 8 characters long
                </li>
                <li className={password && confirmPassword && password === confirmPassword ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                  Passwords must match
                </li>
              </ul>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={viewState === "ACTIVATING"}
              className="mt-2 w-full rounded-xl bg-[#111111] hover:bg-[#222222] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-[#111111] py-2.5 text-xs font-medium shadow-sm transition disabled:opacity-50 min-h-[44px]"
            >
              {viewState === "ACTIVATING" ? "Activating Account..." : "Activate Account"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
