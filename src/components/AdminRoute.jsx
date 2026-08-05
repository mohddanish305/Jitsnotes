import { useMemo, lazy, Suspense } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";

const AdminPanel = lazy(() => import("./AdminPanel"));

export default function AdminRoute() {
  const { user, isAdmin, loading, roleLoading } = useAuth();
  const location = useLocation();

  const loaderCopy = useMemo(() => ({
    title: "Checking admin access...",
    subtitle: "Verifying your session and admin role.",
  }), []);

  if (loading || roleLoading || isAdmin === null) {
    console.log("[admin-route] checking admin access...");
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm shadow-slate-200/60"
        >
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
          <h1 className="text-lg font-semibold text-gray-900">{loaderCopy.title}</h1>
          <p className="mt-2 text-sm text-gray-500">{loaderCopy.subtitle}</p>
        </motion.div>
      </div>
    );
  }

  if (!user && !loading) {
    console.log("[admin-route] no user, redirecting to /admin-login");
    return <Navigate to="/admin-login" replace state={{ from: location.pathname }} />;
  }

  if (isAdmin === false) {
    console.log("[admin-route] user present but not admin");
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm shadow-slate-200/60"
        >
          <h1 className="text-lg font-semibold text-gray-900">Access denied</h1>
          <p className="mt-2 text-sm text-gray-500">You need admin privileges.</p>
        </motion.div>
      </div>
    );
  }

  console.log("[admin-route] admin confirmed, rendering dashboard");
  return (
    <div className="min-h-screen bg-[#f7f7f5] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <div className="mx-auto w-full max-w-7xl">
        <Suspense fallback={
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
          </div>
        }>
          <AdminPanel isOpen={true} onRefresh={() => {}} />
        </Suspense>
      </div>
    </div>
  );
}