import { useState, useEffect, memo } from "react";
import { BookOpen, ArrowRight } from "lucide-react";

const ContinueReading = memo(function ContinueReading({ onOpenDocument }) {
  const [lastRead, setLastRead] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("jits_last_read");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.docId && parsed.title) {
          setLastRead(parsed);
        }
      }
    } catch {
      setLastRead(null);
    }
  }, []);

  if (!lastRead) return null;

  const percent =
    lastRead.numPages && lastRead.pageNum
      ? Math.min(100, Math.round((lastRead.pageNum / lastRead.numPages) * 100))
      : null;

  return (
    <section className="w-full max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-3">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#666666] dark:text-[#999999]">
          Continue Reading
        </h2>
        <span className="text-[11px] text-[#999999] font-medium">
          Saved Progress
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#EDEDED] dark:border-[#222222] bg-[#FFFFFF] dark:bg-[#0B0B0B] shadow-subtle dark:shadow-subtle-dark">
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#FCF4F5] dark:bg-[#1F1215] border border-[#F8E9EC] dark:border-[#2E1A1F] text-[#8F1D32] dark:text-[#A21F3D] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#8F1D32] dark:text-[#A21F3D]">
                {lastRead.subjectName || lastRead.shortCode || "Academic Note"}
              </span>
              {percent !== null && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FCF4F5] dark:bg-[#1F1215] text-[#8F1D32] dark:text-[#A21F3D] border border-[#F8E9EC] dark:border-[#2E1A1F]">
                  {percent}% completed
                </span>
              )}
            </div>

            <h3
              className="text-sm sm:text-base font-semibold text-[#151515] dark:text-white truncate mt-0.5"
              title={lastRead.title}
            >
              {lastRead.title}
            </h3>

            <p className="text-xs text-[#666666] dark:text-[#999999] mt-0.5">
              {lastRead.pageNum && lastRead.numPages
                ? `Page ${lastRead.pageNum} of ${lastRead.numPages}`
                : "Last viewed"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onOpenDocument) {
              onOpenDocument({
                id: lastRead.docId,
                title: lastRead.title,
                folder_id: lastRead.folderId || null,
                subject_id: lastRead.subjectId || null,
              });
            }
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#151515] hover:bg-[#8F1D32] text-white dark:bg-white dark:hover:bg-[#FCF4F5] dark:text-[#151515] dark:hover:text-[#8F1D32] text-xs font-medium shadow-xs transition-colors shrink-0 min-h-[40px] cursor-pointer"
        >
          <span>Continue Reading</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </section>
  );
});

export default ContinueReading;
