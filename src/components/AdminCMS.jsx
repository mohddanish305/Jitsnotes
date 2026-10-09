import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import OverviewCMS from "./admin/OverviewCMS";
import ContentLibrary from "./admin/ContentLibrary";
import CategoriesCMS from "./admin/CategoriesCMS";
import AdminTeachers from "./AdminTeachers";
import AddNoteModal from "./admin/AddNoteModal";

const navItems = [
  {
    id: "overview",
    label: "Overview",
    path: "/admin",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "content",
    label: "Content Library",
    path: "/admin/content",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
        <path d="M6 6h10" />
        <path d="M6 10h10" />
      </svg>
    ),
  },
  {
    id: "categories",
    label: "Categories",
    path: "/admin/categories",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
  {
    id: "access",
    label: "Access Management",
    path: "/admin/access",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

const getView = (pathname) => {
  if (
    pathname.startsWith("/admin/content") ||
    pathname.startsWith("/admin/documents") ||
    pathname.startsWith("/admin/academic")
  ) {
    return "content";
  }
  if (pathname.startsWith("/admin/categories")) return "categories";
  if (pathname.startsWith("/admin/access") || pathname.startsWith("/admin/admins")) return "access";
  return "overview";
};

export default function AdminCMS() {
  const { user, signOut, isSuperAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentView = getView(location.pathname);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Global Add Note Modal State
  const [addNoteModalOpen, setAddNoteModalOpen] = useState(false);
  const [addNoteInitialProps, setAddNoteInitialProps] = useState({});

  // Shared catalog lists for Add Note Modal
  const [catalogYears, setCatalogYears] = useState([]);
  const [catalogSubjects, setCatalogSubjects] = useState([]);
  const [catalogFolders, setCatalogFolders] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadSharedCatalog = useCallback(async () => {
    try {
      const [yearsRes, subjectsRes, unitsRes, foldersRes, categoriesRes] = await Promise.all([
        supabase.from("years").select("id, name").order("id", { ascending: true }),
        supabase
          .from("subjects")
          .select("id, name, short_name, year_id, description, is_active")
          .eq("is_deleted", false)
          .order("name"),
        supabase.from("units").select("id, subject_id, unit_number, title").order("unit_number"),
        supabase.from("folders").select("id, subject_id, name").order("name"),
        supabase.from("document_categories").select("id, name, slug").order("name"),
      ]);

      setCatalogYears(yearsRes.data || []);
      setCatalogSubjects(subjectsRes.data || []);
      setCatalogCategories(categoriesRes.data || []);

      const combined = [];
      const seen = new Set();
      (foldersRes.data || []).forEach((f) => {
        seen.add(f.id);
        combined.push({ id: f.id, subject_id: f.subject_id, name: f.name });
      });
      (unitsRes.data || []).forEach((u) => {
        if (!seen.has(u.id)) {
          seen.add(u.id);
          combined.push({
            id: u.id,
            subject_id: u.subject_id,
            name: u.title || `Unit ${u.unit_number}`,
          });
        }
      });
      setCatalogFolders(combined);
    } catch (err) {
      console.warn("[AdminCMS] Shared catalog preload error:", err);
    }
  }, []);

  useEffect(() => {
    loadSharedCatalog();
  }, [loadSharedCatalog]);

  const handleOpenAddNote = (initialData = {}) => {
    setAddNoteInitialProps(initialData);
    setAddNoteModalOpen(true);
  };

  const handleNoteUploaded = () => {
    showToast("success", "Note saved and published to catalog.");
    loadSharedCatalog();
  };

  const handleCategoryCreated = (newCat) => {
    setCatalogCategories((prev) => [...prev, newCat]);
    showToast("success", `Category "${newCat.name}" created.`);
  };

  const go = (path) => {
    setMobileOpen(false);
    navigate(path);
  };

  const pageTitle =
    currentView === "overview"
      ? "Overview"
      : currentView === "content"
      ? "Content Library"
      : currentView === "categories"
      ? "Categories"
      : "Access Management";

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#151515] antialiased dark:bg-[#0B0B0B] dark:text-[#FAFAFA] transition-colors">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-xs font-semibold shadow-2xl transition-all ${
            toast.type === "error"
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/90 dark:text-red-300"
              : "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/90 dark:text-green-300"
          }`}
        >
          {toast.type === "error" ? (
            <svg className="h-4 w-4 shrink-0 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex min-h-screen">
        {/* ========================================================= */}
        {/* SIDEBAR NAVIGATION (Requirement 3: Simplified Navigation) */}
        {/* ========================================================= */}
        <aside
          className={`${
            mobileOpen ? "fixed inset-y-0 left-0 z-40 flex" : "hidden"
          } w-64 shrink-0 flex-col border-r border-[#E5E5E5] bg-white px-4 py-5 shadow-xs dark:border-[#262626] dark:bg-[#151515] lg:relative lg:flex`}
        >
          {/* Brand Header */}
          <div className="flex items-center gap-3 border-b border-[#E5E5E5] px-2 pb-5 dark:border-[#262626]">
            <img
              src="/icons.png"
              alt="JITS Notes"
              width="36"
              height="36"
              className="rounded-xl shadow-xs"
            />
            <div>
              <p className="font-bold tracking-tight text-[#151515] dark:text-[#FAFAFA]">
                JITS Notes
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8F1D32] dark:text-[#F8E9EC]">
                Academic CMS
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="mt-5 space-y-1" aria-label="Admin navigation">
            {navItems.map((item) => {
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.path)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                    active
                      ? "bg-[#F8E9EC] text-[#8F1D32] dark:bg-[#8F1D32]/20 dark:text-[#F8E9EC]"
                      : "text-[#666666] hover:bg-[#FAFAFA] hover:text-[#151515] dark:text-[#999999] dark:hover:bg-[#262626] dark:hover:text-[#FAFAFA]"
                  }`}
                >
                  <span className={active ? "text-[#8F1D32] dark:text-[#F8E9EC]" : ""}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Profile & Sign Out Footer */}
          <div className="mt-auto border-t border-[#E5E5E5] pt-4 dark:border-[#262626] space-y-2">
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E5E5E5] text-xs font-bold text-[#151515] dark:bg-[#262626] dark:text-white">
                {user?.email?.charAt(0).toUpperCase() || "A"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#151515] dark:text-[#FAFAFA]">
                  {user?.email || "Administrator"}
                </p>
                <p className="text-[10px] text-[#666666] dark:text-[#999999]">
                  {isSuperAdmin ? "Super Admin" : "Faculty Admin"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => signOut()}
              className="flex w-full items-center gap-2.5 rounded-xl border border-[#E5E5E5] px-3 py-2 text-xs font-semibold text-[#666666] hover:bg-[#FAFAFA] hover:text-[#151515] dark:border-[#262626] dark:text-[#999999] dark:hover:bg-[#262626] dark:hover:text-white transition"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Mobile backdrop */}
        {mobileOpen && (
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs lg:hidden"
          />
        )}

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 flex flex-col">
          {/* Header Bar */}
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#E5E5E5] bg-white/95 px-4 sm:px-6 backdrop-blur dark:border-[#262626] dark:bg-[#151515]/95">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[#E5E5E5] px-2.5 py-1.5 text-xs font-semibold text-[#666666] dark:border-[#262626] dark:text-[#999999] lg:hidden"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
                <span>Menu</span>
              </button>

              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-[#151515] dark:text-[#FAFAFA]">
                  {pageTitle}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Single Primary Persistent Action: + Add Note */}
              <button
                type="button"
                onClick={() => handleOpenAddNote()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#8F1D32] hover:bg-[#74152A] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                aria-label="Add Note"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Add Note</span>
              </button>

              <div className="flex items-center gap-2 pl-2 border-l border-[#E5E5E5] dark:border-[#262626]">
                <span className="hidden md:inline text-[11px] text-[#666666] dark:text-[#999999]">
                  Live Supabase + B2
                </span>
                <span
                  className="h-2 w-2 rounded-full bg-green-500"
                  title="Connected to production storage"
                />
              </div>
            </div>
          </header>

          {/* Dynamic Page Content */}
          <div className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
            {currentView === "overview" && <OverviewCMS onNavigate={go} />}

            {currentView === "content" && (
              <ContentLibrary
                showToast={showToast}
              />
            )}

            {currentView === "categories" && <CategoriesCMS showToast={showToast} />}

            {currentView === "access" && (
              <div>
                <AdminTeachers />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Global Add Note Modal */}
      {addNoteModalOpen && (
        <AddNoteModal
          years={catalogYears.length ? catalogYears : undefined}
          subjects={catalogSubjects}
          folders={catalogFolders}
          categories={catalogCategories}
          initialYearId={addNoteInitialProps.yearId || 1}
          initialSubjectId={addNoteInitialProps.subjectId || ""}
          initialUnitId={addNoteInitialProps.unitId || ""}
          onClose={() => setAddNoteModalOpen(false)}
          onUploaded={handleNoteUploaded}
          onCategoryCreated={handleCategoryCreated}
        />
      )}
    </div>
  );
}
