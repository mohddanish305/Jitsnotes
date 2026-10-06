import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import DocumentsCMS from "./DocumentsCMS";
import { resolveSubjectName } from "../utils/academicCatalog";

const NAV_ITEMS = [
  { id: "subjects", label: "Subjects" },
  { id: "folders", label: "Folders" },
  { id: "years", label: "Years" },
  { id: "categories", label: "Categories" },
  { id: "documents", label: "Documents" },
];

const getFriendlyError = (error, fallback) => {
  const message = String(error?.message || "");
  if (/row-level security|permission denied|not authorized|403/i.test(message)) {
    return "You do not have permission to perform this action.";
  }
  if (/duplicate|unique/i.test(message)) {
    return "That record already exists. Choose a different value.";
  }
  if (/network|fetch|timeout|failed to load/i.test(message)) {
    return "Connection failed. Check your internet connection and try again.";
  }
  return fallback || message;
};

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active
          ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"
          : "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-green-500" : "bg-orange-500"}`} />
      {active ? "Active" : "Disabled"}
    </span>
  );
}

function ModalShell({ children, onClose, maxWidth = "max-w-md" }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidth} rounded-2xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#14171F] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
      >
        {children}
      </div>
    </div>
  );
}

// ==========================================
// ADD SUBJECT MODAL
// ==========================================
function AddSubjectModal({ years, initialYearId, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [yearId, setYearId] = useState(initialYearId ? Number(initialYearId) : years[0]?.id || 1);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError("");

    const trimmedName = name.trim();
    const trimmedShort = shortName.trim().toUpperCase();

    if (!trimmedName || !trimmedShort) {
      setError("Subject Name and Short Code are required.");
      return;
    }

    setSaving(true);
    try {
      const { data, error: insertError } = await supabase
        .from("subjects")
        .insert({
          name: trimmedName,
          short_name: trimmedShort,
          year_id: Number(yearId),
          description: description.trim() || null,
          is_active: true,
          is_deleted: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      onSuccess(data);
    } catch (err) {
      setError(getFriendlyError(err, "Failed to create subject."));
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#292E3A] px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-[#FFFFFF]">Create Subject</h2>
          <p className="text-xs text-gray-500 dark:text-[#858B99]">Add a new subject to the curriculum</p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:text-[#858B99] dark:hover:text-[#FFFFFF]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Subject Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Database Management Systems"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] placeholder-gray-400 focus:border-[#111111] dark:focus:border-white focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Short Code *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. DBMS"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm uppercase text-gray-900 dark:text-[#FFFFFF] placeholder-gray-400 focus:border-[#111111] dark:focus:border-white focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Academic Year *
          </label>
          <select
            value={yearId}
            onChange={(e) => setYearId(Number(e.target.value))}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-[#111111] dark:focus:border-white focus:outline-none"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Description <span className="font-normal text-gray-400 dark:text-[#858B99]">(Optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Optional subject description or course notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] placeholder-gray-400 focus:border-[#111111] dark:focus:border-white focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-[#1E2433]">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-xl border border-gray-200 dark:border-[#292E3A] px-4 py-2 text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] hover:bg-gray-50 dark:hover:bg-[#1A1E28]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim() || !shortName.trim()}
            className="rounded-xl bg-[#111111] hover:bg-[#222222] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-[#111111] disabled:opacity-50 px-4 py-2 text-xs font-medium transition"
          >
            {saving ? "Creating..." : "Create Subject"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ==========================================
// EDIT SUBJECT MODAL
// ==========================================
function EditSubjectModal({ subject, years, onClose, onUpdated }) {
  const [name, setName] = useState(subject.name || "");
  const [shortName, setShortName] = useState(subject.short_name || "");
  const [yearId, setYearId] = useState(subject.year_id || 1);
  const [description, setDescription] = useState(subject.description || "");
  const [isActive, setIsActive] = useState(subject.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !shortName.trim()) {
      setError("Subject name and short code are required.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const { data, error: updateError } = await supabase
        .from("subjects")
        .update({
          name: name.trim(),
          short_name: shortName.trim().toUpperCase(),
          year_id: Number(yearId),
          description: description.trim() || null,
          is_active: isActive,
        })
        .eq("id", subject.id)
        .select()
        .single();

      if (updateError) throw updateError;
      onUpdated(data);
    } catch (err) {
      setError(getFriendlyError(err, "Failed to update subject."));
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#292E3A] px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-[#FFFFFF]">Edit Subject</h2>
          <p className="text-xs text-gray-500 dark:text-[#858B99]">Update subject details</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:text-[#858B99] dark:hover:text-[#FFFFFF]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Subject Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-[#111111] dark:focus:border-white focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Short Code *
          </label>
          <input
            type="text"
            required
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm uppercase text-gray-900 dark:text-[#FFFFFF] focus:border-[#111111] dark:focus:border-white focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Academic Year *
          </label>
          <select
            value={yearId}
            onChange={(e) => setYearId(Number(e.target.value))}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-[#111111] dark:focus:border-white focus:outline-none"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Description <span className="font-normal text-gray-400 dark:text-[#858B99]">(Optional)</span>
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-[#111111] dark:focus:border-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="academic_subject_active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#111111] dark:text-white focus:ring-[#111111] dark:focus:ring-white"
          />
          <label htmlFor="academic_subject_active" className="text-xs font-semibold text-gray-700 dark:text-[#B8BDCA]">
            Active
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-[#1E2433]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-gray-200 dark:border-[#292E3A] px-4 py-2 text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] hover:bg-gray-50 dark:hover:bg-[#1A1E28]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#111111] hover:bg-[#222222] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-[#111111] disabled:opacity-50 px-4 py-2 text-xs font-medium shadow-sm transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ==========================================
// DELETE SUBJECT MODAL
// ==========================================
function DeleteSubjectModal({ subject, noteCount, folderCount, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      const { data, error: delError } = await supabase.functions.invoke("delete-subject", {
        body: { subject_id: subject.id },
      });

      if (delError || data?.error) {
        throw new Error(data?.error || delError?.message || "Failed to delete subject.");
      }

      onDeleted(subject.id);
    } catch (err) {
      setError(getFriendlyError(err, "Failed to delete subject."));
      setDeleting(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 mb-4">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h3 className="text-center text-base font-bold text-gray-900 dark:text-[#FFFFFF]">
          Delete Subject?
        </h3>
        <p className="mt-2 text-center text-xs text-gray-500 dark:text-[#858B99] leading-relaxed">
          This will permanently remove the subject and its associated folders/documents. Any B2-backed PDFs will also be permanently deleted.
        </p>
        {(noteCount > 0 || folderCount > 0) && (
          <div className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 text-center">
            Contains {folderCount} folder{folderCount === 1 ? "" : "s"} and {noteCount} document{noteCount === 1 ? "" : "s"} that will be removed.
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-xl border border-gray-200 dark:border-[#292E3A] px-4 py-2 text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] hover:bg-gray-50 dark:hover:bg-[#1A1E28]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors"
          >
            {deleting ? "Deleting..." : "Delete Subject"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ==========================================
// CREATE FOLDER MODAL
// ==========================================
function CreateFolderModal({ subjects, initialSubjectId, onClose, onCreated }) {
  const [subjectId, setSubjectId] = useState(initialSubjectId || subjects[0]?.id || "");
  const [folderName, setFolderName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = folderName.trim();
    if (!trimmed) {
      setError("Folder name is required.");
      return;
    }
    if (!subjectId) {
      setError("Select a subject for this folder.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from("folders")
        .insert({
          subject_id: subjectId,
          name: trimmed,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      onCreated(data);
    } catch (err) {
      setError(getFriendlyError(err, "Failed to create folder."));
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#292E3A] px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-[#FFFFFF]">Create Folder</h2>
          <p className="text-xs text-gray-500 dark:text-[#858B99]">Organize notes inside a subject</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:text-[#858B99] dark:hover:text-[#FFFFFF]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Subject *
          </label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-[#111111] dark:focus:border-white focus:outline-none"
          >
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.short_name ? `${sub.short_name} - ${sub.name}` : sub.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Folder Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Unit 1 or Mid Exam Materials"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] placeholder-gray-400 focus:border-[#111111] dark:focus:border-white focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-[#1E2433]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-gray-200 dark:border-[#292E3A] px-4 py-2 text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] hover:bg-gray-50 dark:hover:bg-[#1A1E28]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#111111] hover:bg-[#222222] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-[#111111] disabled:opacity-50 px-4 py-2 text-xs font-medium shadow-sm transition-colors"
          >
            {saving ? "Creating..." : "Create Folder"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ==========================================
// MAIN COMPONENT: AcademicContentCMS
// ==========================================
export default function AcademicContentCMS() {
  const [section, setSection] = useState("subjects");
  const [years, setYears] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [folders, setFolders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  // Modals state
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [addSubjectYearId, setAddSubjectYearId] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [deletingSubject, setDeletingSubject] = useState(null);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [folderSubjectFilter, setFolderSubjectFilter] = useState("all");

  const notify = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [yearsResult, subjectsResult, foldersResult, categoriesResult, documentsResult] =
        await Promise.all([
          supabase.from("years").select("id,name,created_at").order("id", { ascending: true }),
          supabase
            .from("subjects")
            .select("id,name,short_name,year_id,description,is_active,created_at")
            .eq("is_deleted", false)
            .order("name", { ascending: true }),
          supabase
            .from("folders")
            .select("id,subject_id,name,is_active,created_at,updated_at")
            .order("name", { ascending: true }),
          supabase
            .from("document_categories")
            .select("id,name,slug,created_at")
            .order("name", { ascending: true }),
          supabase.from("documents").select("id,subject_id,folder_id,category_id"),
        ]);

      if (yearsResult.error) throw yearsResult.error;
      if (subjectsResult.error) throw subjectsResult.error;
      if (foldersResult.error) throw foldersResult.error;
      if (categoriesResult.error) throw categoriesResult.error;
      if (documentsResult.error) throw documentsResult.error;

      const folderCountsBySubject = (foldersResult.data || []).reduce((counts, folder) => {
        counts[folder.subject_id] = (counts[folder.subject_id] || 0) + 1;
        return counts;
      }, {});

      const documentCountsBySubject = {};
      const documentCountsByFolder = {};
      const documentCountsByCategory = {};

      (documentsResult.data || []).forEach((doc) => {
        if (doc.subject_id) {
          documentCountsBySubject[doc.subject_id] = (documentCountsBySubject[doc.subject_id] || 0) + 1;
        }
        if (doc.folder_id) {
          documentCountsByFolder[doc.folder_id] = (documentCountsByFolder[doc.folder_id] || 0) + 1;
        }
        if (doc.category_id) {
          documentCountsByCategory[doc.category_id] =
            (documentCountsByCategory[doc.category_id] || 0) + 1;
        }
      });

      setYears(yearsResult.data || []);
      setSubjects(
        (subjectsResult.data || []).map((sub) => ({
          ...sub,
          folder_count: folderCountsBySubject[sub.id] || 0,
          document_count: documentCountsBySubject[sub.id] || 0,
        }))
      );
      setFolders(
        (foldersResult.data || []).map((f) => ({
          ...f,
          document_count: documentCountsByFolder[f.id] || 0,
        }))
      );
      setCategories(
        (categoriesResult.data || []).map((c) => ({
          ...c,
          document_count: documentCountsByCategory[c.id] || 0,
        }))
      );
    } catch (err) {
      setError(getFriendlyError(err, "Unable to load academic content."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenSubjectDocuments = (subject) => {
    setSelectedSubjectId(subject.id);
    setSection("documents");
  };

  const handleSubjectCreated = (newSubject) => {
    setShowAddSubjectModal(false);
    notify("success", `Subject "${newSubject.name}" created successfully.`);
    loadData();
  };

  const handleSubjectUpdated = (updatedSubject) => {
    setEditingSubject(null);
    notify("success", `Subject "${updatedSubject.name}" updated.`);
    loadData();
  };

  const handleSubjectDeleted = (_deletedSubjectId) => {
    setDeletingSubject(null);
    notify("success", "Subject permanently deleted.");
    loadData();
  };

  const handleFolderCreated = (newFolder) => {
    setShowCreateFolderModal(false);
    notify("success", `Folder "${newFolder.name}" created.`);
    loadData();
  };

  const handleDeleteFolder = async (folder) => {
    if (folder.document_count > 0) {
      notify("error", `Cannot delete folder with ${folder.document_count} document(s). Remove documents first.`);
      return;
    }
    try {
      const { error: delError } = await supabase.from("folders").delete().eq("id", folder.id);
      if (delError) throw delError;
      notify("success", "Folder deleted.");
      loadData();
    } catch (err) {
      notify("error", getFriendlyError(err, "Failed to delete folder."));
    }
  };

  // ==========================================
  // RENDER: SUBJECTS TAB
  // ==========================================
  const renderSubjectsTab = () => {
    const sortedYears = [...years].sort((a, b) => a.id - b.id);

    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-[#FFFFFF]">Subject Catalog</h2>
            <p className="text-xs text-gray-500 dark:text-[#858B99]">
              Academic subjects organized by year (1st, 2nd, 3rd, 4th Year)
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAddSubjectYearId(1);
              setShowAddSubjectModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#111111] hover:bg-[#222222] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-[#111111] px-4 py-2 text-xs font-medium shadow-sm transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>+ Create Subject</span>
          </button>
        </div>

        {sortedYears.map((year) => {
          const yearSubjects = subjects.filter((s) => s.year_id === year.id);

          return (
            <div
              key={year.id}
              className="rounded-2xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#14171F] p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#1E2433] pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-lg bg-[#F7F7F7] dark:bg-[#111111] px-2.5 py-1 text-xs font-bold text-[#111111] dark:text-white border border-[#EAEAEA] dark:border-[#222222]">
                    Year {year.id}
                  </span>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-[#FFFFFF]">{year.name}</h3>
                  <span className="text-xs text-gray-400 dark:text-[#858B99]">
                    ({yearSubjects.length} {yearSubjects.length === 1 ? "subject" : "subjects"})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddSubjectYearId(year.id);
                    setShowAddSubjectModal(true);
                  }}
                  className="text-xs font-semibold text-[#111111] dark:text-white hover:underline"
                >
                  + Add Subject
                </button>
              </div>

              {yearSubjects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 dark:border-[#292E3A] bg-gray-50/50 dark:bg-[#10131A] py-8 text-center">
                  <p className="text-xs text-gray-500 dark:text-[#858B99]">No subjects yet</p>
                  <button
                    type="button"
                    onClick={() => {
                      setAddSubjectYearId(year.id);
                      setShowAddSubjectModal(true);
                    }}
                    className="mt-2 text-xs font-bold text-[#111111] dark:text-white hover:underline"
                  >
                    + Create Subject
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {yearSubjects.map((sub) => {
                    const displayName = resolveSubjectName(sub.id, sub.name, sub.short_name);

                    return (
                      <div
                        key={sub.id}
                        className="rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#171B24] p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="rounded-md bg-[#F7F7F7] dark:bg-[#111111] px-2 py-0.5 text-[10px] font-bold uppercase text-[#111111] dark:text-[#B3B3B3] border border-[#EAEAEA] dark:border-[#222222]">
                              {sub.short_name || "SUB"}
                            </span>
                            <StatusBadge active={sub.is_active !== false} />
                          </div>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-[#FFFFFF] line-clamp-2">
                            {displayName}
                          </h4>
                          {sub.description && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-[#858B99] line-clamp-2">
                              {sub.description}
                            </p>
                          )}
                        </div>

                        <div className="border-t border-gray-100 dark:border-[#202533] pt-3 mt-3 space-y-2.5">
                          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-[#858B99]">
                            <span className="flex items-center gap-1.5">
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#111111] dark:text-white" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h4.879a1.5 1.5 0 001.06-.44l1.122-1.12A1.5 1.5 0 0112.62 7.5H19.5A2.25 2.25 0 0121.75 9.75v3m-19.5 0A2.25 2.25 0 004.5 15h15a2.25 2.25 0 002.25-2.25m-19.5 0v5.25A2.25 2.25 0 004.5 20.25h15a2.25 2.25 0 002.25-2.25V12.75" />
                              </svg>
                              <span>{sub.folder_count} {sub.folder_count === 1 ? "folder" : "folders"}</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#111111] dark:text-white" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                              <span>{sub.document_count} {sub.document_count === 1 ? "note" : "notes"}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenSubjectDocuments(sub)}
                              className="flex-1 rounded-lg bg-[#111111] hover:bg-[#222222] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-[#111111] py-1.5 text-xs font-bold transition shadow-sm text-center"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSubject(sub)}
                              className="rounded-lg border border-gray-200 dark:border-[#292E3A] px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] hover:bg-gray-50 dark:hover:bg-[#1A1E28] transition"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeletingSubject({
                                  subject: sub,
                                  noteCount: sub.document_count,
                                  folderCount: sub.folder_count,
                                })
                              }
                              className="rounded-lg border border-red-200 dark:border-red-900/40 p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                              aria-label="Delete subject"
                              title="Delete Subject"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
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
          );
        })}
      </div>
    );
  };

  // ==========================================
  // RENDER: FOLDERS TAB
  // ==========================================
  const renderFoldersTab = () => {
    const displayedFolders =
      folderSubjectFilter === "all"
        ? folders
        : folders.filter((f) => f.subject_id === folderSubjectFilter);

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-[#FFFFFF]">Subject Folders</h2>
            <p className="text-xs text-gray-500 dark:text-[#858B99]">
              Optional folder organization inside academic subjects
            </p>
          </div>
          <button
            type="button"
            disabled={subjects.length === 0}
            onClick={() => setShowCreateFolderModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#111111] hover:bg-[#222222] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-[#111111] disabled:opacity-50 px-4 py-2 text-xs font-medium shadow-sm transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>+ Create Folder</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3 bg-white dark:bg-[#14171F] p-3 rounded-2xl border border-gray-200 dark:border-[#292E3A]">
          <span className="text-xs font-semibold text-gray-500 dark:text-[#858B99]">Filter by Subject:</span>
          <select
            value={folderSubjectFilter}
            onChange={(e) => setFolderSubjectFilter(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3 py-1.5 text-xs text-gray-900 dark:text-[#FFFFFF] outline-none"
          >
            <option value="all">All Subjects</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.short_name ? `${sub.short_name} - ${sub.name}` : sub.name}
              </option>
            ))}
          </select>
        </div>

        {displayedFolders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#14171F] p-10 text-center">
            <h3 className="text-sm font-bold text-gray-900 dark:text-[#FFFFFF]">No folders found</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-[#858B99]">
              {subjects.length === 0
                ? "Create a subject first before adding folders."
                : "Create the first optional folder for a subject."}
            </p>
            {subjects.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCreateFolderModal(true)}
                className="mt-4 rounded-xl bg-[#111111] hover:bg-[#222222] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-[#111111] px-4 py-2 text-xs font-medium"
              >
                + Create Folder
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayedFolders.map((folder) => {
              const sub = subjects.find((s) => s.id === folder.subject_id);

              return (
                <div
                  key={folder.id}
                  className="rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#14171F] p-4 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5 shrink-0 text-[#111111] dark:text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h4.879a1.5 1.5 0 001.06-.44l1.122-1.12A1.5 1.5 0 0112.62 7.5H19.5A2.25 2.25 0 0121.75 9.75v3m-19.5 0A2.25 2.25 0 004.5 15h15a2.25 2.25 0 002.25-2.25m-19.5 0v5.25A2.25 2.25 0 004.5 20.25h15a2.25 2.25 0 002.25-2.25V12.75" />
                    </svg>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-gray-900 dark:text-[#FFFFFF] truncate">
                        {folder.name}
                      </h4>
                      <p className="text-[10px] text-gray-400 dark:text-[#858B99] truncate">
                        {sub?.short_name || sub?.name || "Subject"} • {folder.document_count} note{folder.document_count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteFolder(folder)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 transition"
                    title="Delete folder"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // RENDER: YEARS TAB
  // ==========================================
  const renderYearsTab = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-[#FFFFFF]">Academic Years</h2>
        <p className="text-xs text-gray-500 dark:text-[#858B99]">
          The 4 core engineering curriculum tiers
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#14171F] divide-y divide-gray-100 dark:divide-[#1E2433]">
        {years.map((year) => {
          const yearSubs = subjects.filter((s) => s.year_id === year.id);

          return (
            <div key={year.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#F7F7F7] dark:bg-[#111111] px-2 py-0.5 text-xs font-bold text-[#111111] dark:text-white border border-[#EAEAEA] dark:border-[#222222]">
                    Year {year.id}
                  </span>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-[#FFFFFF]">{year.name}</h4>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-[#858B99]">
                  {yearSubs.length} subject{yearSubs.length === 1 ? "" : "s"} enrolled
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSection("subjects");
                }}
                className="rounded-lg border border-gray-200 dark:border-[#292E3A] px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] hover:bg-gray-50 dark:hover:bg-[#1A1E28]"
              >
                View Subjects
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ==========================================
  // RENDER: CATEGORIES TAB
  // ==========================================
  const renderCategoriesTab = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-[#FFFFFF]">Document Categories</h2>
        <p className="text-xs text-gray-500 dark:text-[#858B99]">
          Standard academic material classifications
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#14171F] p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900 dark:text-[#FFFFFF]">{cat.name}</h4>
              <span className="rounded-md bg-gray-100 dark:bg-[#1E2433] px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-[#B8BDCA]">
                {cat.slug}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-[#858B99]">
              {cat.document_count} note{cat.document_count === 1 ? "" : "s"} categorized
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-xl border px-4 py-3 text-xs font-semibold shadow-xl transition-all ${
            toast.type === "error"
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/80 dark:text-red-300"
              : "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/80 dark:text-green-300"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-[#292E3A] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#111111] dark:text-white">
            Academic Content
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-[#FFFFFF]">
            Catalog Management
          </h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-[#858B99]">
            Year → Subject → Folder (Optional) → Notes / PDFs
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="rounded-xl border border-gray-200 dark:border-[#292E3A] px-3.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] hover:bg-gray-50 dark:hover:bg-[#1A1E28]"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-[#292E3A] pb-px">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSection(item.id);
              if (item.id !== "documents") {
                setSelectedSubjectId(null);
              }
            }}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
              section === item.id
                ? "border-[#111111] dark:border-white text-[#111111] dark:text-white dark:border-[#AAB3FF] dark:text-white"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:text-[#858B99] dark:hover:text-[#FFFFFF]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-3 rounded-xl bg-[#111111] text-white dark:bg-white dark:text-[#111111] px-4 py-2 text-xs font-medium shadow-sm"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          <div className="h-10 w-64 bg-gray-100 dark:bg-[#14171F] rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-100 dark:bg-[#14171F] rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : section === "documents" ? (
        <DocumentsCMS initialSubjectId={selectedSubjectId} />
      ) : section === "subjects" ? (
        renderSubjectsTab()
      ) : section === "folders" ? (
        renderFoldersTab()
      ) : section === "years" ? (
        renderYearsTab()
      ) : (
        renderCategoriesTab()
      )}

      {/* Modals */}
      {showAddSubjectModal && (
        <AddSubjectModal
          years={years}
          initialYearId={addSubjectYearId}
          onClose={() => setShowAddSubjectModal(false)}
          onSuccess={handleSubjectCreated}
        />
      )}

      {editingSubject && (
        <EditSubjectModal
          subject={editingSubject}
          years={years}
          onClose={() => setEditingSubject(null)}
          onUpdated={handleSubjectUpdated}
        />
      )}

      {deletingSubject && (
        <DeleteSubjectModal
          subject={deletingSubject.subject}
          noteCount={deletingSubject.noteCount}
          folderCount={deletingSubject.folderCount}
          onClose={() => setDeletingSubject(null)}
          onDeleted={handleSubjectDeleted}
        />
      )}

      {showCreateFolderModal && (
        <CreateFolderModal
          subjects={subjects}
          initialSubjectId={folderSubjectFilter !== "all" ? folderSubjectFilter : null}
          onClose={() => setShowCreateFolderModal(false)}
          onCreated={handleFolderCreated}
        />
      )}
    </section>
  );
}
