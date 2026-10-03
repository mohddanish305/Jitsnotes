import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { supabase } from "../lib/supabase";
import { isDocumentBookmarked, toggleBookmark } from "../utils/bookmarks";

// Configure PDF.js Worker using Vite's bundled worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const formatFileSize = (bytes) => {
  const val = Number(bytes);
  if (!Number.isFinite(val) || val <= 0) return "Unknown size";
  if (val < 1024) return `${val} B`;
  if (val < 1024 * 1024) return `${(val / 1024).toFixed(1)} KB`;
  return `${(val / (1024 * 1024)).toFixed(1)} MB`;
};

export default function PdfViewerModal({ document: doc, subject, yearLabel, onClose }) {
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("Opening PDF...");
  const [error, setError] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);

  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pageRendering, setPageRendering] = useState(false);

  const [isBookmarked, setIsBookmarked] = useState(() => isDocumentBookmarked(doc?.id));
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Menus
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const pageContainerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);

  const docId = doc?.id;

  const showToast = useCallback((msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  }, []);

  // Fetch secure URL and load PDF document
  const loadPdfDocument = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    setError(null);
    setLoadingText("Opening PDF...");

    try {
      const { data, error: funcError } = await supabase.functions.invoke("get-document-url", {
        body: { document_id: docId },
      });

      if (funcError || !data?.download_url) {
        throw new Error(data?.error || funcError?.message || "Failed to secure document link.");
      }

      setDownloadUrl(data.download_url);
      setLoadingText("Preparing your document...");

      const loadingTask = pdfjsLib.getDocument({
        url: data.download_url,
        withCredentials: false,
      });

      const loadedPdf = await loadingTask.promise;
      setPdfDoc(loadedPdf);
      setNumPages(loadedPdf.numPages);
      setPageNum(1);
      setLoading(false);
    } catch (err) {
      console.error("[PdfViewer] Load error:", err);
      setError("Unable to open this PDF.");
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    loadPdfDocument();
  }, [loadPdfDocument]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Focus search input when search bar opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Render Page to Canvas
  const renderCurrentPage = useCallback(
    async (targetPageNum, targetScale) => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }

        setPageRendering(true);
        const page = await pdfDoc.getPage(targetPageNum);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        const viewport = page.getViewport({ scale: targetScale });

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
          canvasContext: context,
          transform,
          viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        renderTaskRef.current = null;
        setPageRendering(false);
      } catch (err) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("[PdfViewer] Page render error:", err);
        }
        setPageRendering(false);
      }
    },
    [pdfDoc]
  );

  // Re-render when pageNum or scale changes
  useEffect(() => {
    if (pdfDoc && pageNum >= 1 && pageNum <= numPages) {
      renderCurrentPage(pageNum, scale);
    }
  }, [pdfDoc, pageNum, scale, renderCurrentPage, numPages]);

  // Fit to Width calculation
  const handleFitWidth = useCallback(async () => {
    if (!pdfDoc || !pageContainerRef.current) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = pageContainerRef.current.clientWidth - 48; // padding
      if (containerWidth > 100 && viewport.width > 0) {
        const fitScale = Math.min(Math.max(containerWidth / viewport.width, 0.4), 2.8);
        setScale(Number(fitScale.toFixed(2)));
      }
    } catch (err) {
      console.error("[PdfViewer] Fit width error:", err);
    }
  }, [pdfDoc, pageNum]);

  // Fit to Page calculation
  const handleFitPage = useCallback(async () => {
    if (!pdfDoc || !pageContainerRef.current) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const containerWidth = pageContainerRef.current.clientWidth - 48;
      const containerHeight = pageContainerRef.current.clientHeight - 48;
      if (containerWidth > 100 && containerHeight > 100) {
        const scaleW = containerWidth / viewport.width;
        const scaleH = containerHeight / viewport.height;
        const fitScale = Math.min(Math.max(Math.min(scaleW, scaleH), 0.4), 2.5);
        setScale(Number(fitScale.toFixed(2)));
      }
    } catch (err) {
      console.error("[PdfViewer] Fit page error:", err);
    }
  }, [pdfDoc, pageNum]);

  // Auto-fit on initial document load
  useEffect(() => {
    if (pdfDoc && numPages > 0) {
      handleFitWidth();
    }
  }, [pdfDoc, numPages, handleFitWidth]);

  // Page Navigation
  const handlePrevPage = () => {
    if (pageNum > 1) {
      setPageNum((p) => p - 1);
    }
  };

  const handleNextPage = () => {
    if (pageNum < numPages) {
      setPageNum((p) => p + 1);
    }
  };

  // Zoom controls
  const handleZoomIn = () => {
    setScale((s) => Math.min(Number((s + 0.2).toFixed(2)), 3.0));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(Number((s - 0.2).toFixed(2)), 0.5));
  };

  // Fullscreen toggle
  const handleToggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("[PdfViewer] Fullscreen error:", err);
    }
    setIsMoreOpen(false);
  };

  // Bookmark toggle
  const handleToggleBookmark = () => {
    const newState = toggleBookmark(doc);
    setIsBookmarked(newState);
    showToast(newState ? "Saved to Bookmarks" : "Removed from Bookmarks");
  };

  // Download PDF
  const handleDownload = async () => {
    if (!downloadUrl) return;
    setIsDownloading(true);
    setIsMoreOpen(false);
    showToast("Starting download...");

    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const cleanTitle = (doc.title || "document").replace(/[/\\?%*:|"<>]/g, "-");
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${cleanTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      showToast("PDF downloaded successfully!");
    } catch (err) {
      console.warn("[PdfViewer] Blob download fallback to direct anchor:", err);
      // Direct navigation fallback if blob fetch is blocked
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      const cleanTitle = (doc.title || "document").replace(/[/\\?%*:|"<>]/g, "-");
      link.download = `${cleanTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Download opened in browser.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Search in PDF
  const handlePerformSearch = async (e) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query || !pdfDoc) {
      setSearchResults([]);
      setSearchMatchIndex(0);
      return;
    }

    setIsSearching(true);
    const matches = [];

    try {
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item) => item.str).join(" ").toLowerCase();
        if (text.includes(query)) {
          matches.push(i);
        }
      }

      setSearchResults(matches);
      if (matches.length > 0) {
        setSearchMatchIndex(0);
        setPageNum(matches[0]);
        showToast(`Found ${matches.length} matching page${matches.length === 1 ? "" : "s"}`);
      } else {
        showToast("No matches found");
      }
    } catch (err) {
      console.error("[PdfViewer] Search error:", err);
      showToast("Unable to search text in this document");
    } finally {
      setIsSearching(false);
    }
  };

  const handleNextSearchMatch = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (searchMatchIndex + 1) % searchResults.length;
    setSearchMatchIndex(nextIdx);
    setPageNum(searchResults[nextIdx]);
  };

  const handlePrevSearchMatch = () => {
    if (searchResults.length === 0) return;
    const prevIdx = (searchMatchIndex - 1 + searchResults.length) % searchResults.length;
    setSearchMatchIndex(prevIdx);
    setPageNum(searchResults[prevIdx]);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts if user is typing in search input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        if (e.key === "Escape") {
          setIsSearchOpen(false);
        }
        return;
      }

      if (e.key === "Escape") {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        } else if (isInfoOpen) {
          setIsInfoOpen(false);
        } else if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          onClose();
        }
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        handlePrevPage();
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        handleNextPage();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-") {
        handleZoomOut();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-[#F7F8FA] dark:bg-[#0B0D12] text-gray-900 dark:text-[#FFFFFF] select-none"
      role="dialog"
      aria-label={doc.title || "PDF Viewer"}
    >
      {/* 1. COMPACT TOP TOOLBAR */}
      <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-[#E5E5E5] dark:border-[#1E2433] bg-white dark:bg-[#14171F] px-3 sm:px-4 shadow-sm z-20">
        {/* Left: Back button + Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 mr-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to Notes"
            title="Back to Notes (Esc)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E5E5E5] dark:border-[#292E3A] bg-[#F7F8FA] dark:bg-[#1A1E28] text-gray-700 dark:text-[#FFFFFF] hover:bg-gray-150 dark:hover:bg-[#252B3A] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>

          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-bold truncate leading-tight text-gray-900 dark:text-white" title={doc.title}>
              {doc.title || "Document Viewer"}
            </h1>
            <p className="text-[10px] text-gray-500 dark:text-[#858B99] truncate">
              {subject?.short_name || subject?.name || "Subject"} {yearLabel ? `• ${yearLabel}` : ""}
            </p>
          </div>
        </div>

        {/* Center: Page Controls (Previous / Page / Next) */}
        {!loading && !error && numPages > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-[#E5E5E5] dark:border-[#292E3A] bg-[#F7F8FA] dark:bg-[#1A1E28] px-2 py-1">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={pageNum <= 1}
              aria-label="Previous Page"
              title="Previous Page (Left Arrow)"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-600 dark:text-[#CBD5E1] hover:bg-white dark:hover:bg-[#252B3A] disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            <span className="text-xs font-semibold px-2 text-gray-700 dark:text-[#CBD5E1] min-w-[70px] text-center">
              {pageNum} <span className="text-gray-400 dark:text-[#64748B]">/</span> {numPages}
            </span>

            <button
              type="button"
              onClick={handleNextPage}
              disabled={pageNum >= numPages}
              aria-label="Next Page"
              title="Next Page (Right Arrow)"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-600 dark:text-[#CBD5E1] hover:bg-white dark:hover:bg-[#252B3A] disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        )}

        {/* Right: Actions (Zoom, Search, Bookmark, Download, Fullscreen, More) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {!loading && !error && (
            <>
              {/* Zoom Controls */}
              <div className="hidden md:flex items-center gap-1 border-r border-[#E5E5E5] dark:border-[#292E3A] pr-1.5 mr-1">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  aria-label="Zoom Out"
                  title="Zoom Out (-)"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 dark:text-[#CBD5E1] hover:bg-gray-100 dark:hover:bg-[#1A1E28] transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <span className="text-[11px] font-bold text-gray-600 dark:text-[#A0AEC0] w-12 text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  aria-label="Zoom In"
                  title="Zoom In (+)"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 dark:text-[#CBD5E1] hover:bg-gray-100 dark:hover:bg-[#1A1E28] transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleFitWidth}
                  aria-label="Fit to Width"
                  title="Fit to Width"
                  className="hidden lg:flex px-2 py-1 text-[11px] font-semibold rounded-lg text-gray-600 dark:text-[#CBD5E1] hover:bg-gray-100 dark:hover:bg-[#1A1E28] transition-colors"
                >
                  Fit Width
                </button>
                <button
                  type="button"
                  onClick={handleFitPage}
                  aria-label="Fit to Page"
                  title="Fit to Page"
                  className="hidden lg:flex px-2 py-1 text-[11px] font-semibold rounded-lg text-gray-600 dark:text-[#CBD5E1] hover:bg-gray-100 dark:hover:bg-[#1A1E28] transition-colors"
                >
                  Fit Page
                </button>
              </div>

              {/* Search Toggle */}
              <button
                type="button"
                onClick={() => setIsSearchOpen((o) => !o)}
                aria-label="Search text in document"
                title="Search text (Ctrl+F)"
                className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl transition-colors ${
                  isSearchOpen
                    ? "bg-[#2C3480] text-white"
                    : "text-gray-600 dark:text-[#CBD5E1] hover:bg-gray-100 dark:hover:bg-[#1A1E28]"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>

              {/* Bookmark Toggle */}
              <button
                type="button"
                onClick={handleToggleBookmark}
                aria-label={isBookmarked ? "Remove Bookmark" : "Bookmark Document"}
                title={isBookmarked ? "Bookmarked (Click to remove)" : "Bookmark this note"}
                className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl transition-colors ${
                  isBookmarked
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
                    : "text-gray-600 dark:text-[#CBD5E1] hover:bg-gray-100 dark:hover:bg-[#1A1E28]"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill={isBookmarked ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
              </button>

              {/* Download Button */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                aria-label="Download PDF"
                title="Download PDF"
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-gray-600 dark:text-[#CBD5E1] hover:bg-gray-100 dark:hover:bg-[#1A1E28] transition-colors"
              >
                {isDownloading ? (
                  <svg className="h-4 w-4 animate-spin text-[#2C3480] dark:text-[#AAB3FF]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                )}
              </button>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={handleToggleFullscreen}
                aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                className="hidden sm:flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-gray-600 dark:text-[#CBD5E1] hover:bg-gray-100 dark:hover:bg-[#1A1E28] transition-colors"
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0h4m-4 0v4m11 5l5 5m0 0h-4m4 0v-4m-5-11l5-5m0 0h-4m4 0v4M9 15l-5 5m0 0h4m-4 0v-4" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                )}
              </button>
            </>
          )}

          {/* More Menu Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMoreOpen((o) => !o)}
              aria-label="More Options"
              title="More Options"
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-gray-600 dark:text-[#CBD5E1] hover:bg-gray-100 dark:hover:bg-[#1A1E28] transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>

            {/* More Menu Dropdown (100% functional, NO dead buttons!) */}
            {isMoreOpen && (
              <div
                className="absolute right-0 mt-2 w-52 rounded-2xl border border-[#E5E5E5] dark:border-[#292E3A] bg-white dark:bg-[#14171F] p-1.5 shadow-xl z-30"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#CBD5E1] hover:bg-[#F7F8FA] dark:hover:bg-[#1A1E28] transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#2C3480] dark:text-[#AAB3FF]" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  <span>Download PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#CBD5E1] hover:bg-[#F7F8FA] dark:hover:bg-[#1A1E28] transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#2C3480] dark:text-[#AAB3FF]" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                  <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false);
                    setIsInfoOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 dark:text-[#CBD5E1] hover:bg-[#F7F8FA] dark:hover:bg-[#1A1E28] transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#2C3480] dark:text-[#AAB3FF]" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>Document Details</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. SEARCH BAR (COLLAPSIBLE) */}
      {isSearchOpen && (
        <div className="flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#1E2433] bg-white dark:bg-[#14171F] px-4 py-2 text-xs z-15 shadow-sm">
          <form onSubmit={handlePerformSearch} className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search text in PDF..."
                className="w-full rounded-lg border border-[#E5E5E5] dark:border-[#292E3A] bg-[#F7F8FA] dark:bg-[#1A1E28] px-3 py-1.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2C3480]"
              />
            </div>

            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="rounded-lg bg-[#2C3480] hover:bg-[#3D4CC4] disabled:opacity-50 text-white px-3 py-1.5 font-bold transition-colors"
            >
              {isSearching ? "Searching..." : "Find"}
            </button>
          </form>

          <div className="flex items-center gap-2 ml-4">
            {searchResults.length > 0 && (
              <>
                <span className="text-[11px] font-semibold text-gray-500 dark:text-[#858B99]">
                  {searchMatchIndex + 1} of {searchResults.length} matches
                </span>
                <button
                  type="button"
                  onClick={handlePrevSearchMatch}
                  title="Previous Match"
                  className="p-1 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1A1E28]"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={handleNextSearchMatch}
                  title="Next Match"
                  className="p-1 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1A1E28]"
                >
                  ▼
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsSearchOpen(false)}
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-white ml-1 font-bold"
              aria-label="Close search"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 3. MAIN VIEWER CONTENT AREA */}
      <main
        ref={pageContainerRef}
        onClick={() => {
          if (isMoreOpen) setIsMoreOpen(false);
        }}
        className="relative flex-1 overflow-auto bg-[#F7F8FA] dark:bg-[#0B0D12] flex items-center justify-center p-3 sm:p-6"
      >
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-[#151936] text-[#2C3480] dark:text-[#AAB3FF]">
              <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">{loadingText}</h3>
              <p className="text-xs text-gray-500 dark:text-[#858B99] mt-1">Preparing your document securely...</p>
            </div>
          </div>
        )}

        {/* Error / Retry State */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-sm rounded-2xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-[#14171F] shadow-lg">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 mb-3">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">{error}</h3>
            <p className="text-xs text-gray-500 dark:text-[#858B99] mb-4">
              The PDF could not be loaded or the authorization has expired.
            </p>
            <button
              type="button"
              onClick={loadPdfDocument}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2C3480] hover:bg-[#3D4CC4] text-white px-4 py-2 text-xs font-bold shadow-sm transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* PDF Canvas Rendering (Always keep canvas pure white, no inverted dark mode inside document!) */}
        {!loading && !error && (
          <div className="relative flex flex-col items-center justify-center my-auto transition-all">
            <div className="relative shadow-2xl rounded-sm overflow-hidden bg-white border border-[#E5E5E5]">
              <canvas ref={canvasRef} className="block max-w-none" />
              {pageRendering && (
                <div className="absolute inset-0 bg-white/40 dark:bg-black/20 backdrop-blur-[1px] flex items-center justify-center">
                  <div className="h-6 w-6 rounded-full border-2 border-[#2C3480] border-t-transparent animate-spin" />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 4. MOBILE BOTTOM CONTROLS BAR */}
      {!loading && !error && numPages > 0 && (
        <footer className="sm:hidden flex h-12 w-full shrink-0 items-center justify-between border-t border-[#E5E5E5] dark:border-[#1E2433] bg-white dark:bg-[#14171F] px-4 z-20">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={pageNum <= 1}
            className="flex h-8 px-3 items-center justify-center rounded-lg bg-[#F7F8FA] dark:bg-[#1A1E28] text-xs font-bold text-gray-700 dark:text-white disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-xs font-semibold text-gray-700 dark:text-white">
            Page {pageNum} of {numPages}
          </span>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={pageNum >= numPages}
            className="flex h-8 px-3 items-center justify-center rounded-lg bg-[#F7F8FA] dark:bg-[#1A1E28] text-xs font-bold text-gray-700 dark:text-white disabled:opacity-30"
          >
            Next
          </button>
        </footer>
      )}

      {/* 5. TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed bottom-14 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900 px-4 py-2 text-xs font-bold shadow-xl backdrop-blur-sm transition-all animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* 6. DOCUMENT DETAILS MODAL (ACCESSED VIA MORE MENU) */}
      {isInfoOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setIsInfoOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#E5E5E5] dark:border-[#292E3A] bg-white dark:bg-[#14171F] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#1E2433]">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Document Information</h3>
              <button
                type="button"
                onClick={() => setIsInfoOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div>
                <span className="text-gray-400 dark:text-[#858B99] block text-[10px] uppercase font-bold">Title</span>
                <span className="font-semibold text-gray-800 dark:text-white">{doc.title}</span>
              </div>
              <div>
                <span className="text-gray-400 dark:text-[#858B99] block text-[10px] uppercase font-bold">Subject & Year</span>
                <span className="font-semibold text-gray-800 dark:text-white">
                  {subject?.name || "Subject"} ({subject?.short_name || "CODE"}) • {yearLabel || "Academic"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-gray-400 dark:text-[#858B99] block text-[10px] uppercase font-bold">Total Pages</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{numPages || doc.page_count || "—"}</span>
                </div>
                <div>
                  <span className="text-gray-400 dark:text-[#858B99] block text-[10px] uppercase font-bold">File Size</span>
                  <span className="font-semibold text-gray-800 dark:text-white">{formatFileSize(doc.file_size)}</span>
                </div>
              </div>
              <div className="pt-1">
                <span className="text-gray-400 dark:text-[#858B99] block text-[10px] uppercase font-bold">Storage Protection</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                  </svg>
                  Verified Secure Cloud
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsInfoOpen(false)}
              className="mt-5 w-full rounded-xl bg-gray-100 dark:bg-[#1A1E28] hover:bg-gray-200 dark:hover:bg-[#252B3A] py-2 text-xs font-bold text-gray-700 dark:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
