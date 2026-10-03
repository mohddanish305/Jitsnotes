import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import AcademicContentCMS from "./AcademicContentCMS";
import DocumentsCMS from "./DocumentsCMS";
import AdminTeachers from "./AdminTeachers";

const safeDocumentFields =
  "id,title,subject_id,unit_id,category_id,storage_provider,file_size,page_count,is_active,created_at,updated_at";

const navItems = [
  {
    id: "overview",
    label: "Overview",
    path: "/admin",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: "academic",
    label: "Academic Content",
    path: "/admin/academic",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
  },
  {
    id: "documents",
    label: "Documents",
    path: "/admin/documents",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    id: "admins",
    label: "Teachers / Admins",
    path: "/admin/admins",
    superAdminOnly: true,
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
  if (pathname.startsWith("/admin/documents")) return "documents";
  if (pathname.startsWith("/admin/academic")) return "academic";
  if (pathname.startsWith("/admin/activity")) return "activity";
  if (pathname.startsWith("/admin/admins")) return "admins";
  return "overview";
};

const friendlyError = (error, fallback) => {
  if (/permission|row-level security|not authorized/i.test(String(error?.message || ""))) {
    return "You do not have permission to view this area.";
  }
  return fallback;
};

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "—";

function Metric({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-sm dark:border-[#292E3A] dark:bg-[#14171F]">
      <p className="text-xs font-bold uppercase tracking-wider text-[#555555] dark:text-[#858B99]">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-[#000000] dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-[#555555] dark:text-[#B8BDCA]">{detail}</p>
    </div>
  );
}

function Overview({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    const count = async (table, filters = []) => {
      try {
        let query = supabase.from(table).select("id", { count: "exact", head: true });
        filters.forEach(([column, value]) => {
          query = query.eq(column, value);
        });
        const res = await query;
        if (res.error) throw res.error;
        return res.count || 0;
      } catch (err) {
        if (!import.meta.env.PROD) {
          console.warn(`[Overview] Non-critical count error for ${table}:`, err);
        }
        return 0;
      }
    };

    const fetchRecent = async () => {
      try {
        const res = await supabase
          .from("documents")
          .select(safeDocumentFields)
          .order("created_at", { ascending: false })
          .limit(5);
        if (res.error) throw res.error;
        return res.data || [];
      } catch (err) {
        if (!import.meta.env.PROD) {
          console.warn("[Overview] Non-critical recent documents query error:", err);
        }
        return [];
      }
    };

    try {
      const [yearsCount, subjectsCount, unitsCount, categoriesCount, documentsCount, activeDocumentsCount, recentDocs] =
        await Promise.all([
          count("years"),
          count("subjects", [["is_deleted", false]]),
          count("units"),
          count("document_categories"),
          count("documents"),
          count("documents", [["is_active", true]]),
          fetchRecent(),
        ]);

      setStats({
        years: yearsCount,
        subjects: subjectsCount,
        units: unitsCount,
        categories: categoriesCount,
        documents: documentsCount,
        activeDocuments: activeDocumentsCount,
      });
      setRecentDocuments(recentDocs);
    } catch (err) {
      if (!import.meta.env.PROD) {
        console.error("[Overview] Unexpected failure in overview loader:", err);
      }
      setError(friendlyError(err, "Unable to load the admin overview."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  if (error) {
    return (
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-5 dark:border-[#292E3A]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#2C3480] dark:text-[#3D4CC4]">JITS Notes Admin</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#000000] dark:text-white">Overview</h1>
          </div>
          <button
            type="button"
            onClick={loadOverview}
            className="rounded-xl border border-[#E5E5E5] px-4 py-2 text-sm font-semibold text-[#555555] dark:border-[#292E3A] dark:text-gray-200"
          >
            Retry
          </button>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-300">
          Unable to load academic data. {error}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[#E5E5E5] pb-5 dark:border-[#292E3A] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C3480] dark:text-[#3D4CC4]">JITS Notes Admin</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#000000] dark:text-white">Overview</h1>
          <p className="mt-1 text-sm text-[#555555] dark:text-[#B8BDCA]">Live operational data from the shared academic catalog.</p>
        </div>
        <button
          type="button"
          onClick={loadOverview}
          disabled={loading}
          className="rounded-xl border border-[#E5E5E5] px-4 py-2 text-sm font-semibold text-[#555555] hover:bg-[#F7F8FA] disabled:opacity-50 dark:border-[#292E3A] dark:text-gray-200 dark:hover:bg-[#171B24]"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl bg-[#E5E5E5] dark:bg-[#14171F]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Years" value={stats.years} detail="Academic levels" />
          <Metric label="Subjects" value={stats.subjects} detail="Active catalog courses" />
          <Metric label="Units" value={stats.units} detail="Syllabus units" />
          <Metric label="Categories" value={stats.categories} detail="Document types" />
          <Metric label="Documents" value={stats.documents} detail={`${stats.activeDocuments} active`} />
          <Metric label="Published Active" value={stats.activeDocuments} detail="Visible in app & website" />
        </div>
      )}

      {/* Recent documents */}
      <div className="rounded-2xl border border-[#E5E5E5] bg-white shadow-sm dark:border-[#292E3A] dark:bg-[#14171F]">
        <div className="flex items-center justify-between gap-4 border-b border-[#E5E5E5] px-5 py-4 dark:border-[#292E3A]">
          <div>
            <h2 className="font-bold text-[#000000] dark:text-white">Recent Documents</h2>
            <p className="mt-0.5 text-xs text-[#555555] dark:text-[#858B99]">
              Latest notes uploaded to the academic repository.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("/admin/documents")}
            className="text-xs font-bold text-[#2C3480] hover:underline dark:text-[#3D4CC4]"
          >
            Manage all notes →
          </button>
        </div>

        {loading ? (
          <div className="p-5">
            <div className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          </div>
        ) : recentDocuments.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#555555] dark:text-[#B8BDCA]">No documents found.</p>
        ) : (
          <div className="divide-y divide-[#E5E5E5] dark:divide-[#292E3A]">
            {recentDocuments.map((document) => (
              <div key={document.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#000000] dark:text-white">{document.title}</p>
                  <p className="mt-0.5 text-xs text-[#555555] dark:text-[#858B99]">
                    {document.storage_provider === "b2" ? "Cloud PDF" : document.storage_provider} • {formatDate(document.created_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    document.is_active === false
                      ? "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                      : "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"
                  }`}
                >
                  {document.is_active === false ? "Inactive" : "Active"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Activity() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    supabase
      .from("admin_activity")
      .select("id,action,resource_type,resource_id,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError(friendlyError(queryError, "Unable to load activity."));
        setEvents(data || []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#2C3480] dark:text-[#3D4CC4]">Administration</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#000000] dark:text-white">Activity</h1>
        <p className="mt-1 text-sm text-[#555555] dark:text-[#B8BDCA]">Real administrative events recorded by the CMS.</p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      ) : loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-[#E5E5E5] dark:bg-[#14171F]" />
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E5E5] p-12 text-center text-sm text-[#555555] dark:border-[#292E3A] dark:text-[#B8BDCA]">
          No activity recorded yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white shadow-sm dark:border-[#292E3A] dark:bg-[#14171F]">
          <div className="divide-y divide-[#E5E5E5] dark:divide-[#292E3A]">
            {events.map((event) => (
              <div key={event.id} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold capitalize text-[#000000] dark:text-white">
                    {event.action.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-[#555555] dark:text-[#858B99]">
                    Resource: <span className="font-medium text-[#000000] dark:text-white">{event.resource_type}</span>
                    {event.metadata?.title ? ` — "${event.metadata.title}"` : ""}
                  </p>
                </div>
                <p className="text-xs text-[#555555] dark:text-[#858B99]">{formatDate(event.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function AdminCMS() {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const view = getView(location.pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      supabase
        .from("admin_profiles")
        .select("is_super_admin,is_active")
        .eq("id", data.user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (active) setIsSuperAdmin(profile?.is_super_admin === true && profile?.is_active !== false);
        });
    });
    return () => {
      active = false;
    };
  }, []);

  const go = (path) => {
    setMobileOpen(false);
    navigate(path);
  };

  const visibleNavItems = navItems.filter((item) => !item.superAdminOnly || isSuperAdmin);
  const currentTitle =
    view === "overview"
      ? "Overview"
      : view === "academic"
      ? "Academic Content"
      : view === "documents"
      ? "Documents"
      : view === "admins"
      ? "Teachers / Admins"
      : "Activity";

  const content =
    view === "overview" ? (
      <Overview onNavigate={go} />
    ) : view === "academic" ? (
      <AcademicContentCMS />
    ) : view === "documents" ? (
      <DocumentsCMS />
    ) : view === "admins" ? (
      isSuperAdmin ? (
        <AdminTeachers />
      ) : (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          <h2 className="text-base font-bold">Access Restricted</h2>
          <p className="mt-1 text-xs">Only Super Administrators have permission to manage administrator accounts and invitations.</p>
        </div>
      )
    ) : view === "activity" ? (
      isSuperAdmin ? (
        <Activity />
      ) : (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          <h2 className="text-base font-bold">Access Restricted</h2>
          <p className="mt-1 text-xs">Only Super Administrators have permission to view activity logs.</p>
        </div>
      )
    ) : (
      <Overview onNavigate={go} />
    );

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#000000] antialiased dark:bg-[#0B0D12] dark:text-[#FFFFFF]">
      <div className="flex min-h-screen">
        {/* Sidebar (Requirement 24) */}
        <aside
          className={`${
            mobileOpen ? "fixed inset-y-0 left-0 z-40 flex" : "hidden"
          } w-64 shrink-0 flex-col border-r border-[#E5E5E5] bg-white px-4 py-5 shadow-sm dark:border-[#292E3A] dark:bg-[#10131A] lg:relative lg:flex`}
        >
          {/* Logo & Brand Header */}
          <div className="flex items-center gap-3 border-b border-[#E5E5E5] px-2 pb-5 dark:border-[#292E3A]">
            <img src="/icons.webp" alt="JITS Notes" width="36" height="36" className="rounded-xl shadow-xs" />
            <div>
              <p className="font-extrabold tracking-tight text-[#000000] dark:text-white">JITS Notes</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#2C3480] dark:text-[#3D4CC4]">
                Admin CMS
              </p>
            </div>
          </div>

          {/* Navigation Items (Requirement 24: No emojis, clean icons) */}
          <nav className="mt-5 space-y-1" aria-label="Admin navigation">
            {visibleNavItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.path)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  view === item.id
                    ? "bg-[#2C3480] text-white shadow-sm"
                    : "text-[#555555] hover:bg-[#F7F8FA] hover:text-[#000000] dark:text-[#B8BDCA] dark:hover:bg-[#171B24] dark:hover:text-white"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}

            <p className="px-3 pb-1 pt-6 text-[10px] font-bold uppercase tracking-wider text-[#858B99]">
              Administration
            </p>

            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-[#858B99] opacity-60"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </button>
          </nav>

          {/* Sign Out Action */}
          <div className="mt-auto border-t border-[#E5E5E5] pt-4 dark:border-[#292E3A]">
            <button
              type="button"
              onClick={() => signOut()}
              className="flex w-full items-center gap-2.5 rounded-xl border border-[#E5E5E5] px-3 py-2 text-sm font-semibold text-[#555555] hover:bg-[#F7F8FA] hover:text-[#000000] dark:border-[#292E3A] dark:text-[#B8BDCA] dark:hover:bg-[#171B24] dark:hover:text-white"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </div>
        </aside>

        {/* Mobile backdrop */}
        {mobileOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs lg:hidden"
          />
        ) : null}

        {/* Main Content Area */}
        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#E5E5E5] bg-white/95 px-4 backdrop-blur dark:border-[#292E3A] dark:bg-[#0B0D12]/95 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-[#E5E5E5] px-3 py-1.5 text-xs font-semibold text-[#555555] dark:border-[#292E3A] dark:text-gray-200 lg:hidden"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              Menu
            </button>

            <div className="hidden text-sm font-bold text-[#000000] dark:text-[#FFFFFF] sm:block">
              {currentTitle}
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-xs text-[#555555] dark:text-[#858B99] sm:inline">
                Live Supabase + B2
              </span>
              <span className="h-2 w-2 rounded-full bg-green-500" title="Connected to production storage" />
            </div>
          </header>

          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{content}</div>
        </main>
      </div>
    </div>
  );
}
