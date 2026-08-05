import { memo } from "react";
import { motion } from "framer-motion";
import { trackSubjectClick, trackNoteClick } from "../utils/analytics";

const YEAR_LABELS = {
  1: "Year 1",
  2: "Year 2",
  3: "Year 3",
  4: "Year 4",
};

const isValidThumbnailUrl = (value) => typeof value === "string" && value.startsWith("http");

const getYearNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const match = value.match(/year\s*(\d)/i);
    if (match) return Number(match[1]);
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) return numeric;
  }
  return null;
};

const getSubjectLink = (subject) => subject.drive_link || subject.pdf_url || subject.pdf_path || "";

function SubjectCardSkeleton() {
  return (
    <div className="mx-auto flex h-[200px] sm:h-[295px] w-full max-w-[245px] sm:w-[245px] sm:min-w-[245px] sm:max-w-[245px] flex-col justify-between overflow-hidden rounded-xl sm:rounded-2xl border border-gray-250 dark:border-gray-800 bg-white dark:bg-[#111827] p-2.5 sm:p-4 shadow-sm animate-pulse">
      <div className="flex items-center justify-between gap-1 sm:gap-2 flex-shrink-0">
        <div className="h-4 sm:h-5 w-16 sm:w-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-4 sm:h-5 w-10 sm:w-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
      <div className="flex justify-center my-auto flex-shrink-0">
        <div className="h-16 w-16 sm:h-[96px] sm:w-[96px] rounded-lg sm:rounded-xl bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="h-7 sm:h-9 w-full bg-gray-200 dark:bg-gray-700 rounded-lg sm:rounded-xl flex-shrink-0" />
    </div>
  );
}

const SubjectCard = memo(function SubjectCard({ subject, yearLabel, buttonTransition }) {
  const link = getSubjectLink(subject);
  const hasThumbnail = isValidThumbnailUrl(subject.thumbnail_url);

  return (
    <motion.article
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.4 }}
      whileHover={{
        y: -6,
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08)",
      }}
      className="group mx-auto flex h-[200px] sm:h-[295px] w-full max-w-[245px] sm:w-[245px] sm:min-w-[245px] sm:max-w-[245px] flex-col justify-between overflow-hidden rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] hover:bg-gray-55/50 dark:hover:bg-[#1E293B] p-2.5 sm:p-4 shadow-sm transition-all duration-300"
    >
      <div className="flex items-center justify-between gap-1 sm:gap-2 flex-shrink-0">
        <h3 className="min-w-0 flex-1 text-left text-xs sm:text-sm font-bold leading-tight text-gray-900 dark:text-[#F8FAFC] truncate" title={subject.short_name}>
          {subject.short_name || "UNTITLED"}
        </h3>
        <span className="shrink-0 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-750 bg-gray-50 dark:bg-[#1E293B]/50 px-1.5 sm:px-2.5 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-gray-600 dark:text-[#94A3B8]">
          {yearLabel}
        </span>
      </div>

      <div className="flex w-full items-center justify-center my-auto flex-shrink-0">
        <div className="relative h-16 w-16 sm:h-[96px] sm:w-[96px] overflow-hidden rounded-lg sm:rounded-xl border border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
          {hasThumbnail ? (
            <img
              src={subject.thumbnail_url}
              alt={`${subject.short_name || 'Subject'} Notes JITS`}
              loading="lazy"
              decoding="async"
              width="96"
              height="96"
              className="h-full w-full object-cover rounded-lg sm:rounded-xl transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 via-white to-gray-200 dark:from-gray-800 dark:via-[#111827] dark:to-gray-900">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border border-gray-200 dark:border-gray-750 bg-white dark:bg-gray-800 shadow-sm">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 text-gray-400 dark:text-gray-550"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 6.75A2.75 2.75 0 0 1 6.75 4h10.5A2.75 2.75 0 0 1 20 6.75v10.5A2.75 2.75 0 0 1 17.25 20H6.75A2.75 2.75 0 0 1 4 17.25z" />
                  <path d="m8.5 15 2.5-3 2.25 2.7 1.75-1.95L18 15" />
                  <circle cx="9" cy="9" r="1.25" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full mt-auto flex-shrink-0">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={buttonTransition}
          onClick={() => {
            trackSubjectClick(subject.short_name || "Unknown Subject", subject.year_id || 1);
            trackNoteClick(subject.short_name || "Unknown Subject", link);
            window.open(link, "_blank");
          }}
          className="flex h-7 sm:h-9 w-full items-center justify-center rounded-lg sm:rounded-xl bg-black dark:bg-[#6366F1] px-3 sm:px-4 text-[10px] sm:text-xs font-bold text-white shadow-sm hover:bg-gray-900 dark:hover:bg-[#6366F1]/90 transition-colors"
        >
          View Notes
        </motion.button>
      </div>
    </motion.article>
  );
});

