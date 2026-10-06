import { useLocation, useNavigate } from "react-router-dom";
import { Home, ChevronRight } from "lucide-react";

export default function Breadcrumbs({
  yearNumber,
  onYearClick,
  subject,
  _onSubjectClick,
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleHomeClick = (e) => {
    e.preventDefault();
    if (location.pathname !== "/") {
      navigate("/");
    } else if (onYearClick) {
      onYearClick(1);
    }
  };

  const handleYearClick = (e, year) => {
    e.preventDefault();
    if (onYearClick) {
      onYearClick(year);
    } else {
      navigate(`/years/${year}/subjects`);
    }
  };

  const yearLabels = {
    1: "1st Year",
    2: "2nd Year",
    3: "3rd Year",
    4: "4th Year",
  };

  const yearLabel = yearLabels[yearNumber] || `Year ${yearNumber}`;

  return (
    <nav
      aria-label="Breadcrumb"
      className="inline-flex items-center flex-wrap gap-1.5 py-1.5 px-3 text-xs font-medium text-[#666666] dark:text-[#999999] border border-[#EDEDED] dark:border-[#222222] bg-[#FFFFFF] dark:bg-[#0B0B0B] rounded-xl max-w-full shadow-subtle dark:shadow-subtle-dark"
    >
      <ol className="inline-flex flex-wrap items-center gap-1 sm:gap-1.5">
        <li className="inline-flex items-center">
          <a
            href="/"
            onClick={handleHomeClick}
            className="inline-flex items-center gap-1.5 text-[#666666] dark:text-[#999999] hover:text-[#151515] dark:hover:text-white transition-colors"
          >
            <Home className="w-3.5 h-3.5 text-[#999999]" />
            <span>Home</span>
          </a>
        </li>

        {yearNumber && (
          <li className="inline-flex items-center">
            <ChevronRight className="w-3 h-3 text-[#999999] mx-0.5 shrink-0" />
            {subject ? (
              <button
                type="button"
                onClick={(e) => handleYearClick(e, yearNumber)}
                className="text-[#666666] dark:text-[#999999] hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors font-medium cursor-pointer"
              >
                {yearLabel}
              </button>
            ) : (
              <span className="font-semibold text-[#151515] dark:text-white">
                {yearLabel}
              </span>
            )}
          </li>
        )}

        {subject && (
          <li className="inline-flex items-center">
            <ChevronRight className="w-3 h-3 text-[#999999] mx-0.5 shrink-0" />
            <span
              className="font-semibold text-[#8F1D32] dark:text-[#A21F3D] truncate max-w-[180px] sm:max-w-[280px]"
              title={subject.name || subject.short_name}
            >
              {subject.short_name || subject.name}
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
}
