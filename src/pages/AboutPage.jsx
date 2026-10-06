import { memo } from "react";
import LegalLayout from "../components/LegalLayout";
import { BookOpen, GraduationCap, Target, ShieldAlert, Mail } from "lucide-react";

export const AboutPage = memo(function AboutPage({ onOpenFeedback }) {
  return (
    <LegalLayout
      title="About JITS Notes"
      subtitle="Educational study material platform designed for B.Tech CSE & AIML students following the JNTUH R22 curriculum."
      badge="About Platform"
      lastUpdated="October 2026"
    >
      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold text-[#151515] dark:text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#8F1D32] dark:text-[#A21F3D]" />
          <span>1. Overview & Purpose</span>
        </h2>
        <p>
          <strong>JITS Notes</strong> is an educational resource platform developed to streamline academic learning for engineering students.
          It provides a clean, clutter-free repository of lecture notes, unit-wise reference guides, previous question papers, and high-yield question banks.
        </p>
        <p>
          The platform was created to eliminate fragmented PDF sharing across messaging apps and give students reliable, fast, and structured access to study materials.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold text-[#151515] dark:text-white flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[#8F1D32] dark:text-[#A21F3D]" />
          <span>2. Academic Scope & Coverage</span>
        </h2>
        <p>
          JITS Notes specifically covers courses and regulations for:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-[#666666] dark:text-[#B5B5B5]">
          <li><strong>B.Tech Computer Science & Engineering (CSE)</strong> — All semesters (1st Year to 4th Year)</li>
          <li><strong>B.Tech Artificial Intelligence & Machine Learning (AIML)</strong> — All semesters (1st Year to 4th Year)</li>
          <li><strong>Academic Regulation:</strong> JNTUH R22 (2022–2026 scheme)</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold text-[#151515] dark:text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-[#8F1D32] dark:text-[#A21F3D]" />
          <span>3. Key Features</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="p-4 rounded-xl border border-[#EDEDED] dark:border-[#292929] bg-[#FAFAFA] dark:bg-[#151515]">
            <h3 className="text-sm font-bold text-[#151515] dark:text-white mb-1">Unit-Wise Grouping</h3>
            <p className="text-xs text-[#666666] dark:text-[#999999]">
              Documents are structured directly by syllabus units (Unit 1 to Unit 5), making targeted exam preparation effortless.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-[#EDEDED] dark:border-[#292929] bg-[#FAFAFA] dark:bg-[#151515]">
            <h3 className="text-sm font-bold text-[#151515] dark:text-white mb-1">Instant In-Browser Viewer</h3>
            <p className="text-xs text-[#666666] dark:text-[#999999]">
              High-performance canvas PDF viewer with in-document search, page controls, auto-fit zoom, and reading position memory.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-[#EDEDED] dark:border-[#292929] bg-[#FAFAFA] dark:bg-[#151515]">
            <h3 className="text-sm font-bold text-[#151515] dark:text-white mb-1">Zero Friction for Students</h3>
            <p className="text-xs text-[#666666] dark:text-[#999999]">
              No registration, login, or personal profile required for students to read notes and download study guides.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-[#EDEDED] dark:border-[#292929] bg-[#FAFAFA] dark:bg-[#151515]">
            <h3 className="text-sm font-bold text-[#151515] dark:text-white mb-1">App & Web Parity</h3>
            <p className="text-xs text-[#666666] dark:text-[#999999]">
              Unified student navigation flow across both the official Android application and this web companion.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold text-[#151515] dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[#8F1D32] dark:text-[#A21F3D]" />
          <span>4. University & Institutional Disclaimer</span>
        </h2>
        <div className="p-4 rounded-xl border border-[#EDEDED] dark:border-[#292929] bg-[#FAFAFA] dark:bg-[#151515] text-xs text-[#666666] dark:text-[#B5B5B5] leading-relaxed">
          <p>
            <strong>Important Notice:</strong> JITS Notes is an independent educational platform curated for students studying under the JNTUH R22 curriculum.
            JITS Notes is <strong>not officially affiliated with, endorsed by, or sponsored by Jawaharlal Nehru Technological University Hyderabad (JNTUH)</strong> or any single official administrative body.
            Official syllabus notifications, circulars, exam timetables, and academic regulations must always be verified via the official JNTUH university portal.
          </p>
        </div>
      </section>

      <section className="space-y-3 pt-4 border-t border-[#EDEDED] dark:border-[#292929]">
        <h2 className="text-lg sm:text-xl font-bold text-[#151515] dark:text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-[#8F1D32] dark:text-[#A21F3D]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>5. About the Creator</span>
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 rounded-xl border border-[#EDEDED] dark:border-[#292929] bg-white dark:bg-[#0B0B0B]">
          <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 bg-[#F7F7F7] dark:bg-[#151515] border border-[#EDEDED] dark:border-[#292929] flex items-center justify-center">
            <span className="text-[#8F1D32] dark:text-[#A21F3D] font-bold text-xl">MD</span>
          </div>
          <div>
            <h3 className="font-bold text-[#151515] dark:text-white text-base">Mohd Danish</h3>
            <p className="text-xs text-[#8F1D32] dark:text-[#A21F3D] font-medium mb-2">B.Tech Student & Lead Developer</p>
            <p className="text-xs text-[#666666] dark:text-[#B5B5B5] leading-relaxed">
              Mohd Danish is an engineering student passionate about cloud architecture and frontend development. He created JITS Notes to solve the fragmented study material problem for his peers in the JNTUH R22 curriculum, leveraging modern web technologies like React, Supabase, and Backblaze B2.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3 pt-4 border-t border-[#EDEDED] dark:border-[#292929]">
        <h2 className="text-lg sm:text-xl font-bold text-[#151515] dark:text-white flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#8F1D32] dark:text-[#A21F3D]" />
          <span>6. Feedback & Contributions</span>
        </h2>
        <p>
          We continually update the repository based on student and faculty feedback. If you notice any missing unit notes, formatting issues, or would like to contribute study guides:
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenFeedback}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8F1D32] hover:bg-[#74152A] text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <span>Send Academic Feedback</span>
          </button>
        </div>
      </section>
    </LegalLayout>
  );
});

export default AboutPage;
