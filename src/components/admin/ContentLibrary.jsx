import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { resolveSubjectName } from "../../utils/academicCatalog";
import EditNoteModal from "./EditNoteModal";
import DeleteNoteModal from "./DeleteNoteModal";
import {
  AddSubjectModal,
  EditSubjectModal,
  DeleteSubjectModal,
  AddFolderModal,
  DeleteFolderModal,
} from "./AcademicModals";

const SAFE_DOCUMENT_FIELDS =
  "id,title,description,subject_id,folder_id,unit_id,category_id,storage_provider,mime_type,file_size,page_count,is_active,created_at,updated_at";

const YEAR_TABS = [
  { id: 1, label: "1st Year", short: "Year 1" },
  { id: 2, label: "2nd Year", short: "Year 2" },
  { id: 3, label: "3rd Year", short: "Year 3" },
  { id: 4, label: "4th Year", short: "Year 4" },
];

const ITEMS_PER_PAGE = 15;

const formatFileSize = (bytes) => {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) return "—";
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (val) => {
  if (!val) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(val));
};

export default function ContentLibrary({
  onOpenAddNote,
  initialSubjectId = null,
  showToast,
}) {
  // View mode: 'hierarchy' (Year -> Subject -> Units -> Notes) | 'table' (Global search & filter)
  const [viewMode, setViewMode] = useState("table");

  // Hierarchy Navigation State
  const [activeYear, setActiveYear] = useState(1);
  const [activeSubjectId, setActiveSubjectId] = useState(initialSubjectId);
  const [activeFolderId, setActiveFolderId] = useState(null); // null = All Units in subject

  // Global Table Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterYear, setFilterYear] = useState(0); // 0 = all
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterUnitId, setFilterUnitId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // 'all' | 'active' | 'inactive'
  const [currentPage, setCurrentPage] = useState(1);

  // Data Store
  const [subjects, setSubjects] = useState([]);
  const [folders, setFolders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Subject search within hierarchy mode
  const [subjectSearch, setSubjectSearch] = useState("");

  // Action / Modal States
  const [openingDocId, setOpeningDocId] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [deletingNote, setDeletingNote] = useState(null);
  const [addingSubjectYear, setAddingSubjectYear] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [deletingSubject, setDeletingSubject] = useState(null);
  const [addingFolderSubject, setAddingFolderSubject] = useState(null);
  const [deletingFolder, setDeletingFolder] = useState(null);

  // Load catalog & notes
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [_yearsRes, subjectsRes, unitsRes, foldersRes, categoriesRes, documentsRes] =
        await Promise.all([
          supabase.from("years").select("id, name").order("id", { ascending: true }),
          supabase
            .from("subjects")
            .select("id, name, short_name, year_id, description, is_active, is_deleted")
            .eq("is_deleted", false)
            .order("name"),
          supabase
            .from("units")
            .select("id, subject_id, unit_number, title, is_active")
            .order("unit_number", { ascending: true }),
          supabase
            .from("folders")
            .select("id, subject_id, name, is_active, created_at, updated_at")
            .order("name"),
          supabase.from("document_categories").select("id, name, slug").order("name"),
          supabase
            .from("documents")
            .select(SAFE_DOCUMENT_FIELDS)
            .order("created_at", { ascending: false }),
        ]);

      if (subjectsRes.error) throw subjectsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;
      if (documentsRes.error) throw documentsRes.error;

      setSubjects(subjectsRes.data || []);
      setCategories(categoriesRes.data || []);
      setDocuments(documentsRes.data || []);

      // Build unified units/folders
      const combinedFolders = [];
      const seenIds = new Set();

      (foldersRes.data || []).forEach((f) => {
        seenIds.add(f.id);
        combinedFolders.push({
          id: f.id,
          subject_id: f.subject_id,
          name: f.name,
          is_active: f.is_active !== false,
          created_at: f.created_at,
        });
      });

      (unitsRes.data || []).forEach((u) => {
        if (!seenIds.has(u.id)) {
          seenIds.add(u.id);
          combinedFolders.push({
            id: u.id,
            subject_id: u.subject_id,
            name: u.title || `Unit ${u.unit_number}`,
            is_active: u.is_active !== false,
            created_at: null,
          });
        }
      });

      setFolders(combinedFolders);

      if (initialSubjectId) {
        const found = subjectsRes.data?.find((s) => s.id === initialSubjectId);
        if (found) {
          setActiveYear(found.year_id || 1);
          setActiveSubjectId(found.id);
          setViewMode("hierarchy");
        }
      }
    } catch (err) {
      console.error("[ContentLibrary] Load failed:", err);
      setError(err?.message || "Unable to load content library data.");
    } finally {
      setLoading(false);
    }
  }, [initialSubjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived maps
  const subjectMap = useMemo(() => {
    const map = new Map();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const folderMap = useMemo(() => {
    const map = new Map();
    folders.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [folders]);

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Document counts per subject and per folder
  const subjectDocCounts = useMemo(() => {
    const map = new Map();
    documents.forEach((d) => {
      if (d.subject_id) {
        map.set(d.subject_id, (map.get(d.subject_id) || 0) + 1);
      }
    });
    return map;
  }, [documents]);

  const folderDocCounts = useMemo(() => {
    const map = new Map();
    documents.forEach((d) => {
      const uId = d.folder_id || d.unit_id;
      if (uId) {
        map.set(uId, (map.get(uId) || 0) + 1);
      }
    });
    return map;
  }, [documents]);

  // Active Subject in Hierarchy Mode
  const activeSubject = useMemo(() => {
    if (!activeSubjectId) return null;
    return subjects.find((s) => s.id === activeSubjectId) || null;
  }, [subjects, activeSubjectId]);

  // Active Subject's folders
  const activeSubjectFolders = useMemo(() => {
    if (!activeSubject) return [];
    return folders.filter((f) => f.subject_id === activeSubject.id);
  }, [folders, activeSubject]);

  // Active Subject's documents
  const activeSubjectDocs = useMemo(() => {
    if (!activeSubject) return [];
    return documents.filter((d) => d.subject_id === activeSubject.id);
  }, [documents, activeSubject]);

  // Displayed docs in Hierarchy mode
  const hierarchyDisplayedDocs = useMemo(() => {
    if (!activeSubject) return [];
    if (!activeFolderId) {
      return activeSubjectDocs;
    }
    return activeSubjectDocs.filter((d) => (d.folder_id || d.unit_id) === activeFolderId);
  }, [activeSubject, activeFolderId, activeSubjectDocs]);

  // Filtered subjects in Year view of Hierarchy Mode
  const yearSubjects = useMemo(() => {
    const subs = subjects.filter((s) => Number(s.year_id) === activeYear);
    if (!subjectSearch.trim()) return subs;
    const q = subjectSearch.trim().toLowerCase();
    return subs.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.short_name && s.short_name.toLowerCase().includes(q))
    );
  }, [subjects, activeYear, subjectSearch]);

  // Available subjects for Table Filter dropdown
  const filterAvailableSubjects = useMemo(() => {
    if (!filterYear) return subjects;
    return subjects.filter((s) => Number(s.year_id) === Number(filterYear));
  }, [subjects, filterYear]);

  // Available units for Table Filter dropdown
  const filterAvailableUnits = useMemo(() => {
    if (!filterSubjectId) return folders;
    return folders.filter((f) => f.subject_id === filterSubjectId);
  }, [folders, filterSubjectId]);

  // Filtered documents for Table / Search mode
  const filteredTableDocs = useMemo(() => {
    return documents.filter((doc) => {
      const sub = subjectMap.get(doc.subject_id);

      if (filterYear > 0) {
        if (!sub || Number(sub.year_id) !== Number(filterYear)) return false;
      }
      if (filterSubjectId && doc.subject_id !== filterSubjectId) {
        return false;
      }
      if (filterUnitId) {
        const uId = doc.folder_id || doc.unit_id;
        if (uId !== filterUnitId) return false;
      }
      if (filterCategoryId && doc.category_id !== filterCategoryId) {
        return false;
      }
      if (filterStatus === "active" && !doc.is_active) {
        return false;
      }
      if (filterStatus === "inactive" && doc.is_active) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = doc.title?.toLowerCase().includes(q);
        const matchSub =
          sub?.name?.toLowerCase().includes(q) ||
          sub?.short_name?.toLowerCase().includes(q);
        if (!matchTitle && !matchSub) return false;
      }
      return true;
    });
  }, [
    documents,
    subjectMap,
    filterYear,
    filterSubjectId,
    filterUnitId,
    filterCategoryId,
    filterStatus,
    searchQuery,
  ]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredTableDocs.length / ITEMS_PER_PAGE) || 1;
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTableDocs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTableDocs, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterYear, filterSubjectId, filterUnitId, filterCategoryId, filterStatus]);

  // Action: Open PDF (secure flow via get-document-url)
  const handleOpenPdf = async (doc) => {
    setOpeningDocId(doc.id);
    try {
      const { data, error: urlError } = await supabase.functions.invoke("get-document-url", {
        body: { document_id: doc.id },
      });
      if (urlError || !data?.download_url) {
        throw new Error(data?.error || urlError?.message || "Failed to generate download URL.");
      }
      window.open(data.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      if (showToast) showToast("error", err?.message || "Failed to open PDF.");
      else alert(err?.message || "Failed to open PDF.");
    } finally {
      setOpeningDocId(null);
    }
  };

  // Action: Toggle Note Active / Disabled
  const handleToggleNoteActive = async (doc) => {
    try {
      const updatedActive = !doc.is_active;
      const { error: updateError } = await supabase
        .from("documents")
        .update({ is_active: updatedActive, updated_at: new Date().toISOString() })
        .eq("id", doc.id);

      if (updateError) throw updateError;

      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, is_active: updatedActive } : d))
      );
      if (showToast) showToast("success", `Note ${updatedActive ? "activated" : "disabled"}.`);
    } catch (err) {
      if (showToast) showToast("error", err?.message || "Failed to update status.");
    }
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setFilterYear(0);
    setFilterSubjectId("");
    setFilterUnitId("");
    setFilterCategoryId("");
    setFilterStatus("all");
    setCurrentPage(1);
  };

  const isAnyFilterActive =
    Boolean(searchQuery.trim()) ||
    filterYear > 0 ||
    Boolean(filterSubjectId) ||
    Boolean(filterUnitId) ||
    Boolean(filterCategoryId) ||
    filterStatus !== "all";

  return (
    <div className="space-y-6">
      {/* Top Controls: Breadcrumbs & View Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E5E5E5] dark:border-[#262626] pb-4">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 text-xs text-[#666666] dark:text-[#999999] flex-wrap">
          <button
            type="button"
            onClick={() => {
              setActiveSubjectId(null);
              setActiveFolderId(null);
            }}
            className="font-bold text-[#151515] dark:text-[#FAFAFA] hover:text-[#8F1D32] transition"
          >
            Content Library
          </button>

          {viewMode === "hierarchy" && (
            <>
              <span>/</span>
              <button
                type="button"
                onClick={() => {
                  setActiveSubjectId(null);
                  setActiveFolderId(null);
                }}
                className={`hover:text-[#8F1D32] transition ${
                  !activeSubject ? "font-bold text-[#8F1D32]" : ""
                }`}
              >
                Year {activeYear}
              </button>

              {activeSubject && (
                <>
                  <span>/</span>
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(null)}
                    className={`hover:text-[#8F1D32] transition ${
                      !activeFolderId ? "font-bold text-[#8F1D32]" : ""
                    }`}
                  >
                    {activeSubject.short_name || activeSubject.name}
                  </button>

                  {activeFolderId && (
                    <>
                      <span>/</span>
                      <span className="font-bold text-[#8F1D32]">
                        {folderMap.get(activeFolderId) || "Unit"}
                      </span>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {viewMode === "table" && (
            <>
              <span>/</span>
              <span className="font-semibold text-[#8F1D32]">Global Search & Filters</span>
            </>
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#151515] p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "table"
                  ? "bg-white text-[#151515] dark:bg-[#262626] dark:text-white shadow-xs"
                  : "text-[#666666] hover:text-[#151515] dark:text-[#999999] dark:hover:text-white"
              }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span>All Notes ({documents.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("hierarchy")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "hierarchy"
                  ? "bg-white text-[#151515] dark:bg-[#262626] dark:text-white shadow-xs"
                  : "text-[#666666] hover:text-[#151515] dark:text-[#999999] dark:hover:text-white"
              }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Browse Hierarchy</span>
            </button>
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-10 animate-pulse rounded-xl bg-[#FAFAFA] dark:bg-[#151515]" />
          <div className="h-64 animate-pulse rounded-2xl bg-[#FAFAFA] dark:bg-[#151515]" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 space-y-3">
          <p className="font-semibold">Unable to load library.</p>
          <p>{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="rounded-xl bg-red-600 text-white px-4 py-2 font-semibold shadow-xs"
          >
            Retry
          </button>
        </div>
      ) : viewMode === "hierarchy" ? (
        /* ========================================================= */
        /* MODE 1: HIERARCHICAL BROWSING (Year -> Subject -> Units)  */
        /* ========================================================= */
        <div className="space-y-6">
          {!activeSubject ? (
            /* LEVEL 1: Year Tabs + Subject Cards */
            <div className="space-y-5">
              {/* Year Selector Tabs */}
              <div className="flex items-center gap-2 border-b border-[#E5E5E5] dark:border-[#262626] pb-3 overflow-x-auto">
                {YEAR_TABS.map((yt) => {
                  const isCur = activeYear === yt.id;
                  const count = subjects.filter((s) => Number(s.year_id) === yt.id).length;
                  return (
                    <button
                      key={yt.id}
                      type="button"
                      onClick={() => {
                        setActiveYear(yt.id);
                        setSubjectSearch("");
                      }}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
                        isCur
                          ? "bg-[#8F1D32] text-white shadow-xs"
                          : "border border-[#E5E5E5] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#151515] text-[#666666] dark:text-[#999999] hover:text-[#151515] dark:hover:text-white"
                      }`}
                    >
                      <span>{yt.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                          isCur
                            ? "bg-white/20 text-white"
                            : "bg-[#E5E5E5] dark:bg-[#262626] text-[#666666] dark:text-[#999999]"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setAddingSubjectYear(activeYear)}
                  className="ml-auto flex items-center gap-1.5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2 text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] transition shadow-xs whitespace-nowrap"
                >
                  <svg className="h-3.5 w-3.5 text-[#8F1D32]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span>Add Subject</span>
                </button>
              </div>

              {/* Subject Search */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <svg
                    className="absolute left-3.5 top-2.5 h-4 w-4 text-[#999999]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder={`Search Year ${activeYear} subjects...`}
                    value={subjectSearch}
                    onChange={(e) => setSubjectSearch(e.target.value)}
                    className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] pl-9.5 pr-3.5 py-2 text-xs text-[#151515] dark:text-[#FAFAFA] placeholder-[#999999] focus:border-[#8F1D32] focus:outline-none"
                  />
                </div>
              </div>

              {/* Subjects Grid */}
              {yearSubjects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#E5E5E5] dark:border-[#262626] p-12 text-center bg-[#FAFAFA] dark:bg-[#151515]">
                  <p className="text-sm font-semibold text-[#151515] dark:text-[#FAFAFA]">
                    No subjects found in Year {activeYear}
                  </p>
                  <p className="mt-1 text-xs text-[#666666] dark:text-[#999999]">
                    Create a subject to begin organizing notes and syllabus units.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAddingSubjectYear(activeYear)}
                    className="mt-4 rounded-xl bg-[#8F1D32] hover:bg-[#74152A] px-4 py-2 text-xs font-semibold text-white shadow-xs transition"
                  >
                    + Create Subject
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {yearSubjects.map((sub) => {
                    const docCount = subjectDocCounts.get(sub.id) || 0;
                    const folderCount = folders.filter((f) => f.subject_id === sub.id).length;

                    return (
                      <div
                        key={sub.id}
                        className="group relative rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] p-4.5 shadow-xs hover:border-[#8F1D32]/50 transition-all flex flex-col justify-between"
                      >
                        <div
                          onClick={() => {
                            setActiveSubjectId(sub.id);
                            setActiveFolderId(null);
                          }}
                          className="cursor-pointer space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="rounded-lg bg-[#F8E9EC] text-[#8F1D32] dark:bg-[#8F1D32]/20 dark:text-[#F8E9EC] px-2 py-0.5 text-[11px] font-bold">
                              {sub.short_name || "SUB"}
                            </span>
                            <span className="text-[11px] text-[#666666] dark:text-[#999999]">
                              {docCount} note{docCount === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-[#151515] dark:text-[#FAFAFA] group-hover:text-[#8F1D32] transition">
                              {resolveSubjectName(sub.id, sub.name, sub.short_name)}
                            </h4>
                            {sub.description && (
                              <p className="mt-1 text-xs text-[#666666] dark:text-[#999999] line-clamp-2">
                                {sub.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#E5E5E5] dark:border-[#262626] text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSubjectId(sub.id);
                              setActiveFolderId(null);
                            }}
                            className="text-xs font-semibold text-[#8F1D32] hover:underline"
                          >
                            Explore {folderCount} unit{folderCount === 1 ? "" : "s"} →
                          </button>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSubject(sub);
                              }}
                              title="Edit subject"
                              className="rounded-lg p-1 text-[#666666] hover:bg-[#E5E5E5] dark:hover:bg-[#262626] dark:text-[#999999]"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingSubject({
                                  subject: sub,
                                  noteCount: docCount,
                                  folderCount,
                                });
                              }}
                              title="Delete subject"
                              className="rounded-lg p-1 text-[#666666] hover:text-red-600 hover:bg-[#E5E5E5] dark:hover:bg-[#262626] dark:text-[#999999]"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* LEVEL 2: Subject Detail View with Unit Tabs & Notes */
            <div className="space-y-5">
              {/* Subject Detail Header */}
              <div className="rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#151515] p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-[#8F1D32] text-white px-2 py-0.5 text-xs font-bold">
                        {activeSubject.short_name || "SUB"}
                      </span>
                      <h3 className="text-base font-bold text-[#151515] dark:text-[#FAFAFA]">
                        {resolveSubjectName(activeSubject.id, activeSubject.name, activeSubject.short_name)}
                      </h3>
                      <span className="text-xs text-[#666666] dark:text-[#999999]">
                        • Year {activeSubject.year_id}
                      </span>
                    </div>
                    {activeSubject.description && (
                      <p className="mt-1.5 text-xs text-[#666666] dark:text-[#999999]">
                        {activeSubject.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAddingFolderSubject(activeSubject)}
                      className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3 py-1.5 text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] transition shadow-xs"
                    >
                      + Add Unit / Folder
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenAddNote) {
                          onOpenAddNote({
                            yearId: activeSubject.year_id,
                            subjectId: activeSubject.id,
                            unitId: activeFolderId || "",
                          });
                        }
                      }}
                      className="rounded-xl bg-[#8F1D32] hover:bg-[#74152A] px-3.5 py-1.5 text-xs font-semibold text-white transition shadow-xs"
                    >
                      + Add Note
                    </button>
                  </div>
                </div>

                {/* Units / Folders Pills */}
                <div className="flex items-center gap-2 pt-4 mt-4 border-t border-[#E5E5E5] dark:border-[#262626] overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(null)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                      activeFolderId === null
                        ? "bg-[#151515] text-white dark:bg-white dark:text-[#151515]"
                        : "border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] text-[#666666] dark:text-[#999999] hover:text-[#151515] dark:hover:text-white"
                    }`}
                  >
                    All Units ({activeSubjectDocs.length})
                  </button>

                  {activeSubjectFolders.map((f) => {
                    const count = folderDocCounts.get(f.id) || 0;
                    const isCur = activeFolderId === f.id;

                    return (
                      <div key={f.id} className="relative group inline-flex items-center">
                        <button
                          type="button"
                          onClick={() => setActiveFolderId(f.id)}
                          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                            isCur
                              ? "bg-[#8F1D32] text-white"
                              : "border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] text-[#666666] dark:text-[#999999] hover:text-[#151515] dark:hover:text-white"
                          }`}
                        >
                          <span>📁 {f.name}</span>
                          <span className="text-[10px] opacity-80">({count})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setDeletingFolder({
                              folder: f,
                              noteCount: count,
                            })
                          }
                          title="Delete folder"
                          className="hidden group-hover:flex ml-1 p-1 text-[#666666] hover:text-red-600 transition"
                        >
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes List inside this subject / unit */}
              {hierarchyDisplayedDocs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#E5E5E5] dark:border-[#262626] p-10 text-center bg-[#FAFAFA] dark:bg-[#151515]">
                  <p className="text-sm font-semibold text-[#151515] dark:text-[#FAFAFA]">
                    No notes in this section
                  </p>
                  <p className="mt-1 text-xs text-[#666666] dark:text-[#999999]">
                    Upload a lecture note, previous question paper, or study material PDF.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenAddNote) {
                        onOpenAddNote({
                          yearId: activeSubject.year_id,
                          subjectId: activeSubject.id,
                          unitId: activeFolderId || "",
                        });
                      }
                    }}
                    className="mt-4 rounded-xl bg-[#8F1D32] hover:bg-[#74152A] px-4 py-2 text-xs font-semibold text-white shadow-xs transition"
                  >
                    + Add Note
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#E5E5E5] dark:divide-[#262626] rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] overflow-hidden shadow-xs">
                  {hierarchyDisplayedDocs.map((doc) => {
                    const catName = categoryMap.get(doc.category_id) || "Notes";
                    const fName = folderMap.get(doc.folder_id || doc.unit_id);

                    return (
                      <div
                        key={doc.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-[#FAFAFA] dark:hover:bg-[#1B1B1B] transition"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-[#F8E9EC] text-[#8F1D32] dark:bg-[#8F1D32]/20 dark:text-[#F8E9EC] px-2 py-0.5 text-[10px] font-bold">
                              {catName}
                            </span>
                            {fName && (
                              <span className="text-[11px] text-[#666666] dark:text-[#999999]">
                                • 📁 {fName}
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.2 text-[10px] font-semibold ${
                                doc.is_active
                                  ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"
                                  : "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                              }`}
                            >
                              {doc.is_active ? "Active" : "Disabled"}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-[#151515] dark:text-[#FAFAFA] truncate">
                            {doc.title}
                          </h4>

                          <p className="text-[11px] text-[#666666] dark:text-[#999999]">
                            {formatFileSize(doc.file_size)} • Uploaded {formatDate(doc.created_at)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={openingDocId === doc.id}
                            onClick={() => handleOpenPdf(doc)}
                            className="rounded-lg border border-[#E5E5E5] dark:border-[#262626] px-2.5 py-1 text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] transition shadow-xs"
                          >
                            {openingDocId === doc.id ? "Opening..." : "View PDF"}
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingNote(doc)}
                            className="rounded-lg border border-[#E5E5E5] dark:border-[#262626] px-2.5 py-1 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:text-[#151515] dark:hover:text-white hover:bg-[#FAFAFA] dark:hover:bg-[#262626] transition"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleNoteActive(doc)}
                            className="rounded-lg border border-[#E5E5E5] dark:border-[#262626] px-2 py-1 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] transition"
                            title={doc.is_active ? "Disable note" : "Activate note"}
                          >
                            {doc.is_active ? "Disable" : "Activate"}
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingNote(doc)}
                            className="rounded-lg border border-transparent p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                            title="Delete note"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================= */
        /* MODE 2: GLOBAL SEARCH & FILTER TABLE (Requirement 4)      */
        /* ========================================================= */
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#151515] p-4 shadow-xs space-y-3">
            {/* Search Input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3.5 top-3 h-4 w-4 text-[#999999]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by note title or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#0B0B0B] pl-10 pr-3.5 py-2.5 text-xs text-[#151515] dark:text-[#FAFAFA] placeholder-[#999999] focus:border-[#8F1D32] focus:outline-none"
                />
              </div>

              {isAnyFilterActive && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs font-semibold text-[#8F1D32] hover:underline px-2 py-1 self-center"
                >
                  Clear all filters
                </button>
              )}
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
              {/* Year Filter */}
              <div>
                <select
                  value={filterYear}
                  onChange={(e) => {
                    setFilterYear(Number(e.target.value));
                    setFilterSubjectId("");
                    setFilterUnitId("");
                  }}
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#0B0B0B] px-3 py-2 text-xs text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] focus:outline-none"
                >
                  <option value={0}>All Years</option>
                  {YEAR_TABS.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Filter */}
              <div>
                <select
                  value={filterSubjectId}
                  onChange={(e) => {
                    setFilterSubjectId(e.target.value);
                    setFilterUnitId("");
                  }}
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#0B0B0B] px-3 py-2 text-xs text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] focus:outline-none"
                >
                  <option value="">All Subjects</option>
                  {filterAvailableSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.short_name ? `[${s.short_name}] ` : ""}{resolveSubjectName(s.id, s.name, s.short_name)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Filter */}
              <div>
                <select
                  value={filterUnitId}
                  onChange={(e) => setFilterUnitId(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#0B0B0B] px-3 py-2 text-xs text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] focus:outline-none"
                >
                  <option value="">All Units / Folders</option>
                  {filterAvailableUnits.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={filterCategoryId}
                  onChange={(e) => setFilterCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#0B0B0B] px-3 py-2 text-xs text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] focus:outline-none"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#0B0B0B] px-3 py-2 text-xs text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] focus:outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Disabled Only</option>
                </select>
              </div>
            </div>

            {/* Total Results Count */}
            <div className="flex items-center justify-between text-xs text-[#666666] dark:text-[#999999] pt-2 border-t border-[#E5E5E5] dark:border-[#262626]">
              <span>
                Showing <strong className="text-[#151515] dark:text-[#FAFAFA]">{filteredTableDocs.length}</strong> of {documents.length} notes
              </span>
              <span>Page {currentPage} of {totalPages}</span>
            </div>
          </div>

          {/* Notes Table */}
          {filteredTableDocs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E5E5E5] dark:border-[#262626] p-12 text-center bg-[#FAFAFA] dark:bg-[#151515]">
              <p className="text-sm font-semibold text-[#151515] dark:text-[#FAFAFA]">
                No matching notes found
              </p>
              <p className="mt-1 text-xs text-[#666666] dark:text-[#999999]">
                Try adjusting your search terms or clearing the active filters.
              </p>
              {isAnyFilterActive && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-4 rounded-xl border border-[#E5E5E5] dark:border-[#262626] px-4 py-2 text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] hover:bg-white transition"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAFAFA] dark:bg-[#0B0B0B] border-b border-[#E5E5E5] dark:border-[#262626] text-[#666666] dark:text-[#999999] font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Note Title</th>
                      <th className="px-4 py-3">Subject & Year</th>
                      <th className="px-4 py-3">Unit / Folder</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">File Size</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5] dark:divide-[#262626]">
                    {paginatedDocs.map((doc) => {
                      const sub = subjectMap.get(doc.subject_id);
                      const catName = categoryMap.get(doc.category_id) || "—";
                      const fName = folderMap.get(doc.folder_id || doc.unit_id) || "General";

                      return (
                        <tr
                          key={doc.id}
                          className="hover:bg-[#FAFAFA] dark:hover:bg-[#1B1B1B] transition"
                        >
                          {/* Title */}
                          <td className="px-4 py-3.5 max-w-[240px]">
                            <p className="font-bold text-[#151515] dark:text-[#FAFAFA] truncate">
                              {doc.title}
                            </p>
                            <p className="text-[10px] text-[#666666] dark:text-[#999999]">
                              Added {formatDate(doc.created_at)}
                            </p>
                          </td>

                          {/* Subject */}
                          <td className="px-4 py-3.5">
                            <span className="font-medium text-[#151515] dark:text-[#FAFAFA]">
                              {sub ? resolveSubjectName(sub.id, sub.name, sub.short_name) : "—"}
                            </span>
                            <span className="block text-[10px] text-[#666666] dark:text-[#999999]">
                              {sub ? `Year ${sub.year_id}` : ""}
                            </span>
                          </td>

                          {/* Unit */}
                          <td className="px-4 py-3.5 text-[#666666] dark:text-[#999999]">
                            {fName}
                          </td>

                          {/* Category */}
                          <td className="px-4 py-3.5">
                            <span className="rounded-md bg-[#F8E9EC] text-[#8F1D32] dark:bg-[#8F1D32]/20 dark:text-[#F8E9EC] px-2 py-0.5 text-[10px] font-bold">
                              {catName}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                doc.is_active
                                  ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"
                                  : "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                              }`}
                            >
                              {doc.is_active ? "Active" : "Disabled"}
                            </span>
                          </td>

                          {/* File Size */}
                          <td className="px-4 py-3.5 text-[#666666] dark:text-[#999999]">
                            {formatFileSize(doc.file_size)}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={openingDocId === doc.id}
                                onClick={() => handleOpenPdf(doc)}
                                className="rounded-lg border border-[#E5E5E5] dark:border-[#262626] px-2 py-1 font-semibold text-[#151515] dark:text-[#FAFAFA] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] transition shadow-xs"
                              >
                                {openingDocId === doc.id ? "Opening..." : "View"}
                              </button>

                              <button
                                type="button"
                                onClick={() => setEditingNote(doc)}
                                className="rounded-lg border border-[#E5E5E5] dark:border-[#262626] px-2 py-1 font-semibold text-[#666666] dark:text-[#999999] hover:text-[#151515] dark:hover:text-white transition"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleNoteActive(doc)}
                                className="rounded-lg border border-[#E5E5E5] dark:border-[#262626] px-2 py-1 font-semibold text-[#666666] dark:text-[#999999] hover:text-[#151515] transition"
                              >
                                {doc.is_active ? "Disable" : "Activate"}
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingNote(doc)}
                                className="rounded-lg p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                                title="Delete note"
                              >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination bar */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[#E5E5E5] dark:border-[#262626] px-4 py-3 bg-[#FAFAFA] dark:bg-[#0B0B0B]">
                  <span className="text-xs text-[#666666] dark:text-[#999999]">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredTableDocs.length)} of{" "}
                    {filteredTableDocs.length} notes
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-[#E5E5E5] dark:border-[#262626] px-3 py-1 text-xs font-semibold disabled:opacity-40 transition"
                    >
                      Previous
                    </button>
                    <span className="px-2 text-xs font-bold text-[#151515] dark:text-white">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded-lg border border-[#E5E5E5] dark:border-[#262626] px-3 py-1 text-xs font-semibold disabled:opacity-40 transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {editingNote && (
        <EditNoteModal
          note={editingNote}
          years={YEAR_TABS}
          subjects={subjects}
          folders={folders}
          categories={categories}
          onClose={() => setEditingNote(null)}
          onSaved={(updatedDoc) => {
            setDocuments((prev) =>
              prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d))
            );
            setEditingNote(null);
            if (showToast) showToast("success", `Note "${updatedDoc.title}" updated.`);
          }}
          onCategoryCreated={(newCat) => {
            setCategories((prev) => [...prev, newCat]);
          }}
        />
      )}

      {deletingNote && (
        <DeleteNoteModal
          note={deletingNote}
          onClose={() => setDeletingNote(null)}
          onDeleted={(deletedId) => {
            setDocuments((prev) => prev.filter((d) => d.id !== deletedId));
            setDeletingNote(null);
            if (showToast) showToast("success", "Note permanently deleted.");
          }}
        />
      )}

      {addingSubjectYear && (
        <AddSubjectModal
          initialYearId={addingSubjectYear}
          onClose={() => setAddingSubjectYear(null)}
          onSuccess={(newSub) => {
            setSubjects((prev) => [...prev, newSub]);
            setAddingSubjectYear(null);
            if (showToast) showToast("success", `Subject "${newSub.name}" created.`);
          }}
        />
      )}

      {editingSubject && (
        <EditSubjectModal
          subject={editingSubject}
          onClose={() => setEditingSubject(null)}
          onUpdated={(updatedSub) => {
            setSubjects((prev) =>
              prev.map((s) => (s.id === updatedSub.id ? updatedSub : s))
            );
            setEditingSubject(null);
            if (showToast) showToast("success", `Subject "${updatedSub.name}" updated.`);
          }}
        />
      )}

      {deletingSubject && (
        <DeleteSubjectModal
          subject={deletingSubject.subject}
          noteCount={deletingSubject.noteCount}
          folderCount={deletingSubject.folderCount}
          onClose={() => setDeletingSubject(null)}
          onDeleted={(deletedId) => {
            setSubjects((prev) => prev.filter((s) => s.id !== deletedId));
            setDocuments((prev) => prev.filter((d) => d.subject_id !== deletedId));
            setDeletingSubject(null);
            if (activeSubjectId === deletedId) {
              setActiveSubjectId(null);
            }
            if (showToast) showToast("success", "Subject permanently deleted.");
          }}
        />
      )}

      {addingFolderSubject && (
        <AddFolderModal
          subject={addingFolderSubject}
          existingFolders={folders}
          onClose={() => setAddingFolderSubject(null)}
          onCreated={(newFolder) => {
            setFolders((prev) => [...prev, newFolder]);
            setAddingFolderSubject(null);
            if (showToast) showToast("success", `Folder "${newFolder.name}" created.`);
          }}
        />
      )}

      {deletingFolder && (
        <DeleteFolderModal
          folder={deletingFolder.folder}
          noteCount={deletingFolder.noteCount}
          onClose={() => setDeletingFolder(null)}
          onDeleted={(deletedId) => {
            setFolders((prev) => prev.filter((f) => f.id !== deletedId));
            setDeletingFolder(null);
            if (activeFolderId === deletedId) {
              setActiveFolderId(null);
            }
            if (showToast) showToast("success", "Folder deleted.");
          }}
        />
      )}
    </div>
  );
}
