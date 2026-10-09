import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { resolveSubjectName } from "../../utils/academicCatalog";

const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (val) => {
  if (!val) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(val));
};

function MetricCard({ label, value, detail, icon }) {
  return (
    <div className="rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] p-5 shadow-xs space-y-2 hover:border-[#8F1D32]/40 transition">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#666666] dark:text-[#999999]">
          {label}
        </p>
        {icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F8E9EC] text-[#8F1D32] dark:bg-[#8F1D32]/20 dark:text-[#F8E9EC]">
            {icon}
          </span>
        )}
      </div>
      <p className="text-3xl font-extrabold tracking-tight text-[#151515] dark:text-[#FAFAFA]">
        {value}
      </p>
      <p className="text-xs text-[#666666] dark:text-[#999999]">{detail}</p>
    </div>
  );
}

export default function OverviewCMS({ onNavigate, onOpenAddNote }) {
  const [stats, setStats] = useState(null);
  const [recentDocs, setRecentDocs] = useState([]);
  const [subjectsMap, setSubjectsMap] = useState(new Map());
  const [categoriesMap, setCategoriesMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingDocId, setOpeningDocId] = useState(null);

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
        console.warn(`[Overview] Count error for ${table}:`, err);
        return 0;
      }
    };

    try {
      const [
        yearsCount,
        subjectsCount,
        unitsCount,
        foldersCount,
        categoriesCount,
        documentsCount,
        activeDocsCount,
        recentDocsRes,
        subsRes,
        catsRes,
      ] = await Promise.all([
        count("years"),
        count("subjects", [["is_deleted", false]]),
        count("units"),
        count("folders"),
        count("document_categories"),
        count("documents"),
        count("documents", [["is_active", true]]),
        supabase
          .from("documents")
          .select("id, title, subject_id, category_id, file_size, is_active, created_at")
          .order("created_at", { ascending: false })
          .limit(6),
        supabase.from("subjects").select("id, name, short_name, year_id"),
        supabase.from("document_categories").select("id, name"),
      ]);

      setStats({
        years: yearsCount,
        subjects: subjectsCount,
        units: unitsCount + foldersCount,
        categories: categoriesCount,
        documents: documentsCount,
        activeDocuments: activeDocsCount,
      });

      const sMap = new Map();
      (subsRes.data || []).forEach((s) => sMap.set(s.id, s));
      setSubjectsMap(sMap);

      const cMap = new Map();
      (catsRes.data || []).forEach((c) => cMap.set(c.id, c.name));
      setCategoriesMap(cMap);

      setRecentDocs(recentDocsRes.data || []);
    } catch (err) {
      console.error("[Overview] Failed to load data:", err);
      setError("Unable to load dashboard overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleOpenPdf = async (docId) => {
    setOpeningDocId(docId);
    try {
      const { data, error: urlError } = await supabase.functions.invoke("get-document-url", {
        body: { document_id: docId },
      });
      if (urlError || !data?.download_url) {
        throw new Error(data?.error || urlError?.message || "Failed to generate download URL.");
      }
      window.open(data.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert(err?.message || "Failed to open PDF.");
    } finally {
      setOpeningDocId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E5E5E5] dark:border-[#262626] pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#151515] dark:text-[#FAFAFA]">
            Overview
          </h2>
          <p className="text-xs text-[#666666] dark:text-[#999999] mt-0.5">
            Academic repository status, metrics, and recent activity
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadOverview}
            disabled={loading}
            className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2 text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] transition shadow-xs"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={() => onOpenAddNote?.()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#8F1D32] hover:bg-[#74152A] px-4 py-2 text-xs font-semibold text-white transition shadow-xs cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>+ Add Note</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#FAFAFA] dark:bg-[#151515]" />
          ))}
        </div>
      ) : (
        /* Metrics Grid */
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
          <MetricCard
            label="Total Notes"
            value={stats.documents}
            detail={`${stats.activeDocuments} active published`}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            }
          />
          <MetricCard
            label="Active Published"
            value={stats.activeDocuments}
            detail="Visible to engineering students"
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <MetricCard
            label="Enrolled Subjects"
            value={stats.subjects}
            detail="Across 4 academic curriculum years"
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            }
          />
          <MetricCard
            label="Syllabus Units"
            value={stats.units}
            detail="Organized curriculum folders"
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            }
          />
          <MetricCard
            label="Categories"
            value={stats.categories}
            detail="Custom & standard classifications"
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            }
          />
          <MetricCard
            label="Academic Years"
            value={stats.years}
            detail="1st, 2nd, 3rd & 4th Year B.Tech"
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            }
          />
        </div>
      )}

      {/* Quick Action Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onNavigate?.("/admin/content")}
          className="rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] p-4 text-left shadow-xs hover:border-[#8F1D32] transition group"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#151515] dark:text-[#FAFAFA] group-hover:text-[#8F1D32] transition">
              Content Library →
            </h4>
            <span className="text-[10px] text-[#666666] dark:text-[#999999]">Manage Notes</span>
          </div>
          <p className="mt-1 text-[11px] text-[#666666] dark:text-[#999999]">
            Browse curriculum hierarchy, search, filter, and organize study material.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.("/admin/categories")}
          className="rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] p-4 text-left shadow-xs hover:border-[#8F1D32] transition group"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#151515] dark:text-[#FAFAFA] group-hover:text-[#8F1D32] transition">
              Categories →
            </h4>
            <span className="text-[10px] text-[#666666] dark:text-[#999999]">Custom Tags</span>
          </div>
          <p className="mt-1 text-[11px] text-[#666666] dark:text-[#999999]">
            Manage document types like Lab Manuals, Viva Questions, and Question Papers.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.("/admin/access")}
          className="rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] p-4 text-left shadow-xs hover:border-[#8F1D32] transition group"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-[#151515] dark:text-[#FAFAFA] group-hover:text-[#8F1D32] transition">
              Access Management →
            </h4>
            <span className="text-[10px] text-[#666666] dark:text-[#999999]">Admins</span>
          </div>
          <p className="mt-1 text-[11px] text-[#666666] dark:text-[#999999]">
            Invite faculty admins and manage privileged access credentials.
          </p>
        </button>
      </div>

      {/* Recent Notes Table */}
      <div className="rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#262626] px-5 py-4 bg-[#FAFAFA] dark:bg-[#0B0B0B]">
          <div>
            <h3 className="text-xs font-bold text-[#151515] dark:text-[#FAFAFA] uppercase tracking-wider">
              Recent Notes
            </h3>
            <p className="text-[11px] text-[#666666] dark:text-[#999999]">
              Latest documents registered in the shared catalog
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.("/admin/content")}
            className="text-xs font-bold text-[#8F1D32] hover:underline"
          >
            View all notes →
          </button>
        </div>

        {recentDocs.length === 0 ? (
          <p className="p-8 text-center text-xs text-[#666666] dark:text-[#999999]">
            No notes uploaded yet.
          </p>
        ) : (
          <div className="divide-y divide-[#E5E5E5] dark:divide-[#262626]">
            {recentDocs.map((doc) => {
              const sub = subjectsMap.get(doc.subject_id);
              const catName = categoriesMap.get(doc.category_id) || "—";

              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[#FAFAFA] dark:hover:bg-[#1B1B1B] transition"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-xs font-bold text-[#151515] dark:text-[#FAFAFA]">
                      {doc.title}
                    </p>
                    <p className="text-[11px] text-[#666666] dark:text-[#999999] truncate">
                      {sub ? `${resolveSubjectName(sub.id, sub.name, sub.short_name)} (Year ${sub.year_id})` : "General"}{" "}
                      • <span className="text-[#8F1D32] dark:text-[#F8E9EC]">{catName}</span> • {formatBytes(doc.file_size)} • {formatDate(doc.created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        doc.is_active
                          ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"
                          : "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                      }`}
                    >
                      {doc.is_active ? "Active" : "Disabled"}
                    </span>

                    <button
                      type="button"
                      disabled={openingDocId === doc.id}
                      onClick={() => handleOpenPdf(doc.id)}
                      className="rounded-lg border border-[#E5E5E5] dark:border-[#262626] px-2.5 py-1 text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] transition"
                    >
                      {openingDocId === doc.id ? "Opening..." : "View"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
