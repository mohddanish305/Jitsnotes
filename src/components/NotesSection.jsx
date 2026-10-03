import { memo, useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { trackSubjectClick, trackNoteClick } from "../utils/analytics";
import { supabase } from "../lib/supabase";
import { resolveSubjectName } from "../utils/academicCatalog";
import SubjectVisual from "./SubjectVisual";
import PdfViewerModal from "./PdfViewerModal";
import { loadAcademicYearAssets } from "../utils/academicYearAssets";

const YEAR_LABELS = {
  1: "Year 1",
  2: "Year 2",
  3: "Year 3",
  4: "Year 4",
};

const getYearNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const match = value.match(/year\s*(\d)/i);
    if (match) return Number(match[1]);
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) return numeric;
  }
  return null;
};

const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function SubjectCardSkeleton() {
  return (
    <div className="flex w-full flex-col justify-between overflow-hidden rounded-2xl border border-[#E5E5E5] dark:border-[#292E3A] bg-white dark:bg-[#14171F] p-4 shadow-sm animate-pulse">
      <div className="aspect-[16/9] w-full rounded-[14px] bg-gray-200 dark:bg-[#1A1E28]" />
      <div className="mt-3.5 space-y-2">
        <div className="h-4 w-3/4 bg-gray-200 dark:bg-[#1A1E28] rounded" />
        <div className="flex justify-between items-center pt-1">
          <div className="h-3 w-12 bg-gray-200 dark:bg-[#1A1E28] rounded" />
          <div className="h-3 w-14 bg-gray-200 dark:bg-[#1A1E28] rounded" />
        </div>
      </div>
      <div className="mt-4 h-11 w-full bg-gray-200 dark:bg-[#1A1E28] rounded-xl" />
    </div>
  );
}

