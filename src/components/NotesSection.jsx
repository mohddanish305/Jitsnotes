import { memo, useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Calendar,
  Layers,
  ChevronDown,
  GraduationCap,
  Laptop,
  Brain,
  Award,
} from "lucide-react";
import { trackSubjectClick, trackNoteClick } from "../utils/analytics";
import { supabase } from "../lib/supabase";
import { resolveSubjectName } from "../utils/academicCatalog";
import SubjectVisual from "./SubjectVisual";
import PdfViewerModal from "./PdfViewerModal";
import Breadcrumbs from "./Breadcrumbs";
import { loadAcademicYearAssets } from "../utils/academicYearAssets";

const _ACADEMIC_YEARS = [
  {
    id: 1,
    label: "1st Year",
    subtitle: "Core foundations & engineering sciences",
    icon: GraduationCap,
  },
  {
    id: 2,
    label: "2nd Year",
    subtitle: "Data structures & core CSE foundations",
    icon: Laptop,
  },
  {
    id: 3,
    label: "3rd Year",
    subtitle: "AIML, specialized algorithms & data",
    icon: Brain,
  },
  {
    id: 4,
    label: "4th Year",
    subtitle: "Electives, major projects & advanced topics",
    icon: Award,
  },
];

const YEAR_LABELS = {
  1: "1st Year",
  2: "2nd Year",
  3: "3rd Year",
  4: "4th Year",
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

const formatDate = (val) => {
  if (!val) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(val));
  } catch {
    return null;
  }
};

/* Skeleton Loaders */
function SubjectCardSkeleton() {
  return (
    <div className="flex w-full flex-col justify-between overflow-hidden rounded-xl sm:rounded-2xl border border-[#EDEDED] dark:border-[#222222] bg-[#FFFFFF] dark:bg-[#0B0B0B] p-2 sm:p-3.5 shadow-subtle dark:shadow-subtle-dark animate-pulse">
      <div className="aspect-[16/9] w-full rounded-lg sm:rounded-xl bg-[#F7F7F7] dark:bg-[#151515]" />
      <div className="mt-2 sm:mt-2.5 space-y-1.5">
        <div className="h-3 sm:h-4 w-3/4 bg-[#F7F7F7] dark:bg-[#151515] rounded" />
        <div className="h-2.5 sm:h-3 w-1/2 bg-[#F7F7F7] dark:bg-[#151515] rounded" />
      </div>
      <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-[#EDEDED] dark:border-[#222222] flex justify-between items-center">
        <div className="h-2.5 sm:h-3 w-12 sm:w-16 bg-[#F7F7F7] dark:bg-[#151515] rounded" />
        <div className="h-2.5 sm:h-3 w-10 sm:w-12 bg-[#F7F7F7] dark:bg-[#151515] rounded" />
      </div>
    </div>
  );
}

function UnitRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-[#EDEDED] dark:border-[#222222] bg-[#FFFFFF] dark:bg-[#0B0B0B] animate-pulse">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-lg bg-[#F7F7F7] dark:bg-[#151515] shrink-0" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="h-3.5 w-1/3 bg-[#F7F7F7] dark:bg-[#151515] rounded" />
          <div className="h-2.5 w-1/5 bg-[#F7F7F7] dark:bg-[#151515] rounded" />
        </div>
      </div>
      <div className="h-4 w-4 bg-[#F7F7F7] dark:bg-[#151515] rounded shrink-0" />
    </div>
  );
}

