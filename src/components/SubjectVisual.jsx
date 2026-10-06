import { memo, useState } from "react";
import { getAcademicYearIllustration, normalizeYearId } from "../utils/academicYearAssets";
import { resolveSubjectName } from "../utils/academicCatalog";

/**
 * SubjectVisual Component
 * Renders the Subject illustration (custom thumbnail or dedicated academic year artwork)
 * with 16:9 aspect ratio, rounded-xl border-radius, object-cover, and robust monochrome fallback.
 */
const SubjectVisual = memo(function SubjectVisual({ subject, compact = false, showBadge = false }) {
  const [imageError, setImageError] = useState(false);
  const yearId = normalizeYearId(subject);

  const customImage =
    typeof subject?.thumbnail_url === "string" && subject.thumbnail_url.startsWith("http")
      ? subject.thumbnail_url
      : typeof subject?.image_url === "string" && subject.image_url.startsWith("http")
        ? subject.image_url
        : typeof subject?.image === "string" && subject.image.startsWith("http")
          ? subject.image
          : null;

  const illustrationSrc = customImage || getAcademicYearIllustration(subject);
  const shortCode = String(subject?.short_name || "").trim().toUpperCase();
  const displayName = resolveSubjectName(subject) || String(subject?.name || "").trim();

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-[#EAEAEA] dark:border-[#222222] bg-[#F7F7F7] dark:bg-[#111111] transition-all duration-200 flex items-center justify-center select-none ${
        compact ? "h-[85px]" : "aspect-[16/9] w-full"
      }`}
    >
      {!imageError && illustrationSrc ? (
        <img
          src={illustrationSrc}
          alt={`${displayName} Academic Illustration`}
          className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
          decoding="async"
          onError={() => setImageError(true)}
        />
      ) : (
        /* Neutral Academic Fallback */
        <div className="flex flex-col items-center justify-center p-3 text-center w-full h-full bg-[#F7F7F7] dark:bg-[#111111]">
          <span className="text-xs font-bold tracking-wider text-[#111111] dark:text-white">
            {shortCode || `YEAR ${yearId}`}
          </span>
          <span className="text-[10px] text-[#666666] dark:text-[#B3B3B3] mt-0.5">
            Year {yearId}
          </span>
        </div>
      )}

      {showBadge && shortCode && (
        <div className="absolute top-2.5 right-2.5 z-10 rounded-md bg-white/90 dark:bg-black/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-[#111111] dark:text-white shadow-sm border border-[#EAEAEA] dark:border-[#222222]">
          {shortCode}
        </div>
      )}
    </div>
  );
});

export default SubjectVisual;
