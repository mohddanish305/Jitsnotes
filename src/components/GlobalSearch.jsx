import { useState, useEffect, useRef, memo } from "react";
import { Search, X, FileText, BookOpen, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { resolveSubjectName } from "../utils/academicCatalog";

const GlobalSearch = memo(function GlobalSearch({
  isOpen,
  onClose,
  onOpen,
  isMobile = false,
  onSelectSubject,
  _onSelectFolder,
  onOpenDocument,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Debounced search query fetching from Supabase
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const [subjectsRes, foldersRes, docsRes] = await Promise.all([
          supabase
            .from("subjects")
            .select("id, name, short_name, year_id, is_active, is_deleted")
            .or(`name.ilike.%${trimmed}%,short_name.ilike.%${trimmed}%`)
            .eq("is_deleted", false)
            .limit(6),
          supabase
            .from("folders")
            .select("id, name, subject_id, is_active, subjects(id, name, short_name, year_id)")
            .ilike("name", `%${trimmed}%`)
            .eq("is_active", true)
            .limit(6),
          supabase
            .from("documents")
            .select("id, title, file_size, subject_id, folder_id, is_active, subjects(id, name, short_name, year_id), folders(id, name)")
            .ilike("title", `%${trimmed}%`)
            .eq("is_active", true)
            .limit(8),
        ]);

        const combined = [];

        // Add subjects
        (subjectsRes.data || []).forEach((s) => {
          if (s.is_active !== false) {
            combined.push({
              type: "subject",
              id: s.id,
              title: resolveSubjectName(s) || s.name,
              code: s.short_name,
              year: s.year_id || 1,
              raw: s,
            });
          }
        });

        // Add folders
        (foldersRes.data || []).forEach((f) => {
          const subject = f.subjects;
          combined.push({
            type: "folder",
            id: f.id,
            title: f.name,
            subjectTitle: subject ? resolveSubjectName(subject) || subject.name : "Subject",
            subjectCode: subject?.short_name || "",
            year: subject?.year_id || 1,
            rawSubject: subject,
            rawFolder: f,
          });
        });

        // Add documents
        (docsRes.data || []).forEach((d) => {
          const subject = d.subjects;
          const folder = d.folders;
          combined.push({
            type: "document",
            id: d.id,
            title: d.title,
            subjectTitle: subject ? resolveSubjectName(subject) || subject.name : "Subject",
            subjectCode: subject?.short_name || "",
            folderTitle: folder?.name || null,
            year: subject?.year_id || 1,
            rawDocument: d,
            rawSubject: subject,
          });
        });

        setResults(combined);
      } catch (err) {
        console.error("[GlobalSearch] Search query error:", err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleClear = (e) => {
    e.stopPropagation();
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  const handleItemClick = (item) => {
    onClose?.();
    if (item.type === "document" && onOpenDocument) {
      onOpenDocument(item.rawDocument, item.rawSubject);
    } else if (item.type === "folder" && onSelectSubject) {
      onSelectSubject(item.rawSubject);
    } else if (item.type === "subject" && onSelectSubject) {
      onSelectSubject(item.raw);
    }
  };

  // 1. DESKTOP SEARCH: Compact expanding input in navbar
  if (!isMobile) {
    if (!isOpen) {
      return (
        <button
          type="button"
          onClick={onOpen}
          className="w-10 h-10 rounded-xl bg-white dark:bg-[#0B0B0B] hover:bg-[#FCF4F5] dark:hover:bg-[#1F1215] text-[#151515] dark:text-white hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors flex items-center justify-center border border-[#EDEDED] dark:border-[#222222] shadow-xs cursor-pointer"
          aria-label="Search notes"
          title="Search subjects, notes (Ctrl+K)"
        >
          <Search className="w-4 h-4" />
        </button>
      );
    }

    return (
      <div ref={containerRef} className="relative flex items-center">
        {/* Compact expanding search input (250px - 280px) */}
        <div className="relative flex items-center w-[250px] lg:w-[280px] h-10 rounded-xl border border-[#EDEDED] dark:border-[#222222] bg-white dark:bg-[#151515] shadow-sm transition-all duration-150 focus-within:border-[#8F1D32] dark:focus-within:border-[#A21F3D]">
          <Search className="absolute left-3 w-4 h-4 text-[#999999] pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subjects, notes..."
            className="w-full h-full bg-transparent pl-9 pr-8 text-xs sm:text-sm text-[#151515] dark:text-white placeholder-[#999999] outline-none"
            aria-label="Search subjects and notes"
          />
          <button
            type="button"
            onClick={query ? handleClear : onClose}
            className="absolute right-2.5 p-1 rounded-md text-[#999999] hover:text-[#151515] dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Close search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Compact dropdown directly below the search bar */}
        {query.trim().length >= 2 && (
          <div className="absolute top-full right-0 mt-2 z-50 w-[320px] lg:w-[360px] max-h-[360px] overflow-y-auto rounded-2xl border border-[#EDEDED] dark:border-[#222222] bg-white dark:bg-[#0B0B0B] shadow-xl admin-scrollbar divide-y divide-[#EDEDED] dark:divide-[#222222]">
            {loading ? (
              <div className="p-4 text-center text-xs text-[#999999]">
                Searching notes and subjects...
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#666666] dark:text-[#999999]">
                No matching notes or subjects found.
              </div>
            ) : (
              results.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleItemClick(item)}
                  className="group flex items-center justify-between p-3 hover:bg-[#FCF4F5] dark:hover:bg-[#1F1215] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#F7F7F7] dark:bg-[#151515] text-[#8F1D32] dark:text-[#A21F3D] group-hover:bg-[#8F1D32] group-hover:text-white transition-colors">
                      {item.type === "document" ? (
                        <FileText className="w-4 h-4" />
                      ) : (
                        <BookOpen className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#151515] dark:text-white group-hover:text-[#8F1D32] dark:group-hover:text-[#A21F3D] transition-colors truncate">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#666666] dark:text-[#999999] mt-0.5">
                        <span className="font-semibold text-[#8F1D32] dark:text-[#A21F3D]">
                          Year {item.year}
                        </span>
                        {item.subjectCode && <span>• {item.subjectCode}</span>}
                        {item.type === "document" && <span className="font-medium">• PDF</span>}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#999999] group-hover:text-[#8F1D32] dark:group-hover:text-[#A21F3D] group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // 2. MOBILE SEARCH: Compact bar directly below the header
  if (!isOpen) return null;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center w-full h-[42px] rounded-xl border border-[#EDEDED] dark:border-[#222222] bg-white dark:bg-[#151515] shadow-sm">
        <Search className="absolute left-3 w-4 h-4 text-[#999999] pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subjects, notes..."
          className="w-full h-full bg-transparent pl-9 pr-9 text-xs sm:text-sm text-[#151515] dark:text-white placeholder-[#999999] outline-none"
          aria-label="Search subjects and notes"
        />
        <button
          type="button"
          onClick={query ? handleClear : onClose}
          className="absolute right-2.5 p-1 rounded-md text-[#999999] hover:text-[#151515] dark:hover:text-white transition-colors cursor-pointer"
          aria-label="Close search"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile results dropdown directly below the compact search input */}
      {query.trim().length >= 2 && (
        <div className="w-full mt-2 max-h-[300px] overflow-y-auto rounded-2xl border border-[#EDEDED] dark:border-[#222222] bg-white dark:bg-[#0B0B0B] shadow-xl admin-scrollbar divide-y divide-[#EDEDED] dark:divide-[#222222]">
          {loading ? (
            <div className="p-4 text-center text-xs text-[#999999]">
              Searching notes and subjects...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#666666] dark:text-[#999999]">
              No matching notes or subjects found for "{query}".
            </div>
          ) : (
            results.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                onClick={() => handleItemClick(item)}
                className="group flex items-center justify-between p-3 hover:bg-[#FCF4F5] dark:hover:bg-[#1F1215] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#F7F7F7] dark:bg-[#151515] text-[#8F1D32] dark:text-[#A21F3D] group-hover:bg-[#8F1D32] group-hover:text-white transition-colors">
                    {item.type === "document" ? (
                      <FileText className="w-4 h-4" />
                    ) : (
                      <BookOpen className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-[#151515] dark:text-white group-hover:text-[#8F1D32] dark:group-hover:text-[#A21F3D] transition-colors truncate">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#666666] dark:text-[#999999] mt-0.5">
                      <span className="font-semibold text-[#8F1D32] dark:text-[#A21F3D]">
                        Year {item.year}
                      </span>
                      {item.subjectCode && <span>• {item.subjectCode}</span>}
                      {item.type === "document" && <span className="font-medium">• PDF</span>}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#999999] group-hover:text-[#8F1D32] dark:group-hover:text-[#A21F3D] shrink-0" />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
});

export default GlobalSearch;
