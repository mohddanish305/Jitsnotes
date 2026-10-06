/**
 * JITS Notes — Centralized Academic Year Assets
 * Maps each academic year to its dedicated illustration:
 * Year 1 -> Blue
 * Year 2 -> Teal/Green
 * Year 3 -> Orange
 * Year 4 -> Purple
 */

import year1Blue from "../assets/academic-years/year-1-blue.png";
import year2Teal from "../assets/academic-years/year-2-teal.png";
import year3Orange from "../assets/academic-years/year-3-orange.png";
import year4Purple from "../assets/academic-years/year-4-purple.png";
import { supabase } from "../lib/supabase";

export const LOCAL_YEAR_ILLUSTRATIONS = {
  1: year1Blue,
  2: year2Teal,
  3: year3Orange,
  4: year4Purple,
};

export const YEAR_ACCENT_METADATA = {
  1: {
    color: "monochrome",
    name: "Year 1",
    tagBg: "bg-[#F7F7F7] dark:bg-[#111111]",
    tagText: "text-[#111111] dark:text-[#FFFFFF]",
    border: "border-[#EAEAEA] dark:border-[#222222]",
  },
  2: {
    color: "monochrome",
    name: "Year 2",
    tagBg: "bg-[#F7F7F7] dark:bg-[#111111]",
    tagText: "text-[#111111] dark:text-[#FFFFFF]",
    border: "border-[#EAEAEA] dark:border-[#222222]",
  },
  3: {
    color: "monochrome",
    name: "Year 3",
    tagBg: "bg-[#F7F7F7] dark:bg-[#111111]",
    tagText: "text-[#111111] dark:text-[#FFFFFF]",
    border: "border-[#EAEAEA] dark:border-[#222222]",
  },
  4: {
    color: "monochrome",
    name: "Year 4",
    tagBg: "bg-[#F7F7F7] dark:bg-[#111111]",
    tagText: "text-[#111111] dark:text-[#FFFFFF]",
    border: "border-[#EAEAEA] dark:border-[#222222]",
  },
};

// In-memory cache for remote Supabase assets
let remoteAssetsCache = null;
let fetchPromise = null;

/**
 * Normalizes any year reference (number, "Year 1", "1", subject object) to 1, 2, 3, or 4.
 */
export function normalizeYearId(input) {
  if (typeof input === "number") {
    if (input >= 1 && input <= 4) return input;
    return 1;
  }
  if (typeof input === "string") {
    const match = input.match(/(\d)/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (parsed >= 1 && parsed <= 4) return parsed;
    }
  }
  if (typeof input === "object" && input !== null) {
    if ("year_id" in input) return normalizeYearId(input.year_id);
    if ("year" in input) return normalizeYearId(input.year);
    if ("academic_year" in input) return normalizeYearId(input.academic_year);
  }
  return 1; // Default fallback to Year 1
}

/**
 * Fetches and caches academic year assets from Supabase.
 */
export async function loadAcademicYearAssets() {
  if (remoteAssetsCache) return remoteAssetsCache;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("academic_year_assets")
        .select("year_id, image_url, storage_path");

      if (error) {
        console.warn("[AcademicAssets] Failed to fetch remote assets, using local bundled assets:", error);
        remoteAssetsCache = {};
      } else {
        const map = {};
        (data || []).forEach((row) => {
          map[row.year_id] = row.image_url;
        });
        remoteAssetsCache = map;
      }
    } catch (err) {
      console.warn("[AcademicAssets] Error loading remote assets:", err);
      remoteAssetsCache = {};
    } finally {
      fetchPromise = null;
    }
    return remoteAssetsCache;
  })();

  return fetchPromise;
}

/**
 * Returns the illustration URL for a given year.
 * Priority: Remote cached URL -> Local bundled asset -> Default Year 1 Blue.
 */
export function getAcademicYearIllustration(yearIdOrObj) {
  const yearId = normalizeYearId(yearIdOrObj);

  if (remoteAssetsCache && remoteAssetsCache[yearId]) {
    return remoteAssetsCache[yearId];
  }

  return LOCAL_YEAR_ILLUSTRATIONS[yearId] || LOCAL_YEAR_ILLUSTRATIONS[1];
}

/**
 * Returns accent styling details for a given year.
 */
export function getAcademicYearMeta(yearIdOrObj) {
  const yearId = normalizeYearId(yearIdOrObj);
  return YEAR_ACCENT_METADATA[yearId] || YEAR_ACCENT_METADATA[1];
}
