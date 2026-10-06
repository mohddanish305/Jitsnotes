import React from "react";
import { useNavigate } from "react-router-dom";
import SEO from "./SEO";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <SEO title="Page Not Found" description="The page you are looking for does not exist on JITS Notes." />
      <h1 className="text-6xl font-black text-[#111111] dark:text-white mb-4">404</h1>
      <h2 className="text-2xl font-bold text-[#8F1D32] dark:text-[#A21F3D] mb-6">Page Not Found</h2>
      <p className="text-[#666666] dark:text-[#B3B3B3] max-w-md mb-8">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <button
        onClick={() => navigate("/")}
        className="px-6 py-3 bg-[#111111] dark:bg-white text-white dark:text-black font-semibold rounded-xl hover:bg-[#262626] dark:hover:bg-[#EAEAEA] transition-colors"
      >
        Go to Homepage
      </button>
    </div>
  );
}
