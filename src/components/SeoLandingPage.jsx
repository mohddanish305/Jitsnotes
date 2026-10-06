import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaChevronDown, FaChevronUp, FaBookOpen, FaGraduationCap, FaFolderOpen, FaArrowLeft } from "./icons";
import { useNavigate, useLocation } from "react-router-dom";
import SEO from "./SEO";
import Breadcrumbs from "./Breadcrumbs";

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
    <div className="w-full max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 transition-colors duration-200">
      <SEO 
        title={page.title} 
        description={page.description} 
      />

      <div className="space-y-1 text-left mb-6">
        <Breadcrumbs />
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#555555] dark:text-[#B8BDCA] hover:text-[#000000] dark:hover:text-[#FFFFFF] transition-colors mb-2"
        >
          <FaArrowLeft className="w-3 h-3" /> Back to Notes
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#000000] dark:text-[#FFFFFF]">
          {page.h1}
        </h1>
        <p className="text-sm text-[#555555] dark:text-[#B8BDCA] max-w-2xl">
          {page.description}
        </p>
      </div>

      {/* Main Section */}
      <section className="grid lg:grid-cols-3 gap-6 sm:gap-8 items-start mb-12 text-left">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#14171F] border border-[#E5E5E5] dark:border-[#292E3A] p-6 sm:p-7 rounded-2xl shadow-sm">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 text-[#000000] dark:text-[#FFFFFF]">
              {page.aboutTitle}
            </h2>
            <p className="text-[#555555] dark:text-[#B8BDCA] text-sm leading-relaxed mb-3">
              {page.aboutText}
            </p>
            <p className="text-[#555555] dark:text-[#B8BDCA] text-sm leading-relaxed">
              Access other critical academic links for Jayamukhi Institute of Technological Sciences (JITS) students below, or return to the main dashboard to browse dynamic subject categories. This database is compiled by JITS students, led by <strong>MOHD DANISH</strong>.
            </p>
          </div>

          {/* Quick Links Grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            
            <div className="bg-[#FFFFFF] dark:bg-[#0A0A0A] border border-[#EAEAEA] dark:border-[#222222] p-5 rounded-2xl shadow-subtle dark:shadow-subtle-dark">
              <div className="w-9 h-9 rounded-xl bg-[#F7F7F7] dark:bg-[#111111] border border-[#EAEAEA] dark:border-[#222222] flex items-center justify-center mb-3 text-[#111111] dark:text-white">
                <FaBookOpen className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-[#111111] dark:text-white mb-1.5">B.Tech Year Notes</h3>
              <p className="text-xs text-[#666666] dark:text-[#B3B3B3] mb-3 leading-relaxed">Select your academic year to browse matching lecture files, question banks, and notes.</p>
              <div className="flex flex-wrap gap-1.5 text-xs font-medium">
                <button onClick={() => navigate("/year/1")} className="px-2.5 py-1 rounded-lg bg-[#F7F7F7] dark:bg-[#111111] text-[#111111] dark:text-[#FFFFFF] hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-[#111111] transition border border-[#EAEAEA] dark:border-[#222222]">Year 1</button>
                <button onClick={() => navigate("/year/2")} className="px-2.5 py-1 rounded-lg bg-[#F7F7F7] dark:bg-[#111111] text-[#111111] dark:text-[#FFFFFF] hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-[#111111] transition border border-[#EAEAEA] dark:border-[#222222]">Year 2</button>
                <button onClick={() => navigate("/year/3")} className="px-2.5 py-1 rounded-lg bg-[#F7F7F7] dark:bg-[#111111] text-[#111111] dark:text-[#FFFFFF] hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-[#111111] transition border border-[#EAEAEA] dark:border-[#222222]">Year 3</button>
                <button onClick={() => navigate("/year/4")} className="px-2.5 py-1 rounded-lg bg-[#F7F7F7] dark:bg-[#111111] text-[#111111] dark:text-[#FFFFFF] hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-[#111111] transition border border-[#EAEAEA] dark:border-[#222222]">Year 4</button>
              </div>
            </div>

            <div className="bg-[#FFFFFF] dark:bg-[#0A0A0A] border border-[#EAEAEA] dark:border-[#222222] p-5 rounded-2xl shadow-subtle dark:shadow-subtle-dark">
              <div className="w-9 h-9 rounded-xl bg-[#F7F7F7] dark:bg-[#111111] border border-[#EAEAEA] dark:border-[#222222] flex items-center justify-center mb-3 text-[#111111] dark:text-white">
                <FaFolderOpen className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-[#111111] dark:text-white mb-1.5">Academic Notes Catalog</h3>
              <p className="text-xs text-[#666666] dark:text-[#B3B3B3] mb-3 leading-relaxed">Access lecture notes, previous papers, and organized academic study materials.</p>
              <button 
                onClick={() => navigate("/year/1")} 
                className="text-xs font-semibold text-[#111111] dark:text-white hover:underline"
              >
                Browse Academic Notes →
              </button>
            </div>

          </div>

          {/* FAQ Accordion Section */}
          <div className="bg-white dark:bg-[#141517] border border-[#E4E7EB] dark:border-[#2B2F34] p-6 sm:p-7 rounded-2xl shadow-subtle dark:shadow-subtle-dark">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-[#141517] dark:text-white">
              Frequently Asked Questions (FAQ)
            </h2>
            <div className="space-y-3">
              {page.faqs.map((faq, index) => (
                <div key={index} className="border-b border-[#E4E7EB] dark:border-[#2B2F34] pb-3 last:border-b-0">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full flex items-center justify-between text-left font-semibold text-sm sm:text-base text-[#141517] dark:text-white py-2"
                  >
                    <span>{faq.question}</span>
                    {openFaqIndex === index ? <FaChevronUp className="w-4 h-4 text-[#8A8F98]" /> : <FaChevronDown className="w-4 h-4 text-[#8A8F98]" />}
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaqIndex === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <p className="text-xs sm:text-sm text-[#5F6368] dark:text-[#B8BDCA] pt-1.5 leading-relaxed">
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

        {/* Right Sidebar */}
        <div className="space-y-6">
          <div className="bg-[#0A0A0A] text-white p-6 sm:p-7 rounded-2xl shadow-subtle dark:shadow-subtle-dark border border-[#222222]">
            <h3 className="font-semibold text-lg mb-2">Academic Sections</h3>
            <p className="text-xs text-[#B3B3B3] leading-relaxed mb-5">
              Our materials are sorted carefully to ensure that JITS engineering students can locate previous papers and target subject notes immediately.
            </p>
            <div className="space-y-2.5 text-xs font-medium">
              <div className="flex items-center gap-2.5">
                <FaGraduationCap className="w-4 h-4 text-white" />
                <span>JNTUH R22 Regulation compliant</span>
              </div>
              <div className="flex items-center gap-2.5">
                <FaBookOpen className="w-4 h-4 text-white" />
                <span>B.Tech CSE & AIML Resources</span>
              </div>
            </div>
          </div>

          {/* Internal Links Block */}
          <div className="bg-[#FFFFFF] dark:bg-[#0A0A0A] border border-[#EAEAEA] dark:border-[#222222] p-5 rounded-2xl shadow-subtle dark:shadow-subtle-dark text-left">
            <h4 className="font-semibold text-sm text-[#111111] dark:text-white mb-3">JITS Study Materials Links</h4>
            <ul className="text-xs text-[#666666] dark:text-[#B3B3B3] space-y-2.5">
              {LANDING_PAGES_LIST.map((item) => (
                <li key={item.path}>
                  <button
                    onClick={() => handlePageChange(item.path)}
                    className={`block text-left ${
                      activePath === item.path 
                        ? "text-[#111111] dark:text-white font-semibold underline" 
                        : "text-[#666666] dark:text-[#B3B3B3] hover:text-[#111111] dark:hover:text-white"
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