/* Document Card Component */
const DocumentCard = memo(function DocumentCard({ doc, onOpen }) {
  const sizeLabel = formatBytes(doc.file_size);
  const updatedDate = formatDate(doc.updated_at || doc.created_at);
  const categoryName = doc.document_categories?.name || doc.category_name || null;

  return (
    <article
      onClick={() => onOpen(doc)}
      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-[#EDEDED] dark:border-[#222222] bg-[#FFFFFF] dark:bg-[#0B0B0B] hover:border-[#8F1D32] dark:hover:border-[#A21F3D] shadow-subtle dark:shadow-subtle-dark hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
        {/* PDF Badge Icon in Soft Burgundy Tint */}
        <div className="w-10 h-10 rounded-xl bg-[#FCF4F5] dark:bg-[#1F1215] border border-[#F8E9EC] dark:border-[#2E1A1F] text-[#8F1D32] dark:text-[#A21F3D] flex items-center justify-center shrink-0 transition-colors group-hover:bg-[#8F1D32] group-hover:text-white dark:group-hover:bg-[#A21F3D]">
          <FileText className="w-5 h-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4
              className="text-xs sm:text-sm font-semibold text-[#151515] dark:text-white group-hover:text-[#8F1D32] dark:group-hover:text-[#A21F3D] transition-colors leading-tight"
              title={doc.title}
            >
              {doc.title}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#666666] dark:text-[#999999]">
            {categoryName ? (
              <span className="px-2 py-0.5 rounded-md bg-[#FCF4F5] dark:bg-[#1F1215] text-[#8F1D32] dark:text-[#A21F3D] font-semibold text-[10px]">
                {categoryName}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-md bg-[#F7F7F7] dark:bg-[#151515] text-[#151515] dark:text-white font-medium text-[10px]">
                Note
              </span>
            )}
            <span className="font-semibold text-[#151515] dark:text-white">PDF</span>
            {sizeLabel && <span>• {sizeLabel}</span>}
            {doc.page_count && <span>• {doc.page_count} pages</span>}
            {updatedDate && (
              <span className="hidden sm:inline-flex items-center gap-1">
                • <Calendar className="w-3 h-3 text-[#999999]" /> {updatedDate}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(doc);
        }}
        className="inline-flex items-center justify-center gap-1.5 self-start sm:self-center px-4 py-2 rounded-xl bg-[#151515] hover:bg-[#8F1D32] text-white dark:bg-white dark:hover:bg-[#FCF4F5] dark:text-[#151515] dark:hover:text-[#8F1D32] text-xs font-semibold shadow-xs transition-colors shrink-0 min-h-[38px]"
        aria-label={`Open PDF: ${doc.title}`}
      >
        <span>Open PDF</span>
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </article>
  );
});

/* Subject Card Component — Preserving Subject Image Artwork (2 cols on mobile, 3 cols tablet, 4 cols desktop) */
const SubjectCard = memo(function SubjectCard({ subject, counts, onSelect }) {
  const displayName = resolveSubjectName(subject) || subject.name || "Subject";
  const notesCount = counts?.notes ?? 0;

  return (
    <article
      onClick={() => onSelect(subject)}
      className="group flex w-full flex-col justify-between overflow-hidden rounded-xl sm:rounded-2xl border border-[#EDEDED] dark:border-[#222222] bg-[#FFFFFF] dark:bg-[#0B0B0B] hover:border-[#8F1D32] dark:hover:border-[#A21F3D] p-2 sm:p-3.5 shadow-subtle dark:shadow-subtle-dark hover:-translate-y-0.5 transition-all duration-200 cursor-pointer select-none"
    >
      <div>
        {/* Top: Preserved Subject Illustration with Short Code at Top-Left */}
        <SubjectVisual subject={subject} showBadge={true} />

        {/* Full Subject Name Beneath Illustration (Natural wrapping, no clipping) */}
        <h3
          className="text-xs sm:text-sm font-semibold text-[#151515] dark:text-white leading-snug line-clamp-2 text-left group-hover:text-[#8F1D32] dark:group-hover:text-[#A21F3D] transition-colors mt-2 sm:mt-2.5"
          title={displayName}
        >
          {displayName}
        </h3>

        {/* Category / Metadata Beneath Title */}
        <p className="text-[10px] sm:text-[11px] font-medium text-[#666666] dark:text-[#999999] mt-1 text-left truncate">
          {notesCount > 0 ? `${notesCount} ${notesCount === 1 ? "Note" : "Notes"}` : "Study Material"}
        </p>
      </div>

      {/* Card Footer: View Notes & Browse → Actions */}
      <div className="pt-2 sm:pt-2.5 border-t border-[#EDEDED] dark:border-[#222222] mt-2.5 sm:mt-3 flex items-center justify-between gap-1">
        <span className="text-[9px] sm:text-xs text-[#666666] dark:text-[#999999] font-medium truncate">
          View Notes
        </span>

        <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-xs font-semibold text-[#8F1D32] dark:text-[#A21F3D] group-hover:translate-x-0.5 transition-transform shrink-0">
          <span>Browse</span>
          <ArrowRight className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
        </span>
      </div>
    </article>
  );
});

/* Collapsible Unit Row Component */
const UnitRow = memo(function UnitRow({ group, isExpanded, onToggle, onOpenPdf }) {
  const noteCount = group.notes.length;

  return (
    <div className="rounded-xl border border-[#EDEDED] dark:border-[#222222] bg-[#FFFFFF] dark:bg-[#0B0B0B] shadow-subtle dark:shadow-subtle-dark overflow-hidden">
      {/* Clickable Unit Header Row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-3.5 sm:p-4 text-left hover:bg-[#FAFAFA] dark:hover:bg-[#111111] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8F1D32] focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#0B0B0B]"
        aria-expanded={isExpanded}
        aria-controls={`unit-content-${group.id}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isExpanded
              ? "bg-[#8F1D32] text-white dark:bg-[#A21F3D]"
              : "bg-[#FCF4F5] dark:bg-[#1F1215] text-[#8F1D32] dark:text-[#A21F3D] border border-[#F8E9EC] dark:border-[#2E1A1F]"
          }`}>
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-[#151515] dark:text-white leading-tight truncate">
              {group.title}
            </h3>
            <span className="text-[11px] text-[#666666] dark:text-[#999999] font-medium">
              {noteCount} {noteCount === 1 ? "note" : "notes"}
            </span>
          </div>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-[#999999] dark:text-[#666666] shrink-0 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded Notes Content */}
      {isExpanded && (
        <div
          id={`unit-content-${group.id}`}
          className="border-t border-[#EDEDED] dark:border-[#222222] px-3.5 sm:px-4 py-3 space-y-2.5 bg-[#FAFAFA] dark:bg-[#080808]"
        >
          {group.notes.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onOpen={onOpenPdf} />
          ))}
        </div>
      )}
    </div>
  );
});

/* Main NotesSection Component */
const NotesSection = memo(function NotesSection({
  selectedYear = 1,
  onYearChange,
  subjects = [],
  loading = false,
  isAdmin = false,
  onOpenAdmin,
  activeSubject: propActiveSubject = null,
  onSubjectChange,
  onOpenDocumentDirect,
}) {
  const [internalActiveSubject, setInternalActiveSubject] = useState(propActiveSubject);
  const activeSubject = propActiveSubject !== undefined && propActiveSubject !== null ? propActiveSubject : internalActiveSubject;

  const [subjectDetailsLoading, setSubjectDetailsLoading] = useState(false);
  const [subjectDocuments, setSubjectDocuments] = useState([]);
  const [subjectUnits, setSubjectUnits] = useState([]);
  const [subjectError, setSubjectError] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);

  // Track which units are expanded (by group id)
  const [expandedUnits, setExpandedUnits] = useState(new Set());

  // Subject counts cache: { [subjectId]: { notes: number } }
  const [countsMap, setCountsMap] = useState({});

  useEffect(() => {
    loadAcademicYearAssets();
  }, []);

  // Sync internal state if propActiveSubject changes
  useEffect(() => {
    if (propActiveSubject !== undefined) {
      setInternalActiveSubject(propActiveSubject);
    }
  }, [propActiveSubject]);

  // Fetch counts of documents for visible subjects
  useEffect(() => {
    if (!subjects || subjects.length === 0) return;

    let isMounted = true;
    async function fetchCounts() {
      try {
        const subjectIds = subjects.map((s) => s.id);
        const { data, error } = await supabase
          .from("documents")
          .select("subject_id")
          .in("subject_id", subjectIds)
          .eq("is_active", true);

        if (!isMounted || error) return;

        const map = {};
        subjectIds.forEach((id) => {
          map[id] = { notes: 0 };
        });

        (data || []).forEach((row) => {
          if (map[row.subject_id]) map[row.subject_id].notes++;
        });

        setCountsMap(map);
      } catch (err) {
        console.warn("Could not fetch subject counts:", err);
      }
    }

    fetchCounts();
    return () => {
      isMounted = false;
    };
  }, [subjects]);

  // Fetch ALL active documents and units for the active subject
  useEffect(() => {
    if (!activeSubject) {
      setSubjectDocuments([]);
      setSubjectUnits([]);
      setSubjectError(null);
      setExpandedUnits(new Set());
      return;
    }

    let isMounted = true;
    async function loadSubjectData() {
      setSubjectDetailsLoading(true);
      setSubjectError(null);
      setExpandedUnits(new Set());
      try {
        const [unitsRes, foldersRes, docsRes] = await Promise.all([
          supabase
            .from("units")
            .select("id, title, unit_number, is_active")
            .eq("subject_id", activeSubject.id)
            .eq("is_active", true)
            .order("unit_number", { ascending: true }),
          supabase
            .from("folders")
            .select("id, name, is_active")
            .eq("subject_id", activeSubject.id)
            .eq("is_active", true)
            .order("name", { ascending: true }),
          supabase
            .from("documents")
            .select("id, title, description, file_size, page_count, unit_id, folder_id, category_id, is_active, created_at, updated_at, document_categories(id, name)")
            .eq("subject_id", activeSubject.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false }),
        ]);

        if (!isMounted) return;

        if (docsRes.error) throw docsRes.error;

        // Build unified unit groups
        const combinedGroups = [];
        const seenIds = new Set();

        (unitsRes.data || []).forEach((u) => {
          seenIds.add(u.id);
          combinedGroups.push({
            id: u.id,
            title: u.title || `Unit ${u.unit_number}`,
            unit_number: u.unit_number,
            type: "unit",
          });
        });

        (foldersRes.data || []).forEach((f) => {
          if (!seenIds.has(f.id)) {
            seenIds.add(f.id);
            combinedGroups.push({
              id: f.id,
              title: f.name,
              unit_number: null,
              type: "folder",
            });
          }
        });

        setSubjectUnits(combinedGroups);
        setSubjectDocuments(docsRes.data || []);
      } catch (err) {
        if (isMounted) {
          console.error("Error loading subject notes:", err);
          setSubjectError("Unable to load notes for this subject. Please try again.");
        }
      } finally {
        if (isMounted) {
          setSubjectDetailsLoading(false);
        }
      }
    }

    loadSubjectData();
    return () => {
      isMounted = false;
    };
  }, [activeSubject]);

  // Auto-expand the first unit with notes once data loads
  useEffect(() => {
    if (subjectDetailsLoading || subjectDocuments.length === 0) return;
    // We intentionally don't auto-expand; units start collapsed for a compact view.
    // If there's only one group, auto-expand it for convenience.
    // This is computed after groupedDocuments is available, so we compute inline.
    const unitMap = new Map();
    subjectUnits.forEach((u) => {
      unitMap.set(u.id, { notes: [] });
    });
    const unassigned = [];
    subjectDocuments.forEach((doc) => {
      const targetId = doc.unit_id || doc.folder_id;
      if (targetId && unitMap.has(targetId)) {
        unitMap.get(targetId).notes.push(doc);
      } else {
        unassigned.push(doc);
      }
    });
    const nonEmptyCount = Array.from(unitMap.values()).filter((g) => g.notes.length > 0).length + (unassigned.length > 0 ? 1 : 0);
    if (nonEmptyCount === 1) {
      // Auto-expand the single group
      for (const [id, g] of unitMap.entries()) {
        if (g.notes.length > 0) {
          setExpandedUnits(new Set([id]));
          return;
        }
      }
      if (unassigned.length > 0) {
        setExpandedUnits(new Set(["other-notes"]));
      }
    }
  }, [subjectDetailsLoading, subjectDocuments, subjectUnits]);

  const handleSelectSubject = useCallback((subject) => {
    trackSubjectClick(subject.short_name || "Unknown Subject", subject.year_id || selectedYear);
    if (onSubjectChange) {
      onSubjectChange(subject);
    } else {
      setInternalActiveSubject(subject);
    }

    const section = document.getElementById("notes-section");
    if (section) section.scrollIntoView({ behavior: "smooth" });
  }, [onSubjectChange, selectedYear]);

  const handleBackToSubjects = useCallback(() => {
    if (onSubjectChange) {
      onSubjectChange(null);
    } else {
      setInternalActiveSubject(null);
    }

    const section = document.getElementById("notes-section");
    if (section) section.scrollIntoView({ behavior: "smooth" });
  }, [onSubjectChange]);

  const handleOpenPdf = useCallback((doc) => {
    trackNoteClick(activeSubject?.short_name || "Unknown Subject", doc.title || "Document");
    if (onOpenDocumentDirect) {
      onOpenDocumentDirect(doc, activeSubject);
    } else {
      setViewingDoc(doc);
    }
  }, [activeSubject, onOpenDocumentDirect]);

  const handleToggleUnit = useCallback((groupId) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Clean filtered subjects: remove placeholder subjects, dots, dashes, and inactive
  const visibleSubjects = useMemo(() => {
    return (subjects || []).filter((subject) => {
      if (subject.is_deleted) return false;
      if (subject.is_active === false && !isAdmin) return false;

      const rawName = String(subject.name || "").trim();
      const rawShort = String(subject.short_name || "").trim();
      if (!rawName && !rawShort) return false;

      // Filter out placeholders like ".", "..", "---", "Unnamed Subject"
      if (/^[.\-_]+$/.test(rawName) && !rawShort) return false;
      if (/^unnamed subject$/i.test(rawName) && !rawShort) return false;

      const resolved = resolveSubjectName(subject);
      if (!resolved || /^[.\-_]+$/.test(resolved) || /^unnamed subject$/i.test(resolved)) {
        return false;
      }

      return getYearNumber(subject.year ?? subject.year_id) === selectedYear;
    });
  }, [subjects, selectedYear, isAdmin]);

  // Group active documents by Unit / Group
  // Empty units are filtered out. Unassigned documents go to "Other".
  const groupedDocuments = useMemo(() => {
    if (subjectDocuments.length === 0) return [];

    const unitMap = new Map();
    subjectUnits.forEach((u) => {
      unitMap.set(u.id, {
        id: u.id,
        title: u.title,
        unit_number: u.unit_number,
        notes: [],
      });
    });

    const unassignedNotes = [];

    subjectDocuments.forEach((doc) => {
      const targetId = doc.unit_id || doc.folder_id;
      if (targetId && unitMap.has(targetId)) {
        unitMap.get(targetId).notes.push(doc);
      } else {
        unassignedNotes.push(doc);
      }
    });

    // Sort groups: Unit 1, Unit 2, Unit 3... then custom folders
    // Filter out empty units to keep the interface compact
    const sortedGroups = Array.from(unitMap.values())
      .filter((group) => group.notes.length > 0)
      .sort((a, b) => {
        if (a.unit_number && b.unit_number) return a.unit_number - b.unit_number;
        if (a.unit_number) return -1;
        if (b.unit_number) return 1;
        return a.title.localeCompare(b.title);
      });

    // If there are unassigned notes, add an "Other" section
    if (unassignedNotes.length > 0) {
      sortedGroups.push({
        id: "other-notes",
        title: "Other",
        unit_number: null,
        notes: unassignedNotes,
      });
    }

    return sortedGroups;
  }, [subjectDocuments, subjectUnits]);

  const yearLabel = YEAR_LABELS[selectedYear] || `Year ${selectedYear}`;

  return (
    <section
      id="notes-section"
      className="w-full max-w-content mx-auto px-3 sm:px-6 lg:px-8 pt-6 pb-14 transition-colors duration-200"
    >
      {/* Dynamic Hierarchical Breadcrumbs: Home -> Year -> Subject */}
      <div className="mb-6">
        <Breadcrumbs
          yearNumber={selectedYear}
          onYearClick={(y) => {
            if (activeSubject) handleBackToSubjects();
            if (onYearChange) onYearChange(y);
          }}
          subject={activeSubject}
          onSubjectClick={null}
        />
      </div>

      {/* VIEW 1: SUBJECTS LIST (When no subject is currently open) */}
      {!activeSubject && (
        <div>
          {/* Header */}
          <div className="mb-6 text-left flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#FCF4F5] dark:bg-[#1F1215] border border-[#F8E9EC] dark:border-[#2E1A1F] text-[#8F1D32] dark:text-[#A21F3D] text-[11px] font-bold mb-2">
                <span>JNTUH R22</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#151515] dark:text-white">
                {yearLabel} Subjects
              </h2>
              <p className="text-xs sm:text-sm text-[#666666] dark:text-[#999999] mt-1">
                Select a subject to view lecture notes, question banks and study materials grouped by unit.
              </p>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="self-start sm:self-auto px-4 py-2 bg-[#151515] hover:bg-[#8F1D32] text-white dark:bg-white dark:hover:bg-[#FCF4F5] dark:text-[#151515] dark:hover:text-[#8F1D32] rounded-xl text-xs font-semibold transition-colors shrink-0"
              >
                + Add Subject (Admin)
              </button>
            )}
          </div>

          {/* Subjects Content (Mobile: 2 cols, Tablet: 3 cols, Desktop: 4 cols) */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-4 lg:gap-5 w-full">
              {Array.from({ length: 4 }).map((_, i) => (
                <SubjectCardSkeleton key={i} />
              ))}
            </div>
          ) : visibleSubjects.length === 0 ? (
            <div className="text-center py-14 px-6 bg-[#FFFFFF] dark:bg-[#0B0B0B] rounded-2xl border border-[#EDEDED] dark:border-[#222222] shadow-subtle dark:shadow-subtle-dark max-w-md mx-auto">
              <div className="w-12 h-12 rounded-xl bg-[#FCF4F5] dark:bg-[#1F1215] border border-[#F8E9EC] dark:border-[#2E1A1F] text-[#8F1D32] dark:text-[#A21F3D] flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#151515] dark:text-white mb-1">
                No subjects available yet
              </h3>
              <p className="text-xs text-[#666666] dark:text-[#999999] leading-relaxed mb-4">
                Subjects published by administrators for {yearLabel} will appear here.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="px-4 py-2 bg-[#8F1D32] hover:bg-[#74152A] text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Create Subject
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-4 lg:gap-5 w-full">
              {visibleSubjects.map((subject) => (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  counts={countsMap[subject.id]}
                  onSelect={handleSelectSubject}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: NOTES PAGE (Subject -> Notes grouped by Unit, all on one page) */}
      {/* Units are collapsible rows. Clicking expands notes inline. No separate unit screen. */}
      {activeSubject && (
        <div className="space-y-5">
          {/* Subject Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl border border-[#EDEDED] dark:border-[#222222] bg-[#FFFFFF] dark:bg-[#0B0B0B] shadow-subtle dark:shadow-subtle-dark">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={handleBackToSubjects}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8F1D32] dark:text-[#A21F3D] hover:underline transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to {yearLabel} Subjects</span>
                </button>
                <span className="text-[#999999]">•</span>
                <span className="px-2 py-0.5 rounded-md bg-[#FCF4F5] dark:bg-[#1F1215] border border-[#F8E9EC] dark:border-[#2E1A1F] text-[#8F1D32] dark:text-[#A21F3D] text-[11px] font-bold">
                  {activeSubject.short_name || "SUBJECT"}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#151515] dark:text-white leading-tight">
                {resolveSubjectName(activeSubject) || activeSubject.name}
              </h2>
              <p className="text-xs sm:text-sm text-[#666666] dark:text-[#999999] mt-1.5">
                All study material, lecture notes, and question banks grouped by unit.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="px-3 py-1.5 rounded-xl bg-[#F7F7F7] dark:bg-[#151515] border border-[#EDEDED] dark:border-[#222222] text-xs font-semibold text-[#151515] dark:text-white">
                {subjectDocuments.length} {subjectDocuments.length === 1 ? "Note" : "Notes"} Available
              </span>

              <button
                type="button"
                onClick={handleBackToSubjects}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#EDEDED] dark:border-[#222222] text-xs font-semibold text-[#151515] dark:text-white hover:bg-[#F7F7F7] dark:hover:bg-[#151515] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            </div>
          </div>

          {/* Loading State */}
          {subjectDetailsLoading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <UnitRowSkeleton key={i} />
              ))}
            </div>
          ) : subjectError ? (
            <div className="rounded-2xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 p-6 text-center">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                {subjectError}
              </p>
              <button
                type="button"
                onClick={() => handleSelectSubject(activeSubject)}
                className="mt-2 rounded-xl bg-[#151515] px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-[#151515] hover:bg-[#8F1D32] transition-colors"
              >
                Retry
              </button>
            </div>
          ) : subjectDocuments.length === 0 ? (
            <div className="text-center py-14 px-6 bg-[#FFFFFF] dark:bg-[#0B0B0B] rounded-2xl border border-[#EDEDED] dark:border-[#222222] shadow-subtle dark:shadow-subtle-dark max-w-md mx-auto">
              <div className="w-12 h-12 rounded-xl bg-[#FCF4F5] dark:bg-[#1F1215] border border-[#F8E9EC] dark:border-[#2E1A1F] text-[#8F1D32] dark:text-[#A21F3D] flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#151515] dark:text-white mb-1">
                No notes uploaded yet
              </h3>
              <p className="text-xs text-[#666666] dark:text-[#999999] leading-relaxed">
                Check back soon or ask your teacher admin to upload notes for this subject.
              </p>
            </div>
          ) : (
            /* Collapsible Unit Rows: Unit 1, Unit 2, ... Other */
            <div className="space-y-2.5">
              {groupedDocuments.map((group) => (
                <UnitRow
                  key={group.id}
                  group={group}
                  isExpanded={expandedUnits.has(group.id)}
                  onToggle={() => handleToggleUnit(group.id)}
                  onOpenPdf={handleOpenPdf}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* In-App PDF Viewer Modal */}
      {viewingDoc && (
        <PdfViewerModal
          document={viewingDoc}
          subject={activeSubject}
          yearLabel={yearLabel}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </section>
  );
});

export default NotesSection;
