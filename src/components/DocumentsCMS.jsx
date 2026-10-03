import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { resolveSubjectName } from "../utils/academicCatalog";

const SAFE_DOCUMENT_FIELDS =
  "id,title,description,subject_id,folder_id,unit_id,category_id,storage_provider,mime_type,file_size,page_count,is_active,created_at,updated_at";

const YEAR_TABS = [
  { id: 1, label: "1st Year", short: "Year 1" },
  { id: 2, label: "2nd Year", short: "Year 2" },
  { id: 3, label: "3rd Year", short: "Year 3" },
  { id: 4, label: "4th Year", short: "Year 4" },
];

const friendlyError = (error, fallback) => {
  const message = String(error?.message || "");
  if (/row-level security|permission denied|not authorized|403/i.test(message)) {
    return "You do not have permission to perform this action.";
  }
  if (/network|fetch|timeout/i.test(message)) {
    return "Connection failed. Check your internet connection and try again.";
  }
  if (/unique|duplicate/i.test(message)) {
    return "A record with this name already exists.";
  }
  return fallback || message;
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
};

const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const cleanTitleFromFilename = (filename) => {
  if (!filename) return "";
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  return nameWithoutExt
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function Modal({ children, onClose, maxWidth = "max-w-xl" }) {
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
// CREATE SUBJECT MODAL
// ==========================================
function CreateSubjectModal({ initialYear, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [yearId, setYearId] = useState(initialYear || 1);
  const [description, setDescription] = useState("");
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
      const { data, error: insertError } = await supabase
        .from("subjects")
        .insert({
          name: name.trim(),
          short_name: shortName.trim().toUpperCase(),
          year_id: Number(yearId),
          description: description.trim() || null,
          drive_link: null,
          is_active: true,
          is_deleted: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      onCreated(data);
    } catch (err) {
      setError(friendlyError(err, "Failed to create subject."));
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#292E3A] px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-[#FFFFFF]">Create Subject</h2>
          <p className="text-xs text-gray-500 dark:text-[#858B99]">Add a new subject to the curriculum</p>
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
            placeholder="e.g. Applied Physics"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] placeholder-gray-400 focus:border-[#2C3480] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Short Code *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. AP"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm uppercase text-gray-900 dark:text-[#FFFFFF] placeholder-gray-400 focus:border-[#2C3480] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Academic Year *
          </label>
          <select
            value={yearId}
            onChange={(e) => setYearId(Number(e.target.value))}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-[#2C3480] focus:outline-none"
          >
            {YEAR_TABS.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
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
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] placeholder-gray-400 focus:border-[#2C3480] focus:outline-none"
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
            className="rounded-xl bg-[#2C3480] hover:bg-[#3D4CC4] disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors"
          >
            {saving ? "Creating..." : "Create Subject"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================
// EDIT SUBJECT MODAL
// ==========================================
function EditSubjectModal({ subject, onClose, onUpdated }) {
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
      setError(friendlyError(err, "Failed to update subject."));
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
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
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-[#2C3480] focus:outline-none"
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
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm uppercase text-gray-900 dark:text-[#FFFFFF] focus:border-[#2C3480] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Academic Year *
          </label>
          <select
            value={yearId}
            onChange={(e) => setYearId(Number(e.target.value))}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-[#2C3480] focus:outline-none"
          >
            {YEAR_TABS.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
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
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-[#2C3480] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="subject_active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#2C3480] focus:ring-[#2C3480]"
          />
          <label htmlFor="subject_active" className="text-xs font-semibold text-gray-700 dark:text-[#B8BDCA]">
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
            className="rounded-xl bg-[#2C3480] hover:bg-[#3D4CC4] disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================
// DELETE SUBJECT CONFIRMATION MODAL
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
      setError(friendlyError(err, "Failed to delete subject."));
      setDeleting(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
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
    </Modal>
  );
}

// ==========================================
// CREATE FOLDER MODAL
// ==========================================
function CreateFolderModal({ subject, existingFolders, onClose, onCreated }) {
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

    const isDuplicate = existingFolders.some(
      (f) => f.subject_id === subject.id && f.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setError(`A folder named "${trimmed}" already exists in this subject.`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from("folders")
        .insert({
          subject_id: subject.id,
          name: trimmed,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      onCreated(data);
    } catch (err) {
      setError(friendlyError(err, "Failed to create folder."));
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#292E3A] px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-[#FFFFFF]">Create Folder</h2>
          <p className="text-xs text-gray-500 dark:text-[#858B99]">Inside {subject.short_name || subject.name}</p>
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
            Folder Name
          </label>
          <input
            type="text"
            required
            autoFocus
            placeholder="e.g. Unit 1, Important Questions, Previous Papers"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] placeholder-gray-400 focus:border-[#2C3480] focus:outline-none"
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
            className="rounded-xl bg-[#2C3480] hover:bg-[#3D4CC4] disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors"
          >
            {saving ? "Creating..." : "Create Folder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================
// UPLOAD NOTES MODAL (MULTIPLE PDF SUPPORT)
// ==========================================
function UploadNotesModal({
  year,
  subject,
  initialFolderId,
  folders,
  categories,
  onClose,
  onUploaded,
}) {
  const [selectedFolderId, setSelectedFolderId] = useState(initialFolderId || "");
  const [fileItems, setFileItems] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // { current, total, currentName }
  const [globalError, setGlobalError] = useState(null);
  const fileInputRef = useRef(null);

  const defaultCategoryId = useMemo(() => {
    const studyMaterial = categories.find((c) => /study material|notes/i.test(c.name));
    return studyMaterial ? studyMaterial.id : categories[0]?.id || "";
  }, [categories]);

  const addFiles = (files) => {
    const newItems = [];
    for (const file of files) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setGlobalError("Only PDF files are supported.");
        continue;
      }
      if (file.size > 25 * 1024 * 1024) {
        setGlobalError(`File "${file.name}" exceeds the 25 MB limit.`);
        continue;
      }

      newItems.push({
        id: crypto.randomUUID(),
        file,
        title: cleanTitleFromFilename(file.name),
        categoryId: defaultCategoryId,
        status: "idle", // 'idle' | 'uploading' | 'done' | 'error'
        error: null,
      });
    }

    if (newItems.length > 0) {
      setFileItems((prev) => [...prev, ...newItems]);
      setGlobalError(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const handleRemoveItem = (id) => {
    setFileItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleTitleChange = (id, newTitle) => {
    setFileItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    );
  };

  const handleCategoryChange = (id, newCategoryId) => {
    setFileItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, categoryId: newCategoryId } : item))
    );
  };

  const handleUploadAll = async () => {
    if (fileItems.length === 0) {
      setGlobalError("Please select at least one PDF file.");
      return;
    }

    // Validate titles
    for (const item of fileItems) {
      if (!item.title.trim()) {
        setGlobalError("Every note must have a title.");
        return;
      }
    }

    setIsUploading(true);
    setGlobalError(null);

    const uploadedDocs = [];
    const failedItems = [];

    for (let i = 0; i < fileItems.length; i++) {
      const item = fileItems[i];
      setUploadProgress({
        current: i + 1,
        total: fileItems.length,
        currentName: item.title,
      });

      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("title", item.title.trim());
        formData.append("year_id", String(year));
        formData.append("subject_id", subject.id);
        if (selectedFolderId) {
          formData.append("folder_id", selectedFolderId);
        }
        formData.append("category_id", item.categoryId);

        const { data, error } = await supabase.functions.invoke("upload-document", {
          body: formData,
        });

        if (error || !data?.document) {
          throw new Error(data?.error || error?.message || "Upload failed");
        }

        uploadedDocs.push(data.document);
        setFileItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: "done" } : it))
        );
      } catch (err) {
        failedItems.push({ item, error: err?.message || "Failed" });
        setFileItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: "error", error: err?.message || "Failed" } : it
          )
        );
      }
    }

    setIsUploading(false);
    setUploadProgress(null);

    if (uploadedDocs.length > 0) {
      onUploaded(uploadedDocs);
    }

    if (failedItems.length === 0) {
      onClose();
    } else {
      setGlobalError(
        `${uploadedDocs.length} note(s) uploaded successfully. ${failedItems.length} file(s) failed.`
      );
    }
  };

  const targetFolder = folders.find((f) => f.id === selectedFolderId);

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#292E3A] px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-[#FFFFFF]">Add Notes</h2>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500 dark:text-[#858B99]">
            <span>{year}th Year</span>
            <span>/</span>
            <span className="font-semibold text-gray-700 dark:text-[#B8BDCA]">{subject.short_name || subject.name}</span>
            <span>/</span>
            <span className="text-[#2C3480] dark:text-[#AAB3FF] font-semibold">
              {targetFolder ? targetFolder.name : "No Folder"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isUploading}
          className="text-gray-400 hover:text-gray-600 dark:text-[#858B99] dark:hover:text-[#FFFFFF]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-6 overflow-y-auto space-y-5 flex-1">
        {globalError && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40 flex items-center justify-between">
            <span>{globalError}</span>
            <button
              type="button"
              onClick={() => setGlobalError(null)}
              className="text-red-500 hover:text-red-700 ml-2 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Folder Destination Selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Folder (Optional)
          </label>
          <select
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            disabled={isUploading}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-[#2C3480] focus:outline-none"
          >
            <option value="">No Folder (Direct under Subject)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                📁 {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-2xl border-2 border-dashed border-gray-300 dark:border-[#292E3A] hover:border-[#2C3480] dark:hover:border-[#3D4CC4] bg-[#F7F8FA] dark:bg-[#10131A] p-6 text-center transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-[#14171F] border border-gray-200 dark:border-[#292E3A] text-[#2C3480] dark:text-[#3D4CC4] shadow-sm mb-3">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-[#FFFFFF]">
            Drop PDFs here or Browse
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-[#858B99]">
            Multiple PDF files supported • Maximum 25 MB per file
          </p>
        </div>

        {/* Selected Files List */}
        {fileItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-[#858B99]">
                Selected Notes ({fileItems.length})
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-xs font-semibold text-[#2C3480] dark:text-[#AAB3FF] hover:underline"
              >
                + Add More PDFs
              </button>
            </div>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {fileItems.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3.5 transition-all ${
                    item.status === "error"
                      ? "border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20"
                      : item.status === "done"
                      ? "border-green-200 dark:border-green-900/40 bg-green-50/50 dark:bg-green-950/20"
                      : "border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#14171F]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5 shrink-0 text-[#2C3480] dark:text-[#3D4CC4]"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] truncate">
                          {item.file.name}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-[#858B99]">
                          {formatBytes(item.file.size)}
                        </p>
                      </div>
                    </div>
                    {item.status !== "done" && !isUploading && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-xs font-semibold text-gray-400 hover:text-red-500"
                      >
                        Remove
                      </button>
                    )}
                    {item.status === "done" && (
                      <span className="text-xs font-bold text-green-600 dark:text-green-400">
                        ✓ Uploaded
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 dark:text-[#858B99] mb-0.5">
                        Title
                      </label>
                      <input
                        type="text"
                        required
                        disabled={isUploading || item.status === "done"}
                        value={item.title}
                        onChange={(e) => handleTitleChange(item.id, e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-[#292E3A] bg-gray-50 dark:bg-[#1A1E28] px-2.5 py-1.5 text-xs text-gray-900 dark:text-[#FFFFFF] focus:border-[#2C3480] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 dark:text-[#858B99] mb-0.5">
                        Category
                      </label>
                      <select
                        value={item.categoryId}
                        disabled={isUploading || item.status === "done"}
                        onChange={(e) => handleCategoryChange(item.id, e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-[#292E3A] bg-gray-50 dark:bg-[#1A1E28] px-2.5 py-1.5 text-xs text-gray-900 dark:text-[#FFFFFF] focus:border-[#2C3480] focus:outline-none"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {item.error && (
                    <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                      Error: {item.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-200 dark:border-[#292E3A] px-6 py-4 bg-white dark:bg-[#14171F]">
        <div>
          {uploadProgress ? (
            <span className="text-xs font-medium text-gray-600 dark:text-[#B8BDCA]">
              Uploading {uploadProgress.current} of {uploadProgress.total}: {uploadProgress.currentName}...
            </span>
          ) : (
            <span className="text-xs text-gray-500 dark:text-[#858B99]">
              {fileItems.length} file{fileItems.length === 1 ? "" : "s"} selected
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-xl border border-gray-200 dark:border-[#292E3A] px-4 py-2 text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] hover:bg-gray-50 dark:hover:bg-[#1A1E28]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUploadAll}
            disabled={isUploading || fileItems.length === 0}
            className="rounded-xl bg-[#2C3480] hover:bg-[#3D4CC4] disabled:opacity-50 px-5 py-2 text-xs font-bold text-white shadow-sm transition-colors"
          >
            {isUploading
              ? `Uploading (${uploadProgress?.current || 1}/${uploadProgress?.total || fileItems.length})...`
              : `Upload ${fileItems.length} Note${fileItems.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ==========================================
// EDIT NOTE MODAL
// ==========================================
function EditNoteModal({ note, folders, categories, onClose, onSaved }) {
  const [title, setTitle] = useState(note.title || "");
  const [folderId, setFolderId] = useState(note.folder_id || note.unit_id || "");
  const [categoryId, setCategoryId] = useState(note.category_id || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data, error: updateError } = await supabase
        .from("documents")
        .update({
          title: title.trim(),
          folder_id: folderId || null,
          unit_id: folderId || null,
          category_id: categoryId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", note.id)
        .select()
        .single();

      if (updateError) throw updateError;
      onSaved(data);
    } catch (err) {
      setError(friendlyError(err, "Failed to update note."));
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#292E3A] px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-[#FFFFFF]">Edit Note</h2>
          <p className="text-xs text-gray-500 dark:text-[#858B99]">Update note details</p>
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
            Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-[#2C3480] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Folder (Optional)
          </label>
          <select
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-[#2C3480] focus:outline-none"
          >
            <option value="">No Folder (Direct under Subject)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                📁 {f.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] mb-1">
            Category
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2.5 text-sm text-gray-900 dark:text-[#FFFFFF] focus:border-[#2C3480] focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
            className="rounded-xl bg-[#2C3480] hover:bg-[#3D4CC4] disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================
// DELETE NOTE CONFIRMATION MODAL
// ==========================================
function DeleteNoteModal({ note, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      const { data, error: delError } = await supabase.functions.invoke("delete-document", {
        body: { document_id: note.id },
      });

      if (delError || data?.error) {
        throw new Error(data?.error || delError?.message || "Failed to delete document.");
      }

      onDeleted(note.id);
    } catch (err) {
      setError(friendlyError(err, "Failed to delete document."));
      setDeleting(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 mb-4">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h3 className="text-center text-base font-bold text-gray-900 dark:text-[#FFFFFF]">
          Delete this PDF permanently?
        </h3>
        <p className="mt-2 text-center text-xs text-gray-500 dark:text-[#858B99] leading-relaxed">
          Deleting this document will remove its private B2 file and database record. This action cannot be undone.
        </p>

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
            {deleting ? "Deleting..." : "Delete PDF"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ==========================================
// DELETE FOLDER CONFIRMATION MODAL
// ==========================================
function DeleteFolderModal({ folder, noteCount, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const hasNotes = noteCount > 0;

  const handleConfirm = async () => {
    if (hasNotes) return;
    setDeleting(true);
    setError(null);
    try {
      const { error: delError } = await supabase.from("folders").delete().eq("id", folder.id);
      if (delError) throw delError;
      onDeleted(folder.id);
    } catch (err) {
      setError(friendlyError(err, "Failed to delete folder."));
      setDeleting(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mb-4">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <h3 className="text-center text-base font-bold text-gray-900 dark:text-[#FFFFFF]">
          Delete Folder "{folder.name}"?
        </h3>

        {hasNotes ? (
          <div className="mt-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 p-4 border border-orange-200 dark:border-orange-900/40 text-center">
            <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
              This folder contains {noteCount} note{noteCount === 1 ? "" : "s"}.
            </p>
            <p className="mt-1 text-xs text-orange-700 dark:text-orange-400">
              Move the notes or remove them before deleting the folder.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-center text-xs text-gray-500 dark:text-[#858B99]">
            This empty folder will be permanently deleted.
          </p>
        )}

        {error && (
          <div className="mt-3 rounded-xl bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 dark:border-[#292E3A] px-4 py-2 text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] hover:bg-gray-50 dark:hover:bg-[#1A1E28]"
          >
            {hasNotes ? "OK" : "Cancel"}
          </button>
          {!hasNotes && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={deleting}
              className="rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors"
            >
              {deleting ? "Deleting..." : "Delete Folder"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ==========================================
// MAIN COMPONENT: DocumentsCMS
// ==========================================
export default function DocumentsCMS({ initialSubjectId = null }) {
  const [selectedYear, setSelectedYear] = useState(1);
  const [selectedSubjectId, setSelectedSubjectId] = useState(initialSubjectId);
  const [selectedFolderId, setSelectedFolderId] = useState(null); // null = all notes or root

  const [subjects, setSubjects] = useState([]);
  const [folders, setFolders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [openingDocId, setOpeningDocId] = useState(null);
  const [toast, setToast] = useState(null);

  // Modals state
  const [createSubjectOpen, setCreateSubjectOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [deletingSubject, setDeletingSubject] = useState(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [deletingNote, setDeletingNote] = useState(null);
  const [deletingFolder, setDeletingFolder] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [yearsRes, subjectsRes, unitsRes, foldersRes, categoriesRes, documentsRes] = await Promise.all([
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

      if (yearsRes.error) {
        console.error("[DocumentsCMS]", { table: "years", error: yearsRes.error });
      }
      if (subjectsRes.error) {
        console.error("[DocumentsCMS]", { table: "subjects", error: subjectsRes.error });
        throw subjectsRes.error;
      }
      if (unitsRes.error) {
        console.error("[DocumentsCMS]", { table: "units", error: unitsRes.error });
      }
      if (foldersRes.error) {
        console.error("[DocumentsCMS]", { table: "folders", error: foldersRes.error });
      }
      if (categoriesRes.error) {
        console.error("[DocumentsCMS]", { table: "document_categories", error: categoriesRes.error });
        throw categoriesRes.error;
      }
      if (documentsRes.error) {
        console.error("[DocumentsCMS]", { table: "documents", error: documentsRes.error });
        throw documentsRes.error;
      }

      setSubjects(subjectsRes.data || []);

      // Build unified folders from folders table with fallback to units
      const combinedFolders = [];
      const seenFolderIds = new Set();

      (foldersRes.data || []).forEach((f) => {
        seenFolderIds.add(f.id);
        combinedFolders.push({
          id: f.id,
          subject_id: f.subject_id,
          name: f.name,
          is_active: f.is_active !== false,
          created_at: f.created_at,
          updated_at: f.updated_at,
        });
      });

      (unitsRes.data || []).forEach((u) => {
        if (!seenFolderIds.has(u.id)) {
          seenFolderIds.add(u.id);
          combinedFolders.push({
            id: u.id,
            subject_id: u.subject_id,
            name: u.title || `Unit ${u.unit_number}`,
            is_active: u.is_active !== false,
            created_at: null,
            updated_at: null,
          });
        }
      });

      setFolders(combinedFolders);
      setCategories(categoriesRes.data || []);
      setDocuments(documentsRes.data || []);

      if (initialSubjectId) {
        const found = subjectsRes.data?.find((s) => s.id === initialSubjectId);
        if (found) {
          setSelectedYear(found.year_id || 1);
          setSelectedSubjectId(found.id);
        }
      }
    } catch (err) {
      console.error("[DocumentsCMS] Failed to load documents CMS data:", err);
      setError(friendlyError(err, "Unable to load document management data."));
    } finally {
      setLoading(false);
    }
  }, [initialSubjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived lookups
  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const folderMap = useMemo(() => {
    const map = new Map();
    folders.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [folders]);

  // Current selected subject
  const currentSubject = useMemo(() => {
    if (!selectedSubjectId) return null;
    return subjects.find((s) => s.id === selectedSubjectId) || null;
  }, [subjects, selectedSubjectId]);

  // Subjects filtered by selected year & search query
  const filteredSubjects = useMemo(() => {
    const byYear = subjects.filter((s) => Number(s.year_id) === selectedYear);
    if (!subjectSearch.trim()) return byYear;
    const query = subjectSearch.trim().toLowerCase();
    return byYear.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        (s.short_name && s.short_name.toLowerCase().includes(query))
    );
  }, [subjects, selectedYear, subjectSearch]);

  // Folders for current subject
  const currentSubjectFolders = useMemo(() => {
    if (!currentSubject) return [];
    return folders.filter((f) => f.subject_id === currentSubject.id);
  }, [folders, currentSubject]);

  // Documents for current subject
  const currentSubjectDocuments = useMemo(() => {
    if (!currentSubject) return [];
    return documents.filter((d) => d.subject_id === currentSubject.id);
  }, [documents, currentSubject]);

  // Document counts per folder
  const noteCountByFolder = useMemo(() => {
    const map = new Map();
    currentSubjectDocuments.forEach((doc) => {
      const fId = doc.folder_id || doc.unit_id;
      if (fId) {
        map.set(fId, (map.get(fId) || 0) + 1);
      }
    });
    return map;
  }, [currentSubjectDocuments]);

  // Direct notes (not in any folder)
  const directDocuments = useMemo(() => {
    return currentSubjectDocuments.filter((d) => !d.folder_id && !d.unit_id);
  }, [currentSubjectDocuments]);

  // Filtered documents currently displayed
  const displayedDocuments = useMemo(() => {
    if (!selectedFolderId) {
      return currentSubjectDocuments;
    }
    return currentSubjectDocuments.filter(
      (d) => (d.folder_id || d.unit_id) === selectedFolderId
    );
  }, [currentSubjectDocuments, selectedFolderId]);

  // Action: Open PDF
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
      showToast("error", err?.message || "Failed to open PDF.");
    } finally {
      setOpeningDocId(null);
    }
  };

  // Action: Toggle Active / Disabled
  const handleToggleActive = async (doc) => {
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
      showToast("success", `Note ${updatedActive ? "enabled" : "disabled"}.`);
    } catch (err) {
      showToast("error", friendlyError(err, "Failed to update note status."));
    }
  };

  // Handlers for modal callbacks
  const handleSubjectCreated = (newSubject) => {
    setSubjects((prev) => [...prev, newSubject]);
    setSelectedYear(newSubject.year_id || selectedYear);
    setSelectedSubjectId(newSubject.id);
    setSelectedFolderId(null);
    setCreateSubjectOpen(false);
    showToast("success", `Subject "${newSubject.name}" created.`);
  };

  const handleSubjectUpdated = (updatedSubject) => {
    setSubjects((prev) => prev.map((s) => (s.id === updatedSubject.id ? updatedSubject : s)));
    setEditingSubject(null);
    showToast("success", `Subject "${updatedSubject.name}" updated.`);
  };

  const handleSubjectDeleted = (deletedSubjectId) => {
    setSubjects((prev) => prev.filter((s) => s.id !== deletedSubjectId));
    if (selectedSubjectId === deletedSubjectId) {
      setSelectedSubjectId(null);
      setSelectedFolderId(null);
    }
    setDeletingSubject(null);
    showToast("success", "Subject permanently deleted.");
  };

  const handleFolderCreated = (newFolder) => {
    setFolders((prev) => [...prev, newFolder]);
    setCreateFolderOpen(false);
    showToast("success", `Folder "${newFolder.name}" created.`);
  };

  const handleNotesUploaded = (uploadedList) => {
    setDocuments((prev) => [...uploadedList, ...prev]);
    showToast("success", `${uploadedList.length} note(s) added successfully.`);
  };

  const handleNoteSaved = (savedDoc) => {
    setDocuments((prev) => prev.map((d) => (d.id === savedDoc.id ? savedDoc : d)));
    setEditingNote(null);
    showToast("success", "Note updated.");
  };

  const handleNoteDeleted = (deletedId) => {
    setDocuments((prev) => prev.filter((d) => d.id !== deletedId));
    setDeletingNote(null);
    showToast("success", "Note permanently deleted.");
  };

  const handleFolderDeleted = (deletedFolderId) => {
    setFolders((prev) => prev.filter((f) => f.id !== deletedFolderId));
    if (selectedFolderId === deletedFolderId) {
      setSelectedFolderId(null);
    }
    setDeletingFolder(null);
    showToast("success", "Folder deleted.");
  };

  const selectedFolderName = useMemo(() => {
    if (!selectedFolderId) return null;
    return folderMap.get(selectedFolderId) || "Folder";
  }, [selectedFolderId, folderMap]);

  return (
    <section className="space-y-6">
      {/* Toast Notification */}
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

      {/* Header & Year Tabs */}
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-[#292E3A] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C3480] dark:text-[#AAB3FF]">
            Content Management
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-[#FFFFFF]">
            Documents & Notes
          </h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-[#858B99]">
            Year → Subject → Folders → All Notes / PDFs
          </p>
        </div>

        {/* Year Tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-gray-100 dark:bg-[#14171F] p-1 border border-gray-200 dark:border-[#292E3A]">
          {YEAR_TABS.map((tab) => {
            const isSelected = selectedYear === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSelectedYear(tab.id);
                  setSelectedSubjectId(null);
                  setSelectedFolderId(null);
                }}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-[#2C3480] text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 dark:text-[#858B99] dark:hover:text-[#FFFFFF]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-10 w-64 bg-gray-100 dark:bg-[#14171F] rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 dark:bg-[#14171F] rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-3 rounded-xl bg-[#2C3480] px-4 py-2 text-xs font-bold text-white shadow-sm"
          >
            Retry
          </button>
        </div>
      ) : !currentSubject ? (
        // ==========================================
        // VIEW 1: SUBJECT SELECTION
        // ==========================================
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search subjects..."
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#14171F] pl-9 pr-4 py-2 text-xs text-gray-900 dark:text-[#FFFFFF] placeholder-gray-400 focus:border-[#2C3480] focus:outline-none"
              />
              <svg
                viewBox="0 0 24 24"
                className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
              </svg>
            </div>

            <button
              type="button"
              onClick={() => setCreateSubjectOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#2C3480] hover:bg-[#3D4CC4] px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>+ Create Subject</span>
            </button>
          </div>

          {filteredSubjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 dark:border-[#292E3A] bg-white dark:bg-[#14171F] p-12 text-center">
              <h3 className="text-sm font-bold text-gray-900 dark:text-[#FFFFFF] mb-1">
                No subjects found
              </h3>
              <p className="text-xs text-gray-500 dark:text-[#858B99] mb-4">
                {subjectSearch ? "No subjects match your search." : `No subjects created for Year ${selectedYear} yet.`}
              </p>
              <button
                type="button"
                onClick={() => setCreateSubjectOpen(true)}
                className="rounded-xl bg-[#2C3480] px-4 py-2 text-xs font-bold text-white hover:bg-[#3D4CC4]"
              >
                + Create Subject
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredSubjects.map((sub) => {
                const displayName = resolveSubjectName(sub.id, sub.name, sub.short_name);
                const subFolders = folders.filter((f) => f.subject_id === sub.id);
                const subDocs = documents.filter((d) => d.subject_id === sub.id);

                return (
                  <div
                    key={sub.id}
                    className="rounded-2xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#14171F] p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="rounded-md bg-blue-50 dark:bg-[#1A1E28] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2C3480] dark:text-[#B8BDCA] border border-blue-100 dark:border-[#292E3A]">
                          {sub.short_name || "SUB"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 dark:text-[#858B99]">
                            Year {selectedYear}
                          </span>
                          <StatusBadge active={sub.is_active !== false} />
                        </div>
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-[#FFFFFF] line-clamp-2">
                        {displayName}
                      </h3>
                      {sub.description && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-[#858B99] line-clamp-2">
                          {sub.description}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-gray-100 dark:border-[#1E2433] pt-3 mt-4 space-y-3">
                      <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-[#858B99]">
                        <span className="flex items-center gap-1.5">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#2C3480] dark:text-[#3D4CC4]" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h4.879a1.5 1.5 0 001.06-.44l1.122-1.12A1.5 1.5 0 0112.62 7.5H19.5A2.25 2.25 0 0121.75 9.75v3m-19.5 0A2.25 2.25 0 004.5 15h15a2.25 2.25 0 002.25-2.25m-19.5 0v5.25A2.25 2.25 0 004.5 20.25h15a2.25 2.25 0 002.25-2.25V12.75" />
                          </svg>
                          <span>{subFolders.length} {subFolders.length === 1 ? "folder" : "folders"}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#2C3480] dark:text-[#3D4CC4]" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <span>{subDocs.length} {subDocs.length === 1 ? "note" : "notes"}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubjectId(sub.id);
                            setSelectedFolderId(null);
                          }}
                          className="flex-1 rounded-xl bg-[#2C3480] hover:bg-[#3D4CC4] text-white py-1.5 text-xs font-bold transition shadow-sm text-center"
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSubject(sub)}
                          className="rounded-xl border border-gray-200 dark:border-[#292E3A] px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] hover:bg-gray-50 dark:hover:bg-[#1A1E28] transition"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingSubject({ subject: sub, noteCount: subDocs.length, folderCount: subFolders.length })}
                          className="rounded-xl border border-red-200 dark:border-red-900/40 p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                          aria-label="Delete subject"
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
      ) : (
        // ==========================================
        // VIEW 2: SUBJECT CONTENT (FOLDERS & NOTES)
        // ==========================================
        <div className="space-y-6">
          {/* Breadcrumb & Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#14171F] p-4 rounded-2xl border border-gray-200 dark:border-[#292E3A]">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubjectId(null);
                  setSelectedFolderId(null);
                }}
                className="font-semibold text-gray-500 hover:text-gray-900 dark:text-[#858B99] dark:hover:text-[#FFFFFF]"
              >
                {selectedYear}th Year Subjects
              </button>
              <span className="text-gray-400">/</span>
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className={`font-bold ${
                  !selectedFolderId
                    ? "text-[#2C3480] dark:text-[#AAB3FF]"
                    : "text-gray-600 hover:text-gray-900 dark:text-[#B8BDCA] dark:hover:text-[#FFFFFF]"
                }`}
              >
                {resolveSubjectName(currentSubject.id, currentSubject.name, currentSubject.short_name)}
              </button>
              {selectedFolderName && (
                <>
                  <span className="text-gray-400">/</span>
                  <span className="font-bold text-[#2C3480] dark:text-[#AAB3FF]">
                    {selectedFolderName}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCreateFolderOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#1A1E28] px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] hover:bg-gray-50 dark:hover:bg-[#242A38] shadow-sm transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#2C3480] dark:text-[#3D4CC4]" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>+ Create Folder</span>
              </button>

              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2C3480] hover:bg-[#3D4CC4] px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>+ Add Note</span>
              </button>

              <button
                type="button"
                onClick={() => setEditingSubject(currentSubject)}
                className="rounded-xl border border-gray-200 dark:border-[#292E3A] px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] hover:bg-gray-50 dark:hover:bg-[#1A1E28] transition"
              >
                Edit Subject
              </button>

              <button
                type="button"
                onClick={() =>
                  setDeletingSubject({
                    subject: currentSubject,
                    noteCount: currentSubjectDocuments.length,
                    folderCount: currentSubjectFolders.length,
                  })
                }
                className="rounded-xl border border-red-200 dark:border-red-900/40 p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                aria-label="Delete subject"
                title="Delete Subject"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          </div>

          {/* FOLDERS SECTION */}
          {!selectedFolderId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-[#858B99]">
                  Folders ({currentSubjectFolders.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setCreateFolderOpen(true)}
                  className="text-xs font-semibold text-[#2C3480] dark:text-[#AAB3FF] hover:underline"
                >
                  + New Folder
                </button>
              </div>

              {currentSubjectFolders.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 dark:border-[#292E3A] bg-gray-50/50 dark:bg-[#14171F]/40 p-6 text-center">
                  <p className="text-xs text-gray-500 dark:text-[#858B99]">
                    No folders created for this subject yet. Folders are optional.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {currentSubjectFolders.map((folder) => {
                    const count = noteCountByFolder.get(folder.id) || 0;
                    return (
                      <div
                        key={folder.id}
                        className="group flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#14171F] hover:border-[#2C3480] dark:hover:border-[#3D4CC4] shadow-sm transition-all"
                      >
                        <div
                          onClick={() => setSelectedFolderId(folder.id)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5 shrink-0 text-[#2C3480] dark:text-[#3D4CC4]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h4.879a1.5 1.5 0 001.06-.44l1.122-1.12A1.5 1.5 0 0112.62 7.5H19.5A2.25 2.25 0 0121.75 9.75v3m-19.5 0A2.25 2.25 0 004.5 15h15a2.25 2.25 0 002.25-2.25m-19.5 0v5.25A2.25 2.25 0 004.5 20.25h15a2.25 2.25 0 002.25-2.25V12.75" />
                          </svg>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-gray-900 dark:text-[#FFFFFF] truncate group-hover:text-[#2C3480] dark:group-hover:text-[#AAB3FF]">
                              {folder.name}
                            </h4>
                            <span className="text-[10px] text-gray-400 dark:text-[#858B99]">
                              {count} {count === 1 ? "note" : "notes"}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingFolder({ folder, count });
                          }}
                          aria-label={`Delete folder ${folder.name}`}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400 hover:text-red-600 transition-opacity"
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
          )}

          {/* ALL NOTES / PDFS SECTION */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-[#858B99]">
                  {selectedFolderId
                    ? `Notes in "${selectedFolderName}" (${displayedDocuments.length})`
                    : `All Notes / PDFs (${currentSubjectDocuments.length})`}
                </h2>
                {!selectedFolderId && directDocuments.length > 0 && (
                  <p className="text-[11px] text-gray-400 dark:text-[#858B99]">
                    Includes {directDocuments.length} direct note{directDocuments.length === 1 ? "" : "s"} not in any folder
                  </p>
                )}
              </div>

              {selectedFolderId && (
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(null)}
                  className="text-xs font-semibold text-[#2C3480] dark:text-[#AAB3FF] hover:underline"
                >
                  ← Show All Notes
                </button>
              )}
            </div>

            {displayedDocuments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-[#292E3A] bg-white dark:bg-[#14171F] p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-[#1A1E28] text-[#2C3480] dark:text-[#3D4CC4] mb-3">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-[#FFFFFF] mb-1">
                  No notes uploaded yet
                </h3>
                <p className="text-xs text-gray-500 dark:text-[#858B99] mb-4">
                  {selectedFolderId
                    ? `No notes in "${selectedFolderName}" yet.`
                    : "No study materials or question papers uploaded for this subject yet."}
                </p>
                <button
                  type="button"
                  onClick={() => setUploadOpen(true)}
                  className="rounded-xl bg-[#2C3480] px-4 py-2 text-xs font-bold text-white hover:bg-[#3D4CC4]"
                >
                  + Add Note
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 dark:border-[#292E3A] bg-white dark:bg-[#14171F] overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-[#1E2433]">
                {displayedDocuments.map((doc) => {
                  const categoryName = categoryMap.get(doc.category_id) || "Study Material";
                  const folderName = doc.folder_id || doc.unit_id ? folderMap.get(doc.folder_id || doc.unit_id) : null;
                  const isOpening = openingDocId === doc.id;

                  return (
                    <div
                      key={doc.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/60 dark:hover:bg-[#1A1E28]/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 shrink-0 text-[#2C3480] dark:text-[#3D4CC4]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <span className="text-sm font-semibold text-gray-900 dark:text-[#FFFFFF] truncate">
                            {doc.title}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pl-6">
                          <span className="rounded-md bg-gray-100 dark:bg-[#1E2433] px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:text-[#B8BDCA]">
                            {categoryName}
                          </span>
                          {folderName ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-[#1E2433] px-2 py-0.5 text-[10px] font-medium text-[#2C3480] dark:text-[#AAB3FF] border border-blue-100 dark:border-[#292E3A]">
                              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h4.879a1.5 1.5 0 001.06-.44l1.122-1.12A1.5 1.5 0 0112.62 7.5H19.5A2.25 2.25 0 0121.75 9.75v3m-19.5 0A2.25 2.25 0 004.5 15h15a2.25 2.25 0 002.25-2.25m-19.5 0v5.25A2.25 2.25 0 004.5 20.25h15a2.25 2.25 0 002.25-2.25V12.75" />
                              </svg>
                              <span>{folderName}</span>
                            </span>
                          ) : (
                            <span className="rounded-md bg-gray-50 dark:bg-[#1E2433] px-2 py-0.5 text-[10px] font-medium text-gray-400 dark:text-[#858B99]">
                              Direct Note
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 dark:text-[#858B99]">
                            {formatBytes(doc.file_size)}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-[#858B99]">
                            • Added {formatDate(doc.created_at)}
                          </span>
                          <StatusBadge active={doc.is_active} />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pl-6 sm:pl-0 shrink-0">
                        {/* Open PDF */}
                        <button
                          type="button"
                          onClick={() => handleOpenPdf(doc)}
                          disabled={isOpening}
                          className="rounded-lg bg-[#2C3480] hover:bg-[#3D4CC4] disabled:opacity-50 text-white px-3 py-1.5 text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                        >
                          {isOpening ? (
                            <span>Opening...</span>
                          ) : (
                            <>
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                              <span>Open PDF</span>
                            </>
                          )}
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => setEditingNote(doc)}
                          className="rounded-lg border border-gray-200 dark:border-[#292E3A] px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-[#B8BDCA] hover:bg-gray-50 dark:hover:bg-[#1A1E28] transition-colors"
                        >
                          Edit
                        </button>

                        {/* Toggle Active */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(doc)}
                          className="rounded-lg border border-gray-200 dark:border-[#292E3A] px-2.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-[#858B99] hover:bg-gray-50 dark:hover:bg-[#1A1E28] transition-colors"
                        >
                          {doc.is_active ? "Disable" : "Enable"}
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => setDeletingNote(doc)}
                          className="rounded-lg border border-red-200 dark:border-red-900/40 p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          aria-label="Delete note"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {createSubjectOpen && (
        <CreateSubjectModal
          initialYear={selectedYear}
          onClose={() => setCreateSubjectOpen(false)}
          onCreated={handleSubjectCreated}
        />
      )}

      {editingSubject && (
        <EditSubjectModal
          subject={editingSubject}
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

      {createFolderOpen && currentSubject && (
        <CreateFolderModal
          subject={currentSubject}
          existingFolders={currentSubjectFolders}
          onClose={() => setCreateFolderOpen(false)}
          onCreated={handleFolderCreated}
        />
      )}

      {uploadOpen && currentSubject && (
        <UploadNotesModal
          year={selectedYear}
          subject={currentSubject}
          initialFolderId={selectedFolderId}
          folders={currentSubjectFolders}
          categories={categories}
          onClose={() => setUploadOpen(false)}
          onUploaded={handleNotesUploaded}
        />
      )}

      {editingNote && (
        <EditNoteModal
          note={editingNote}
          folders={currentSubjectFolders}
          categories={categories}
          onClose={() => setEditingNote(null)}
          onSaved={handleNoteSaved}
        />
      )}

      {deletingNote && (
        <DeleteNoteModal
          note={deletingNote}
          onClose={() => setDeletingNote(null)}
          onDeleted={handleNoteDeleted}
        />
      )}

      {deletingFolder && (
        <DeleteFolderModal
          folder={deletingFolder.folder}
          noteCount={deletingFolder.count}
          onClose={() => setDeletingFolder(null)}
          onDeleted={handleFolderDeleted}
        />
      )}
    </section>
  );
}
