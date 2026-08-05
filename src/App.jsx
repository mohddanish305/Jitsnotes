import { useState, useRef, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaGithub, FaLinkedin, FaEnvelope, FaSun, FaMoon, FaBars, FaTimes } from "./components/icons";
import { useLocation, useNavigate } from "react-router-dom";
import Modal from "./components/Modal";
import NotesSection from "./components/NotesSection";
import ResourcesSection from "./components/ResourcesSection";
import { subjectsApi, feedbackApi } from "./lib/api";
import { sendFeedbackEmailNotification } from "./lib/email";
import { useAuth } from "./context/AuthContext";
import SEO from "./components/SEO";
import Breadcrumbs from "./components/Breadcrumbs";
import { trackPageView, trackYearSelection, trackFeedbackSubmit } from "./utils/analytics";

const AdminRoute = lazy(() => import("./components/AdminRoute"));
const ResourcesPage = lazy(() => import("./components/ResourcesPage"));
const SeoLandingPage = lazy(() => import("./components/SeoLandingPage"));

export default function App() {
  const { user, isAdmin, signIn, signInWithGoogle, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname === "/admin-login" || location.pathname.startsWith("/admin");
  const shouldShowAdmin = isAdmin || isAdminRoute;

  console.log("Current route:", location.pathname);
  console.log("Show admin:", shouldShowAdmin);
  console.log("Admin authenticated:", isAdmin);

  const isAdminLoginRoute = location.pathname === "/admin-login";
  const isAdminDashboardRoute = location.pathname.startsWith("/admin") && !isAdminLoginRoute;

  const [selectedYear, setSelectedYear] = useState(1);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isQuestionsOpen, setIsQuestionsOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ name: "", email: "", message: "" });
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") || "light";
    }
    return "light";
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (location.pathname === "/" && location.state?.scrollTo) {
      const targetId = location.state.scrollTo;
      setTimeout(() => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 150);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Track page views on every React Router route change (SPA navigation)
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const resourcesSectionRef = useRef(null);

  const years = [
    { id: 1, label: "First Year" },
    { id: 2, label: "Second Year" },
    { id: 3, label: "Third Year" },
    { id: 4, label: "Fourth Year" },
  ];

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const data = await subjectsApi.getAll();
      setSubjects(data || []);
    } catch (error) {
      console.error("App: Error fetching subjects:", error);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects(); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  useEffect(() => {
    const handleSubjectsChanged = () => {
      fetchSubjects();
    };

    window.addEventListener("subjects:changed", handleSubjectsChanged);
    return () => {
      window.removeEventListener("subjects:changed", handleSubjectsChanged);
    };
  }, []);

  useEffect(() => {
    if (!isAdminLoginRoute) {
      setIsAdminLoginOpen(false);
    }
  }, [isAdminLoginRoute]);

  useEffect(() => {
    if (isAdmin && isAdminLoginRoute) {
      setIsAdminLoginOpen(false);
      navigate("/admin", { replace: true });
    }
  }, [isAdmin, isAdminLoginRoute, navigate]);

  // Synchronize clean paths and query parameters with selectedYear state
  useEffect(() => {
    const pathMatch = location.pathname.match(/^\/year\/(\d)(?:\/([^/]+))?$/i);
    if (pathMatch) {
      const yearNum = parseInt(pathMatch[1], 10);
      if (yearNum >= 1 && yearNum <= 4 && yearNum !== selectedYear) {
        setSelectedYear(yearNum);
      }
      return;
    }

    const params = new URLSearchParams(location.search);
    const yearParam = params.get("year");
    if (yearParam) {
      const yearNum = parseInt(yearParam, 10);
      if (yearNum >= 1 && yearNum <= 4 && yearNum !== selectedYear) {
        setSelectedYear(yearNum);
      }
    }
  }, [location.pathname, location.search, selectedYear]);

  const handleYearClick = (id) => {
    setSelectedYear(id);
    navigate(`/year/${id}`, { replace: true });
    trackYearSelection(id);

    const section = document.getElementById("notes-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleViewResources = () => {
    const section = document.getElementById("resources-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSendFeedback = () => {
    setIsFeedbackOpen(true);
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (isFeedbackSubmitting) return;

    const name = feedbackForm.name?.trim() || "";
    const email = feedbackForm.email?.trim() || "";
    const message = feedbackForm.message?.trim() || "";

    if (!name || !email || !message) {
      alert("Please fill in all required fields.");
      return;
    }

    setIsFeedbackSubmitting(true);
    try {
      const result = await feedbackApi.submit({
        name: name,
        email: email,
        message: message,
      });

      if (result && result.success) {
        // Send email notification via EmailJS after successful database save
        sendFeedbackEmailNotification({
          name: name,
          email: email,
          message: message,
          createdAt: new Date().toISOString(),
        }).catch((err) => console.error('[EmailJS] Unhandled notification error:', err));

        trackFeedbackSubmit();
        alert(`Thank you, ${name || "friend"}! Your feedback has been submitted.`);
        setIsFeedbackOpen(false);
        setFeedbackForm({ name: "", email: "", message: "" });
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      alert("Error submitting feedback. Please try again.");
    } finally {
      setIsFeedbackSubmitting(false);
    }
  };

  const handleFeedbackChange = (e) => {
    const { name, value } = e.target;
    setFeedbackForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isSigningIn) return;

    setIsSigningIn(true);
    setLoginError("");

    try {
      const { error } = await signIn(loginForm.email, loginForm.password);
      if (error) {
        setLoginError(error.message || "Invalid credentials");
      } else {
        setIsAdminLoginOpen(false);
        setLoginForm({ email: "", password: "" });
        navigate("/admin");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError("");
    const { error } = await signInWithGoogle();
    if (error) {
      setLoginError(error.message || "Google sign-in failed.");
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const handleAdminClick = () => {
    if (isAdmin) {
      navigate("/admin");
      return;
    }

    setIsAdminLoginOpen(true);
  };

  // Animation variants
  const buttonTransition = {
    type: "spring",
    stiffness: 400,
    damping: 17,
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
        ease: "easeOut"
      }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        ease: "easeOut"
      }
    }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  if (isAdminDashboardRoute) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />
        </div>
      }>
        <AdminRoute />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B1120] text-gray-900 dark:text-[#F8FAFC] transition-colors duration-300">
      <SEO yearNumber={selectedYear} />
      {/* HEADER */}
      <motion.header
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-[#0B1120]/80 border-b border-gray-100 dark:border-gray-800/60 shadow-sm transition-colors duration-300"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05, duration: 0.3 }}
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => {
                if (location.pathname !== "/") {
                  navigate("/");
                } else {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            >
              <motion.img
                src="/icons.webp"
                alt="JITS Notes logo"
                width="40"
                height="40"
                decoding="async"
                fetchPriority="high"
                whileHover={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 0.4 }}
                className="w-10 h-10 rounded-xl shadow-md object-cover border border-gray-100 dark:border-gray-800"
              />
              <div>
                <span className="font-bold text-base sm:text-lg tracking-tight text-gray-900 dark:text-[#F8FAFC]">JITS Notes</span>
                <p className="text-[10px] sm:text-xs text-gray-505 dark:text-[#94A3B8] font-medium">Free Learning Platform</p>
              </div>
            </motion.div>

            {/* Desktop Navigation */}
            <motion.nav
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05, duration: 0.3 }}
              className="hidden md:flex items-center gap-7 text-sm font-medium"
            >
              <button
                onClick={() => {
                  if (location.pathname !== "/") {
                    navigate("/", { state: { scrollTo: "notes-section" } });
                  } else {
                    handleYearClick(selectedYear);
                  }
                }}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-[#F8FAFC] transition-colors"
              >
                Notes
              </button>
              <button
                onClick={() => navigate("/resources")}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-[#F8FAFC] transition-colors"
              >
                Resources
              </button>
              <button
                onClick={() => navigate("/jits-notes")}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-[#F8FAFC] transition-colors"
              >
                JITS Info
              </button>
              <button
                onClick={handleSendFeedback}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-[#F8FAFC] transition-colors"
              >
                Feedback
              </button>

              {shouldShowAdmin && (
                <button
                  type="button"
                  onClick={handleAdminClick}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-[#F8FAFC] transition-colors"
                >
                  Admin
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleLogout}
                  className="text-red-500 hover:text-red-600 transition-colors"
                >
                  Logout
                </button>
              )}

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-250 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors flex items-center justify-center"
                aria-label="Toggle theme"
              >
                {theme === "light" ? <FaMoon className="w-4 h-4" /> : <FaSun className="w-4 h-4" />}
              </button>
            </motion.nav>

            {/* Mobile Actions */}
            <div className="md:hidden flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors flex items-center justify-center"
                aria-label="Toggle theme"
              >
                {theme === "light" ? <FaMoon className="w-4 h-4" /> : <FaSun className="w-4 h-4" />}
              </button>

              {/* Hamburger Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors flex items-center justify-center"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <FaTimes className="w-5 h-5" /> : <FaBars className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0B1120] overflow-hidden"
            >
              <div className="px-4 py-3 space-y-2.5 font-medium text-sm">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (location.pathname !== "/") {
                      navigate("/", { state: { scrollTo: "notes-section" } });
                    } else {
                      handleYearClick(selectedYear);
                    }
                  }}
                  className="block w-full text-left px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-55 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-[#F8FAFC]"
                >
                  Notes
                </button>
                 <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate("/resources");
                  }}
                  className="block w-full text-left px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-55 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-[#F8FAFC]"
                >
                  Resources
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate("/jits-notes");
                  }}
                  className="block w-full text-left px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-55 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-[#F8FAFC]"
                >
                  JITS Info
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleSendFeedback();
                  }}
                  className="block w-full text-left px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-[#F8FAFC]"
                >
                  Feedback
                </button>
                {shouldShowAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleAdminClick();
                    }}
                    className="block w-full text-left px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-[#F8FAFC]"
                  >
                    Admin
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="block w-full text-left px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    Logout
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* MAIN CONTENT PAGE CHANGER */}
      {location.pathname.startsWith("/resources") ? (
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <ResourcesPage onBackToHome={() => navigate("/")} />
        </Suspense>
      ) : ["/jits-notes", "/jits-r22-notes", "/jits-previous-papers", "/jits-important-questions", "/jits-placement-materials"].includes(location.pathname) ? (
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <SeoLandingPage />
        </Suspense>
      ) : (
        <main id="main-content">
          {/* HERO SECTION */}
          <section className="w-full max-w-[1450px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 md:py-16 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-14">

            {/* LEFT */}
            <motion.div
              initial={false}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full max-w-2xl text-left"
            >
              <motion.div
                initial={false}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="mb-4 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-[306D29] text-xs font-semibold"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-650 dark:bg-[#6366F1] animate-pulse" />
                Updated for JNTUH R22 Regulation
              </motion.div>

              <motion.h1
                initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 leading-tight text-gray-900 dark:text-[#F8FAFC]"
              >
                B.Tech CSE & AIML <br />
                <span className="text-[#A82323]">JITS Notes</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-gray-500 dark:text-[#94A3B8] text-sm sm:text-base mb-6 max-w-xl leading-relaxed"
              >
                Access free study material, engineering notes, JITS CSE notes, JITS AIML notes, important questions, and previous question papers under the JNTUH R22 regulation. Organised by year for easy access.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="flex flex-wrap gap-3.5"
              >
                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => handleYearClick(selectedYear)}
                  className="bg-black dark:bg-[#6366F1] text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:shadow-lg transition-all"
                >
                  Browse Notes
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  onClick={() => navigate("/resources")}
                  className="border border-gray-250 dark:border-gray-700 bg-white dark:bg-[#111827] text-gray-705 dark:text-[#F8FAFC] px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-55 dark:hover:bg-[#1E293B] transition-all"
                >
                  View Resources
                </motion.button>
              </motion.div>
            </motion.div>

            {/* RIGHT - YEAR CARD */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="w-full max-w-md bg-white dark:bg-[#111827] border border-gray-150 dark:border-gray-800/80 shadow-lg rounded-2xl p-5 sm:p-6 transition-all duration-300"
            >
              <div className="space-y-3">
                {years.map((year, index) => (
                  <motion.div
                    key={year.id}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + index * 0.08, duration: 0.4 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleYearClick(year.id)}
                    className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all duration-200 border
                      ${selectedYear === year.id
                        ? "bg-black dark:bg-[#6366F1] text-white border-black dark:border-[#6366F1] shadow-md"
                        : "bg-gray-55/40 hover:bg-gray-100/80 dark:bg-gray-800/40 dark:hover:bg-gray-800/80 border-gray-100 dark:border-gray-800/55 text-gray-707 dark:text-[#F8FAFC]"
                      }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.4 }}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg font-bold text-sm
                        ${selectedYear === year.id
                            ? "bg-white text-black dark:text-[#6366F1]"
                            : "bg-black dark:bg-gray-800 text-white dark:text-[#F8FAFC]"
                          }`}
                      >
                        {year.id}
                      </motion.div>

                      <span className="font-semibold text-sm sm:text-base">{year.label}</span>
                    </div>

                    <motion.span
                      animate={{ x: selectedYear === year.id ? [0, 4, 0] : 0 }}
                      className={selectedYear === year.id ? "text-white" : "text-gray-400 dark:text-gray-505"}
                    >
                      →
                    </motion.span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </section>

          {/* RESOURCES PREVIEW SECTION */}
          <ResourcesSection onViewAll={() => navigate("/resources")} />

          {/* BREADCRUMBS FOR NOTES */}
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 mt-6 -mb-6">
            <Breadcrumbs yearNumber={selectedYear} onYearClick={setSelectedYear} />
          </div>

          {/* NOTES SECTION */}
          <NotesSection
            selectedYear={selectedYear}
            subjects={subjects}
            loading={loading}
            isAdmin={isAdmin}
            onOpenAdmin={handleAdminClick}
          />

          {/* STATS */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={containerVariants}
            className="bg-white/60 dark:bg-[#111827]/60 backdrop-blur-sm border-y border-gray-200/55 dark:border-gray-800 shadow-sm transition-colors duration-300"
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 py-6 sm:py-8">
                {[
                  ["4", "Years Covered"],
                  ["50+", "Subjects"],
                  ["500+", "Question Papers"],
                  ["R22", "Regulation"]
                ].map(([val, label], i) => (
                  <motion.div
                    key={i}
                    variants={itemVariants}
                    className="text-center"
                  >
                    <motion.h3
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{
                        delay: 0.15 + i * 0.05,
                        type: "spring",
                        stiffness: 200,
                        damping: 15
                      }}
                      className="text-xl sm:text-2xl font-black mb-0.5 text-gray-900 dark:text-[#F8FAFC]"
                    >
                      {val}
                    </motion.h3>
                    <p className="text-[11px] sm:text-xs text-gray-505 dark:text-[#94A3B8] font-medium">{label}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>

          {/* FEEDBACK */}
          <motion.section
            id="resources-section"
            ref={resourcesSectionRef}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            variants={staggerContainer}
            className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14"
          >
            <div className="max-w-md mx-auto text-center bg-white dark:bg-[#111827] border border-gray-150 dark:border-gray-800/80 p-6 sm:p-8 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
              <motion.h2 variants={fadeInUp} className="text-lg sm:text-xl font-bold mb-1.5 tracking-tight text-gray-900 dark:text-[#F8FAFC]">
                Help Us Improve
              </motion.h2>
              <motion.p variants={fadeInUp} className="text-gray-555 dark:text-[#94A3B8] text-xs sm:text-sm mb-5 leading-relaxed">
                Found an issue or suggestion?
              </motion.p>
              <motion.button
                onClick={handleSendFeedback}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                transition={buttonTransition}
                className="inline-flex items-center justify-center bg-black dark:bg-[#6366F1] text-white px-5 py-2.5 rounded-xl hover:shadow-md transition-all font-bold text-xs shadow-sm"
              >
                Send Feedback
              </motion.button>
            </div>
          </motion.section>
        </main>
      )}

      {/* FOOTER */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full bg-white dark:bg-[#0B1120] border-t border-gray-150 dark:border-gray-850 py-12 transition-colors duration-300"
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center space-y-8">
          {/* Logo / Brand Name */}
          <h3 className="font-extrabold text-xl sm:text-2xl tracking-tight text-gray-900 dark:text-[#F8FAFC]">
            JITS Notes
          </h3>

          {/* Description */}
          <p className="text-gray-500 dark:text-[#94A3B8] text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
            Helping JITS students with organized notes,<br className="hidden sm:inline" />
            questions & resources
          </p>

          {/* Social Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm font-semibold text-gray-500 dark:text-[#94A3B8]">

            <button
              onClick={() => navigate("/jits-notes")}
              className="flex items-center gap-1.5 hover:text-black dark:hover:text-[#F8FAFC] transition-colors"
            >
              <span>JITS Notes Hub</span>
            </button>

            <span className="text-gray-300 dark:text-gray-700">•</span>

            <a
              href="https://github.com/mohddanish305"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-black dark:hover:text-[#F8FAFC] transition-colors"
            >
              <FaGithub className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>

            <span className="text-gray-300 dark:text-gray-700">•</span>

            <a
              href="https://www.linkedin.com/in/mohd-danish-986a5b2a3/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-black dark:hover:text-[#F8FAFC] transition-colors"
            >
              <FaLinkedin className="w-3.5 h-3.5" />
              <span>LinkedIn</span>
            </a>

            <span className="text-gray-300 dark:text-gray-700">•</span>

            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=23c41a05a1@jits.in"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                const gmailUrl = "https://mail.google.com/mail/?view=cm&fs=1&to=23c41a05a1@jits.in";
                const mailtoUrl = "mailto:23c41a05a1@jits.in";
                if (navigator.onLine) {
                  const newWindow = window.open(gmailUrl, "_blank", "noopener,noreferrer");
                  if (newWindow) return;
                }
                window.location.href = mailtoUrl;
              }}
              className="flex items-center gap-1.5 hover:text-black dark:hover:text-[#F8FAFC] transition-colors"
            >
              <FaEnvelope className="w-3.5 h-3.5" />
              <span>Email</span>
            </a>

          </div>

          {/* Copyright & Author Credits */}
          <div className="flex flex-col items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 font-medium">
            <div>© 2026 JITS Notes</div>
            <div className="flex items-center gap-1">
              Made with <span className="text-red-500 animate-pulse">❤️</span> by MOHD DANISH
            </div>
          </div>
        </div>
      </motion.footer>

      {/* FEEDBACK MODAL */}
      <Modal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        title="Send Feedback"
      >
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onSubmit={handleFeedbackSubmit}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Name</label>
              <input
                type="text"
                name="name"
                value={feedbackForm.name}
                onChange={handleFeedbackChange}
                required
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-black/10 dark:focus:ring-[#6366F1]/20 focus:border-black dark:focus:border-[#6366F1] text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                name="email"
                value={feedbackForm.email}
                onChange={handleFeedbackChange}
                required
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-black/10 dark:focus:ring-[#6366F1]/20 focus:border-black dark:focus:border-[#6366F1] text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Message</label>
              <textarea
                name="message"
                value={feedbackForm.message}
                onChange={handleFeedbackChange}
                required
                rows={4}
                className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-black/10 dark:focus:ring-[#6366F1]/20 focus:border-black dark:focus:border-[#6366F1] text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition resize-none"
                placeholder="Your feedback..."
              />
            </div>
            <motion.button
              type="submit"
              disabled={isFeedbackSubmitting}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              transition={buttonTransition}
              className="w-full bg-black dark:bg-[#6366F1] text-white py-2.5 rounded-xl font-bold text-xs hover:bg-gray-900 dark:hover:bg-[#6366F1]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFeedbackSubmitting ? "Submitting..." : "Submit Feedback"}
            </motion.button>
          </div>
        </motion.form>
      </Modal>

      {/* QUESTIONS PREVIEW MODAL */}
      <Modal
        isOpen={isQuestionsOpen}
        onClose={() => setIsQuestionsOpen(false)}
        title={`Important Questions - Year ${selectedYear}`}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-2.5 max-h-96 overflow-y-auto pr-2 admin-scrollbar"
        >
          {subjects.length === 0 ? (
            <p className="text-center text-gray-505 dark:text-gray-400 py-8 text-sm">No subjects for this year yet.</p>
          ) : (
            subjects.map((subject, i) => (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                whileHover={{ scale: 1.01, backgroundColor: "rgba(99, 102, 241, 0.05)" }}
                className="p-3.5 border border-gray-150 dark:border-gray-800 bg-white dark:bg-[#111827]/40 rounded-xl cursor-pointer transition-all"
              >
                <h4 className="font-bold text-sm text-gray-900 dark:text-[#F8FAFC] mb-0.5">{subject.name}</h4>
                <p className="text-xs text-gray-500 dark:text-[#94A3B8]">{subject.short_name}</p>
              </motion.div>
            ))
          )}
        </motion.div>
      </Modal>

      {/* ADMIN LOGIN MODAL */}
      <Modal isOpen={isAdminLoginOpen} onClose={() => setIsAdminLoginOpen(false)} title="Admin Login">
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onSubmit={handleLogin}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-305 mb-1.5">Email</label>
            <input
              type="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              required
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-black/10 dark:focus:ring-[#6366F1]/20 focus:border-black dark:focus:border-[#6366F1] text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-305 mb-1.5">Password</label>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              required
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-black/10 dark:focus:ring-[#6366F1]/20 focus:border-black dark:focus:border-[#6366F1] text-sm text-gray-900 dark:text-[#F8FAFC] outline-none transition"
              placeholder="••••••••"
            />
          </div>
          {loginError && (
            <p className="text-red-550 dark:text-red-400 text-xs">{loginError}</p>
          )}
          <motion.button
            type="submit"
            disabled={isSigningIn}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={buttonTransition}
            className={`w-full py-2.5 rounded-xl font-bold text-xs transition-colors ${isSigningIn
              ? "bg-gray-550 text-white cursor-not-allowed"
              : "bg-black dark:bg-[#6366F1] text-white hover:bg-gray-900 dark:hover:bg-[#6366F1]/90"
              }`}
          >
            {isSigningIn ? "Signing In..." : "Sign In"}
          </motion.button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-550 font-bold">
              <span className="bg-white dark:bg-[#111827] px-3 transition-colors duration-300">or continue with</span>
            </div>
          </div>

          <motion.button
            type="button"
            onClick={handleGoogleLogin}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={buttonTransition}
            className="w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2.5 rounded-xl font-bold text-xs text-gray-700 dark:text-[#F8FAFC] hover:bg-gray-550 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-sm font-black text-indigo-650 dark:text-[#6366F1]">G</span>
            Continue with Google
          </motion.button>
        </motion.form>
      </Modal>
    </div>
  );
}
