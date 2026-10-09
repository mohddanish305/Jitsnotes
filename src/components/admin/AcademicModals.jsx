import { useState } from "react";
import { supabase } from "../../lib/supabase";

const YEAR_OPTIONS = [
  { id: 1, label: "1st Year", short: "Year 1" },
  { id: 2, label: "2nd Year", short: "Year 2" },
  { id: 3, label: "3rd Year", short: "Year 3" },
  { id: 4, label: "4th Year", short: "Year 4" },
];

function ModalShell({ children, onClose, maxWidth = "max-w-md" }) {
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
        className={`w-full ${maxWidth} rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#151515] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
      >
        {children}
      </div>
    </div>
  );
}

// ==========================================
// ADD SUBJECT MODAL
// ==========================================
export function AddSubjectModal({ initialYearId = 1, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [yearId, setYearId] = useState(initialYearId ? Number(initialYearId) : 1);
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
      setError(err?.message || "Failed to create subject.");
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#262626] px-6 py-4 bg-[#FAFAFA] dark:bg-[#0B0B0B]">
        <div>
          <h2 className="text-base font-bold text-[#151515] dark:text-[#FAFAFA]">Create Subject</h2>
          <p className="text-xs text-[#666666] dark:text-[#999999]">Add a new subject to Year {yearId}</p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          className="rounded-lg p-1.5 text-[#666666] hover:bg-[#E5E5E5] dark:text-[#999999] dark:hover:bg-[#262626]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
            Subject Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Database Management Systems"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] placeholder-[#999999] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
              Short Code *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. DBMS"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm uppercase text-[#151515] dark:text-[#FAFAFA] placeholder-[#999999] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
              Academic Year *
            </label>
            <select
              value={yearId}
              onChange={(e) => setYearId(Number(e.target.value))}
              className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
            Description <span className="font-normal text-[#666666] dark:text-[#999999]">(Optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Course overview or syllabus summary"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2 text-sm text-[#151515] dark:text-[#FAFAFA] placeholder-[#999999] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E5E5E5] dark:border-[#262626]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] px-4 py-2 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#8F1D32] hover:bg-[#74152A] text-white disabled:opacity-50 px-4 py-2 text-xs font-semibold shadow-xs transition"
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
export function EditSubjectModal({ subject, onClose, onUpdated }) {
  const [name, setName] = useState(subject?.name || "");
  const [shortName, setShortName] = useState(subject?.short_name || "");
  const [yearId, setYearId] = useState(subject?.year_id || 1);
  const [description, setDescription] = useState(subject?.description || "");
  const [isActive, setIsActive] = useState(subject?.is_active !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const trimmedName = name.trim();
    const trimmedShort = shortName.trim().toUpperCase();

    if (!trimmedName || !trimmedShort) {
      setError("Subject Name and Short Code are required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const { data, error: updateError } = await supabase
        .from("subjects")
        .update({
          name: trimmedName,
          short_name: trimmedShort,
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
      setError(err?.message || "Failed to update subject.");
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#262626] px-6 py-4 bg-[#FAFAFA] dark:bg-[#0B0B0B]">
        <div>
          <h2 className="text-base font-bold text-[#151515] dark:text-[#FAFAFA]">Edit Subject</h2>
          <p className="text-xs text-[#666666] dark:text-[#999999]">Update syllabus and course catalog</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg p-1.5 text-[#666666] hover:bg-[#E5E5E5] dark:text-[#999999] dark:hover:bg-[#262626]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
            Subject Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
              Short Code *
            </label>
            <input
              type="text"
              required
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm uppercase text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
              Academic Year *
            </label>
            <select
              value={yearId}
              onChange={(e) => setYearId(Number(e.target.value))}
              className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
            Description <span className="font-normal text-[#666666] dark:text-[#999999]">(Optional)</span>
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="sub_edit_active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-[#E5E5E5] text-[#8F1D32] focus:ring-[#8F1D32]"
          />
          <label htmlFor="sub_edit_active" className="text-xs font-semibold text-[#151515] dark:text-[#FAFAFA]">
            Active in curriculum
          </label>
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E5E5E5] dark:border-[#262626]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] px-4 py-2 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#8F1D32] hover:bg-[#74152A] text-white disabled:opacity-50 px-4 py-2 text-xs font-semibold shadow-xs transition"
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
export function DeleteSubjectModal({ subject, noteCount = 0, folderCount = 0, onClose, onDeleted }) {
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
      setError(err?.message || "Failed to delete subject.");
      setDeleting(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <div className="text-center">
          <h3 className="text-base font-bold text-[#151515] dark:text-[#FAFAFA]">
            Delete Subject?
          </h3>
          <p className="mt-1 text-xs text-[#666666] dark:text-[#999999]">
            This will permanently remove <span className="font-semibold text-[#151515] dark:text-[#FAFAFA]">"{subject?.name}"</span> and its associated folders and PDFs.
          </p>
          {(noteCount > 0 || folderCount > 0) && (
            <div className="mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
              Contains {folderCount} folder(s) and {noteCount} note(s) that will be permanently removed.
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E5E5E5] dark:border-[#262626]">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] px-4 py-2 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:bg-[#FAFAFA] dark:hover:bg-[#262626]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-xs transition"
          >
            {deleting ? "Deleting Subject..." : "Delete Subject"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ==========================================
// ADD FOLDER MODAL
// ==========================================
export function AddFolderModal({ subject, existingFolders = [], onClose, onCreated }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
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
    setError("");

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
      setError(err?.message || "Failed to create folder.");
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#262626] px-6 py-4 bg-[#FAFAFA] dark:bg-[#0B0B0B]">
        <div>
          <h2 className="text-base font-bold text-[#151515] dark:text-[#FAFAFA]">Create Folder</h2>
          <p className="text-xs text-[#666666] dark:text-[#999999]">Inside {subject?.short_name || subject?.name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg p-1.5 text-[#666666] hover:bg-[#E5E5E5] dark:text-[#999999] dark:hover:bg-[#262626]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
            Folder Name *
          </label>
          <input
            type="text"
            required
            autoFocus
            placeholder="e.g. Unit 1 or Mid Exam Material"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] placeholder-[#999999] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E5E5E5] dark:border-[#262626]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] px-4 py-2 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:bg-[#FAFAFA] dark:hover:bg-[#262626]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-xl bg-[#8F1D32] hover:bg-[#74152A] text-white disabled:opacity-50 px-4 py-2 text-xs font-semibold shadow-xs transition"
          >
            {saving ? "Creating..." : "Create Folder"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ==========================================
// DELETE FOLDER MODAL
// ==========================================
export function DeleteFolderModal({ folder, noteCount = 0, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    if (noteCount > 0) {
      setError(`Cannot delete folder with ${noteCount} note(s). Please move or delete the notes first.`);
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const { error: delError } = await supabase.from("folders").delete().eq("id", folder.id);
      if (delError) throw delError;
      onDeleted(folder.id);
    } catch (err) {
      setError(err?.message || "Failed to delete folder.");
      setDeleting(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="p-6 space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <div className="text-center">
          <h3 className="text-base font-bold text-[#151515] dark:text-[#FAFAFA]">
            Delete Folder?
          </h3>
          <p className="mt-1 text-xs text-[#666666] dark:text-[#999999]">
            Are you sure you want to delete <span className="font-semibold text-[#151515] dark:text-[#FAFAFA]">"{folder?.name}"</span>?
          </p>
          {noteCount > 0 && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">
              This folder contains {noteCount} note(s). Remove the notes first before deleting.
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E5E5E5] dark:border-[#262626]">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] px-4 py-2 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:bg-[#FAFAFA] dark:hover:bg-[#262626]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting || noteCount > 0}
            className="rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-xs transition"
          >
            {deleting ? "Deleting..." : "Delete Folder"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
