/**
 * Google Analytics 4 — Reusable tracking utility
 * Measurement ID: G-FJQ8RXJLRG
 *
 * gtag.js is loaded directly in index.html on every page.
 * This module provides typed wrappers that:
 *   - Fire real GA4 events in production (import.meta.env.PROD)
 *   - Log to console in development so you can verify calls
 *   - Never fire duplicate page_view events (send_page_view: false in HTML)
 */
export const GA_MEASUREMENT_ID = "G-FJQ8RXJLRG";

const isAnalyticsAllowed = () => {
  if (typeof window === "undefined") return false;
  // Isolate Admin CMS routes completely from Google Analytics
  if (window.location.pathname.startsWith("/admin")) return false;
  return true;
};

/** Safe wrapper — guards against gtag not yet available, errors, and admin routes */
const fireEvent = (command, ...args) => {
  if (!isAnalyticsAllowed()) return;
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag(command, ...args);
    }
  } catch (err) {
    if (!import.meta.env.PROD) {
      console.warn("[Analytics] Suppressed non-critical event error:", err);
    }
  }
};

// ---------------------------------------------------------------------------
// Page View — called by App.jsx on every React Router location change
// ---------------------------------------------------------------------------
export const trackPageView = (path) => {
  if (!isAnalyticsAllowed()) return;
  if (path && String(path).startsWith("/admin")) return;

  if (import.meta.env.PROD) {
    fireEvent("event", "page_view", {
      page_path: path,
      page_location: window.location.href,
    });
  } else {
    console.log(`[GA4] page_view → ${path}`);
  }
};

// ---------------------------------------------------------------------------
// Year Selection — called when student clicks Year 1/2/3/4
// ---------------------------------------------------------------------------
export const trackYearSelection = (year) => {
  if (import.meta.env.PROD) {
    fireEvent("event", "year_selection", { year });
  } else {
    console.log(`[GA4] year_selection → Year ${year}`);
  }
};

// ---------------------------------------------------------------------------
// Subject Click — called when student opens a subject card
// ---------------------------------------------------------------------------
export const trackSubjectClick = (subjectName, year) => {
  if (import.meta.env.PROD) {
    fireEvent("event", "subject_click", { subject_name: subjectName, year });
  } else {
    console.log(`[GA4] subject_click → "${subjectName}" (Year ${year})`);
  }
};

// ---------------------------------------------------------------------------
// Note Click — called when student opens a notes document
// ---------------------------------------------------------------------------
export const trackNoteClick = (subjectName, docIdOrTitle) => {
  if (import.meta.env.PROD) {
    fireEvent("event", "note_click", { subject_name: subjectName, document: docIdOrTitle });
  } else {
    console.log(`[GA4] note_click → "${subjectName}" — ${docIdOrTitle}`);
  }
};

// ---------------------------------------------------------------------------
// Feedback Submit — called after successful feedback form submission
// ---------------------------------------------------------------------------
export const trackFeedbackSubmit = () => {
  if (import.meta.env.PROD) {
    fireEvent("event", "feedback_submit", {
      submitted_at: new Date().toISOString(),
    });
  } else {
    console.log("[GA4] feedback_submit");
  }
};
