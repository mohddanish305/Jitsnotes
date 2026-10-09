import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function DeleteNoteModal({ note, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !deleting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, deleting]);

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
      setError(err?.message || "Failed to delete document. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#151515] p-6 shadow-2xl space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <div className="text-center">
          <h3 className="text-base font-bold text-[#151515] dark:text-[#FAFAFA]">
            Delete Note Permanently?
          </h3>
          <p className="mt-1 text-xs text-[#666666] dark:text-[#999999] leading-relaxed">
            Are you sure you want to delete <span className="font-semibold text-[#151515] dark:text-[#FAFAFA]">"{note?.title}"</span>?
          </p>
          <div className="mt-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20 p-3 text-[11px] text-red-700 dark:text-red-300">
            This will permanently erase the PDF from Backblaze B2 private storage and remove the record from the catalog. This action cannot be undone.
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E5E5E5] dark:border-[#262626]">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] px-4 py-2 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-xs transition"
          >
            {deleting ? "Deleting PDF..." : "Delete Permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
