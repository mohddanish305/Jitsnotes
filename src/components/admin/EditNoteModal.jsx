import { useState, useMemo, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { categoriesApi } from "../../lib/api";
import { resolveSubjectName } from "../../utils/academicCatalog";

const YEAR_OPTIONS = [
  { id: 1, label: "1st Year", short: "Year 1" },
  { id: 2, label: "2nd Year", short: "Year 2" },
  { id: 3, label: "3rd Year", short: "Year 3" },
  { id: 4, label: "4th Year", short: "Year 4" },
];

const SUGGESTED_CATEGORY_EXAMPLES = [
  "Lab Manual",
  "Assignments",
  "Viva Questions",
  "Previous Year Papers",
  "Exam Preparation",
  "Projects",
  "Reference Material",
];

export default function EditNoteModal({
  note,
  years = YEAR_OPTIONS,
  subjects = [],
  folders = [],
  categories = [],
  onClose,
  onSaved,
  onCategoryCreated,
}) {
  const [title, setTitle] = useState(note?.title || "");
  const [yearId, setYearId] = useState(() => {
    const sub = subjects.find((s) => s.id === note?.subject_id);
    return sub ? Number(sub.year_id) : 1;
  });
  const [subjectId, setSubjectId] = useState(note?.subject_id || "");
  const [unitId, setUnitId] = useState(note?.folder_id || note?.unit_id || "");
  const [categoryId, setCategoryId] = useState(note?.category_id || "");
  const [description, setDescription] = useState(note?.description || "");
  const [isActive, setIsActive] = useState(note?.is_active !== false);

  // Custom Category State
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [categoryValidationMessage, setCategoryValidationMessage] = useState(null);
  const [duplicateCategoryMatch, setDuplicateCategoryMatch] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Filter subjects by chosen year
  const availableSubjects = useMemo(() => {
    return subjects.filter((s) => Number(s.year_id) === Number(yearId));
  }, [subjects, yearId]);

  // Available folders for chosen subject
  const availableFolders = useMemo(() => {
    if (!subjectId) return [];
    return folders.filter((f) => f.subject_id === subjectId);
  }, [folders, subjectId]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !saving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  const handleCategorySelectChange = (e) => {
    const val = e.target.value;
    if (val === "__custom__") {
      setIsCustomCategoryMode(true);
      setCategoryValidationMessage(null);
      setDuplicateCategoryMatch(null);
    } else {
      setIsCustomCategoryMode(false);
      setCategoryId(val);
      setCategoryValidationMessage(null);
      setDuplicateCategoryMatch(null);
    }
  };

  const handleCreateCustomCategory = async (rawName) => {
    const nameToUse = (rawName !== undefined ? rawName : customCategoryName)
      .trim()
      .replace(/\s+/g, " ");

    if (!nameToUse) {
      setCategoryValidationMessage("Custom category name cannot be empty.");
      setDuplicateCategoryMatch(null);
      return null;
    }

    const localMatch = categories.find(
      (c) => (c.name || "").trim().toLowerCase() === nameToUse.toLowerCase()
    );
    if (localMatch) {
      setCategoryValidationMessage(`Category "${localMatch.name}" already exists.`);
      setDuplicateCategoryMatch(localMatch);
      return null;
    }

    setIsCreatingCategory(true);
    setCategoryValidationMessage(null);
    setDuplicateCategoryMatch(null);

    try {
      const newCat = await categoriesApi.create(nameToUse);
      if (onCategoryCreated) {
        onCategoryCreated(newCat);
      }
      setCategoryId(newCat.id);
      setIsCustomCategoryMode(false);
      setCustomCategoryName("");
      return newCat;
    } catch (err) {
      if (err.isDuplicate && err.existingCategory) {
        setCategoryValidationMessage(`Category "${err.existingCategory.name}" already exists.`);
        setDuplicateCategoryMatch(err.existingCategory);
      } else {
        setCategoryValidationMessage(err?.message || "Failed to create custom category.");
      }
      return null;
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!title.trim()) {
      setError("Note title is required.");
      return;
    }
    if (!subjectId) {
      setError("Subject is required.");
      return;
    }

    let finalCategoryId = categoryId;
    if (isCustomCategoryMode) {
      if (!customCategoryName.trim()) {
        setError("Please enter a category name or select an existing category.");
        return;
      }
      const createdCat = await handleCreateCustomCategory(customCategoryName);
      if (!createdCat) return;
      finalCategoryId = createdCat.id;
    }

    if (!finalCategoryId) {
      setError("Please select a category.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data, error: updateError } = await supabase
        .from("documents")
        .update({
          title: title.trim(),
          subject_id: subjectId,
          folder_id: unitId || null,
          unit_id: unitId || null,
          category_id: finalCategoryId,
          description: description.trim() || null,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", note.id)
        .select()
        .single();

      if (updateError) throw updateError;
      onSaved(data);
    } catch (err) {
      setError(err?.message || "Failed to update note. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#151515] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#262626] px-6 py-4.5 bg-[#FAFAFA] dark:bg-[#0B0B0B]">
          <div>
            <h2 className="text-base font-bold text-[#151515] dark:text-[#FAFAFA]">Edit Note</h2>
            <p className="text-xs text-[#666666] dark:text-[#999999]">Update note metadata and status</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-[#666666] hover:bg-[#E5E5E5] hover:text-[#151515] dark:text-[#999999] dark:hover:bg-[#262626] dark:hover:text-[#FAFAFA] transition"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3.5 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40">
              {error}
            </div>
          )}

          {/* Academic Year & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
                Academic Year *
              </label>
              <select
                value={yearId}
                disabled={saving}
                onChange={(e) => {
                  const newY = Number(e.target.value);
                  setYearId(newY);
                  const newSubs = subjects.filter((s) => Number(s.year_id) === newY);
                  if (newSubs.length > 0) {
                    setSubjectId(newSubs[0].id);
                  } else {
                    setSubjectId("");
                  }
                }}
                className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label || y.name || (Number(y.id) === 1 ? "1st Year" : Number(y.id) === 2 ? "2nd Year" : Number(y.id) === 3 ? "3rd Year" : Number(y.id) === 4 ? "4th Year" : `Year ${y.id}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
                Subject *
              </label>
              <select
                value={subjectId}
                disabled={saving}
                required
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
              >
                {availableSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.short_name ? `[${sub.short_name}] ` : ""}
                    {resolveSubjectName(sub.id, sub.name, sub.short_name)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Unit / Folder */}
          <div>
            <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
              Unit / Organization
            </label>
            <select
              value={unitId}
              disabled={saving}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
            >
              <option value="">No Unit / General Notes</option>
              {availableFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
              Note Title *
            </label>
            <input
              type="text"
              required
              disabled={saving}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA]">
                Category *
              </label>
              {isCustomCategoryMode && (
                <button
                  type="button"
                  onClick={() => setIsCustomCategoryMode(false)}
                  className="text-[11px] font-medium text-[#8F1D32] dark:text-[#F8E9EC] hover:underline"
                >
                  ← Choose existing
                </button>
              )}
            </div>

            <select
              value={isCustomCategoryMode ? "__custom__" : categoryId}
              disabled={saving}
              onChange={handleCategorySelectChange}
              className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__custom__">+ Create Custom Category</option>
            </select>

            {isCustomCategoryMode && (
              <div className="mt-3 p-3.5 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#0B0B0B] space-y-2">
                <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA]">
                  Custom Category Name *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCategoryName}
                    disabled={isCreatingCategory}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    placeholder="Enter category name..."
                    className="flex-1 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2 text-sm text-[#151515] dark:text-[#FAFAFA] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleCreateCustomCategory()}
                    disabled={isCreatingCategory || !customCategoryName.trim()}
                    className="px-4 py-2 rounded-xl bg-[#8F1D32] hover:bg-[#74152A] text-white text-xs font-semibold disabled:opacity-50 transition"
                  >
                    Add
                  </button>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#666666] dark:text-[#999999] mb-1">
                    Suggested examples:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_CATEGORY_EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => {
                          setCustomCategoryName(ex);
                          setCategoryValidationMessage(null);
                          setDuplicateCategoryMatch(null);
                        }}
                        className="rounded-lg bg-[#F8E9EC] hover:bg-[#8F1D32]/20 dark:bg-[#8F1D32]/20 px-2 py-1 text-[11px] font-medium text-[#8F1D32] dark:text-[#F8E9EC] transition"
                      >
                        + {ex}
                      </button>
                    ))}
                  </div>
                </div>

                {categoryValidationMessage && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900/40 space-y-1">
                    <p>{categoryValidationMessage}</p>
                    {duplicateCategoryMatch && (
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryId(duplicateCategoryMatch.id);
                          setIsCustomCategoryMode(false);
                          setCategoryValidationMessage(null);
                          setDuplicateCategoryMatch(null);
                        }}
                        className="inline-block text-xs font-bold text-[#8F1D32] dark:text-[#F8E9EC] hover:underline cursor-pointer"
                      >
                        Select existing "{duplicateCategoryMatch.name}" instead →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
              Description <span className="font-normal text-[#666666] dark:text-[#999999]">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              disabled={saving}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="edit_note_active"
              checked={isActive}
              disabled={saving}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-[#E5E5E5] text-[#8F1D32] focus:ring-[#8F1D32]"
            />
            <label htmlFor="edit_note_active" className="text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] cursor-pointer">
              Active (Visible to students)
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E5E5] dark:border-[#262626]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] px-4 py-2.5 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#8F1D32] hover:bg-[#74152A] text-white disabled:opacity-50 px-5 py-2.5 text-xs font-semibold shadow-xs transition"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
