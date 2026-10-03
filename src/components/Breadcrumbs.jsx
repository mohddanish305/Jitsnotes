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

  return (
    <nav 
      aria-label="Breadcrumb" 
      className="flex flex-wrap items-center space-x-1.5 sm:space-x-2 py-2 px-3 text-xs font-medium text-[#555555] dark:text-[#B8BDCA] border border-[#E5E5E5] dark:border-[#292E3A] bg-white dark:bg-[#14171F] rounded-xl max-w-fit shadow-sm"
    >
      <ol className="inline-flex flex-wrap items-center space-x-1 sm:space-x-2">
        <li className="inline-flex items-center">
          <a
            href="/"
            onClick={handleHomeClick}
            className="inline-flex items-center gap-1.5 hover:text-[#000000] dark:hover:text-[#FFFFFF] transition-colors"
          >
            <FaHome className="w-3.5 h-3.5" />
            <span>Home</span>
          </a>
        </li>

        {yearNumber && (
          <li className="flex items-center">
            <FaChevronRight className="w-2.5 h-2.5 mx-1 text-[#858B99]" />
            <a
              href={`/?year=${yearNumber}`}
              onClick={(e) => handleYearClick(e, yearNumber)}
              className="hover:text-[#000000] dark:hover:text-[#FFFFFF] font-semibold transition-colors"
            >
              Year {yearNumber}
            </a>
          </li>
        )}
      </ol>
    </nav>
  );
}
