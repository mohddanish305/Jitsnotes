import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaSearch, FaArrowLeft, FaTimes, FaFolderOpen, FaFileAlt, FaFlask, FaGraduationCap, FaBriefcase, FaBook } from "./icons";
import { resourcesApi } from "../lib/api";
import SEO from "./SEO";
import Breadcrumbs from "./Breadcrumbs";
import { trackResourceClick } from "../utils/analytics";

const RESOURCE_TYPES = [
  "Previous Year Question Papers",
  "Syllabus",
  "Lab Manuals",
  "Important Questions",
  "E-Books",
  "Placement Material",
  "Other"
];

const YEAR_OPTIONS = [
  { value: "", label: "All Years" },
  { value: 1, label: "1st Year" },
  { value: 2, label: "2nd Year" },
  { value: 3, label: "3rd Year" },
  { value: 4, label: "4th Year" }
];

const getTypeIcon = (type) => {
  const iconClass = "w-5 h-5 text-gray-500 dark:text-gray-400";
  switch (type) {
    case "Previous Year Question Papers":
      return <FaFileAlt className={iconClass} />;
    case "Syllabus":
      return <FaGraduationCap className={iconClass} />;
    case "Lab Manuals":
      return <FaFlask className={iconClass} />;
    case "Important Questions":
      return <FaFileAlt className={iconClass} />;
    case "E-Books":
      return <FaBook className={iconClass} />;
    case "Placement Material":
      return <FaBriefcase className={iconClass} />;
    default:
      return <FaFolderOpen className={iconClass} />;
  }
};

function ResourceCardSkeleton() {
  return (
    <div className="w-[245px] h-[310px] rounded-2xl border border-gray-250 dark:border-gray-800 bg-white dark:bg-[#111827] p-4 flex flex-col justify-between shadow-sm animate-pulse mx-auto">
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
      <div className="flex justify-center my-auto flex-shrink-0">
        <div className="h-[96px] w-[96px] rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="space-y-1.5 w-full flex-shrink-0">
        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-9 w-full bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    </div>
  );
}

function ResourceCard({ resource, buttonTransition }) {
  const hasThumbnail = typeof resource.thumbnail_url === "string" && resource.thumbnail_url.startsWith("http");

  return (
    <motion.article
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.4 }}
      whileHover={{
        y: -6,
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08)",
      }}
      className="group mx-auto flex h-[310px] w-[245px] min-w-[245px] max-w-[245px] flex-col justify-between overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] hover:bg-gray-50/50 dark:hover:bg-[#1E293B] p-4 shadow-sm transition-all duration-300"
    >
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <h3 className="min-w-0 flex-1 text-left text-sm font-bold leading-tight text-gray-900 dark:text-[#F8FAFC] truncate" title={resource.title}>
          {resource.short_name || resource.title || "UNTITLED"}
        </h3>
        <span className="shrink-0 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-750 bg-gray-50 dark:bg-[#1E293B]/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-600 dark:text-[#94A3B8]">
          Year {resource.academic_year}
        </span>
      </div>

      <div className="flex w-full items-center justify-center my-auto flex-shrink-0">
        <div className="relative h-[96px] w-[96px] overflow-hidden rounded-xl border border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
          {hasThumbnail ? (
            <img
              src={resource.thumbnail_url}
              alt={`${resource.title || 'Resource'} JITS study material`}
              loading="lazy"
              decoding="async"
              width="96"
              height="96"
              className="h-full w-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 via-white to-gray-200 dark:from-gray-800 dark:via-[#111827] dark:to-gray-900">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 dark:border-gray-750 bg-white dark:bg-gray-850 shadow-sm">
                {getTypeIcon?.(resource.resource_type) || "📁"}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full mt-auto flex-shrink-0 space-y-2">
        <div className="text-left">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#94A3B8] font-bold truncate">
            {resource.resource_type}
          </p>
          <p className="text-xxs text-gray-450 dark:text-gray-500 truncate" title={resource.description || ""}>
            {resource.description || "No description provided."}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={buttonTransition}
          onClick={() => {
            trackResourceClick(resource.title || "Unknown Resource", resource.resource_type || "Other");
            window.open(resource.drive_link, "_blank", "noopener,noreferrer");
          }}
          className="flex h-9 w-full items-center justify-center rounded-xl bg-black dark:bg-[#6366F1] px-4 text-xs font-bold text-white shadow-sm hover:bg-gray-900 dark:hover:bg-[#6366F1]/90 transition-colors"
        >
          Open Resource
        </motion.button>
      </div>
    </motion.article>
  );
}

