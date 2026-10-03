import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AcceptTeacherInvitation() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Checking your invitation...");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const accept = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (active) setError("Open this page from the invitation email, then sign in with the invited email address.");
        return;
      }
      const { data, error: functionError } = await supabase.functions.invoke("accept-teacher-invitation", { body: {} });
      if (!active) return;
      if (functionError || data?.error) {
        setError(functionError?.message || data?.error || "Unable to accept the invitation.");
        return;
      }
      setStatus("Teacher Admin access activated. Redirecting...");
      window.setTimeout(() => navigate("/admin", { replace: true }), 700);
    };
    accept();
    return () => { active = false; };
  }, [navigate]);

  return <main className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-4 dark:bg-[#0B0D12]"><section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-[#14171F]"><p className="text-sm font-semibold text-[#2C3480] dark:text-[#AAB3FF]">JITS Notes</p><h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Teacher Admin Invitation</h1>{error ? <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-300">{error}</p> : <p className="mt-5 text-sm text-gray-600 dark:text-[#B8BDCA]">{status}</p>}<button type="button" onClick={() => navigate("/admin-login")} className="mt-6 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">Go to admin login</button></section></main>;
}
