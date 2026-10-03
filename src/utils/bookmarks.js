/**
 * JITS Notes — Local Bookmark Management
 * Preserves bookmarks in localStorage without student authentication.
 */

const BOOKMARKS_STORAGE_KEY = "jits_bookmarks_v1";

export function getBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[Bookmarks] Failed to load bookmarks:", err);
    return [];
  }
}

export function isDocumentBookmarked(documentId) {
  if (!documentId) return false;
  const list = getBookmarks();
  return list.some((item) => (typeof item === "string" ? item === documentId : item.id === documentId));
}

export function toggleBookmark(doc) {
  if (!doc || !doc.id) return false;
  const list = getBookmarks();
  const exists = list.some((item) => (typeof item === "string" ? item === doc.id : item.id === doc.id));

  let updated;
  let bookmarkedNow;

  if (exists) {
    updated = list.filter((item) => (typeof item === "string" ? item !== doc.id : item.id !== doc.id));
    bookmarkedNow = false;
  } else {
    const entry = {
      id: doc.id,
      title: doc.title || "Untitled Document",
      subject_id: doc.subject_id || null,
      created_at: doc.created_at || new Date().toISOString(),
      bookmarked_at: new Date().toISOString(),
    };
    updated = [entry, ...list];
    bookmarkedNow = true;
  }

  try {
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("jits-bookmarks-changed", { detail: { documentId: doc.id, isBookmarked: bookmarkedNow } }));
  } catch (err) {
    console.error("[Bookmarks] Failed to save bookmark:", err);
  }

  return bookmarkedNow;
}
