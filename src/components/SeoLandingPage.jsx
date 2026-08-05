import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaChevronDown, FaChevronUp, FaBookOpen, FaGraduationCap, FaFolderOpen, FaArrowLeft, FaFileAlt, FaLock } from "./icons";
import { useNavigate, useLocation } from "react-router-dom";
import SEO from "./SEO";
import Breadcrumbs from "./Breadcrumbs";
// Pageview events are handled globally on route transition inside App.jsx

const PAGE_DATA = {
  "/jits-notes": {
    title: "JITS Notes - JNTUH R22 Notes & Materials",
    h1: "JITS Notes Hub",
    description: "Free JNTUH R22 study material, previous papers, and important questions for JITS CSE & AIML students at Jayamukhi Institute of Technological Sciences.",
    keywords: "JITS Notes, Jayamukhi Institute Notes, JITS R22 Notes",
    aboutTitle: "About Jayamukhi Institute Notes Platform",
    aboutText: "Welcome to the ultimate learning repository for students of Jayamukhi Institute of Technological Sciences (JITS), Warangal. JITS Notes is a peer-supported education platform designed to make academic preparation smooth and stress-free. We host comprehensive study materials, JNTUH syllabus details, and lab programs mapped to the latest curriculum.",
    faqs: [
      { question: "What is JITS Notes and who is it for?", answer: "JITS Notes is a free, dedicated academic resource platform built specifically for students of Jayamukhi Institute of Technological Sciences (JITS), Narsampet, Warangal, Telangana. It provides direct access to organized lecture notes, placement preparation materials, and question papers." },
      { question: "Which courses and regulations are supported?", answer: "Currently, the platform hosts complete study resources for B.Tech Computer Science & Engineering (CSE) and Artificial Intelligence & Machine Learning (AIML) branches under the JNTUH R22 regulation." },
      { question: "Is JITS Notes completely free to use?", answer: "Yes. JITS Notes is a fully free public learning resource. Our goal is to support JITS engineering students with seamless access to high-quality academic notes without any charge." }
    ]
  },
  "/jits-r22-notes": {
    title: "JITS R22 Notes - JNTUH Regulation Study Materials",
    h1: "JNTUH R22 Regulation Notes",
    description: "Download regulation-compliant JNTUH R22 Notes for Jayamukhi Institute engineering subjects (CSE & AIML branches).",
    keywords: "JITS R22 Notes, JNTUH R22 Notes, JITS study materials",
    aboutTitle: "JNTUH R22 Curriculum Mapped Notes",
    aboutText: "The JNTUH R22 Regulation introduced modern course structures including advanced computing, engineering graphics, and specialized AI/ML libraries. This section hosts structured lecture notes matching R22 credits and syllabus requirements. Get ready-to-study PDF books compiled from university professors and top-scoring students.",
    faqs: [
      { question: "What is the JNTUH R22 regulation?", answer: "JNTUH R22 is the academic regulation introduced by Jawaharlal Nehru Technological University Hyderabad for B.Tech courses starting from the 2022-2023 academic year, featuring updated syllabus modules and credit distribution." },
      { question: "Are these notes valid for all JNTUH colleges?", answer: "Yes, since Jayamukhi Institute is affiliated with JNTUH, these R22 syllabus notes are fully compatible with any other college following the official JNTUH R22 regulation." }
    ]
  },
  "/jits-previous-papers": {
    title: "JITS Previous Question Papers - JNTUH University Exams",
    h1: "JITS Previous Exam Papers",
    description: "Get JITS Previous Papers and semester-end university question banks for Jayamukhi Institute CSE & AIML students.",
    keywords: "JITS Previous Papers, JITS Question Papers, Jayamukhi college papers",
    aboutTitle: "Download JITS Previous Question Papers",
    aboutText: "Preparing for semester exams is significantly easier when you practice with past years' question papers. This section hosts previous years' JNTUH end-semester exam question papers for computer science subjects. Learn about mark distributions, recurring core questions, and exam patterns.",
    faqs: [
      { question: "How far back do these question papers go?", answer: "We collect previous question papers ranging from the recent semester exams back to the introduction of the R22 regulation modules." },
      { question: "Why should I practice previous question papers?", answer: "Practicing past JNTUH papers helps you understand the repeating question patterns, standard mark distribution, and time management strategies for final exams." }
    ]
  },
  "/jits-important-questions": {
    title: "JITS Important Questions - Semester Mid & End Exams",
    h1: "Important Questions & Question Banks",
    description: "Access curated list of expected JITS Important Questions and midterm/end-semester question banks.",
    keywords: "JITS Important Questions, JNTUH Important Questions, JITS question bank",
    aboutTitle: "Midterm & Semester Expected Questions",
    aboutText: "We analyze previous academic results and syllabus weightage to compile a list of expected JITS Important Questions. These unit-wise question lists cover high-priority topics like algorithms, coding problems, mathematics derivations, and computer systems concepts to help you target critical sections.",
    faqs: [
      { question: "How are the important questions selected?", answer: "Our team filters questions based on previous JNTUH recurring patterns, syllabus weightage, and standard university test blue-prints." },
      { question: "Will these questions appear in midterms?", answer: "While we cannot guarantee exact matches, these important questions cover the core concepts that university professors highly prioritize during testing." }
    ]
  },
  "/jits-placement-materials": {
    title: "JITS Placement Materials - Career & Coding Preparation",
    h1: "Career Hub & Placement Materials",
    description: "Free JITS Placement Materials, aptitude preparation guides, coding manuals, and interview resources for JITS Warangal.",
    keywords: "JITS Placement Materials, JITS Study Material, coding prep",
    aboutTitle: "JITS Placement & Career Preparation Materials",
    aboutText: "Get job-ready with our curated JITS Placement Materials. Access placement preparation kits containing quantitative aptitude worksheets, verbal reasoning sheets, resume templates, and programming guides (Python, Java, C++, SQL). Prepare successfully for top companies like TCS, Wipro, Infosys, and Cognizant.",
    faqs: [
      { question: "What is included in the placement preparation materials?", answer: "The repository includes quantitative aptitude sheets, logical reasoning guides, technical coding interview questions, and sample HR templates." },
      { question: "Can I use these resources for off-campus preparation?", answer: "Absolutely. These coding and aptitude sheets are designed to help JITS students excel in both on-campus placement drives and off-campus recruitment tests." }
    ]
  }
};

