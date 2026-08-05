import { useLocation, useNavigate } from "react-router-dom";
import { FaChevronRight, FaHome } from "./icons";

export default function Breadcrumbs({ yearNumber, onYearClick }) {
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
    if (location.pathname !== "/") {
      navigate("/", { state: { scrollTo: "notes-section" } });
      setTimeout(() => {
        if (onYearClick) onYearClick(year);
      }, 100);
    } else if (onYearClick) {
      onYearClick(year);
    }
  };

  const isResources = location.pathname === "/resources";

  return (
    <nav 
      aria-label="Breadcrumb" 
      className="flex items-center space-x-2 py-3 px-4 mb-4 text-xs font-semibold text-gray-500 dark:text-[#94A3B8] border border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-[#111827]/40 rounded-xl max-w-fit"
    >
      <ol className="inline-flex items-center space-x-1.5 md:space-x-2">
        <li className="inline-flex items-center">
          <a
            href="/"
            onClick={handleHomeClick}
            className="inline-flex items-center gap-1 hover:text-black dark:hover:text-[#F8FAFC] transition-colors"
          >
            <FaHome className="w-3.5 h-3.5" />
            <span>Home</span>
          </a>
        </li>

        {isResources && (
          <li className="flex items-center">
            <FaChevronRight className="w-2.5 h-2.5 mx-1 text-gray-400" />
            <span className="text-gray-800 dark:text-[#F8FAFC]">Resources Repository</span>
          </li>
        )}

        {!isResources && yearNumber && (
          <li className="flex items-center">
            <FaChevronRight className="w-2.5 h-2.5 mx-1 text-gray-400" />
            <a
              href={`/?year=${yearNumber}`}
              onClick={(e) => handleYearClick(e, yearNumber)}
              className="hover:text-black dark:hover:text-[#F8FAFC] transition-colors"
            >
              Year {yearNumber}
            </a>
          </li>
        )}
      </ol>
    </nav>
  );
}
