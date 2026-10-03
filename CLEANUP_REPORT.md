# JITS Notes — Final Legacy Resources Removal & Cleanup Report

**Project:** JITS Notes  
**Date:** October 4, 2026  
**Status:** Completed & Verified  

---

## 1. Removed Frontend Files

The following obsolete, redundant, or deprecated frontend files were permanently removed from the codebase:

| File Path | Description | Reason for Removal |
|---|---|---|
| `src/components/ResourcesPage.jsx` | Old standalone Resources Repository page | Legacy resources system deprecation |
| `src/components/ResourcesSection.jsx` | Old Academic Resources preview component on homepage | Legacy resources preview deprecation |
| `src/components/HeroSection.jsx` | Old unused duplicate hero component | Redundant, unreferenced legacy component |
| `src/assets/BLUE_illustration.png` | Duplicate illustration file at root of assets | Identical copy of `src/assets/academic-years/year-1-blue.png` |
| `src/assets/ORANGE_illustration.png` | Duplicate illustration file at root of assets | Identical copy of `src/assets/academic-years/year-3-orange.png` |
| `src/assets/PURPLE_illustration.png` | Duplicate illustration file at root of assets | Identical copy of `src/assets/academic-years/year-4-purple.png` |
| `src/assets/TEAL_illustration.png` | Duplicate illustration file at root of assets | Identical copy of `src/assets/academic-years/year-2-teal.png` |

---

## 2. Removed Backend Files

No functional backend services were arbitrarily removed. Obsolete Google Drive code paths were cleaned from:
- `backend/utils/validators.js`: Removed `validateDriveLink` and mandatory `drive_link` validation.
- `backend/controllers/public.controller.js`: Removed `drive_link` from `SELECT` queries.
- `backend/controllers/admin.controller.js`: Removed `drive_link` from `SELECT` queries.

---

## 3. Removed Routes

| Deprecated Route | New Behavior |
|---|---|
| `/resources` | Redirects to `/` with `<Navigate to="/" replace />` |
| `/resources/*` | Redirects to `/` |
| `/notes` | Redirects to `/` with smooth scroll state targeting `#notes-section` |

---

## 4. Removed Google Drive References

1. **Edge Function (`delete-document`)**:
   - Replaced legacy Google Drive rejection note with strict Backblaze B2 verification (`doc.storage_provider === 'b2'`).
2. **Backend Controllers & Validators**:
   - Removed `validateDriveLink` from `backend/utils/validators.js`.
   - Removed `drive_link` fields from public and admin subject queries.
3. **Frontend API & Components**:
   - Removed `drive_link` handling from `ResourcesPage.jsx` (file deleted).
   - Removed Google Drive mentions in `README.md` and `SETUP.md`.
4. **Subject Creation**:
   - Confirmed `subjects.drive_link` remains nullable in database so new subjects are created without requiring Drive links.

---

## 5. Removed Legacy Resources Repository References

1. **Desktop Navbar**: Removed "Resources" navigation button.
2. **Mobile Menu**: Removed "Resources" navigation item.
3. **Hero Section**: Removed "View Resources" button; retained "Browse Notes" as the primary action.
4. **Breadcrumbs (`src/components/Breadcrumbs.jsx`)**: Removed `isResources` and "Resources Repository" breadcrumb trail.
5. **SEO (`src/components/SEO.jsx`)**: Removed SearchAction query template pointing to `/resources?search={...}` and breadcrumb item for `/resources`.
6. **Sitemap (`public/sitemap.xml`)**: Removed `<loc>https://jitsnotes.web.app/resources</loc>`.
7. **Frontend API (`src/lib/api.js`)**: Removed `resourcesApi` (`getAll`, `create`, `update`, `delete`).
8. **Analytics (`src/utils/analytics.js`)**: Removed `trackResourceClick`.
9. **SEO Hub (`src/components/SeoLandingPage.jsx`)**: Replaced "Resources Repository" card with "Academic Notes Catalog" linking to academic years.

---

## 6. Removed Database Objects

In strict accordance with Section 6 of the project specifications (**"DO NOT DELETE CURRENT PRODUCTION DATA BLINDLY"**), **no production tables or rows were dropped or truncated** via unverified destructive commands.

