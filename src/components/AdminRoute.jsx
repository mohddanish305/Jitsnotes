import { useState, useEffect, lazy, Suspense } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

const AdminCMS = lazy(() => import("./AdminCMS"));

export default function AdminRoute() {
  const {
    user,
    role,
    isAdmin,
    authLoading,
    roleLoading,
    authStatus,
    roleResolved,
    roleError,
    authError,
    retryAuth,
  } = useAuth();
  const location = useLocation();

  // Safety fallback: Never allow "Checking admin access..." to spin indefinitely
  const [routeTimedOut, setRouteTimedOut] = useState(false);

  const isCheckingRole = roleLoading || (Boolean(user) && isAdmin === null && authStatus !== "error" && !roleError);

  useEffect(() => {
    if (isCheckingRole) {
      const timer = setTimeout(() => {
        console.warn("[admin-route] role verification wait safety timer expired (8s)");
        setRouteTimedOut(true);
      }, 8000);
      return () => clearTimeout(timer);
    } else {
      setRouteTimedOut(false);
    }
  }, [isCheckingRole]);

  console.log("[admin-route] auth state:", authStatus, { authLoading, roleLoading });
  console.log("[admin-route] role state:", { isAdmin, role, roleResolved });

  // 1. Initial auth bootstrap (waiting for initial session check)
  if (authLoading && !user && authStatus !== "error") {
    return (
      <div className="min-h-screen bg-[#FFFFFF] dark:bg-[#000000] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-[#EAEAEA] dark:border-[#222222] bg-[#FFFFFF] dark:bg-[#0A0A0A] p-8 text-center shadow-subtle dark:shadow-subtle-dark"
        >
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-[#EAEAEA] dark:border-[#222222] border-t-[#111111] dark:border-t-white" />
          <h1 className="text-base font-semibold text-[#111111] dark:text-white">Connecting...</h1>
          <p className="mt-2 text-xs text-[#666666] dark:text-[#B3B3B3]">Restoring administrative session.</p>
        </motion.div>
      </div>
    );
  }

  // 2. Unauthenticated check: definitely no session/user
  if (authStatus === "unauthenticated" || (!user && !authLoading && !roleLoading)) {
    console.log("[admin-route] no user, redirecting to /admin-login");
    return <Navigate to="/admin-login" replace state={{ from: location.pathname }} />;
  }

  // 3. Error or Timeout: Never leave UI hanging forever!
  if (authStatus === "error" || roleError || authError || routeTimedOut) {
    const errorMsg =
      roleError?.message ||
      authError?.message ||
      (routeTimedOut ? "Admin access verification took too long to respond." : "Unable to verify admin access.");

    console.log("[admin-route] error state encountered:", errorMsg);
    return (
      <div className="min-h-screen bg-[#FFFFFF] dark:bg-[#000000] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 dark:border-red-900/40 bg-[#FFFFFF] dark:bg-[#0A0A0A] p-8 text-center shadow-subtle dark:shadow-subtle-dark">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40 text-red-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-base font-semibold text-[#111111] dark:text-white">Unable to verify admin access.</h1>
          <p className="mt-2 text-xs text-[#666666] dark:text-[#B3B3B3]">{errorMsg}</p>
          <div className="mt-6 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRouteTimedOut(false);
                retryAuth?.();
              }}
              className="rounded-xl bg-[#111111] px-5 py-2.5 text-xs font-semibold text-white dark:bg-white dark:text-[#111111] hover:bg-[#222222] transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Role loading state
  if (isCheckingRole) {
    console.log("[admin-route] checking admin access");
    return (
      <div className="min-h-screen bg-[#FFFFFF] dark:bg-[#000000] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-[#EAEAEA] dark:border-[#222222] bg-[#FFFFFF] dark:bg-[#0A0A0A] p-8 text-center shadow-subtle dark:shadow-subtle-dark"
        >
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-[#EAEAEA] dark:border-[#222222] border-t-[#111111] dark:border-t-white" />
          <h1 className="text-base font-semibold text-[#111111] dark:text-white">Checking admin access...</h1>
          <p className="mt-2 text-xs text-[#666666] dark:text-[#B3B3B3]">Verifying your session and admin role.</p>
        </motion.div>
      </div>
    );
  }

  // 5. Authenticated but unauthorized
  if (isAdmin === false) {
    console.log("[admin-route] user present but not admin");
    return (
      <div className="min-h-screen bg-[#FFFFFF] dark:bg-[#000000] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-[#EAEAEA] dark:border-[#222222] bg-[#FFFFFF] dark:bg-[#0A0A0A] p-8 text-center shadow-subtle dark:shadow-subtle-dark"
        >
          <h1 className="text-base font-semibold text-[#111111] dark:text-white">Access Denied</h1>
          <p className="mt-2 text-xs text-[#666666] dark:text-[#B3B3B3]">This portal requires administrator privileges.</p>
        </motion.div>
      </div>
    );
  }

  // 6. Authorized Admin confirmed!
  console.log("[admin-route] role resolved:", role);
  console.log("[admin-route] rendering dashboard");
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#FFFFFF] p-12 dark:bg-[#000000]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EAEAEA] dark:border-[#222222] border-t-[#111111] dark:border-t-white" />
      </div>
    }>
      <AdminCMS />
    </Suspense>
  );
}