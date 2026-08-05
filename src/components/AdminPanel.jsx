import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import Modal from "./Modal";
import { useAuth } from "../context/AuthContext";
import { supabase as supabaseClient } from "../lib/supabase";
import { FaBook, FaFileAlt, FaFlask, FaGraduationCap, FaBriefcase, FaFolderOpen } from "./icons";
const getTypeIcon = (type) => {
  const iconClass = "w-5 h-5 text-gray-500 dark:text-gray-400";
  switch (type) {
    case "Previous Year Question Papers":
      return <FaFileAlt className={iconClass} />;
    case "Syllabus":
      return <FaGraduationCap className={iconClass} />;
    case "Lab Manuals":
      return <FaFlask className={iconClass} />;
    case "Important Questions":
      return <FaFileAlt className={iconClass} />;
    case "E-Books":
      return <FaBook className={iconClass} />;
    case "Placement Material":
      return <FaBriefcase className={iconClass} />;
    default:
      return <FaFolderOpen className={iconClass} />;
  }
};

const supabaseProxy = new Proxy(supabaseClient, {
  get(target, prop) {
    if (prop === "from") {
      return (tableName) => {
        const originalQuery = target.from(tableName);
        if (tableName === "subjects") {
          return new Proxy(originalQuery, {
            get(qTarget, qProp) {
              if (qProp === "update") {
                return (payload) => {
                  const mappedPayload = { ...payload };
                  if ("subject_name" in mappedPayload) {
                    mappedPayload.name = mappedPayload.subject_name;
                    delete mappedPayload.subject_name;
                  }
                  if ("year" in mappedPayload) {
                    mappedPayload.year_id = mappedPayload.year;
                    delete mappedPayload.year;
                  }
                  return qTarget.update(mappedPayload);
                };
              }
              if (qProp === "insert") {
                return (payloads) => {
                  const mappedPayloads = (Array.isArray(payloads) ? payloads : [payloads]).map((payload) => {
                    const mapped = { ...payload };
                    if ("subject_name" in mapped) {
                      mapped.name = mapped.subject_name;
                      delete mapped.subject_name;
                    }
                    if ("year" in mapped) {
                      mapped.year_id = mapped.year;
                      delete mapped.year;
                    }
                    return mapped;
                  });
                  return qTarget.insert(mappedPayloads);
                };
              }
              const value = qTarget[qProp];
              return typeof value === "function" ? value.bind(qTarget) : value;
            },
          });
        }
        return originalQuery;
      };
    }
    const val = target[prop];
    return typeof val === "function" ? val.bind(target) : val;
  },
});

const supabase = supabaseProxy;

const INITIAL_FORM = {
  id: undefined,
  subject_name: "",
  short_name: "",
  year: 1,
  drive_link: "",
  thumbnail_url: "",
};

const INITIAL_RESOURCE_FORM = {
  id: undefined,
  title: "",
  short_name: "",
  description: "",
  resource_type: "Previous Year Question Papers",
  academic_year: 1,
  drive_link: "",
  thumbnail_url: "",
};

const YEAR_OPTIONS = [
  { value: 1, label: "Year 1" },
  { value: 2, label: "Year 2" },
  { value: 3, label: "Year 3" },
  { value: 4, label: "Year 4" },
];

const RESOURCE_TYPES = [
  "Previous Year Question Papers",
  "Syllabus",
  "Lab Manuals",
  "Important Questions",
  "E-Books",
  "Placement Material",
  "Other"
];

const PDF_BUCKET = "notes-pdfs";
const THUMBNAIL_BUCKET = "subject-thumbnails";
const THUMBNAIL_MAX_SIZE = 5 * 1024 * 1024;
const THUMBNAIL_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const FALLBACK_THUMBNAIL = "/icons.png";

const isValidThumbnailUrl = (value) => typeof value === "string" && value.startsWith("http");

const normalizeSubjectName = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
const normalizeSubjectYear = (value) => Number(value);

const normalizeSubjectRow = (subject) => {
  const yearValue = Number(subject.year_id ?? subject.year ?? 1);
  return {
    ...subject,
    id: subject.id,
    subject_name: subject.name ?? subject.subject_name ?? "",
    name: subject.name ?? subject.subject_name ?? "",
    short_name: subject.short_name ?? "",
    year: yearValue,
    year_id: yearValue,
    drive_link: subject.drive_link ?? "",
    thumbnail_url: subject.thumbnail_url ?? "",
  };
};

function getStoragePathFromUrl(url, bucket) {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const marker = `/object/public/${bucket}/`;
    const index = parsedUrl.pathname.indexOf(marker);

    if (index >= 0) {
      return decodeURIComponent(parsedUrl.pathname.slice(index + marker.length));
    }
  } catch (error) {
    return null;
  }

  return null;
}

function getPdfStoragePath(subject) {
  if (subject?.pdf_path) {
    return subject.pdf_path;
  }
  return getStoragePathFromUrl(subject?.drive_link || "", PDF_BUCKET);
}

function getThumbnailStoragePath(item) {
  return getStoragePathFromUrl(item?.thumbnail_url || "", THUMBNAIL_BUCKET);
}

function isSupportedThumbnailFile(file) {
  return Boolean(file) && THUMBNAIL_ALLOWED_TYPES.includes(file.type) && file.size <= THUMBNAIL_MAX_SIZE;
}

function createStorageFilePath(file, itemId, prefix) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
  return `${prefix}/${itemId}/${Date.now()}-${safeName}`;
}