const LANDING_PAGES_LIST = [
  { path: "/jits-notes", label: "JITS Notes Hub" },
  { path: "/jits-r22-notes", label: "JNTUH R22 Notes" },
  { path: "/jits-previous-papers", label: "Previous Question Papers" },
  { path: "/jits-important-questions", label: "Important Questions List" },
  { path: "/jits-placement-materials", label: "Placement Materials Prep" }
];

export default function SeoLandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const activePath = location.pathname;
  const page = PAGE_DATA[activePath] || PAGE_DATA["/jits-notes"];

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  useEffect(() => {
    // Inject dynamic schemas for the landing pages
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": page.faqs.map((faq) => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };

    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://jitsnotes.web.app/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": page.h1,
          "item": `https://jitsnotes.web.app${activePath}`
        }
      ]
    };

    const scriptFaq = document.createElement("script");
    scriptFaq.type = "application/ld+json";
    scriptFaq.text = JSON.stringify(faqSchema);
    document.head.appendChild(scriptFaq);

    const scriptBread = document.createElement("script");
    scriptBread.type = "application/ld+json";
    scriptBread.text = JSON.stringify(breadcrumbSchema);
    document.head.appendChild(scriptBread);

    return () => {
      scriptFaq.remove();
      scriptBread.remove();
    };
  }, [page, activePath]);

  const handlePageChange = (path) => {
    navigate(path);
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8 transition-colors duration-300">
      <SEO 
        title={page.title} 
        description={page.description} 
      />

      <div className="space-y-1 text-left mb-6">
        <Breadcrumbs />
        <button
          onClick={() => {
            navigate("/");
          }}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-[#94A3B8] hover:text-black dark:hover:text-[#F8FAFC] transition-colors mb-3"
        >
          <FaArrowLeft /> Back to Dashboard
        </button>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-[#F8FAFC]">
          {page.h1}
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#94A3B8] max-w-2xl">
          {page.description}
        </p>
      </div>

      {/* Main Section */}
      <section className="grid lg:grid-cols-3 gap-8 items-start mb-16 text-left">
        
        {/* Left/Main Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-6 sm:p-8 rounded-2xl shadow-sm">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-900 dark:text-[#F8FAFC]">
              {page.aboutTitle}
            </h2>
            <p className="text-gray-600 dark:text-[#94A3B8] text-sm leading-relaxed mb-4">
              {page.aboutText}
            </p>
            <p className="text-gray-600 dark:text-[#94A3B8] text-sm leading-relaxed">
              Access other critical academic links for Jayamukhi Institute of Technological Sciences (JITS) students below, or return to the main dashboard to browse dynamic subject categories. This database is compiled by JITS students, led by <strong>MOHD DANISH</strong>.
            </p>
          </div>

          {/* Quick Links Grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            
            <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center mb-4 text-indigo-500">
                <FaBookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-[#F8FAFC] mb-2">B.Tech Year Notes</h3>
              <p className="text-xs text-gray-500 dark:text-[#94A3B8] mb-4">Select your academic year to browse matching lecture files, question banks, and notes.</p>
              <div className="flex flex-wrap gap-2 text-xxs font-bold uppercase">
                <button onClick={() => navigate("/year/1")} className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-black hover:text-white dark:hover:bg-[#6366F1] transition">Year 1</button>
                <button onClick={() => navigate("/year/2")} className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-black hover:text-white dark:hover:bg-[#6366F1] transition">Year 2</button>
                <button onClick={() => navigate("/year/3")} className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-black hover:text-white dark:hover:bg-[#6366F1] transition">Year 3</button>
                <button onClick={() => navigate("/year/4")} className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-black hover:text-white dark:hover:bg-[#6366F1] transition">Year 4</button>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mb-4 text-emerald-500">
                <FaFolderOpen className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-[#F8FAFC] mb-2">Resources Repository</h3>
              <p className="text-xs text-gray-500 dark:text-[#94A3B8] mb-4">Access placement materials, official syllabus books, question banks, and lab manuals.</p>
              <button 
                onClick={() => navigate("/resources")} 
                className="text-xs font-bold text-indigo-600 dark:text-[#6366F1] hover:underline"
              >
                Go to Resources Repository →
              </button>
            </div>

          </div>

          {/* FAQ Accordion Section */}
          <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-6 sm:p-8 rounded-2xl shadow-sm">
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-900 dark:text-[#F8FAFC]">
              Frequently Asked Questions (FAQ)
            </h2>
            <div className="space-y-4">
              {page.faqs.map((faq, index) => (
                <div key={index} className="border-b border-gray-100 dark:border-gray-800 pb-4">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full flex items-center justify-between text-left font-bold text-sm sm:text-base text-gray-900 dark:text-[#F8FAFC] py-2 outline-none focus:outline-none"
                  >
                    <span>{faq.question}</span>
                    {openFaqIndex === index ? <FaChevronUp className="w-4 h-4 text-gray-400" /> : <FaChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaqIndex === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-[#94A3B8] pt-2 leading-relaxed">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Sidebar/Internal Linking */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6 sm:p-8 rounded-2xl shadow-md">
            <h3 className="font-extrabold text-lg sm:text-xl mb-3">Academic Sections</h3>
            <p className="text-xs text-indigo-100 leading-relaxed mb-6">
              Our materials are sorted carefully to ensure that JITS engineering students can locate previous papers and target subject notes immediately.
            </p>
            <div className="space-y-3 text-xs font-semibold">
              <div className="flex items-center gap-2.5">
                <FaGraduationCap className="w-4 h-4 text-indigo-200" />
                <span>JNTUH R22 Regulation compliant</span>
              </div>
              <div className="flex items-center gap-2.5">
                <FaBookOpen className="w-4 h-4 text-indigo-200" />
                <span>B.Tech CSE & AIML Resources</span>
              </div>
            </div>
          </div>

          {/* Internal link block for the 5 SEO pages */}
          <div className="bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm text-left">
            <h4 className="font-bold text-sm text-gray-900 dark:text-[#F8FAFC] mb-3">JITS Study Materials Links</h4>
            <ul className="text-xs text-gray-500 dark:text-[#94A3B8] space-y-3">
              {LANDING_PAGES_LIST.map((item) => (
                <li key={item.path}>
                  <button
                    onClick={() => handlePageChange(item.path)}
                    className={`hover:underline block text-left font-semibold ${
                      activePath === item.path 
                        ? "text-indigo-600 dark:text-[#6366F1] font-bold" 
                        : "text-gray-650 dark:text-gray-400 hover:text-indigo-500"
                    }`}
                  >
                    • {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </section>
    </div>
  );
}