function StudentSubjectModal({ subject, yearLabel, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const subjectTitle = useMemo(() => {
    return resolveSubjectName(subject);
  }, [subject]);

  useEffect(() => {
    let ignore = false;
    async function fetchSubjectData() {
      setLoading(true);
      setError(null);
      try {
        const [foldersRes, unitsRes, docsRes, catsRes] = await Promise.all([
          supabase
            .from("folders")
            .select("id, name, is_active")
            .eq("subject_id", subject.id)
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("units")
            .select("id, title, unit_number, is_active")
            .eq("subject_id", subject.id)
            .eq("is_active", true)
            .order("unit_number", { ascending: true }),
          supabase
            .from("documents")
            .select("id, title, folder_id, unit_id, category_id, file_size, page_count, is_active, created_at")
            .eq("subject_id", subject.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false }),
          supabase.from("document_categories").select("id, name, slug"),
        ]);

        if (!ignore) {
          if (docsRes.error) {
            console.error("[NotesSection] Error fetching documents:", docsRes.error);
            throw docsRes.error;
          }

          const combinedFolders = [];
          const seen = new Set();
          (foldersRes.data || []).forEach((f) => {
            seen.add(f.id);
            combinedFolders.push({ id: f.id, name: f.name });
          });
          (unitsRes.data || []).forEach((u) => {
            if (!seen.has(u.id)) {
              seen.add(u.id);
              combinedFolders.push({ id: u.id, name: u.title || `Unit ${u.unit_number}` });
            }
          });

          setFolders(combinedFolders);
          setDocuments(docsRes.data || []);
          setCategories(catsRes.data || []);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) {
          console.error("[NotesSection] Subject fetch error:", err);
          setError(err?.message || "Failed to load notes for this subject.");
          setLoading(false);
        }
      }
    }
    fetchSubjectData();
    return () => {
      ignore = true;
    };
  }, [subject.id, reloadKey]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !viewingDoc) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, viewingDoc]);

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((cat) => map.set(cat.id, cat.name));
    return map;
  }, [categories]);

  const documentsByFolder = useMemo(() => {
    const map = new Map();
    documents.forEach((doc) => {
      const fId = doc.folder_id || doc.unit_id;
      if (fId) {
        const list = map.get(fId) || [];
        list.push(doc);
        map.set(fId, list);
      }
    });
    return map;
  }, [documents]);

  const directDocuments = useMemo(() => {
    return documents.filter((doc) => !doc.folder_id && !doc.unit_id);
  }, [documents]);

  const handleOpenPdf = (doc) => {
    trackNoteClick(subject.short_name || "Unknown Subject", doc.title || "Document");
    setViewingDoc(doc);
  };

  const renderNoteCard = (doc) => {
    const categoryName = categoryMap.get(doc.category_id) || "Lecture Notes";
    const sizeLabel = formatBytes(doc.file_size);

    return (
      <div
        key={doc.id}
        onClick={() => handleOpenPdf(doc)}
        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-3 hover:bg-[#F7F8FA] dark:hover:bg-[#1A1E28] rounded-xl transition-colors cursor-pointer border border-transparent hover:border-[#E5E5E5] dark:hover:border-[#292E3A]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            {/* SVG PDF Icon */}
            <div className="h-8 w-8 shrink-0 rounded-lg bg-[#2C3480]/10 dark:bg-[#3D4CC4]/20 flex items-center justify-center text-[#2C3480] dark:text-[#FFFFFF]">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[#000000] dark:text-[#FFFFFF] truncate group-hover:text-[#2C3480] dark:group-hover:text-[#3D4CC4] transition-colors">
              {doc.title}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 pl-10.5">
            <span className="rounded-md bg-[#F7F8FA] dark:bg-[#1A1E28] px-2 py-0.5 text-[10px] font-semibold text-[#555555] dark:text-[#B8BDCA] border border-[#E5E5E5] dark:border-[#292E3A]">
              {categoryName}
            </span>
            <span className="text-[11px] text-[#858B99]">
              PDF
            </span>
            {sizeLabel && (
              <span className="text-[11px] text-[#858B99]">
                · {sizeLabel}
              </span>
            )}
            {doc.page_count && (
              <span className="text-[11px] text-[#858B99]">
                · {doc.page_count} pages
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenPdf(doc);
          }}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#2C3480] hover:bg-[#3D4CC4] text-white px-4 py-2 text-xs font-semibold shadow-sm transition-colors min-h-[44px] sm:min-h-[36px]"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span>Open PDF</span>
        </button>
      </div>
    );
  };

  const hasAnyContent = documents.length > 0;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#E5E5E5] dark:border-[#292E3A] bg-white dark:bg-[#14171F] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#E5E5E5] dark:border-[#292E3A] px-6 py-5 bg-white dark:bg-[#10131A]">
            <div className="min-w-0 flex-1 pr-4">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="rounded-md bg-[#2C3480]/10 dark:bg-[#3D4CC4]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#2C3480] dark:text-[#FFFFFF] border border-[#2C3480]/20 dark:border-[#3D4CC4]/40">
                  {yearLabel}
                </span>
                {subject.short_name && (
                  <span className="rounded-md bg-[#F7F8FA] dark:bg-[#1A1E28] px-2 py-0.5 text-[11px] font-semibold text-[#000000] dark:text-[#FFFFFF] border border-[#E5E5E5] dark:border-[#292E3A]">
                    {subject.short_name}
                  </span>
                )}
              </div>
              <h2 id="student-modal-title" className="text-xl font-bold text-[#000000] dark:text-[#FFFFFF] truncate leading-tight">
                {subjectTitle}
              </h2>
              <p className="mt-1 text-xs text-[#555555] dark:text-[#B8BDCA]">
                Academic Notes, Question Papers & Study Materials
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#858B99] hover:bg-[#F7F8FA] dark:hover:bg-[#1A1E28] hover:text-[#000000] dark:hover:text-[#FFFFFF] transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 bg-[#F7F8FA] dark:bg-[#0B0D12] space-y-5">
            {loading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse rounded-2xl border border-[#E5E5E5] dark:border-[#292E3A] bg-white dark:bg-[#14171F] p-5 shadow-sm">
                    <div className="h-5 w-48 bg-gray-200 dark:bg-[#1A1E28] rounded mb-4" />
                    <div className="space-y-3">
                      <div className="h-14 bg-gray-100 dark:bg-[#1A1E28] rounded-xl" />
                      <div className="h-14 bg-gray-100 dark:bg-[#1A1E28] rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 p-6 text-center">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="mt-2 rounded-xl bg-[#2C3480] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3D4CC4] transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : !hasAnyContent && folders.length === 0 ? (
              <div className="rounded-2xl border border-[#E5E5E5] dark:border-[#292E3A] bg-white dark:bg-[#14171F] p-10 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2C3480]/10 dark:bg-[#3D4CC4]/20 text-[#2C3480] dark:text-[#FFFFFF] mb-3">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-[#000000] dark:text-[#FFFFFF] mb-1">
                  No Notes Published Yet
                </h3>
                <p className="text-xs text-[#555555] dark:text-[#B8BDCA] max-w-sm mx-auto">
                  Study notes and question papers for this subject are currently being prepared and will be uploaded shortly.
                </p>
              </div>
            ) : (
              <>
                {/* Folders and their notes */}
                {folders.map((folder) => {
                  const folderDocs = documentsByFolder.get(folder.id) || [];

                  return (
                    <div
                      key={folder.id}
                      className="rounded-2xl border border-[#E5E5E5] dark:border-[#292E3A] bg-white dark:bg-[#14171F] p-5 shadow-sm transition-all"
                    >
                      {/* Folder Header */}
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E5E5E5] dark:border-[#292E3A]">
                        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-[#2C3480]/10 dark:bg-[#3D4CC4]/20 px-2.5 py-1 text-xs font-bold text-[#2C3480] dark:text-[#FFFFFF]">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <span>{folder.name}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-[#858B99]">
                          {folderDocs.length} {folderDocs.length === 1 ? "note" : "notes"}
                        </span>
                      </div>

                      {/* Folder Documents List */}
                      <div className="mt-3 divide-y divide-[#E5E5E5] dark:divide-[#292E3A]">
                        {folderDocs.length === 0 ? (
                          <div className="py-4 text-center">
                            <p className="text-xs text-[#858B99]">
                              No documents inside this folder yet.
                            </p>
                          </div>
                        ) : (
                          folderDocs.map(renderNoteCard)
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Direct Documents (not in any folder) */}
                {directDocuments.length > 0 && (
                  <div className="rounded-2xl border border-[#E5E5E5] dark:border-[#292E3A] bg-white dark:bg-[#14171F] p-5 shadow-sm transition-all">
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E5E5E5] dark:border-[#292E3A]">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#555555] dark:text-[#B8BDCA]">
                        {folders.length > 0 ? "General Subject Notes" : "All Notes / PDFs"}
                      </h3>
                      <span className="shrink-0 text-xs font-semibold text-[#858B99]">
                        {directDocuments.length} {directDocuments.length === 1 ? "note" : "notes"}
                      </span>
                    </div>

                    <div className="mt-3 divide-y divide-[#E5E5E5] dark:divide-[#292E3A]">
                      {directDocuments.map(renderNoteCard)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[#E5E5E5] dark:border-[#292E3A] px-6 py-4 bg-white dark:bg-[#10131A]">
            <span className="text-xs text-[#555555] dark:text-[#858B99]">
              {documents.length} document{documents.length === 1 ? "" : "s"} available
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E5E5E5] dark:border-[#292E3A] px-4 py-2 text-xs font-semibold text-[#000000] dark:text-[#FFFFFF] hover:bg-[#F7F8FA] dark:hover:bg-[#1A1E28] transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>

      {/* In-App PDF Viewer */}
      {viewingDoc && (
        <PdfViewerModal
          document={viewingDoc}
          subject={subject}
          yearLabel={yearLabel}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </>
  );
}

const SubjectCard = memo(function SubjectCard({ subject, yearLabel, onSelectSubject }) {
  const displayName = resolveSubjectName(subject) || subject.name || "Subject";
  const shortCode = String(subject.short_name || "").trim().toUpperCase() || "SUB";

  return (
    <article
      onClick={() => onSelectSubject(subject)}
      className="group flex w-full flex-col justify-between overflow-hidden rounded-2xl border border-[#E5E5E5] dark:border-[#292E3A] bg-white dark:bg-[#14171F] hover:border-[#2C3480]/50 dark:hover:border-[#3D4CC4]/50 p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
    >
      {/* 1. Automatic Subject Visual (approx 16:9, rounded-[14px], object-cover) */}
      <SubjectVisual subject={subject} />

      {/* 2. Card Information */}
      <div className="flex-1 flex flex-col justify-between mt-3.5 min-w-0">
        <div>
          <h3
            className="text-sm sm:text-base font-bold text-[#000000] dark:text-[#FFFFFF] leading-snug line-clamp-2 text-left"
            title={displayName}
          >
            {displayName}
          </h3>
          <div className="mt-2 flex items-center justify-between gap-1 text-xs">
            <span className="font-bold text-[#2C3480] dark:text-[#FFFFFF] tracking-wide">
              {shortCode}
            </span>
            <span className="rounded-md bg-[#F7F8FA] dark:bg-[#1A1E28] px-2 py-0.5 text-[11px] font-semibold text-[#555555] dark:text-[#B8BDCA] border border-[#E5E5E5] dark:border-[#292E3A]">
              {yearLabel}
            </span>
          </div>
        </div>

        {/* 3. [ View Notes ] */}
        <div className="w-full pt-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectSubject(subject);
            }}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-[#2C3480] hover:bg-[#3D4CC4] text-xs font-semibold text-white shadow-sm transition-colors"
          >
            View Notes
          </button>
        </div>
      </div>
    </article>
  );
});

const NotesSection = memo(function NotesSection({ selectedYear, subjects, loading, isAdmin, onOpenAdmin }) {
  const [selectedSubject, setSelectedSubject] = useState(null);

  useEffect(() => {
    loadAcademicYearAssets();
  }, []);

  const handleSelectSubject = (subject) => {
    trackSubjectClick(subject.short_name || "Unknown Subject", subject.year_id || 1);
    setSelectedSubject(subject);
  };

  return (
    <section
      id="notes-section"
      className="w-full max-w-content mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-10 sm:pb-14 transition-colors duration-200"
    >
      <div className="mb-6 sm:mb-8 text-left">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#000000] dark:text-[#FFFFFF] mb-2">
          {YEAR_LABELS[selectedYear] || `Year ${selectedYear}`} Subjects
        </h2>
        <p className="text-sm text-[#555555] dark:text-[#B8BDCA] max-w-2xl leading-relaxed">
          Choose a subject to access notes and study material.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 w-full">
          {Array.from({ length: 4 }).map((_, i) => (
            <SubjectCardSkeleton key={i} />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#14171F] rounded-2xl border border-[#E5E5E5] dark:border-[#292E3A] p-6 shadow-sm">
          <h3 className="text-base font-bold text-[#000000] dark:text-[#FFFFFF] mb-1">No subjects published yet</h3>
          <p className="text-sm text-[#555555] dark:text-[#B8BDCA] mb-4">Subjects for this academic year will appear here shortly.</p>
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="px-4 py-2 bg-[#2C3480] hover:bg-[#3D4CC4] text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Add Subject (Admin)
            </button>
          )}
        </div>
      ) : (
        (() => {
          const visibleSubjects = subjects.filter((subject) => {
            if (subject.is_deleted) return false;
            if (subject.is_active === false && !isAdmin) return false;
            const rawName = String(subject.name || "").trim();
            const rawShort = String(subject.short_name || "").trim();
            if (!rawName && !rawShort) return false;
            if (/^[.\-_]+$/.test(rawName) && !rawShort) return false;
            if (/^unnamed subject$/i.test(rawName) && !rawShort) return false;
            return getYearNumber(subject.year ?? subject.year_id) === selectedYear;
          });

          if (visibleSubjects.length === 0) {
            return (
              <div className="text-center py-12 bg-white dark:bg-[#14171F] rounded-2xl border border-[#E5E5E5] dark:border-[#292E3A] p-6 shadow-sm">
                <h3 className="text-base font-bold text-[#000000] dark:text-[#FFFFFF] mb-1">No subjects found for {YEAR_LABELS[selectedYear]}</h3>
                <p className="text-sm text-[#555555] dark:text-[#B8BDCA] mb-4">Subjects for this academic year will be uploaded shortly.</p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="px-4 py-2 bg-[#2C3480] hover:bg-[#3D4CC4] text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    Add Subject (Admin)
                  </button>
                )}
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 w-full">
              {visibleSubjects.map((subject) => (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  yearLabel={YEAR_LABELS[selectedYear] || `Year ${selectedYear}`}
                  onSelectSubject={handleSelectSubject}
                />
              ))}
            </div>
          );
        })()
      )}

      {/* Admin button - only show if admin */}
      {isAdmin && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={onOpenAdmin}
            className="px-5 py-2.5 bg-[#2C3480] hover:bg-[#3D4CC4] text-white rounded-xl font-semibold text-xs transition-colors shadow-sm"
          >
            Manage Subjects (Admin)
          </button>
        </div>
      )}

      {/* Student Subject Modal */}
      <AnimatePresence>
        {selectedSubject && (
          <StudentSubjectModal
            subject={selectedSubject}
            yearLabel={YEAR_LABELS[selectedYear] || `Year ${selectedYear}`}
            onClose={() => setSelectedSubject(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
});

export default NotesSection;