function FieldLabel({ children }) {
  return <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-[#94A3B8]">{children}</span>;
}

function getFriendlyError(error, fallbackMessage) {
  const message = error?.message || fallbackMessage;
  if (/row-level security|permission denied|violates row-level security/i.test(message)) {
    return 'Permission denied. Verify the Supabase RLS policy and your admin session.';
  }
  if (message?.includes("resources") || message?.includes("relation")) {
    return "Resources database table was not found. Please run the database migration to create the table and enable permissions.";
  }
  return message;
}

function notifySubjectsChanged() {
  window.dispatchEvent(new Event("subjects:changed"));
}

export default function AdminPanel({ isOpen, onRefresh }) {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("notes"); // "notes" or "resources"
  
  // Notes State
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [editingNote, setEditingNote] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Resources State
  const [resources, setResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourceFormData, setResourceFormData] = useState(INITIAL_RESOURCE_FORM);
  const [editingResource, setEditingResource] = useState(null);
  const [resourceConfirmDeleteId, setResourceConfirmDeleteId] = useState(null);

  // Global State
  const [saving, setSaving] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState("");
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2600);
  }, []);

  const toast = {
    success: (message) => pushToast("success", message),
    error: (message) => pushToast("error", message),
  };

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(getFriendlyError(error, "Failed to load subjects."));
      setLoading(false);
      return;
    }

    const normalizedData = (data || []).map(normalizeSubjectRow);
    setSubjects(normalizedData);
    setLoading(false);
  }, [pushToast]);

  const fetchResources = useCallback(async () => {
    setResourcesLoading(true);
    const { data, error } = await supabase
      .from("resources")
      .select("*")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(getFriendlyError(error, "Failed to load resources."));
      setResourcesLoading(false);
      return;
    }

    setResources(data || []);
    setResourcesLoading(false);
  }, [pushToast]);

  useEffect(() => {
    if (!isOpen) return;
    fetchSubjects();
    fetchResources();
  }, [isOpen, fetchSubjects, fetchResources]);

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreviewUrl("");
      return undefined;
    }

    const objectUrl = window.URL.createObjectURL(thumbnailFile);
    setThumbnailPreviewUrl(objectUrl);

    return () => {
      window.URL.revokeObjectURL(objectUrl);
    };
  }, [thumbnailFile]);

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    await signOut();
    setLogoutLoading(false);
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM);
    setEditingNote(null);
    setThumbnailFile(null);
  };

  const resetResourceForm = () => {
    setResourceFormData(INITIAL_RESOURCE_FORM);
    setEditingResource(null);
    setThumbnailFile(null);
  };

  // Notes Form edit trigger
  const handleEdit = (note) => {
    setEditingNote(note);
    setFormData({
      id: note.id,
      subject_name: note.subject_name,
      short_name: note.short_name,
      year: note.year,
      drive_link: note.drive_link,
      thumbnail_url: note.thumbnail_url || ""
    });

    document
      .getElementById("note-form")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
  };

  // Resources Form edit trigger
  const handleEditResource = (resource) => {
    setEditingResource(resource);
    setResourceFormData({
      id: resource.id,
      title: resource.title,
      short_name: resource.short_name,
      description: resource.description || "",
      resource_type: resource.resource_type,
      academic_year: resource.academic_year,
      drive_link: resource.drive_link,
      thumbnail_url: resource.thumbnail_url || ""
    });

    document
      .getElementById("resource-form")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
  };

  const handleThumbnailChange = (event) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setThumbnailFile(null);
      return;
    }

    if (!isSupportedThumbnailFile(file)) {
      event.target.value = "";
      setThumbnailFile(null);

      if (!THUMBNAIL_ALLOWED_TYPES.includes(file.type)) {
        toast.error("Thumbnail must be JPG, PNG, or WEBP.");
      } else {
        toast.error("Thumbnail must be 5MB or smaller.");
      }
      return;
    }
    setThumbnailFile(file);
  };

  const uploadThumbnail = async (file, itemId) => {
    if (!file) {
      return { thumbnail_url: null, uploadedThumbnailPath: null };
    }

    const uploadedThumbnailPath = createStorageFilePath(file, itemId, "thumbnails");

    const { error: uploadError } = await supabase.storage
      .from(THUMBNAIL_BUCKET)
      .upload(uploadedThumbnailPath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from(THUMBNAIL_BUCKET)
      .getPublicUrl(uploadedThumbnailPath);

    return {
      thumbnail_url: publicUrlData?.publicUrl || null,
      uploadedThumbnailPath,
    };
  };

  // Create/Update Note CRUD
  const handleSaveNote = async () => {
    if (saving) return;
    setSaving(true);

    const name = normalizeSubjectName(formData.subject_name);
    const shortName = normalizeSubjectName(formData.short_name);
    const yearId = normalizeSubjectYear(formData.year);
    const driveLink = normalizeSubjectName(formData.drive_link);
    const thumbnailUrl = isValidThumbnailUrl(formData.thumbnail_url) ? formData.thumbnail_url.trim() : null;

    if (!name || !shortName || !driveLink || !Number.isInteger(yearId) || yearId <= 0) {
      toast.error("Please fill all fields.");
      setSaving(false);
      return;
    }

    const subjectId = editingNote ? editingNote.id : crypto.randomUUID();
    let uploadedThumbnailPath = null;
    let finalThumbnailUrl = thumbnailUrl;

    try {
      if (thumbnailFile) {
        const thumbnailResult = await uploadThumbnail(thumbnailFile, subjectId);
        uploadedThumbnailPath = thumbnailResult.uploadedThumbnailPath;
        finalThumbnailUrl = thumbnailResult.thumbnail_url || finalThumbnailUrl;
      }

      const payload = {
        subject_name: name,
        short_name: shortName,
        year: yearId,
        drive_link: driveLink,
        thumbnail_url: finalThumbnailUrl,
        is_deleted: false,
        is_active: true,
      };

      if (editingNote) {
        const previousThumbnailUrl = editingNote.thumbnail_url;
        const { error } = await supabase
          .from("subjects")
          .update(payload)
          .eq("id", subjectId);

        if (error) throw error;
        toast.success("Subject updated successfully.");

        if (thumbnailFile && previousThumbnailUrl && previousThumbnailUrl !== finalThumbnailUrl) {
          const previousThumbnailPath = getThumbnailStoragePath(editingNote);
          if (previousThumbnailPath) {
            await supabase.storage.from(THUMBNAIL_BUCKET).remove([previousThumbnailPath]);
          }
        }
      } else {
        payload.id = subjectId;
        const { error } = await supabase.from("subjects").insert([payload]);
        if (error) throw error;
        toast.success("Subject created successfully.");
      }

      resetForm();
      await fetchSubjects();
      notifySubjectsChanged();
      if (onRefresh) onRefresh();
    } catch (error) {
      if (uploadedThumbnailPath) {
        await supabase.storage.from(THUMBNAIL_BUCKET).remove([uploadedThumbnailPath]);
      }
      toast.error(error?.message || "Failed to save subject.");
    } finally {
      setSaving(false);
    }
  };

  // Create/Update Resource CRUD
  const handleSaveResource = async () => {
    if (saving) return;
    setSaving(true);

    const title = normalizeSubjectName(resourceFormData.title);
    const shortName = normalizeSubjectName(resourceFormData.short_name);
    const description = normalizeSubjectName(resourceFormData.description);
    const resourceType = resourceFormData.resource_type;
    const academicYear = Number(resourceFormData.academic_year);
    const driveLink = normalizeSubjectName(resourceFormData.drive_link);
    const thumbnailUrl = isValidThumbnailUrl(resourceFormData.thumbnail_url) ? resourceFormData.thumbnail_url.trim() : null;

    if (!title || !shortName || !driveLink) {
      toast.error("Please fill Title, Short Title, and Google Drive Link.");
      setSaving(false);
      return;
    }

    const resourceId = editingResource ? editingResource.id : crypto.randomUUID();
    let uploadedThumbnailPath = null;
    let finalThumbnailUrl = thumbnailUrl;

    try {
      if (thumbnailFile) {
        const thumbnailResult = await uploadThumbnail(thumbnailFile, resourceId);
        uploadedThumbnailPath = thumbnailResult.uploadedThumbnailPath;
        finalThumbnailUrl = thumbnailResult.thumbnail_url || finalThumbnailUrl;
      }

      const payload = {
        title,
        short_name: shortName,
        description,
        resource_type: resourceType,
        academic_year: academicYear,
        drive_link: driveLink,
        thumbnail_url: finalThumbnailUrl,
        is_deleted: false,
      };

      if (editingResource) {
        const previousThumbnailUrl = editingResource.thumbnail_url;
        const { error } = await supabase
          .from("resources")
          .update(payload)
          .eq("id", resourceId);

        if (error) throw error;
        toast.success("Resource updated successfully.");

        if (thumbnailFile && previousThumbnailUrl && previousThumbnailUrl !== finalThumbnailUrl) {
          const previousThumbnailPath = getThumbnailStoragePath(editingResource);
          if (previousThumbnailPath) {
            await supabase.storage.from(THUMBNAIL_BUCKET).remove([previousThumbnailPath]);
          }
        }
      } else {
        payload.id = resourceId;
        const { error } = await supabase.from("resources").insert([payload]);
        if (error) throw error;
        toast.success("Resource created successfully.");
      }

      resetResourceForm();
      await fetchResources();
    } catch (error) {
      if (uploadedThumbnailPath) {
        await supabase.storage.from(THUMBNAIL_BUCKET).remove([uploadedThumbnailPath]);
      }
      toast.error(error?.message || "Failed to save resource.");
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (id) => {
    setConfirmDeleteId(id);
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
  };

  // Delete Note
  const confirmDelete = async (id) => {
    if (deleteLoadingId) return;

    const removed = subjects.find((subject) => subject.id === id);
    if (!removed) return;

    setDeleteLoadingId(id);
    setConfirmDeleteId(null);

    const storagePath = getPdfStoragePath(removed);
    let storageError = null;
    let dbError = null;

    if (storagePath) {
      const { error } = await supabase.storage.from(PDF_BUCKET).remove([storagePath]);
      storageError = error || null;
    }

    if (!storageError) {
      const { error } = await supabase.from("subjects").update({ is_deleted: true }).eq("id", id);
      dbError = error || null;
    }

    if (!storageError && !dbError) {
      const thumbnailStoragePath = getThumbnailStoragePath(removed);
      if (thumbnailStoragePath) {
        await supabase.storage.from(THUMBNAIL_BUCKET).remove([thumbnailStoragePath]);
      }
    }

    if (storageError || dbError) {
      toast.error(getFriendlyError(storageError || dbError, "Failed to delete subject."));
      setDeleteLoadingId(null);
      return;
    }

    toast.success("Subject deleted.");
    await fetchSubjects();
    setDeleteLoadingId(null);
    notifySubjectsChanged();
    if (onRefresh) onRefresh();
  };

  // Delete Resource
  const requestDeleteResource = (id) => {
    setResourceConfirmDeleteId(id);
  };

  const cancelDeleteResource = () => {
    setResourceConfirmDeleteId(null);
  };

  const confirmDeleteResource = async (id) => {
    if (deleteLoadingId) return;

    const removed = resources.find((r) => r.id === id);
    if (!removed) return;

    setDeleteLoadingId(id);
    setResourceConfirmDeleteId(null);

    try {
      const thumbnailStoragePath = getThumbnailStoragePath(removed);
      if (thumbnailStoragePath) {
        await supabase.storage.from(THUMBNAIL_BUCKET).remove([thumbnailStoragePath]);
      }

      const { error } = await supabase.from("resources").update({ is_deleted: true }).eq("id", id);
      if (error) throw error;

      toast.success("Resource deleted successfully.");
      await fetchResources();
    } catch (error) {
      toast.error(error?.message || "Failed to delete resource.");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-2rem)] bg-[#f7f7f5] dark:bg-[#0B1120] px-4 py-4 text-gray-900 dark:text-[#F8FAFC] sm:px-6 lg:px-8 lg:py-6 transition-colors duration-300">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        
        {/* Header Block */}
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] px-5 py-5 shadow-sm sm:px-6 lg:px-8 transition-colors"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-gray-600 dark:text-gray-300">
                <span className="h-2 w-2 rounded-full bg-black dark:bg-[#6366F1]" />
                Admin dashboard
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-[#F8FAFC] sm:text-3xl">JITS Notes Manager</h1>
                <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-[#94A3B8]">
                  Manage subjects notes library and database academic resources from this control panel.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs font-semibold tracking-[0.18em] text-gray-700 dark:text-[#F8FAFC]">
                ADMIN
              </span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutLoading}
                className="inline-flex items-center justify-center rounded-xl bg-black dark:bg-[#6366F1] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-900 dark:hover:bg-[#6366F1]/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {logoutLoading ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </motion.header>

        {/* Tab Selection */}
        <div className="flex border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] rounded-3xl p-1.5 shadow-sm transition-colors duration-300">
          <button
            onClick={() => {
              setActiveTab("notes");
              resetForm();
              resetResourceForm();
            }}
            className={`flex-1 py-3.5 text-sm font-bold rounded-2xl transition-all duration-200 ${
              activeTab === "notes"
                ? "bg-black dark:bg-[#6366F1] text-white shadow-sm"
                : "text-gray-500 dark:text-[#94A3B8] hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/40"
            }`}
          >
            📚 Notes / Subjects
          </button>
          <button
            onClick={() => {
              setActiveTab("resources");
              resetForm();
              resetResourceForm();
            }}
            className={`flex-1 py-3.5 text-sm font-bold rounded-2xl transition-all duration-200 ${
              activeTab === "resources"
                ? "bg-black dark:bg-[#6366F1] text-white shadow-sm"
                : "text-gray-500 dark:text-[#94A3B8] hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/40"
            }`}
          >
            📂 Academic Resources
          </button>
        </div>

        {/* Dynamic Panels */}
        {activeTab === "notes" ? (
          <>
            {/* NOTES CRUD FORM */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] p-5 shadow-sm sm:p-6 transition-colors duration-300"
            >
              <AnimatePresence mode="wait">
                {editingNote ? (
                  <motion.div
                    key="edit-note"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="mx-auto w-full max-w-[900px] rounded-2xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-[#111827] p-5 shadow-sm sm:p-6"
                  >
                    <div className="border-b border-gray-100 dark:border-gray-800 pb-4 mb-6">
                      <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-[#F8FAFC] flex items-center gap-2">
                        <span>✏️</span> Edit Note / Subject
                      </h2>
                      <p className="mt-1 text-xs text-gray-500 dark:text-[#94A3B8]">Update detailed information for this subject</p>
                    </div>

                    <form id="note-form" className="space-y-6" onSubmit={(event) => event.preventDefault()}>
                      <div className="grid gap-6 md:grid-cols-[1fr_200px]">
                        <div className="grid gap-5 sm:grid-cols-2">
                          <label className="block col-span-2 sm:col-span-1 text-left">
                            <FieldLabel>Subject Name</FieldLabel>
                            <input
                              type="text"
                              value={formData.subject_name}
                              onChange={(e) => setFormData((prev) => ({ ...prev, subject_name: e.target.value }))}
                              placeholder="e.g. Database Management Systems"
                              required
                              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1] focus:ring-1 focus:ring-black dark:focus:ring-[#6366F1]"
                            />
                          </label>

                          <label className="block col-span-2 sm:col-span-1 text-left">
                            <FieldLabel>Short Name</FieldLabel>
                            <input
                              type="text"
                              value={formData.short_name}
                              onChange={(e) => setFormData((prev) => ({ ...prev, short_name: e.target.value }))}
                              placeholder="e.g. DBMS"
                              required
                              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1] focus:ring-1 focus:ring-black dark:focus:ring-[#6366F1]"
                            />
                          </label>

                          <label className="block col-span-2 sm:col-span-1 text-left">
                            <FieldLabel>Year</FieldLabel>
                            <select
                              value={formData.year}
                              onChange={(e) => setFormData((prev) => ({ ...prev, year: Number(e.target.value) }))}
                              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1] focus:ring-1 focus:ring-black dark:focus:ring-[#6366F1]"
                            >
                              {YEAR_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block col-span-2 sm:col-span-1 text-left">
                            <FieldLabel>Drive Link</FieldLabel>
                            <input
                              type="url"
                              value={formData.drive_link}
                              onChange={(e) => setFormData((prev) => ({ ...prev, drive_link: e.target.value }))}
                              placeholder="https://drive.google.com/..."
                              required
                              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1] focus:ring-1 focus:ring-black dark:focus:ring-[#6366F1]"
                            />
                          </label>
                        </div>

                        <div className="flex flex-col items-center justify-center border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-4 bg-gray-50/40 dark:bg-gray-850/40">
                          <span className="text-xs font-semibold text-gray-550 uppercase tracking-wider mb-3">Thumbnail</span>
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex h-[110px] w-[110px] items-center justify-center overflow-hidden rounded-2xl border border-gray-150 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow-sm">
                              {thumbnailPreviewUrl ? (
                                <img src={thumbnailPreviewUrl} alt="Preview" decoding="async" className="h-full w-full object-cover" />
                              ) : isValidThumbnailUrl(formData.thumbnail_url) ? (
                                <img src={formData.thumbnail_url} alt="Thumbnail" decoding="async" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-gray-400">
                                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <label className="relative cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                              <span>Upload</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleThumbnailChange}
                                className="sr-only"
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-gray-800 pt-5">
                        <button
                          type="button"
                          onClick={resetForm}
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 text-sm font-semibold text-gray-700 dark:text-gray-305 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNote}
                          disabled={saving}
                          className="inline-flex h-11 items-center justify-center rounded-xl bg-black dark:bg-[#6366F1] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-900 dark:hover:bg-[#6366F1]/90 disabled:opacity-70"
                        >
                          {saving ? "Saving..." : "Update Subject"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div key="add-note" className="space-y-5">
                    <div className="text-left border-b border-gray-100 dark:border-gray-800 pb-3">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-[#F8FAFC]">Add New Subject</h2>
                      <p className="text-xs text-gray-500 dark:text-[#94A3B8]">Create a subject row with ZIP materials drive folder</p>
                    </div>

                    <form id="note-form" className="space-y-5" onSubmit={(event) => event.preventDefault()}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block text-left">
                          <FieldLabel>Subject Name</FieldLabel>
                          <input
                            type="text"
                            value={formData.subject_name}
                            onChange={(e) => setFormData((prev) => ({ ...prev, subject_name: e.target.value }))}
                            placeholder="e.g. Human Computer Interaction"
                            required
                            className="h-12 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-black dark:focus:border-[#6366F1] focus:ring-2 focus:ring-black/10 dark:focus:ring-[#6366F1]/10"
                          />
                        </label>

                        <label className="block text-left">
                          <FieldLabel>Short Name</FieldLabel>
                          <input
                            type="text"
                            value={formData.short_name}
                            onChange={(e) => setFormData((prev) => ({ ...prev, short_name: e.target.value }))}
                            placeholder="e.g. HCI"
                            required
                            className="h-12 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-black dark:focus:border-[#6366F1] focus:ring-2 focus:ring-black/10 dark:focus:ring-[#6366F1]/10"
                          />
                        </label>

                        <label className="block text-left">
                          <FieldLabel>Year</FieldLabel>
                          <select
                            value={formData.year}
                            onChange={(e) => setFormData((prev) => ({ ...prev, year: Number(e.target.value) }))}
                            className="h-12 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1] focus:ring-2 focus:ring-black/10 dark:focus:ring-[#6366F1]/10"
                          >
                            {YEAR_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block text-left">
                          <FieldLabel>Drive Link</FieldLabel>
                          <input
                            type="url"
                            value={formData.drive_link}
                            onChange={(e) => setFormData((prev) => ({ ...prev, drive_link: e.target.value }))}
                            placeholder="https://drive.google.com/..."
                            required
                            className="h-12 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-black dark:focus:border-[#6366F1] focus:ring-2 focus:ring-black/10 dark:focus:ring-[#6366F1]/10"
                          />
                        </label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-[1fr_100px] md:items-start text-left">
                        <label className="block">
                          <FieldLabel>Thumbnail Upload</FieldLabel>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleThumbnailChange}
                            className="h-12 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-sm text-gray-700 dark:text-gray-300 shadow-sm outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 dark:file:bg-gray-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700 dark:file:text-gray-300 hover:file:bg-gray-200"
                          />
                          <p className="mt-2 text-xs text-gray-400">JPG, PNG, or WEBP up to 5MB.</p>
                        </label>

                        <div className="flex justify-start md:justify-end">
                          <div className="flex h-[110px] w-[90px] items-center justify-center overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow-sm">
                            {thumbnailPreviewUrl ? (
                              <img src={thumbnailPreviewUrl} alt="Preview" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-gray-400 bg-gray-100 dark:bg-gray-800">
                                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none">
                                  <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.5" />
                                  <path d="m8 14 2.5-2.5a1 1 0 0 1 1.4 0L16 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleSaveNote}
                          disabled={saving}
                          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-black dark:bg-[#6366F1] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-900 dark:hover:bg-[#6366F1]/90 disabled:opacity-75 sm:min-w-[180px]"
                        >
                          {saving ? "Saving..." : "Save Subject"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>

            {/* SUBJECTS LIST */}
            <section className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] p-5 shadow-sm sm:p-6 transition-colors duration-300">
              <div className="text-left mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-[#F8FAFC]">Subjects Library ({subjects.length})</h2>
                <p className="text-xs text-gray-500 dark:text-[#94A3B8]">List of current academic subject materials</p>
              </div>

              <div>
                {loading ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-24 animate-pulse rounded-2xl border border-gray-200 dark:border-gray-850 bg-gray-50 dark:bg-gray-800" />
                    ))}
                  </div>
                ) : subjects.length === 0 ? (
                  <p className="text-sm py-8 text-center text-gray-500">No subjects found. Create one above.</p>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 lg:block">
                      <div className="grid grid-cols-[1.6fr_0.75fr_1.15fr_0.9fr] gap-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-[#94A3B8]">
                        <span>Subject</span>
                        <span>Year</span>
                        <span>Link</span>
                        <span className="text-right">Actions</span>
                      </div>

                      <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-[#111827]">
                        {subjects.map((subject) => {
                          const year = subject.year_id ?? subject.year;
                          const isDeleting = deleteLoadingId === subject.id;
                          const thumbnailSrc = subject.thumbnail_url || "/icons.png";
                          return (
                            <motion.div
                              key={subject.id}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="grid grid-cols-[1.6fr_0.75fr_1.15fr_0.9fr] items-center gap-4 px-5 py-4 hover:bg-gray-50/40 dark:hover:bg-gray-800/30 transition-colors"
                            >
                              <div className="min-w-0 text-left">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                                    <img
                                      src={thumbnailSrc}
                                      alt={subject.name}
                                      className="h-full w-full object-cover"
                                      onError={(e) => { e.currentTarget.src = FALLBACK_THUMBNAIL; }}
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-[#F8FAFC]">{subject.name}</p>
                                    <p className="mt-0.5 text-xs text-gray-500 dark:text-[#94A3B8]">{subject.short_name}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="text-left">
                                <span className="inline-flex rounded-full border border-gray-200 dark:border-gray-750 bg-gray-50 dark:bg-[#1E293B] px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  Year {year}
                                </span>
                              </div>

                              <div className="text-left">
                                <a
                                  href={subject.drive_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center text-xs font-bold text-gray-700 dark:text-[#6366F1] hover:underline"
                                >
                                  Open Google Drive URL
                                </a>
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(subject)}
                                  className="rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestDelete(subject.id)}
                                  disabled={isDeleting}
                                  className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-100"
                                >
                                  Delete
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mobile Grid */}
                    <div className="grid gap-3 lg:hidden">
                      {subjects.map((subject) => {
                        const year = subject.year_id ?? subject.year;
                        const isDeleting = deleteLoadingId === subject.id;
                        return (
                          <div key={subject.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] p-4 text-left space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                                <img
                                  src={subject.thumbnail_url || "/icons.png"}
                                  alt={subject.name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => { e.currentTarget.src = FALLBACK_THUMBNAIL; }}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-base font-bold text-gray-900 dark:text-[#F8FAFC]">{subject.name}</p>
                                <p className="text-xs text-gray-550">{subject.short_name}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                Year {year}
                              </span>
                              <a
                                href={subject.drive_link}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 shadow-sm"
                              >
                                Link URL
                              </a>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1.5">
                              <button
                                type="button"
                                onClick={() => handleEdit(subject)}
                                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDelete(subject.id)}
                                disabled={isDeleting}
                                className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-400"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            {/* RESOURCES CRUD FORM */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] p-5 shadow-sm sm:p-6 transition-colors duration-300"
            >
              <AnimatePresence mode="wait">
                {editingResource ? (
                  <motion.div
                    key="edit-resource"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="mx-auto w-full max-w-[900px] rounded-2xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-[#111827] p-5 shadow-sm sm:p-6"
                  >
                    <div className="border-b border-gray-100 dark:border-gray-800 pb-4 mb-6">
                      <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-[#F8FAFC] flex items-center gap-2">
                        <span>✏️</span> Edit Resource
                      </h2>
                      <p className="mt-1 text-xs text-gray-500 dark:text-[#94A3B8]">Update document parameters and download url</p>
                    </div>

                    <form id="resource-form" className="space-y-6" onSubmit={(event) => event.preventDefault()}>
                      <div className="grid gap-6 md:grid-cols-[1fr_200px]">
                        <div className="grid gap-5 sm:grid-cols-2">
                          <label className="block col-span-2 sm:col-span-1 text-left">
                            <FieldLabel>Title</FieldLabel>
                            <input
                              type="text"
                              value={resourceFormData.title}
                              onChange={(e) => setResourceFormData((prev) => ({ ...prev, title: e.target.value }))}
                              placeholder="e.g. Lab Manual - Chemistry"
                              required
                              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1]"
                            />
                          </label>

                          <label className="block col-span-2 sm:col-span-1 text-left">
                            <FieldLabel>Short Title</FieldLabel>
                            <input
                              type="text"
                              value={resourceFormData.short_name}
                              onChange={(e) => setResourceFormData((prev) => ({ ...prev, short_name: e.target.value }))}
                              placeholder="e.g. Chemistry Manual"
                              required
                              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1]"
                            />
                          </label>

                          <label className="block col-span-2 sm:col-span-1 text-left">
                            <FieldLabel>Resource Type</FieldLabel>
                            <select
                              value={resourceFormData.resource_type}
                              onChange={(e) => setResourceFormData((prev) => ({ ...prev, resource_type: e.target.value }))}
                              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1]"
                            >
                              {RESOURCE_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block col-span-2 sm:col-span-1 text-left">
                            <FieldLabel>Academic Year</FieldLabel>
                            <select
                              value={resourceFormData.academic_year}
                              onChange={(e) => setResourceFormData((prev) => ({ ...prev, academic_year: Number(e.target.value) }))}
                              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1]"
                            >
                              {YEAR_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block col-span-2 text-left">
                            <FieldLabel>Description</FieldLabel>
                            <textarea
                              value={resourceFormData.description}
                              onChange={(e) => setResourceFormData((prev) => ({ ...prev, description: e.target.value }))}
                              placeholder="Describe this resource (optional)..."
                              rows={2}
                              className="mt-1.5 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1] resize-none"
                            />
                          </label>

                          <label className="block col-span-2 text-left">
                            <FieldLabel>Google Drive Link</FieldLabel>
                            <input
                              type="url"
                              value={resourceFormData.drive_link}
                              onChange={(e) => setResourceFormData((prev) => ({ ...prev, drive_link: e.target.value }))}
                              placeholder="https://drive.google.com/..."
                              required
                              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1]"
                            />
                          </label>
                        </div>

                        <div className="flex flex-col items-center justify-center border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-4 bg-gray-50/40 dark:bg-gray-850/40">
                          <span className="text-xs font-semibold text-gray-550 uppercase tracking-wider mb-3">Thumbnail</span>
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex h-[110px] w-[110px] items-center justify-center overflow-hidden rounded-2xl border border-gray-150 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow-sm">
                              {thumbnailPreviewUrl ? (
                                <img src={thumbnailPreviewUrl} alt="Preview" className="h-full w-full object-cover" />
                              ) : isValidThumbnailUrl(resourceFormData.thumbnail_url) ? (
                                <img src={resourceFormData.thumbnail_url} alt="Thumbnail" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-gray-400 bg-gray-100 dark:bg-gray-800">
                                  {getTypeIcon?.(resourceFormData.resource_type) || "📁"}
                                </div>
                              )}
                            </div>
                            <label className="relative cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                              <span>Upload</span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleThumbnailChange}
                                className="sr-only"
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-gray-800 pt-5">
                        <button
                          type="button"
                          onClick={resetResourceForm}
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 text-sm font-semibold text-gray-700 dark:text-gray-305 hover:bg-gray-55"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveResource}
                          disabled={saving}
                          className="inline-flex h-11 items-center justify-center rounded-xl bg-black dark:bg-[#6366F1] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-900 dark:hover:bg-[#6366F1]/90 disabled:opacity-75"
                        >
                          {saving ? "Saving..." : "Update Resource"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div key="add-resource" className="space-y-5">
                    <div className="text-left border-b border-gray-100 dark:border-gray-800 pb-3">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-[#F8FAFC]">Add New Resource</h2>
                      <p className="text-xs text-gray-500 dark:text-[#94A3B8]">Upload and link lab manuals, exam papers, syllabus, or placement guides</p>
                    </div>

                    <form id="resource-form" className="space-y-5" onSubmit={(event) => event.preventDefault()}>
                      <div className="grid gap-4 md:grid-cols-2 text-left">
                        <label className="block">
                          <FieldLabel>Title</FieldLabel>
                          <input
                            type="text"
                            value={resourceFormData.title}
                            onChange={(e) => setResourceFormData((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g. Lab Manual - Applied Physics"
                            required
                            className="h-12 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition placeholder:text-gray-400 focus:border-black dark:focus:border-[#6366F1]"
                          />
                        </label>

                        <label className="block">
                          <FieldLabel>Short Title</FieldLabel>
                          <input
                            type="text"
                            value={resourceFormData.short_name}
                            onChange={(e) => setResourceFormData((prev) => ({ ...prev, short_name: e.target.value }))}
                            placeholder="e.g. Physics Manual"
                            required
                            className="h-12 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition placeholder:text-gray-400 focus:border-black dark:focus:border-[#6366F1]"
                          />
                        </label>

                        <label className="block">
                          <FieldLabel>Resource Type</FieldLabel>
                          <select
                            value={resourceFormData.resource_type}
                            onChange={(e) => setResourceFormData((prev) => ({ ...prev, resource_type: e.target.value }))}
                            className="h-12 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1]"
                          >
                            {RESOURCE_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <FieldLabel>Academic Year</FieldLabel>
                          <select
                            value={resourceFormData.academic_year}
                            onChange={(e) => setResourceFormData((prev) => ({ ...prev, academic_year: Number(e.target.value) }))}
                            className="h-12 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1]"
                          >
                            {YEAR_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block col-span-2">
                          <FieldLabel>Description</FieldLabel>
                          <textarea
                            value={resourceFormData.description}
                            onChange={(e) => setResourceFormData((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Resource description (semesters, topics, branch)..."
                            rows={2}
                            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1] resize-none"
                          />
                        </label>

                        <label className="block col-span-2">
                          <FieldLabel>Google Drive Link</FieldLabel>
                          <input
                            type="url"
                            value={resourceFormData.drive_link}
                            onChange={(e) => setResourceFormData((prev) => ({ ...prev, drive_link: e.target.value }))}
                            placeholder="https://drive.google.com/..."
                            required
                            className="h-12 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition focus:border-black dark:focus:border-[#6366F1]"
                          />
                        </label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-[1fr_100px] md:items-start text-left">
                        <label className="block">
                          <FieldLabel>Thumbnail Upload</FieldLabel>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleThumbnailChange}
                            className="h-12 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-sm text-gray-700 dark:text-gray-300 shadow-sm outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 dark:file:bg-gray-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-700 dark:file:text-gray-300 hover:file:bg-gray-200"
                          />
                          <p className="mt-2 text-xs text-gray-400">JPG, PNG, or WEBP up to 5MB.</p>
                        </label>

                        <div className="flex justify-start md:justify-end">
                          <div className="flex h-[110px] w-[90px] items-center justify-center overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow-sm">
                            {thumbnailPreviewUrl ? (
                              <img src={thumbnailPreviewUrl} alt="Preview" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-gray-400 bg-gray-100 dark:bg-gray-800">
                                {getTypeIcon?.(resourceFormData.resource_type) || "📁"}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleSaveResource}
                          disabled={saving}
                          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-black dark:bg-[#6366F1] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-900 dark:hover:bg-[#6366F1]/90 disabled:opacity-75 sm:min-w-[180px]"
                        >
                          {saving ? "Saving..." : "Save Resource"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>

            {/* RESOURCES LIST */}
            <section className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] p-5 shadow-sm sm:p-6 transition-colors duration-300">
              <div className="text-left mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-[#F8FAFC]">Academic Resources ({resources.length})</h2>
                <p className="text-xs text-gray-500 dark:text-[#94A3B8]">List of current syllabus, questions, manuals and files</p>
              </div>

              <div>
                {resourcesLoading ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-24 animate-pulse rounded-2xl border border-gray-200 bg-gray-50" />
                    ))}
                  </div>
                ) : resources.length === 0 ? (
                  <p className="text-sm py-8 text-center text-gray-500">No resources found. Create one above.</p>
                ) : (
                  <>
                    {/* Desktop View */}
                    <div className="hidden overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 lg:block">
                      <div className="grid grid-cols-[1.5fr_1.1fr_0.6fr_0.9fr_0.9fr] gap-4 border-b border-gray-200 dark:border-gray-800 bg-gray-55/60 dark:bg-gray-800/40 px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-[#94A3B8]">
                        <span>Resource Title</span>
                        <span>Type / Category</span>
                        <span>Year</span>
                        <span>Link</span>
                        <span className="text-right">Actions</span>
                      </div>

                      <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-[#111827]">
                        {resources.map((resource) => {
                          const isDeleting = deleteLoadingId === resource.id;
                          return (
                            <motion.div
                              key={resource.id}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="grid grid-cols-[1.5fr_1.1fr_0.6fr_0.9fr_0.9fr] items-center gap-4 px-5 py-4 hover:bg-gray-50/40 dark:hover:bg-gray-850/30 transition-colors"
                            >
                              <div className="min-w-0 text-left">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 flex items-center justify-center">
                                    {isValidThumbnailUrl(resource.thumbnail_url) ? (
                                      <img src={resource.thumbnail_url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      getTypeIcon?.(resource.resource_type) || "📁"
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-[#F8FAFC]">{resource.title}</p>
                                    <p className="truncate mt-0.5 text-xs text-gray-500 dark:text-[#94A3B8]">{resource.short_name}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                                {resource.resource_type}
                              </div>

                              <div className="text-left">
                                <span className="inline-flex rounded-full border border-gray-200 dark:border-gray-750 bg-gray-50 dark:bg-[#1E293B] px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  Year {resource.academic_year}
                                </span>
                              </div>

                              <div className="text-left">
                                <a
                                  href={resource.drive_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center text-xs font-bold text-gray-700 dark:text-[#6366F1] hover:underline"
                                >
                                  Open Drive Link
                                </a>
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditResource(resource)}
                                  className="rounded-xl border border-gray-250 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestDeleteResource(resource.id)}
                                  disabled={isDeleting}
                                  className="rounded-xl border border-red-250 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-100"
                                >
                                  Delete
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mobile View */}
                    <div className="grid gap-3 lg:hidden">
                      {resources.map((resource) => {
                        const isDeleting = deleteLoadingId === resource.id;
                        return (
                          <div key={resource.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] p-4 text-left space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                                {isValidThumbnailUrl(resource.thumbnail_url) ? (
                                  <img src={resource.thumbnail_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  getTypeIcon?.(resource.resource_type) || "📁"
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-base font-bold text-gray-900 dark:text-[#F8FAFC]">{resource.title}</p>
                                <p className="text-xs text-gray-550">{resource.resource_type}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-gray-200 dark:border-gray-750 bg-gray-50 dark:bg-[#1E293B] px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                Year {resource.academic_year}
                              </span>
                              <a
                                href={resource.drive_link}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold"
                              >
                                drive Link
                              </a>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleEditResource(resource)}
                                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDeleteResource(resource.id)}
                                disabled={isDeleting}
                                className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-400"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </section>
          </>
        )}

      </div>

      {/* NOTES DELETE CONFIRM MODAL */}
      <Modal
        isOpen={Boolean(confirmDeleteId)}
        onClose={deleteLoadingId ? () => { } : cancelDelete}
        title="Delete Subject Note"
        sizeClassName="max-w-lg"
      >
        <div className="space-y-4 text-left">
          <p className="text-sm leading-relaxed text-gray-500 dark:text-[#94A3B8]">
            This will permanently remove the subject note from Supabase. Any uploaded thumbnails or PDFs will also be deleted from storage.
          </p>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 p-4">
            <p className="text-sm font-bold text-gray-900 dark:text-[#F8FAFC]">
              {confirmDeleteId ? subjects.find((s) => s.id === confirmDeleteId)?.name || "Selected Subject" : "Selected Subject"}
            </p>
            <p className="mt-1 text-xs text-red-650 font-semibold">This action cannot be undone.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cancelDelete}
              disabled={deleteLoadingId === confirmDeleteId}
              className="rounded-xl border border-gray-200 bg-white dark:bg-gray-800 px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => confirmDelete(confirmDeleteId)}
              disabled={deleteLoadingId === confirmDeleteId}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-red-700"
            >
              {deleteLoadingId === confirmDeleteId ? "Deleting..." : "Delete Permanently"}
            </button>
          </div>
        </div>
      </Modal>

      {/* RESOURCES DELETE CONFIRM MODAL */}
      <Modal
        isOpen={Boolean(resourceConfirmDeleteId)}
        onClose={deleteLoadingId ? () => { } : cancelDeleteResource}
        title="Delete Resource"
        sizeClassName="max-w-lg"
      >
        <div className="space-y-4 text-left">
          <p className="text-sm leading-relaxed text-gray-500 dark:text-[#94A3B8]">
            This will permanently remove the academic resource link from the database. This action is irreversible.
          </p>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-855 p-4">
            <p className="text-sm font-bold text-gray-900 dark:text-[#F8FAFC]">
              {resourceConfirmDeleteId ? resources.find((r) => r.id === resourceConfirmDeleteId)?.title || "Selected Resource" : "Selected Resource"}
            </p>
            <p className="mt-1 text-xs text-red-650 font-semibold">This action cannot be undone.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cancelDeleteResource}
              disabled={deleteLoadingId === resourceConfirmDeleteId}
              className="rounded-xl border border-gray-200 bg-white dark:bg-gray-800 px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => confirmDeleteResource(resourceConfirmDeleteId)}
              disabled={deleteLoadingId === resourceConfirmDeleteId}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-red-700"
            >
              {deleteLoadingId === resourceConfirmDeleteId ? "Deleting..." : "Delete Permanently"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Alert list */}
      <div className="pointer-events-none fixed right-4 top-4 z-[70] space-y-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -8, x: 8 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`pointer-events-auto rounded-xl border px-3 py-2 text-xs shadow-sm ${
                t.type === "success"
                  ? "border-emerald-200 bg-white text-emerald-700"
                  : "border-red-200 bg-white text-red-700"
              }`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
