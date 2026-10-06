import { memo } from "react";
import { Clock, FileText, HelpCircle, BookOpen } from "lucide-react";

const QuickAccess = memo(function QuickAccess({ onScrollToNotes }) {
  const items = [
    {
      id: "recent",
      label: "Recent Notes",
      desc: "Latest R22 uploads",
      icon: Clock,
      action: () => onScrollToNotes && onScrollToNotes(),
    },
    {
      id: "important",
      label: "Important Documents",
      desc: "High-yield exam guides",
      icon: FileText,
      action: () => onScrollToNotes && onScrollToNotes(),
    },
    {
      id: "papers",
      label: "Previous Papers",
      desc: "JNTUH question papers",
      icon: HelpCircle,
      action: () => onScrollToNotes && onScrollToNotes(),
    },
    {
      id: "continue",
      label: "Study Materials",
      desc: "Syllabus-aligned units",
      icon: BookOpen,
      action: () => onScrollToNotes && onScrollToNotes(),
    },
  ];

  return (
    <section className="w-full max-w-content mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#666666] dark:text-[#858585]">
          Quick Access
        </h2>
        <span className="text-[11px] text-[#999999] dark:text-[#858585] font-medium">
          CSE & AIML
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className="group flex flex-col text-left p-3 sm:p-3.5 rounded-xl border border-[#EDEDED] dark:border-[#292929] bg-[#FFFFFF] dark:bg-[#151515] hover:border-[#8F1D32] dark:hover:border-[#A21F3D] shadow-subtle dark:shadow-subtle-dark hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#FCF4F5] dark:bg-[#241217] border border-[#F8E9EC] dark:border-[#381B22] text-[#8F1D32] dark:text-[#A21F3D] group-hover:bg-[#8F1D32] group-hover:text-white transition-colors flex items-center justify-center mb-2">
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-[#151515] dark:text-white group-hover:text-[#8F1D32] dark:group-hover:text-[#A21F3D] transition-colors leading-tight">
                {item.label}
              </span>
              <span className="text-[10px] sm:text-[11px] text-[#666666] dark:text-[#B5B5B5] mt-0.5 line-clamp-1">
                {item.desc}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
});

export default QuickAccess;
