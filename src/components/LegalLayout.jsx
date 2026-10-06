import { memo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, ChevronRight } from "lucide-react";
import SEO from "./SEO";

export const LegalLayout = memo(function LegalLayout({
  title,
  subtitle,
  lastUpdated = "October 2026",
  badge = "Policy & Information",
  children,
}) {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFFFF] dark:bg-[#0B0B0B] text-[#151515] dark:text-white transition-colors duration-150">
      <SEO title={`${title} | JITS Notes`} description={subtitle} />

      {/* Main Container */}
      <main className="w-full max-w-[860px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Top Navigation & Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[#EDEDED] dark:border-[#292929]">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#666666] dark:text-[#B5B5B5]">
            <Link to="/" className="inline-flex items-center gap-1 hover:text-[#151515] dark:hover:text-white transition-colors">
              <Home className="w-3.5 h-3.5 text-[#999999]" />
              <span>Home</span>
            </Link>
            <ChevronRight className="w-3 h-3 text-[#999999]" />
            <span className="font-semibold text-[#8F1D32] dark:text-[#A21F3D] truncate max-w-[200px] sm:max-w-xs">
              {title}
            </span>
          </nav>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#666666] dark:text-[#B5B5B5] hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Notes</span>
            <span className="sm:hidden">Back</span>
          </button>
        </div>

        {/* Header Section */}
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#FCF4F5] dark:bg-[#241217] border border-[#F8E9EC] dark:border-[#381B22] text-[#8F1D32] dark:text-[#A21F3D] text-[11px] font-bold mb-3">
            <span>{badge}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#151515] dark:text-white mb-2">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm sm:text-base text-[#666666] dark:text-[#B5B5B5] leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-[#999999] dark:text-[#858585]">
            <span>Last Updated: {lastUpdated}</span>
            <span>•</span>
            <span>JNTUH R22 Academic Portal</span>
          </div>
        </header>

        {/* Document Content */}
        <article className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm sm:text-[15px] leading-relaxed text-[#151515] dark:text-[#E0E0E0]">
          {children}
        </article>
      </main>
    </div>
  );
});

export default LegalLayout;
