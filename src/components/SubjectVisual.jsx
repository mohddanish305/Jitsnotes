import { memo, useState } from "react";
import { getAcademicYearIllustration, normalizeYearId } from "../utils/academicYearAssets";
import { resolveSubjectName } from "../utils/academicCatalog";

/**
 * SubjectVisual Component
 * Renders the centralized Academic Year illustration (Blue for Y1, Teal for Y2, Orange for Y3, Purple for Y4)
 * with approx 16:9 aspect ratio, 14-16px border-radius, object-cover, and robust fallback.
 */
const SubjectVisual = memo(function SubjectVisual({ subject, compact = false }) {
  const [imageError, setImageError] = useState(false);
  const yearId = normalizeYearId(subject);
  const illustrationSrc = getAcademicYearIllustration(subject);
  const shortCode = String(subject?.short_name || "").trim().toUpperCase();
  const displayName = resolveSubjectName(subject) || String(subject?.name || "").trim();

  return (
    <div
      className={`relative w-full overflow-hidden rounded-[14px] border border-[#E5E5E5] dark:border-[#292E3A] bg-[#F7F8FA] dark:bg-[#14171F] transition-all duration-200 flex items-center justify-center select-none ${
        compact ? "h-[85px]" : "aspect-[16/9] w-full"
      }`}
    >
      {!imageError ? (
        <img
          src={illustrationSrc}
          alt={`${displayName} Year ${yearId} Academic Illustration`}
          className="w-full h-full object-cover object-center"
          loading="lazy"
          decoding="async"
          onError={() => setImageError(true)}
        />
      ) : (
        /* Neutral Academic Fallback (Never show broken image or blank white box) */
        <div className="flex flex-col items-center justify-center p-3 text-center w-full h-full bg-[#F7F8FA] dark:bg-[#171B24]">
          <span className="text-xs font-bold tracking-wider text-[#2C3480] dark:text-[#FFFFFF]">
            {shortCode || `YEAR ${yearId}`}
          </span>
          <span className="text-[10px] text-[#555555] dark:text-[#858B99] mt-0.5">
            Year {yearId}
          </span>
        </div>
      )}

      {/* Subtle overlay pill for short code in the corner */}
      {shortCode && (
        <div className="absolute top-2 right-2 z-10 rounded-md bg-white/95 dark:bg-[#14171F]/95 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-[#2C3480] dark:text-[#FFFFFF] shadow-sm border border-[#E5E5E5] dark:border-[#292E3A]">
          {shortCode}
        </div>
      )}
    </div>
  );
});

export default SubjectVisual;
