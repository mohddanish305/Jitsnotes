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

export default function CategoriesCMS({ showToast }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");

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
      loadCategories();
    } catch (err) {
      setCreateError(err?.message || "Failed to create category.");
      setSaving(false);
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

        <button
          type="button"
          onClick={() => {
            setName("");
            setCreateError("");
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#8F1D32] hover:bg-[#74152A] text-white px-4 py-2.5 text-xs font-semibold shadow-xs transition cursor-pointer self-start sm:self-auto"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>+ Create Custom Category</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-3">
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

      {/* Grid of Categories */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#FAFAFA] dark:bg-[#151515]" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 space-y-3">
          <p className="font-semibold">Unable to load categories.</p>
          <p>{error}</p>
          <button
            type="button"
            onClick={loadCategories}
            className="rounded-xl bg-red-600 text-white px-4 py-2 font-semibold shadow-xs"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              className="rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] p-5 shadow-xs hover:border-[#8F1D32]/40 transition space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-[#F8E9EC] text-[#8F1D32] dark:bg-[#8F1D32]/20 dark:text-[#F8E9EC] px-2.5 py-0.5 text-xs font-bold">
                  {cat.name}
                </span>
                <span className="text-[10px] font-mono text-[#666666] dark:text-[#999999] bg-[#FAFAFA] dark:bg-[#0B0B0B] px-2 py-0.5 rounded-md border border-[#E5E5E5] dark:border-[#262626]">
                  {cat.slug || "—"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-[#666666] dark:text-[#999999] pt-2 border-t border-[#E5E5E5] dark:border-[#262626]">
                <span>
                  <strong className="text-[#151515] dark:text-[#FAFAFA] font-bold">
                    {cat.document_count}
                  </strong>{" "}
                  note{cat.document_count === 1 ? "" : "s"} tagged
                </span>
                <span className="text-[11px] text-[#999999]">
                  {cat.created_at ? new Date(cat.created_at).toLocaleDateString() : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Custom Category Modal */}
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
                className="rounded-lg p-1.5 text-[#666666] hover:bg-[#E5E5E5] dark:text-[#999999] dark:hover:bg-[#262626]"
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
                      className="rounded-lg bg-[#F8E9EC] hover:bg-[#8F1D32]/20 dark:bg-[#8F1D32]/20 px-2 py-1 text-[11px] font-medium text-[#8F1D32] dark:text-[#F8E9EC] transition"
                    >
                      + {ex}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E5E5E5] dark:border-[#262626]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  {saving ? "Creating..." : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
