import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { categoriesApi } from "../../lib/api";

const SUGGESTED_EXAMPLES = [
  "Lab Manual",
  "Assignments",
  "Viva Questions",
  "Previous Year Papers",
  "Exam Preparation",
  "Projects",
  "Reference Material",
];

const formatDate = (val) => {
  if (!val) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(val));
  } catch {
    return "—";
  }
};

export default function CategoriesCMS({
  showToast,
  onCategoryCreated,
  onCategoryDeleted,
}) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit Modal State
  const [editingCategory, setEditingCategory] = useState(null);
  const [editName, setEditName] = useState("");
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete Modal State
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [catRes, docRes] = await Promise.all([
        supabase
          .from("document_categories")
          .select("id, name, slug, created_at")
          .order("name", { ascending: true }),
        supabase.from("documents").select("category_id"),
      ]);

      if (catRes.error) throw catRes.error;

      // Count docs per category
      const counts = {};
      (docRes.data || []).forEach((d) => {
        if (d.category_id) {
          counts[d.category_id] = (counts[d.category_id] || 0) + 1;
        }
      });

      const loaded = (catRes.data || []).map((c) => ({
        ...c,
        document_count: counts[c.id] || 0,
      }));

      setCategories(loaded);
    } catch (err) {
      console.error("[CategoriesCMS] Error loading categories:", err);
      setError(err?.message || "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Create Custom Category
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (saving) return;

    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      setCreateError("Category name cannot be empty.");
      return;
    }

    // Local case-insensitive duplicate check
    const normalized = trimmed.toLowerCase();
    const existing = categories.find(
      (c) => (c.name || "").trim().toLowerCase() === normalized
    );
    if (existing) {
      setCreateError(`A category named "${existing.name}" already exists.`);
      return;
    }

    setSaving(true);
    setCreateError("");

    try {
      const created = await categoriesApi.create(trimmed);
      setShowCreateModal(false);
      setName("");
      if (showToast) {
        showToast("success", `Category "${created.name}" created successfully.`);
      }
      if (onCategoryCreated) {
        onCategoryCreated(created);
      }
      loadCategories();
    } catch (err) {
      setCreateError(err?.message || "Failed to create category.");
    } finally {
      setSaving(false);
    }
  };

  // Edit Category
  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditError("");
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (updating || !editingCategory) return;

    const trimmed = editName.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      setEditError("Category name cannot be empty.");
      return;
    }

    const normalized = trimmed.toLowerCase();
    const duplicate = categories.find(
      (c) => c.id !== editingCategory.id && (c.name || "").trim().toLowerCase() === normalized
    );
    if (duplicate) {
      setEditError(`A category named "${duplicate.name}" already exists.`);
      return;
    }

    setUpdating(true);
    setEditError("");

    try {
      const updated = await categoriesApi.update(editingCategory.id, trimmed);
      setEditingCategory(null);
      if (showToast) {
        showToast("success", `Category updated to "${updated.name}".`);
      }
      loadCategories();
    } catch (err) {
      setEditError(err?.message || "Failed to update category.");
    } finally {
      setUpdating(false);
    }
  };

  // Delete Category Safely
  const handleOpenDelete = (cat) => {
    setDeletingCategory(cat);
    setDeleteError("");
  };

  const handleConfirmDelete = async () => {
    if (!deletingCategory || deleting) return;

    if (deletingCategory.document_count > 0) {
      setDeleteError(
        `Cannot delete this category because ${deletingCategory.document_count} note(s) are currently assigned to it. Please reassign those notes first.`
      );
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      await categoriesApi.delete(deletingCategory.id);
      const deletedId = deletingCategory.id;
      const deletedName = deletingCategory.name;
      setDeletingCategory(null);

      // Optimistically update list
      setCategories((prev) => prev.filter((c) => c.id !== deletedId));

      if (showToast) {
        showToast("success", `Category "${deletedName}" was safely deleted.`);
      }

      if (onCategoryDeleted) {
        onCategoryDeleted(deletedId);
      }

      loadCategories();
    } catch (err) {
      console.error("[CategoriesCMS] Delete category failed:", err);
      setDeleteError(
        err?.message || "Failed to delete category. Ensure no documents reference this category."
      );
    } finally {
      setDeleting(false);
    }
  };

  const filteredCategories = categories.filter((c) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.slug && c.slug.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E5E5E5] dark:border-[#262626] pb-4">
        <div>
          <h2 className="text-lg font-bold text-[#151515] dark:text-[#FAFAFA]">
            Document Categories
          </h2>
          <p className="text-xs text-[#666666] dark:text-[#999999]">
            Manage material classifications for notes, question papers, and study resources
          </p>
        </div>

        {/* Primary Action Button: Exactly ONE Plus Icon */}
        <button
          type="button"
          onClick={() => {
            setName("");
            setCreateError("");
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#8F1D32] hover:bg-[#74152A] text-white px-4 py-2.5 text-xs font-semibold shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Create Custom Category</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative max-w-sm flex-1">
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
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] pl-9.5 pr-3.5 py-2 text-xs text-[#151515] dark:text-[#FAFAFA] placeholder-[#999999] focus:border-[#8F1D32] focus:outline-none"
          />
        </div>

        <span className="text-xs text-[#666666] dark:text-[#999999]">
          Total: <strong className="text-[#151515] dark:text-[#FAFAFA]">{categories.length}</strong> categories
        </span>
      </div>

      {/* Grid of Categories: Responsive 3 cols on desktop, 2 on tablet, 1 on mobile */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#FAFAFA] dark:bg-[#151515] border border-[#E5E5E5] dark:border-[#262626]" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 space-y-3">
          <p className="font-semibold">Unable to load categories.</p>
          <p>{error}</p>
          <button
            type="button"
            onClick={loadCategories}
            className="rounded-xl bg-red-600 text-white px-4 py-2 font-semibold shadow-xs cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] dark:border-[#262626] p-12 text-center bg-[#FAFAFA] dark:bg-[#151515]">
          <p className="text-sm font-semibold text-[#151515] dark:text-[#FAFAFA]">
            No categories match your search
          </p>
          <p className="mt-1 text-xs text-[#666666] dark:text-[#999999]">
            Try a different search query or create a new category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              className="group relative flex flex-col justify-between rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] p-5 shadow-xs hover:shadow-md hover:border-[#8F1D32]/50 transition-all duration-200 space-y-3"
            >
              <div>
                {/* Header: Name and Action Icons */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3
                      className="text-sm sm:text-base font-bold text-[#151515] dark:text-[#FAFAFA] truncate leading-snug group-hover:text-[#8F1D32] dark:group-hover:text-[#F8E9EC] transition-colors"
                      title={cat.name}
                    >
                      {cat.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-[#666666] dark:text-[#999999] bg-[#FAFAFA] dark:bg-[#0B0B0B] px-2 py-0.5 rounded-md border border-[#E5E5E5] dark:border-[#262626] truncate max-w-full">
                        {cat.slug || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(cat)}
                      title="Edit category"
                      aria-label={`Edit category ${cat.name}`}
                      className="rounded-lg p-1.5 text-[#666666] hover:text-[#151515] hover:bg-[#F5F5F5] dark:text-[#999999] dark:hover:text-[#FAFAFA] dark:hover:bg-[#262626] transition cursor-pointer"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDelete(cat)}
                      title="Delete category"
                      aria-label={`Delete category ${cat.name}`}
                      className="rounded-lg p-1.5 text-[#666666] hover:text-red-600 hover:bg-red-50 dark:text-[#999999] dark:hover:text-red-400 dark:hover:bg-red-950/30 transition cursor-pointer"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Card Footer: Notes Count & Created Date */}
              <div className="flex items-center justify-between text-xs text-[#666666] dark:text-[#999999] pt-3 border-t border-[#EDEDED] dark:border-[#262626]">
                <div className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-[#8F1D32] dark:text-[#A21F3D]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>
                    <strong className="text-[#151515] dark:text-[#FAFAFA] font-bold">
                      {cat.document_count}
                    </strong>{" "}
                    note{cat.document_count === 1 ? "" : "s"} tagged
                  </span>
                </div>

                <span className="text-[11px] text-[#999999] dark:text-[#666666]">
                  {formatDate(cat.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE CUSTOM CATEGORY MODAL */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setShowCreateModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#151515] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#262626] px-6 py-4 bg-[#FAFAFA] dark:bg-[#0B0B0B]">
              <div>
                <h3 className="text-base font-bold text-[#151515] dark:text-[#FAFAFA]">
                  Create Custom Category
                </h3>
                <p className="text-xs text-[#666666] dark:text-[#999999]">
                  Add a new classification for academic notes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={saving}
                className="rounded-lg p-1.5 text-[#666666] hover:bg-[#E5E5E5] dark:text-[#999999] dark:hover:bg-[#262626] cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="p-6 space-y-4">
              {createError && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40">
                  {createError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
                  Custom Category Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Enter your category name..."
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (createError) setCreateError("");
                  }}
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] placeholder-[#999999] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
                />
              </div>

              <div>
                <p className="text-[11px] font-medium text-[#666666] dark:text-[#999999] mb-1.5">
                  Suggested examples:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => {
                        setName(ex);
                        if (createError) setCreateError("");
                      }}
                      className="rounded-lg bg-[#F8E9EC] hover:bg-[#8F1D32]/20 dark:bg-[#8F1D32]/20 px-2.5 py-1 text-[11px] font-medium text-[#8F1D32] dark:text-[#F8E9EC] transition cursor-pointer"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E5E5E5] dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={saving}
                  className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] px-4 py-2 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="rounded-xl bg-[#8F1D32] hover:bg-[#74152A] text-white disabled:opacity-50 px-4 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  {saving ? "Creating..." : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CATEGORY MODAL */}
      {editingCategory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !updating) setEditingCategory(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#151515] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#262626] px-6 py-4 bg-[#FAFAFA] dark:bg-[#0B0B0B]">
              <div>
                <h3 className="text-base font-bold text-[#151515] dark:text-[#FAFAFA]">
                  Edit Category
                </h3>
                <p className="text-xs text-[#666666] dark:text-[#999999]">
                  Update category name and slug
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                disabled={updating}
                className="rounded-lg p-1.5 text-[#666666] hover:bg-[#E5E5E5] dark:text-[#999999] dark:hover:bg-[#262626] cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateCategory} className="p-6 space-y-4">
              {editError && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editName}
                  disabled={updating}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (editError) setEditError("");
                  }}
                  className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E5E5E5] dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  disabled={updating}
                  className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] px-4 py-2 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating || !editName.trim()}
                  className="rounded-xl bg-[#8F1D32] hover:bg-[#74152A] text-white disabled:opacity-50 px-4 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  {updating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAFE DELETE CATEGORY MODAL */}
      {deletingCategory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setDeletingCategory(null);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#151515] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 space-y-4">
              {deletingCategory.document_count > 0 ? (
                /* CASE A: Category is currently assigned to notes - PREVENT deletion */
                <>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>

                  <div className="text-center">
                    <h3 className="text-base font-bold text-[#151515] dark:text-[#FAFAFA]">
                      Cannot Delete Category
                    </h3>
                    <p className="mt-1 text-xs text-[#666666] dark:text-[#999999]">
                      <span className="font-semibold text-[#151515] dark:text-[#FAFAFA]">
                        "{deletingCategory.name}"
                      </span>{" "}
                      is currently assigned to{" "}
                      <strong className="text-amber-600 dark:text-amber-400">
                        {deletingCategory.document_count} academic note{deletingCategory.document_count === 1 ? "" : "s"}
                      </strong>.
                    </p>
                  </div>

                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 leading-relaxed">
                    Deleting a category must not accidentally delete associated academic notes or PDF files. To protect your student repository, please edit or reassign those notes in the Content Library before deleting this category.
                  </div>

                  {deleteError && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40">
                      {deleteError}
                    </div>
                  )}

                  <div className="flex justify-end pt-2 border-t border-[#E5E5E5] dark:border-[#262626]">
                    <button
                      type="button"
                      onClick={() => setDeletingCategory(null)}
                      className="rounded-xl bg-[#8F1D32] hover:bg-[#74152A] text-white px-4 py-2 text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      Understood
                    </button>
                  </div>
                </>
              ) : (
                /* CASE B: Category is unused - Safe confirmation */
                <>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>

                  <div className="text-center">
                    <h3 className="text-base font-bold text-[#151515] dark:text-[#FAFAFA]">
                      Delete Category?
                    </h3>
                    <p className="mt-1 text-xs text-[#666666] dark:text-[#999999]">
                      Are you sure you want to permanently delete{" "}
                      <span className="font-semibold text-[#151515] dark:text-[#FAFAFA]">
                        "{deletingCategory.name}"
                      </span>?
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#FAFAFA] dark:bg-[#0B0B0B] p-3 text-xs text-[#666666] dark:text-[#999999] border border-[#E5E5E5] dark:border-[#262626] leading-relaxed">
                    This category is currently unused and can be safely deleted. No academic notes, student records, or Backblaze B2 files will be affected.
                  </div>

                  {deleteError && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40">
                      {deleteError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E5E5E5] dark:border-[#262626]">
                    <button
                      type="button"
                      onClick={() => setDeletingCategory(null)}
                      disabled={deleting}
                      className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] px-4 py-2 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      disabled={deleting}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                    >
                      {deleting ? (
                        <>
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <span>Delete Category</span>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
