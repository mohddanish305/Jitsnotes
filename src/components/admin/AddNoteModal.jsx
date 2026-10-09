import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { categoriesApi } from "../../lib/api";
import { resolveSubjectName } from "../../utils/academicCatalog";

const YEAR_OPTIONS = [
  { id: 1, label: "1st Year", short: "Year 1" },
  { id: 2, label: "2nd Year", short: "Year 2" },
  { id: 3, label: "3rd Year", short: "Year 3" },
  { id: 4, label: "4th Year", short: "Year 4" },
];

const SUGGESTED_CATEGORY_EXAMPLES = [
  "Lab Manual",
  "Assignments",
  "Viva Questions",
  "Previous Year Papers",
  "Exam Preparation",
  "Projects",
  "Reference Material",
];

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const cleanTitleFromFilename = (filename) => {
  if (!filename) return "";
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  return nameWithoutExt
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const formatYearLabel = (id, name) => {
  if (name && typeof name === "string" && name.trim()) return name.trim();
  const num = Number(id);
  if (num === 1) return "1st Year";
  if (num === 2) return "2nd Year";
  if (num === 3) return "3rd Year";
  if (num === 4) return "4th Year";
  return `Year ${num}`;
};

export default function AddNoteModal({
  years = YEAR_OPTIONS,
  subjects = [],
  folders = [],
  categories = [],
  initialYearId = 1,
  initialSubjectId = "",
  initialUnitId = "",
  onClose,
  onUploaded,
  onCategoryCreated,
  onUnitCreated,
}) {
  // Prevent background scroll while modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // 1. Academic Years Dynamic Fetch & Normalization
  const [dbYears, setDbYears] = useState([]);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [yearsError, setYearsError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchYears() {
      setYearsLoading(true);
      setYearsError(null);
      try {
        const { data, error: yErr } = await supabase
          .from("years")
          .select("id, name")
          .order("id", { ascending: true });
        if (yErr) throw yErr;
        if (isMounted && data && data.length > 0) {
          setDbYears(data);
        }
      } catch (err) {
        console.warn("[AddNoteModal] Failed to load years from Supabase:", err);
        if (isMounted) {
          setYearsError("Unable to refresh academic years from server. Using curriculum defaults.");
        }
      } finally {
        if (isMounted) setYearsLoading(false);
      }
    }

    fetchYears();
    return () => {
      isMounted = false;
    };
  }, []);

  const resolvedYears = useMemo(() => {
    const source =
      dbYears.length > 0
        ? dbYears
        : years && years.length > 0
        ? years
        : YEAR_OPTIONS;

    return source.map((y) => {
      const numId = Number(y.id);
      return {
        id: numId,
        label: formatYearLabel(numId, y.name || y.label),
      };
    });
  }, [dbYears, years]);

  // A. Academic Location State
  const [yearId, setYearId] = useState(initialYearId ? Number(initialYearId) : 1);
  const [subjectId, setSubjectId] = useState(initialSubjectId || "");
  const [unitId, setUnitId] = useState(initialUnitId || "");

  // Local units/folders created in current modal session
  const [localFolders, setLocalFolders] = useState([]);

  // Custom Unit State
  const [isCustomUnitMode, setIsCustomUnitMode] = useState(false);
  const [customUnitName, setCustomUnitName] = useState("");
  const [customUnitNumber, setCustomUnitNumber] = useState("");
  const [isCreatingUnit, setIsCreatingUnit] = useState(false);
  const [customUnitError, setCustomUnitError] = useState(null);
  const [customUnitSuccess, setCustomUnitSuccess] = useState(null);

  // B. Note Details State
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Custom Category State
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [categoryValidationMessage, setCategoryValidationMessage] = useState(null);
  const [duplicateCategoryMatch, setDuplicateCategoryMatch] = useState(null);

  // C. PDF Upload State
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // D. Save & Submission State
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [uploadSuccessData, setUploadSuccessData] = useState(null);
  const [openingPdf, setOpeningPdf] = useState(false);

  // Filter subjects strictly by chosen year
  const availableSubjects = useMemo(() => {
    return subjects.filter((s) => Number(s.year_id) === Number(yearId));
  }, [subjects, yearId]);

  // Handle Academic Year selection change
  const handleYearChange = (newYearId) => {
    const parsed = Number(newYearId);
    setYearId(parsed);
    // Clear subject and unit selection when academic year changes
    setSubjectId("");
    setUnitId("");
    setIsCustomUnitMode(false);
    setCustomUnitError(null);
    setFieldErrors((prev) => ({ ...prev, year: null, subject: null, unit: null }));
  };

  // Handle Subject selection change
  const handleSubjectChange = (newSubjectId) => {
    setSubjectId(newSubjectId);
    setUnitId("");
    setIsCustomUnitMode(false);
    setCustomUnitError(null);
    setFieldErrors((prev) => ({ ...prev, subject: null, unit: null }));
  };

  // Combined units & folders
  const allFolders = useMemo(() => {
    const combined = [...folders];
    const seen = new Set(folders.map((f) => f.id));
    localFolders.forEach((f) => {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        combined.push(f);
      }
    });
    return combined;
  }, [folders, localFolders]);

  // Filter units/folders for currently chosen subject
  const availableFolders = useMemo(() => {
    if (!subjectId) return [];
    return allFolders.filter((f) => f.subject_id === subjectId);
  }, [allFolders, subjectId]);

  // Set default category if none selected
  useEffect(() => {
    if (categories.length > 0 && !categoryId && !isCustomCategoryMode) {
      const defaultCat =
        categories.find((c) => /lecture notes|study material|notes/i.test(c.name)) ||
        categories[0];
      if (defaultCat) setCategoryId(defaultCat.id);
    }
  }, [categories, categoryId, isCustomCategoryMode]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isUploading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isUploading]);

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    setError(null);
    setFieldErrors((prev) => ({ ...prev, file: null }));

    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Only PDF files are supported.");
      return;
    }
    if (selectedFile.size > 25 * 1024 * 1024) {
      setError(`File "${selectedFile.name}" exceeds the 25 MB limit.`);
      return;
    }
    if (selectedFile.size === 0) {
      setError("The selected file is empty.");
      return;
    }

    setFile(selectedFile);
    if (!title.trim()) {
      setTitle(cleanTitleFromFilename(selectedFile.name));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleCategorySelectChange = (e) => {
    const val = e.target.value;
    if (val === "__custom__") {
      setIsCustomCategoryMode(true);
      setCategoryValidationMessage(null);
      setDuplicateCategoryMatch(null);
    } else {
      setIsCustomCategoryMode(false);
      setCategoryId(val);
      setCategoryValidationMessage(null);
      setDuplicateCategoryMatch(null);
    }
  };

  const handleCreateCustomCategory = async (rawName) => {
    const nameToUse = (rawName !== undefined ? rawName : customCategoryName)
      .trim()
      .replace(/\s+/g, " ");

    if (!nameToUse) {
      setCategoryValidationMessage("Custom category name cannot be empty.");
      setDuplicateCategoryMatch(null);
      return null;
    }

    // Check duplicate against currently loaded categories
    const localMatch = categories.find(
      (c) => (c.name || "").trim().toLowerCase() === nameToUse.toLowerCase()
    );
    if (localMatch) {
      setCategoryValidationMessage(`Category "${localMatch.name}" already exists.`);
      setDuplicateCategoryMatch(localMatch);
      return null;
    }

    setIsCreatingCategory(true);
    setCategoryValidationMessage(null);
    setDuplicateCategoryMatch(null);

    try {
      const newCat = await categoriesApi.create(nameToUse);
      if (onCategoryCreated) {
        onCategoryCreated(newCat);
      }
      setCategoryId(newCat.id);
      setIsCustomCategoryMode(false);
      setCustomCategoryName("");
      return newCat;
    } catch (err) {
      if (err.isDuplicate && err.existingCategory) {
        setCategoryValidationMessage(`Category "${err.existingCategory.name}" already exists.`);
        setDuplicateCategoryMatch(err.existingCategory);
      } else {
        setCategoryValidationMessage(err?.message || "Failed to create custom category.");
      }
      return null;
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Create Custom Unit Inline
  const handleSaveCustomUnit = async () => {
    if (!subjectId) {
      setCustomUnitError("Please select an academic year and subject first.");
      return;
    }
    const trimmed = customUnitName.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      setCustomUnitError("Unit name is required.");
      return;
    }

    // Whitespace and case-insensitive duplicate check within chosen subject
    const isDuplicate = availableFolders.some(
      (f) => (f.name || "").trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setCustomUnitError(`A unit named "${trimmed}" already exists for this subject.`);
      return;
    }

    setIsCreatingUnit(true);
    setCustomUnitError(null);

    try {
      // Insert into folders table (automatically syncs to units table via trigger trg_sync_folder_to_units)
      const { data: newFolder, error: folderErr } = await supabase
        .from("folders")
        .insert({
          subject_id: subjectId,
          name: trimmed,
          is_active: true,
        })
        .select()
        .single();

      if (folderErr) throw folderErr;

      // If optional unit number provided, set it on units table
      let parsedNum = null;
      if (customUnitNumber && /^[0-9]+$/.test(String(customUnitNumber).trim())) {
        parsedNum = Number(customUnitNumber);
        if (parsedNum > 0) {
          try {
            await supabase
              .from("units")
              .update({ unit_number: parsedNum })
              .eq("id", newFolder.id);
          } catch (numErr) {
            console.warn("Could not set custom unit number:", numErr);
          }
        }
      }

      const createdUnit = {
        id: newFolder.id,
        subject_id: subjectId,
        name: trimmed,
        unit_number: parsedNum || undefined,
      };

      setLocalFolders((prev) => [...prev, createdUnit]);
      setUnitId(newFolder.id);
      setIsCustomUnitMode(false);
      setCustomUnitName("");
      setCustomUnitNumber("");
      setCustomUnitSuccess(`Unit "${trimmed}" created and selected.`);
      setTimeout(() => setCustomUnitSuccess(null), 3500);

      if (onUnitCreated) {
        onUnitCreated(createdUnit);
      }
    } catch (err) {
      setCustomUnitError(err?.message || "Failed to create custom unit.");
    } finally {
      setIsCreatingUnit(false);
    }
  };

  const handleCancelCustomUnit = () => {
    setIsCustomUnitMode(false);
    setCustomUnitName("");
    setCustomUnitNumber("");
    setCustomUnitError(null);
  };

  const handleViewCreatedNote = async () => {
    if (!uploadSuccessData?.document?.id) return;
    setOpeningPdf(true);
    try {
      const { data, error: urlError } = await supabase.functions.invoke("get-document-url", {
        body: { document_id: uploadSuccessData.document.id },
      });
      if (urlError || !data?.download_url) {
        throw new Error(data?.error || urlError?.message || "Failed to generate download URL.");
      }
      window.open(data.download_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err?.message || "Failed to open PDF.");
    } finally {
      setOpeningPdf(false);
    }
  };

  const handleResetForAnother = () => {
    setTitle("");
    setFile(null);
    setError(null);
    setFieldErrors({});
    setUploadSuccessData(null);
    setIsCustomCategoryMode(false);
    setCustomCategoryName("");
    setIsCustomUnitMode(false);
    setCustomUnitName("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isUploading) return;

    // Reset error states
    setError(null);
    const errors = {};

    if (!file) {
      errors.file = "Please choose a PDF file to upload.";
    }
    if (!title.trim()) {
      errors.title = "Note title is required.";
    }
    if (!yearId) {
      errors.year = "Academic year is required.";
    }
    if (!subjectId) {
      errors.subject = "Please select a valid subject.";
    } else {
      const activeSubject = availableSubjects.find((s) => s.id === subjectId);
      if (!activeSubject || Number(activeSubject.year_id) !== Number(yearId)) {
        errors.subject = "Selected subject does not belong to the chosen academic year.";
      }
    }

    let finalCategoryId = categoryId;
    let customCatNameUsed = "";
    if (isCustomCategoryMode) {
      if (!customCategoryName.trim()) {
        errors.category = "Please enter a category name or select an existing category.";
      } else {
        const createdCat = await handleCreateCustomCategory(customCategoryName);
        if (!createdCat) {
          return;
        }
        finalCategoryId = createdCat.id;
        customCatNameUsed = createdCat.name;
      }
    }

    if (!finalCategoryId) {
      errors.category = "Please select or create a category.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());
      formData.append("year_id", String(yearId));
      formData.append("subject_id", subjectId);
      if (unitId) {
        formData.append("folder_id", unitId);
        formData.append("unit_id", unitId);
      }
      formData.append("category_id", finalCategoryId);
      formData.append("is_active", isActive ? "true" : "false");

      const { data, error: uploadErr } = await supabase.functions.invoke("upload-document", {
        body: formData,
      });

      if (uploadErr || !data?.document) {
        throw new Error(data?.error || uploadErr?.message || "Upload failed");
      }

      const activeSubject = availableSubjects.find((s) => s.id === subjectId);
      const activeCategory =
        categories.find((c) => c.id === finalCategoryId) ||
        (customCatNameUsed ? { name: customCatNameUsed } : null);
      const activeFolder = availableFolders.find((f) => f.id === unitId);

      setUploadSuccessData({
        document: data.document,
        subjectName: activeSubject ? activeSubject.name : "Subject",
        categoryName: activeCategory ? activeCategory.name : "Study Material",
        folderName: activeFolder ? activeFolder.name : "General Notes",
      });

      if (onUploaded) {
        onUploaded([data.document]);
      }
    } catch (err) {
      console.error("[AddNoteModal] Upload failed:", err);
      setError(
        err?.message || "Upload failed. Please check your connection and file, then try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUploading) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] rounded-2xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#151515] shadow-2xl flex flex-col overflow-hidden my-auto">
        {/* Pinned Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#262626] px-5 sm:px-6 py-4 bg-[#FAFAFA] dark:bg-[#0B0B0B]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F8E9EC] text-[#8F1D32] dark:bg-[#8F1D32]/20 dark:text-[#F8E9EC]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </span>
            <div>
              <h2 className="text-base font-bold text-[#151515] dark:text-[#FAFAFA]">Add Note</h2>
              <p className="text-xs text-[#666666] dark:text-[#999999]">
                Upload PDF to the academic repository
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#666666] hover:bg-[#E5E5E5] hover:text-[#151515] dark:text-[#999999] dark:hover:bg-[#262626] dark:hover:text-[#FAFAFA] transition cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        {uploadSuccessData ? (
          /* SUCCESS STATE */
          <div className="p-6 sm:p-8 text-center space-y-6 overflow-y-auto">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#151515] dark:text-[#FAFAFA]">
                Note Uploaded Successfully
              </h3>
              <p className="mt-1 text-xs text-[#666666] dark:text-[#999999]">
                Saved to repository and backed by Backblaze B2 storage
              </p>
            </div>

            <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#0B0B0B] p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#666666] dark:text-[#999999]">Title:</span>
                <span className="font-semibold text-[#151515] dark:text-[#FAFAFA] truncate max-w-[280px]">
                  {uploadSuccessData.document.title}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666666] dark:text-[#999999]">Subject:</span>
                <span className="font-medium text-[#151515] dark:text-[#FAFAFA]">
                  {uploadSuccessData.subjectName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666666] dark:text-[#999999]">Unit:</span>
                <span className="font-medium text-[#151515] dark:text-[#FAFAFA]">
                  {uploadSuccessData.folderName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666666] dark:text-[#999999]">Category:</span>
                <span className="font-medium text-[#8F1D32] dark:text-[#F8E9EC]">
                  {uploadSuccessData.categoryName}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleViewCreatedNote}
                disabled={openingPdf}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-4 py-2.5 text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] hover:bg-[#FAFAFA] dark:hover:bg-[#262626] transition shadow-xs cursor-pointer"
              >
                {openingPdf ? (
                  <span>Opening...</span>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <span>View Note</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleResetForAnother}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#8F1D32] hover:bg-[#74152A] px-4 py-2.5 text-xs font-semibold text-white transition shadow-xs cursor-pointer"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Add Another Note</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto rounded-xl border border-transparent px-4 py-2.5 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:text-[#151515] dark:hover:text-white cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* FORM VIEW */
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3.5 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40">
                  <div className="font-semibold mb-0.5">Upload Error</div>
                  <div>{error}</div>
                </div>
              )}

              {yearsError && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                  {yearsError}
                </div>
              )}

              {customUnitSuccess && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-2.5 text-xs text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">
                  {customUnitSuccess}
                </div>
              )}

              {/* SECTION A: Academic Location */}
              <div className="space-y-3 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#0B0B0B] p-4">
                <div className="flex items-center gap-2 border-b border-[#E5E5E5] dark:border-[#262626] pb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#151515] text-[10px] font-bold text-white dark:bg-white dark:text-[#151515]">
                    A
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#151515] dark:text-[#FAFAFA]">
                    Academic Location
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Academic Year */}
                  <div>
                    <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
                      Academic Year *
                    </label>
                    <select
                      value={yearId}
                      disabled={isUploading || yearsLoading}
                      onChange={(e) => handleYearChange(e.target.value)}
                      className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
                    >
                      {yearsLoading ? (
                        <option value="">Loading curriculum years...</option>
                      ) : resolvedYears.length === 0 ? (
                        <option value="">No academic years found</option>
                      ) : (
                        resolvedYears.map((y) => (
                          <option key={y.id} value={y.id}>
                            {y.label}
                          </option>
                        ))
                      )}
                    </select>
                    {fieldErrors.year && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                        {fieldErrors.year}
                      </p>
                    )}
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
                      Subject *
                    </label>
                    <select
                      value={subjectId}
                      disabled={isUploading}
                      required
                      onChange={(e) => handleSubjectChange(e.target.value)}
                      className={`w-full rounded-xl border bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none ${
                        fieldErrors.subject
                          ? "border-red-500"
                          : "border-[#E5E5E5] dark:border-[#262626]"
                      }`}
                    >
                      <option value="">Select a subject...</option>
                      {availableSubjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.short_name ? `[${sub.short_name}] ` : ""}
                          {resolveSubjectName(sub.id, sub.name, sub.short_name)}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.subject && (
                      <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                        {fieldErrors.subject}
                      </p>
                    )}
                  </div>
                </div>

                {/* Unit / Organization */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA]">
                      Unit / Organization
                    </label>
                    {!isCustomUnitMode && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!subjectId) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              subject: "Please select an academic year and subject before creating a unit.",
                            }));
                            return;
                          }
                          setIsCustomUnitMode(true);
                          setCustomUnitError(null);
                        }}
                        className="text-[11px] font-semibold text-[#8F1D32] dark:text-[#F8E9EC] hover:underline cursor-pointer"
                      >
                        + Create Custom Unit
                      </button>
                    )}
                  </div>

                  {!isCustomUnitMode ? (
                    <select
                      value={unitId}
                      disabled={isUploading}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__create_custom_unit__") {
                          if (!subjectId) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              subject: "Please select an academic year and subject before creating a unit.",
                            }));
                            return;
                          }
                          setIsCustomUnitMode(true);
                          setCustomUnitError(null);
                        } else {
                          setUnitId(val);
                        }
                      }}
                      className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
                    >
                      <option value="">No Unit / General Notes</option>
                      {availableFolders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.unit_number ? `Unit ${f.unit_number}: ${f.name}` : f.name}
                        </option>
                      ))}
                      <option value="__create_custom_unit__">+ Create Custom Unit</option>
                    </select>
                  ) : (
                    /* Inline Custom Unit Form */
                    <div className="rounded-xl border border-[#8F1D32]/30 bg-[#FDF8F9] dark:bg-[#1E1114] p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#8F1D32] dark:text-[#F8E9EC] flex items-center gap-1.5">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Create Custom Unit
                        </span>
                        <button
                          type="button"
                          onClick={handleCancelCustomUnit}
                          className="text-[11px] font-medium text-[#666666] hover:text-[#151515] dark:text-[#999999] dark:hover:text-white cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
                            Unit Name *
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Unit 1: Graph Theory"
                            value={customUnitName}
                            disabled={isCreatingUnit}
                            onChange={(e) => {
                              setCustomUnitName(e.target.value);
                              setCustomUnitError(null);
                            }}
                            className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3 py-2 text-xs text-[#151515] dark:text-[#FAFAFA] placeholder-[#999999] focus:border-[#8F1D32] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
                            Unit # <span className="font-normal text-[#666666] dark:text-[#999999]">(Opt)</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            placeholder="e.g. 1"
                            value={customUnitNumber}
                            disabled={isCreatingUnit}
                            onChange={(e) => setCustomUnitNumber(e.target.value)}
                            className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3 py-2 text-xs text-[#151515] dark:text-[#FAFAFA] placeholder-[#999999] focus:border-[#8F1D32] focus:outline-none"
                          />
                        </div>
                      </div>

                      {customUnitError && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                          {customUnitError}
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCancelCustomUnit}
                          disabled={isCreatingUnit}
                          className="rounded-lg border border-[#E5E5E5] dark:border-[#262626] px-3 py-1.5 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:bg-white dark:hover:bg-[#262626] transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveCustomUnit}
                          disabled={isCreatingUnit}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#8F1D32] hover:bg-[#74152A] px-3.5 py-1.5 text-xs font-semibold text-white transition shadow-xs cursor-pointer"
                        >
                          {isCreatingUnit ? (
                            <>
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                              <span>Creating...</span>
                            </>
                          ) : (
                            <span>Create & Select</span>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="mt-1 text-[11px] text-[#666666] dark:text-[#999999]">
                    Units are optional curriculum subdivisions for organizing lecture notes and question papers.
                  </p>
                </div>
              </div>

              {/* SECTION B: Note Details */}
              <div className="space-y-3 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#0B0B0B] p-4">
                <div className="flex items-center gap-2 border-b border-[#E5E5E5] dark:border-[#262626] pb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#151515] text-[10px] font-bold text-white dark:bg-white dark:text-[#151515]">
                    B
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#151515] dark:text-[#FAFAFA]">
                    Note Details
                  </h3>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] mb-1">
                    Note Title *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isUploading}
                    placeholder="e.g. Unit 1 Complete Hand-written Notes"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, title: null }));
                    }}
                    className={`w-full rounded-xl border bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] placeholder-[#999999] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none ${
                      fieldErrors.title
                        ? "border-red-500"
                        : "border-[#E5E5E5] dark:border-[#262626]"
                    }`}
                  />
                  {fieldErrors.title && (
                    <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                      {fieldErrors.title}
                    </p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#151515] dark:text-[#FAFAFA]">
                      Category *
                    </label>
                    {isCustomCategoryMode && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCategoryMode(false);
                          setCategoryValidationMessage(null);
                          setDuplicateCategoryMatch(null);
                        }}
                        className="text-[11px] font-medium text-[#8F1D32] dark:text-[#F8E9EC] hover:underline cursor-pointer"
                      >
                        ← Back to existing categories
                      </button>
                    )}
                  </div>

                  <select
                    value={isCustomCategoryMode ? "__custom__" : categoryId}
                    disabled={isUploading}
                    onChange={handleCategorySelectChange}
                    className="w-full rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3.5 py-2.5 text-sm text-[#151515] dark:text-[#FAFAFA] focus:border-[#8F1D32] dark:focus:border-[#A21F3D] focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="__custom__">+ Create Custom Category</option>
                  </select>

                  {/* Inline Custom Category Creator */}
                  {isCustomCategoryMode && (
                    <div className="mt-2 rounded-xl border border-[#8F1D32]/30 bg-[#FDF8F9] dark:bg-[#1E1114] p-3 space-y-2">
                      <label className="block text-[11px] font-semibold text-[#151515] dark:text-[#FAFAFA]">
                        Custom Category Name *
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter your category name..."
                          value={customCategoryName}
                          disabled={isCreatingCategory}
                          onChange={(e) => {
                            setCustomCategoryName(e.target.value);
                            setCategoryValidationMessage(null);
                            setDuplicateCategoryMatch(null);
                          }}
                          className="flex-1 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-3 py-2 text-xs text-[#151515] dark:text-[#FAFAFA] placeholder-[#999999] focus:border-[#8F1D32] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleCreateCustomCategory()}
                          disabled={isCreatingCategory}
                          className="rounded-xl bg-[#8F1D32] hover:bg-[#74152A] px-3 py-2 text-xs font-semibold text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
                        >
                          {isCreatingCategory ? "Saving..." : "Create"}
                        </button>
                      </div>

                      {/* Suggestions */}
                      <div className="pt-1">
                        <span className="text-[10px] text-[#666666] dark:text-[#999999]">
                          Quick suggestions:
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {SUGGESTED_CATEGORY_EXAMPLES.map((ex) => (
                            <button
                              key={ex}
                              type="button"
                              onClick={() => {
                                setCustomCategoryName(ex);
                                setCategoryValidationMessage(null);
                                setDuplicateCategoryMatch(null);
                              }}
                              className="rounded-md border border-[#E5E5E5] dark:border-[#262626] bg-white dark:bg-[#151515] px-2 py-0.5 text-[10px] font-medium text-[#666666] hover:border-[#8F1D32] hover:text-[#8F1D32] dark:text-[#999999] transition cursor-pointer"
                            >
                              + {ex}
                            </button>
                          ))}
                        </div>
                      </div>

                      {categoryValidationMessage && (
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-900/40 space-y-1">
                          <p>{categoryValidationMessage}</p>
                          {duplicateCategoryMatch && (
                            <button
                              type="button"
                              onClick={() => {
                                setCategoryId(duplicateCategoryMatch.id);
                                setIsCustomCategoryMode(false);
                                setCategoryValidationMessage(null);
                                setDuplicateCategoryMatch(null);
                              }}
                              className="inline-block text-xs font-bold text-[#8F1D32] dark:text-[#F8E9EC] hover:underline cursor-pointer"
                            >
                              Select existing "{duplicateCategoryMatch.name}" instead →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="active_status"
                    checked={isActive}
                    disabled={isUploading}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-[#E5E5E5] text-[#8F1D32] focus:ring-[#8F1D32] cursor-pointer"
                  />
                  <label htmlFor="active_status" className="text-xs font-semibold text-[#151515] dark:text-[#FAFAFA] cursor-pointer">
                    Publish immediately (Active)
                  </label>
                </div>
              </div>

              {/* SECTION C: PDF Upload */}
              <div className="space-y-3 rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#0B0B0B] p-4">
                <div className="flex items-center gap-2 border-b border-[#E5E5E5] dark:border-[#262626] pb-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#151515] text-[10px] font-bold text-white dark:bg-white dark:text-[#151515]">
                    C
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#151515] dark:text-[#FAFAFA]">
                    PDF Upload
                  </h3>
                </div>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                    file
                      ? "border-[#8F1D32] bg-[#F8E9EC]/40 dark:bg-[#8F1D32]/10"
                      : isDragging
                      ? "border-[#8F1D32] bg-[#F8E9EC]/60 dark:bg-[#8F1D32]/20"
                      : "border-[#E5E5E5] dark:border-[#262626] hover:border-[#8F1D32] bg-white dark:bg-[#151515]"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={isUploading}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {file ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#8F1D32] text-white">
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </span>
                        <div className="text-left min-w-0">
                          <p className="text-xs font-bold text-[#151515] dark:text-[#FAFAFA] truncate">
                            {file.name}
                          </p>
                          <p className="text-[11px] text-[#666666] dark:text-[#999999]">
                            {formatFileSize(file.size)} • PDF Ready to upload
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        className="text-xs font-semibold text-[#8F1D32] hover:underline shrink-0 cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAFAFA] dark:bg-[#0B0B0B] text-[#666666] dark:text-[#999999] border border-[#E5E5E5] dark:border-[#262626]">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#151515] dark:text-[#FAFAFA]">
                          Click to browse or drag and drop your PDF here
                        </p>
                        <p className="text-[11px] text-[#666666] dark:text-[#999999] mt-0.5">
                          PDF format up to 25 MB max
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {fieldErrors.file && (
                  <p className="text-[11px] text-red-600 dark:text-red-400">
                    {fieldErrors.file}
                  </p>
                )}
              </div>
            </div>

            {/* Pinned Footer Actions */}
            <div className="shrink-0 border-t border-[#E5E5E5] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#0B0B0B] px-5 sm:px-6 py-3.5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] px-4 py-2.5 text-xs font-semibold text-[#666666] dark:text-[#999999] hover:bg-white dark:hover:bg-[#151515] hover:text-[#151515] dark:hover:text-[#FAFAFA] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#8F1D32] hover:bg-[#74152A] text-white disabled:opacity-50 px-5 py-2.5 text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    <span>Uploading Note...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    <span>Save Note</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