export default function ResourcesPage({ onBackToHome }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const [error, setError] = useState(null);

  const buttonTransition = {
    type: "spring",
    stiffness: 400,
    damping: 17,
  };

  useEffect(() => {
    let active = true;
    const fetchResources = async () => {
      try {
        const data = await resourcesApi.getAll();
        if (active) {
          setResources(data || []);
          setError(null);
        }
      } catch (err) {
        console.error("Error loading resources:", err);
        if (active) {
          setError(err);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchResources();
    return () => {
      active = false;
    };
  }, []);

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      const matchesSearch =
        (resource.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (resource.short_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (resource.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesYear = selectedYear === "" || Number(resource.academic_year) === Number(selectedYear);
      const matchesCategory = selectedCategory === "" || resource.resource_type === selectedCategory;

      return matchesSearch && matchesYear && matchesCategory;
    });
  }, [resources, searchQuery, selectedYear, selectedCategory]);

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-8 transition-colors duration-300">
      <SEO title="JITS Study Resources | Lab Manuals, Syllabus & Question Papers" description="Access JNTUH R22 Lab Manuals, Syllabus books, and Placement Preparation resources for JITS students." />
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-150 dark:border-gray-800 pb-6 mb-8">
        <div className="space-y-1 text-left">
          <Breadcrumbs />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-[#F8FAFC]">
            Resources Repository
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-[#94A3B8]">
            Search and download syllabus books, previous questions, lab manuals, and materials.
          </p>
        </div>
      </div>

      {/* Search & Year Filtering Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 mb-6">
        
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <FaSearch className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resources by title, short name, or description..."
            className="h-12 w-full pl-10 pr-10 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] text-sm text-gray-900 dark:text-[#F8FAFC] placeholder-gray-400 dark:placeholder-gray-500 shadow-sm outline-none transition focus:border-black dark:focus:border-[#6366F1] focus:ring-2 focus:ring-black/10 dark:focus:ring-[#6366F1]/10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <FaTimes className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Year Selectors */}
        <div className="flex flex-wrap gap-2">
          {YEAR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedYear(opt.value)}
              className={`h-12 px-4 rounded-xl text-xs sm:text-sm font-semibold border transition-all duration-200 ${
                selectedYear === opt.value
                  ? "bg-black dark:bg-[#6366F1] text-white border-black dark:border-[#6366F1] shadow-sm"
                  : "bg-white dark:bg-[#111827] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Selectors / Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-8 text-xs font-semibold scrollbar-none">
        <button
          onClick={() => setSelectedCategory("")}
          className={`shrink-0 px-4 py-2 rounded-lg border transition-all ${
            selectedCategory === ""
              ? "bg-black dark:bg-[#6366F1] text-white border-black dark:border-[#6366F1]"
              : "bg-white dark:bg-[#111827] border-gray-250 dark:border-gray-800 text-gray-500 dark:text-[#94A3B8] hover:bg-gray-50 dark:hover:bg-gray-800/60"
          }`}
        >
          All Categories
        </button>
        {RESOURCE_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedCategory(type)}
            className={`shrink-0 px-4 py-2 rounded-lg border transition-all ${
              selectedCategory === type
                ? "bg-black dark:bg-[#6366F1] text-white border-black dark:border-[#6366F1]"
                : "bg-white dark:bg-[#111827] border-gray-250 dark:border-gray-800 text-gray-500 dark:text-[#94A3B8] hover:bg-gray-50 dark:hover:bg-gray-800/60"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 justify-center justify-items-center w-full mx-auto">
          {Array.from({ length: 10 }).map((_, i) => (
            <ResourceCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16 bg-white dark:bg-[#111827] rounded-3xl border border-red-200 dark:border-red-950/30 shadow-sm max-w-lg mx-auto"
        >
          <div className="h-14 w-14 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/40 flex items-center justify-center mx-auto mb-4">
            <FaFolderOpen className="w-6 h-6 text-red-500 dark:text-red-450" />
          </div>
          <h3 className="text-base font-bold text-red-650 dark:text-red-400">
            {error?.message?.includes("resources") || error?.message?.includes("relation") || String(error).includes("resources")
              ? "Resources table not found. Please run database migration."
              : "Database Connection Issue"}
          </h3>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-[#94A3B8] max-w-sm mx-auto px-4 leading-relaxed">
            {error?.message?.includes("resources") || error?.message?.includes("relation") || String(error).includes("resources")
              ? "The resources table does not exist in the database yet. Please ensure the SQL migrations have been executed in Supabase."
              : error?.message || "Failed to load academic resources. Please check your connection or try again."}
          </p>
        </motion.div>
      ) : filteredResources.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16 bg-white dark:bg-[#111827] rounded-3xl border border-gray-250 dark:border-gray-800 shadow-sm max-w-lg mx-auto"
        >
          <div className="h-14 w-14 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-150 dark:border-gray-750 flex items-center justify-center mx-auto mb-4">
            <FaFolderOpen className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
          {resources.length === 0 ? (
            <>
              <h3 className="text-base font-bold text-gray-900 dark:text-[#F8FAFC]">No resources available yet</h3>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-[#94A3B8] max-w-sm mx-auto px-4 leading-relaxed">
                Check back later! Academic resources will be uploaded here shortly.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-base font-bold text-gray-900 dark:text-[#F8FAFC]">No Resources Found</h3>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-[#94A3B8] max-w-sm mx-auto px-4 leading-relaxed">
                There are no resources matches your criteria. Try adjusting your search query or clear the active category filters.
              </p>
              {(searchQuery || selectedYear !== "" || selectedCategory !== "") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedYear("");
                    setSelectedCategory("");
                  }}
                  className="mt-5 text-xs font-bold text-black dark:text-[#6366F1] underline"
                >
                  Clear all filters
                </button>
              )}
            </>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.05,
              },
            },
          }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 justify-center justify-items-center w-full mx-auto"
        >
          {filteredResources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              buttonTransition={buttonTransition}
            />
          ))}
        </motion.div>
      )}

    </div>
  );
}