All references in application code, client queries, and Edge Functions to the `resources` table have been decoupled and removed.

---

## 7. Retained Database Objects

The following tables, relationships, and security policies are active and verified:

| Table Name | Purpose | Current Production Status |
|---|---|---|
| `public.years` | Academic Levels (Years 1 to 4) | Active (4 levels) |
| `public.subjects` | Academic course catalog | Active (supports B2 docs) |
| `public.folders` | Optional sub-subject organizational units | Active |
| `public.units` | Syllabus unit mappings (backward compatible with folders) | Active |
| `public.document_categories` | Categorization (Lecture Notes, Question Papers, etc.) | Active (4 categories) |
| `public.documents` | PDF metadata and Backblaze B2 object keys | Active |
| `public.admin_profiles` | Admin authorization and super admin status | Active |
| `public.admin_invitations` | Secure teacher / admin onboarding tokens | Active |
| `public.admin_activity` | Minimal audit logging for document & subject actions | Active |
| `public.feedback` | Student suggestions and feedback reports | Active |

---

## 8. Retained Edge Functions

The following server-side Edge Functions are fully verified and operational:

1. **`upload-document`**:
   - Enforces admin authorization via bearer token.
   - Validates PDF MIME type, size limit, and `%PDF-` signature.
   - Uploads to Backblaze B2 via secure B2 API authorization.
   - Saves document metadata in Supabase `documents` table.
   - Records audit entry in `admin_activity`.
2. **`delete-document`**:
   - Enforces admin authorization.
   - Validates B2 storage provider.
   - Deletes object versions from Backblaze B2.
   - Deletes database metadata record and records audit log.
3. **`get-document-url`**:
   - Serves documents to students and public users for active notes.
   - Enforces B2 storage provider verification.
   - Issues short-lived (15-minute) signed Backblaze B2 download URLs (`b2_get_download_authorization`).
   - Never exposes private B2 keys or storage master credentials to the browser.
4. **`delete-subject`**:
   - Enforces admin authorization.
   - Performs cascading deletion of associated B2 documents and folders with full safety confirmation.
5. **`admin-teachers`** & **`accept-teacher-invitation`**:
   - Super Admin management of teacher administrative accounts.

---

## 9. Admin & Super Admin Authorization Status

- **Student / Public Access**:
  - Read-only access to published, active academic subjects, folders, and notes.
  - Document viewing secured via short-lived signed URLs.
  - Zero ability to create, update, or delete academic content.
- **Admin Access**:
  - Full CRUD on Subjects, Folders, and Documents.
  - Can upload PDFs to Backblaze B2, edit metadata, and toggle active status.
- **Super Admin Access**:
  - Includes all Admin capabilities plus Admin / Teacher invitation management (`/admin/admins`).
  - Access to audit activity logs.
- **Server-Side Enforcement**:
  - Row Level Security (RLS) on Supabase tables.
  - Token and role verification within Edge Functions (`getAdminUser`).

---

## 10. Backblaze B2 Verification

- **Storage Provider**: Exclusively Backblaze B2 (`storage_provider = 'b2'`).
- **Object Key Structure**:
  - Direct note: `subjects/{subjectId}/direct/{uuid}-{safeFileName}`
  - Folder note: `subjects/{subjectId}/folders/{folderId}/{uuid}-{safeFileName}`
- **Security**: No B2 master keys, application keys, or bucket IDs are bundled into client code. Client exclusively requests signed URLs via `get-document-url`.

---

## 11. Remaining REVIEW_REQUIRED Items

| Item | Location | Recommendation |
|---|---|---|
| `public.resources` table | Supabase Database | The table contains 4 legacy records with old Google Drive links from June/August 2026. Since the frontend, backend, and edge functions no longer query this table, the database administrator can safely archive or drop `public.resources` at convenience. |
| `subjects.drive_link` column | Supabase Database | The column is nullable. Kept as null for backwards schema compatibility. It can be dropped in a future schema migration once verified across all legacy clients. |

---

## 12. npm run lint Result

```
> jits-notes@0.0.0 lint
> eslint .

Exit Code: 0 (Zero errors, zero warnings)
```

---

## 13. npm run build Result