const NotesSection = memo(function NotesSection({ selectedYear, subjects, loading, isAdmin, onOpenAdmin }) {
  const buttonTransition = {
    type: "spring",
    stiffness: 400,
    damping: 17,
  };

  return (
    <section
      id="notes-section"
      className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 transition-colors duration-300"
    >
      <motion.h2
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-[#F8FAFC] mb-2"
      >
        {YEAR_LABELS[selectedYear] || `Year ${selectedYear}`} Subjects
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="max-w-2xl text-xs sm:text-sm text-gray-500 dark:text-[#94A3B8] mb-6"
      >
        Choose your year to access Important Questions and Previous Question Papers
      </motion.p>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6 justify-center justify-items-center w-full mx-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <SubjectCardSkeleton key={i} />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-10 bg-white dark:bg-[#111827] rounded-2xl border border-gray-250 dark:border-gray-800 shadow-sm"
        >
          <p className="text-gray-500 dark:text-[#94A3B8] text-sm mb-4">No notes added yet.</p>
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={buttonTransition}
              onClick={onOpenAdmin}
              className="px-4 py-2 bg-black dark:bg-[#6366F1] text-white rounded-xl text-xs font-bold"
            >
              Add Subject (Admin)
            </motion.button>
          )}
        </motion.div>
      ) : (
        (() => {
          const visibleSubjects = subjects.filter((subject) => getYearNumber(subject.year ?? subject.year_id) === selectedYear);

          if (visibleSubjects.length === 0) {
            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-10 bg-white dark:bg-[#111827] rounded-2xl border border-gray-250 dark:border-gray-800 shadow-sm"
              >
                <p className="text-gray-550 dark:text-[#94A3B8] text-sm mb-4">No notes added yet.</p>
                {isAdmin && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={buttonTransition}
                    onClick={onOpenAdmin}
                    className="px-4 py-2 bg-black dark:bg-[#6366F1] text-white rounded-xl text-xs font-bold"
                  >
                    Add Subject (Admin)
                  </motion.button>
                )}
              </motion.div>
            );
          }

          return (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.06,
                  },
                },
              }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6 justify-center justify-items-center w-full mx-auto"
            >
              {visibleSubjects.map((subject) => (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  yearLabel={YEAR_LABELS[selectedYear] || `Year ${selectedYear}`}
                  buttonTransition={buttonTransition}
                />
              ))}
            </motion.div>
          );
        })()
      )}

      {/* Admin button - only show if admin */}
      {isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-8 text-center"
        >
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={buttonTransition}
            onClick={onOpenAdmin}
            className="px-5 py-2.5 bg-gray-900 dark:bg-gray-800 text-white border border-transparent dark:border-gray-700 rounded-xl font-bold text-xs hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors shadow-sm"
          >
            Manage Subjects (Admin)
          </motion.button>
        </motion.div>
      )}
    </section>
  );
});

export default NotesSection;