```
> jits-notes@0.0.0 build
> vite build

vite v8.0.10 building client environment for production...
✓ 513 modules transformed.
dist/index.html                                          7.12 kB │ gzip:  2.09 kB
dist/assets/hero-academic-illustration-DVciSVXX.png    321.00 kB
dist/assets/year-1-blue-Do8TV3jJ.png                 1,138.60 kB
dist/assets/year-2-teal-YqnjFhjP.png                 1,168.66 kB
dist/assets/year-3-orange-BEc9Kul4.png               1,206.34 kB
dist/assets/year-4-purple-DMkScNLt.png               1,223.73 kB
dist/assets/pdf.worker-BgryrOlp.mjs                  2,209.73 kB
dist/assets/index-DtD0o_1f.css                          41.66 kB │ gzip:  8.06 kB
dist/assets/AdminCMS-BMLDpiXX.js                       128.75 kB │ gzip: 22.16 kB
dist/assets/index-Cd5WD5Kw.js                          130.58 kB │ gzip: 35.56 kB
✓ built in 3.91s
Exit Code: 0
```

---

## 14. Final Route List

| Route | Access | Component / Target | Description |
|---|---|---|---|
| `/` | Public | `App.jsx` (Hero + Academic Years + NotesSection) | Homepage with Academic Years & Notes |
| `/year/:yearId` | Public | `App.jsx` + `NotesSection` | Year-specific subjects view (1 to 4) |
| `/year/:yearId/:subjectSlug` | Public | `App.jsx` + `NotesSection` | Subject-filtered view |
| `/resources` | Redirect | `<Navigate to="/" replace />` | Clean redirect from old resources URL |
| `/notes` | Redirect | `<Navigate to="/" replace />` | Redirect to homepage notes section |
| `/jits-notes` | Public | `SeoLandingPage.jsx` | JITS Academic Hub |
| `/jits-r22-notes` | Public | `SeoLandingPage.jsx` | JNTUH R22 Curriculum Overview |
| `/jits-previous-papers` | Public | `SeoLandingPage.jsx` | Previous Examination Papers Hub |
| `/jits-important-questions` | Public | `SeoLandingPage.jsx` | Important Exam Questions Hub |
| `/jits-placement-materials` | Public | `SeoLandingPage.jsx` | Placement & Interview Preparation Hub |
| `/admin-login` | Public | `Modal` (Admin Login Form) | Admin & Teacher authentication |
| `/admin` | Admin / Super Admin | `AdminCMS.jsx` (Overview) | Operational dashboard & statistics |
| `/admin/academic` | Admin / Super Admin | `AcademicContentCMS.jsx` | Subjects, Folders, Years, Categories |
| `/admin/documents` | Admin / Super Admin | `DocumentsCMS.jsx` | PDF Upload, Edit, Delete, Toggle Active |
| `/admin/admins` | Super Admin | `AdminTeachers.jsx` | Teacher invitation & role management |
| `/admin/accept-invitation` | Public | `AcceptTeacherInvitation.jsx` | Teacher invitation activation |

---

## 15. Final Architecture Diagram

```
                              STUDENT WORKFLOW
                              ================

                                 Academic Year
                                       ↓
                                    Subject
                                       ↓
                               Folder (optional)
                                       ↓
                               Notes / Documents
                                       ↓
                         PDF Viewer (PdfViewerModal)
                                       ↓
                   Edge Function (get-document-url)
                                       ↓
                    Backblaze B2 Signed URL (15 min)


                              ADMIN CMS WORKFLOW
                              ==================

                         Admin / Super Admin Auth
                                       ↓
                                   Admin CMS
                    ┌──────────────────┴──────────────────┐
                    ↓                                     ↓
          Academic Content CMS                      Documents CMS
        (Subjects, Folders, Years)            (Upload, Edit, Toggle, Delete)
                    │                                     │
                    │                                     ↓
                    │                        Edge Function (upload-document)
                    │                                     ↓
                    │                        Backblaze B2 Storage (PDF bytes)
                    │                                     ↓
                    └──────────────────┬──────────────────┘
                                       ↓
                          Supabase Database (PostgreSQL)
                        (Metadata, RLS, Audit Logging)
```
