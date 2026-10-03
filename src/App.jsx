import { useState, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaGithub, FaLinkedin, FaEnvelope, FaSun, FaMoon, FaBars, FaTimes } from "./components/icons";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import Modal from "./components/Modal";
import NotesSection from "./components/NotesSection";
import { subjectsApi, feedbackApi } from "./lib/api";
import { sendFeedbackEmailNotification } from "./lib/email";
import { useAuth } from "./context/AuthContext";
import SEO from "./components/SEO";
import Breadcrumbs from "./components/Breadcrumbs";
import AcceptTeacherInvitation from "./components/AcceptTeacherInvitation";
import { trackPageView, trackYearSelection, trackFeedbackSubmit } from "./utils/analytics";
import heroBg from "./assets/Hero_image.png";

const AdminRoute = lazy(() => import("./components/AdminRoute"));
const SeoLandingPage = lazy(() => import("./components/SeoLandingPage"));

export default function App() {
  const { isAdmin, signIn, signInWithGoogle, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname === "/admin-login" || location.pathname.startsWith("/admin");
  const shouldShowAdmin = isAdmin || isAdminRoute;

  const isAdminLoginRoute = location.pathname === "/admin-login";
  const isAdminDashboardRoute = location.pathname.startsWith("/admin") && !isAdminLoginRoute;

  const [selectedYear, setSelectedYear] = useState(1);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
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

  // Track page views on every React Router route change
  useEffect(() => {
    if (!location.pathname.startsWith("/admin")) {
      trackPageView(location.pathname + location.search);
    }
  }, [location]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const years = [
    { id: 1, label: "1st Year" },
    { id: 2, label: "2nd Year" },
    { id: 3, label: "3rd Year" },
    { id: 4, label: "4th Year" },
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
    fetchSubjects();
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

  if (location.pathname === "/admin/accept-invitation") {
    return <AcceptTeacherInvitation />;
  }

  if (isAdminDashboardRoute) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-[#F7F8FA] dark:bg-[#0B0D12] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E5E5E5] border-t-[#2C3480]" />
        </div>
      }>
        <AdminRoute />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0D12] text-[#000000] dark:text-[#FFFFFF] transition-colors duration-200">
      <SEO yearNumber={selectedYear} />
      
      {/* 1. HEADER (Section 9) */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md bg-white/95 dark:bg-[#10131A]/95 border-b border-[#E5E5E5] dark:border-[#292E3A] transition-colors duration-200"
      >
        <div className="w-full max-w-content mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-[68px]">
            {/* Logo */}
            <div
              className="flex items-center gap-3 cursor-pointer select-none"
              onClick={() => {
                if (location.pathname !== "/") {
                  navigate("/");
                } else {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            >
              <img
                src="/icons.webp"
                alt="JITS Notes logo"
                width="38"
                height="38"
                decoding="async"
                fetchPriority="high"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border border-[#E5E5E5] dark:border-[#292E3A]"
              />
              <div className="flex flex-col">
                <span className="font-bold text-base sm:text-lg tracking-tight text-[#000000] dark:text-[#FFFFFF]">
                  JITS Notes
                </span>
                <span className="text-[10px] sm:text-xs text-[#555555] dark:text-[#858B99] font-medium leading-none">
                  B.Tech CSE & AIML
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6 lg:gap-7 text-sm font-semibold">
              <button
                onClick={() => {
                  if (location.pathname !== "/") {
                    navigate("/", { state: { scrollTo: "notes-section" } });
                  } else {
                    handleYearClick(selectedYear);
                  }
                }}
                className="text-[#555555] dark:text-[#B8BDCA] hover:text-[#000000] dark:hover:text-[#FFFFFF] transition-colors"
              >
                Notes
              </button>
              <button
                onClick={() => navigate("/jits-notes")}
                className="text-[#555555] dark:text-[#B8BDCA] hover:text-[#000000] dark:hover:text-[#FFFFFF] transition-colors"
              >
                JITS Info
              </button>
              <button
                onClick={handleSendFeedback}
                className="text-[#555555] dark:text-[#B8BDCA] hover:text-[#000000] dark:hover:text-[#FFFFFF] transition-colors"
              >
                Feedback
              </button>

              {shouldShowAdmin && (
                <button
                  type="button"
                  onClick={handleAdminClick}
                  className="text-[#2C3480] dark:text-[#3D4CC4] hover:underline transition-colors"
                >
                  Admin
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleLogout}
                  className="text-red-600 hover:text-red-700 text-xs font-bold transition-colors"
                >
                  Logout
                </button>
              )}

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-[#F7F8FA] hover:bg-gray-200 dark:bg-[#1A1E28] dark:hover:bg-[#292E3A] text-[#555555] dark:text-[#B8BDCA] transition-colors flex items-center justify-center border border-[#E5E5E5] dark:border-[#292E3A]"
                aria-label="Toggle theme"
              >
                {theme === "light" ? <FaMoon className="w-4 h-4" /> : <FaSun className="w-4 h-4" />}
              </button>
            </nav>

            {/* Mobile Actions */}
            <div className="md:hidden flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-[#F7F8FA] hover:bg-gray-200 dark:bg-[#1A1E28] dark:hover:bg-[#292E3A] text-[#555555] dark:text-[#B8BDCA] transition-colors flex items-center justify-center border border-[#E5E5E5] dark:border-[#292E3A]"
                aria-label="Toggle theme"
              >
                {theme === "light" ? <FaMoon className="w-4 h-4" /> : <FaSun className="w-4 h-4" />}
              </button>

              {/* Hamburger Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-xl hover:bg-[#F7F8FA] dark:hover:bg-[#1A1E28] text-[#000000] dark:text-[#FFFFFF] transition-colors flex items-center justify-center border border-[#E5E5E5] dark:border-[#292E3A]"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <FaTimes className="w-5 h-5" /> : <FaBars className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu (Section 32) */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="md:hidden border-b border-[#E5E5E5] dark:border-[#292E3A] bg-white dark:bg-[#10131A] overflow-hidden"
            >
              <div className="px-4 py-3 space-y-1 font-semibold text-sm">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (location.pathname !== "/") {
                      navigate("/", { state: { scrollTo: "notes-section" } });
                    } else {
                      handleYearClick(selectedYear);
                    }
                  }}
                  className="block w-full text-left px-3 py-2.5 rounded-xl text-[#555555] dark:text-[#B8BDCA] hover:bg-[#F7F8FA] dark:hover:bg-[#1A1E28] hover:text-[#000000] dark:hover:text-[#FFFFFF] min-h-[44px] flex items-center"
                >
                  Notes
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate("/jits-notes");
                  }}
                  className="block w-full text-left px-3 py-2.5 rounded-xl text-[#555555] dark:text-[#B8BDCA] hover:bg-[#F7F8FA] dark:hover:bg-[#1A1E28] hover:text-[#000000] dark:hover:text-[#FFFFFF] min-h-[44px] flex items-center"
                >
                  JITS Info
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleSendFeedback();
                  }}
                  className="block w-full text-left px-3 py-2.5 rounded-xl text-[#555555] dark:text-[#B8BDCA] hover:bg-[#F7F8FA] dark:hover:bg-[#1A1E28] hover:text-[#000000] dark:hover:text-[#FFFFFF] min-h-[44px] flex items-center"
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
                    className="block w-full text-left px-3 py-2.5 rounded-xl text-[#2C3480] dark:text-[#3D4CC4] hover:bg-[#F7F8FA] dark:hover:bg-[#1A1E28] min-h-[44px] flex items-center"
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
                    className="block w-full text-left px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 min-h-[44px] flex items-center"
                  >
                    Logout
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 2. MAIN CONTENT PAGE CHANGER */}
      {location.pathname.startsWith("/resources") ? (
        <Navigate to="/" replace />
      ) : location.pathname === "/notes" ? (
        <Navigate to="/" replace state={{ scrollTo: "notes-section" }} />
      ) : ["/jits-notes", "/jits-r22-notes", "/jits-previous-papers", "/jits-important-questions", "/jits-placement-materials"].includes(location.pathname) ? (
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <SeoLandingPage />
        </Suspense>
      ) : (
        <main id="main-content">
          {/* HERO SECTION */}
          <section
            className="relative w-full min-h-[540px] lg:h-[580px] lg:min-h-[560px] lg:max-h-[620px] flex items-center overflow-hidden border-b border-[#E5E5E5] dark:border-[#292E3A] bg-cover bg-no-repeat bg-[center_right] lg:bg-right"
            style={{ backgroundImage: `url(${heroBg})` }}
          >
            {/* Neutral Readability & Dark Mode Overlays */}
            <div className="absolute inset-0 bg-white/60 sm:bg-white/40 dark:bg-[#0B0D12]/80 sm:dark:bg-[#0B0D12]/70 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/60 to-transparent dark:from-[#0B0D12]/90 dark:via-[#0B0D12]/70 dark:to-transparent pointer-events-none" />

            <div className="relative z-10 w-full max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 lg:py-0">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] gap-8 lg:gap-14 items-center">
                
                {/* LEFT COLUMN: HERO CONTENT */}
                <div className="text-left">
                  {/* Small badge */}
                  <div className="mb-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2C3480]/10 dark:bg-[#3D4CC4]/20 border border-[#2C3480]/20 dark:border-[#3D4CC4]/30 text-[#2C3480] dark:text-[#FFFFFF] text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2C3480] dark:bg-[#3D4CC4]" />
                    JNTUH R22 • B.Tech CSE & AIML
                  </div>

                  {/* Heading */}
                  <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold mb-3 leading-tight tracking-tight text-[#000000] dark:text-[#FFFFFF]">
                    B.Tech CSE & AIML <br />
                    <span className="text-[#2C3480] dark:text-[#FFFFFF]">JITS Notes</span>
                  </h1>

                  {/* Supporting text */}
                  <p className="text-sm sm:text-base text-[#555555] dark:text-[#B8BDCA] mb-6 max-w-xl leading-relaxed">
                    Access organized notes, question papers and study material for B.Tech CSE & AIML students following the JNTUH R22 curriculum.
                  </p>

                  {/* Buttons */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const section = document.getElementById("notes-section");
                        if (section) section.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="bg-[#2C3480] hover:bg-[#3D4CC4] text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-colors min-h-[44px]"
                    >
                      Browse Notes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const section = document.getElementById("notes-section");
                        if (section) section.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="border border-[#2C3480] dark:border-[#3D4CC4] text-[#2C3480] dark:text-[#FFFFFF] bg-white/80 dark:bg-[#14171F]/80 hover:bg-white dark:hover:bg-[#1A1E28] px-6 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-colors min-h-[44px]"
                    >
                      View Resources
                    </button>
                  </div>
                </div>

                {/* RIGHT COLUMN: ACADEMIC YEARS CARD */}
                <div className="w-full">
                  <div className="bg-white/95 dark:bg-[#14171F]/95 backdrop-blur-md border border-[#E5E5E5] dark:border-[#292E3A] rounded-2xl p-5 sm:p-6 shadow-md dark:shadow-2xl">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E5E5E5] dark:border-[#292E3A]">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#555555] dark:text-[#B8BDCA]">
                        Academic Years
                      </span>
                      <span className="text-xs text-[#858B99] font-medium">
                        JNTUH R22
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {years.map((y) => {
                        const isSelected = selectedYear === y.id;
                        return (
                          <div
                            key={y.id}
                            onClick={() => handleYearClick(y.id)}
                            className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-150 border ${
                              isSelected
                                ? "bg-[#2C3480] text-white border-[#2C3480] shadow-sm"
                                : "bg-[#F7F8FA] dark:bg-[#1A1E28] border-[#E5E5E5] dark:border-[#292E3A] text-[#000000] dark:text-[#FFFFFF] hover:border-[#2C3480]/40 dark:hover:border-[#3D4CC4]/40"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                isSelected
                                  ? "bg-white text-[#2C3480]"
                                  : "bg-white dark:bg-[#10131A] text-[#000000] dark:text-[#FFFFFF] border border-[#E5E5E5] dark:border-[#292E3A]"
                              }`}>
                                {y.id}
                              </span>
                              <span className="font-semibold text-xs sm:text-sm">{y.label}</span>
                            </div>
                            <span className={`text-xs ${isSelected ? "text-white" : "text-[#858B99]"}`}>
                              →
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* BREADCRUMBS & SUBJECTS */}
          <div className="w-full max-w-content mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-1">
            <Breadcrumbs yearNumber={selectedYear} onYearClick={setSelectedYear} />
          </div>

          <NotesSection
            selectedYear={selectedYear}
            subjects={subjects}
            loading={loading}
            isAdmin={isAdmin}
            onOpenAdmin={handleAdminClick}
          />

          {/* 5. FEEDBACK SECTION */}
          <section className="w-full max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <div className="max-w-[560px] mx-auto p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#14171F] border border-[#E5E5E5] dark:border-[#292E3A] text-center shadow-sm">
              <h2 className="text-lg sm:text-xl font-bold text-[#000000] dark:text-[#FFFFFF] mb-1.5 tracking-tight">
                Help improve JITS Notes
              </h2>
              <p className="text-sm text-[#555555] dark:text-[#B8BDCA] mb-5 leading-relaxed">
                Found an issue or have a suggestion?
              </p>
              <button
                type="button"
                onClick={handleSendFeedback}
                className="inline-flex items-center justify-center bg-[#2C3480] hover:bg-[#3D4CC4] text-white px-6 py-2.5 rounded-xl font-semibold text-xs shadow-sm transition-colors min-h-[44px]"
              >
                Send Feedback
              </button>
            </div>
          </section>
        </main>
      )}

      {/* 7. FOOTER (Section 25) */}
      <footer className="w-full bg-white dark:bg-[#10131A] border-t border-[#E5E5E5] dark:border-[#292E3A] py-8 sm:py-10 transition-colors duration-200">
        <div className="w-full max-w-content mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center text-center space-y-5">
          <h3 className="font-bold text-lg sm:text-xl tracking-tight text-[#000000] dark:text-[#FFFFFF]">
            JITS Notes
          </h3>

          <p className="text-xs sm:text-sm text-[#555555] dark:text-[#B8BDCA] max-w-md mx-auto leading-relaxed">
            Helping JITS students with organized notes, questions & resources.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm font-semibold text-[#555555] dark:text-[#B8BDCA]">
            <button
              onClick={() => navigate("/jits-notes")}
              className="hover:text-[#000000] dark:hover:text-[#FFFFFF] transition-colors"
            >
              JITS Notes Hub
            </button>

            <span className="text-[#858B99]">•</span>

            <a
              href="https://github.com/mohddanish305"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-[#000000] dark:hover:text-[#FFFFFF] transition-colors"
            >
              <FaGithub className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>

            <span className="text-[#858B99]">•</span>

            <a
              href="https://www.linkedin.com/in/mohd-danish-986a5b2a3/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-[#000000] dark:hover:text-[#FFFFFF] transition-colors"
            >
              <FaLinkedin className="w-3.5 h-3.5" />
              <span>LinkedIn</span>
            </a>

            <span className="text-[#858B99]">•</span>

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
              className="flex items-center gap-1.5 hover:text-[#000000] dark:hover:text-[#FFFFFF] transition-colors"
            >
              <FaEnvelope className="w-3.5 h-3.5" />
              <span>Email</span>
            </a>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-xs text-[#858B99] font-medium pt-2 border-t border-[#E5E5E5] dark:border-[#292E3A] w-full justify-center">
            <span>© 2026 JITS Notes</span>
            <span className="hidden sm:inline">•</span>
            <span>Made with ❤️ by MOHD DANISH</span>
          </div>
        </div>
      </footer>

      {/* FEEDBACK MODAL */}
      <Modal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        title="Send Feedback"
      >
        <form onSubmit={handleFeedbackSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#555555] dark:text-[#B8BDCA] mb-1.5">Name</label>
            <input
              type="text"
              name="name"
              value={feedbackForm.name}
              onChange={handleFeedbackChange}
              required
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#171B24] border border-[#E5E5E5] dark:border-[#292E3A] rounded-xl focus:border-[#2C3480] dark:focus:border-[#3D4CC4] text-sm text-[#000000] dark:text-[#FFFFFF] outline-none transition"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#555555] dark:text-[#B8BDCA] mb-1.5">Email</label>
            <input
              type="email"
              name="email"
              value={feedbackForm.email}
              onChange={handleFeedbackChange}
              required
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#171B24] border border-[#E5E5E5] dark:border-[#292E3A] rounded-xl focus:border-[#2C3480] dark:focus:border-[#3D4CC4] text-sm text-[#000000] dark:text-[#FFFFFF] outline-none transition"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#555555] dark:text-[#B8BDCA] mb-1.5">Message</label>
            <textarea
              name="message"
              value={feedbackForm.message}
              onChange={handleFeedbackChange}
              required
              rows={4}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#171B24] border border-[#E5E5E5] dark:border-[#292E3A] rounded-xl focus:border-[#2C3480] dark:focus:border-[#3D4CC4] text-sm text-[#000000] dark:text-[#FFFFFF] outline-none transition resize-none"
              placeholder="Your feedback or suggestion..."
            />
          </div>
          <button
            type="submit"
            disabled={isFeedbackSubmitting}
            className="w-full bg-[#2C3480] hover:bg-[#3D4CC4] text-white py-2.5 rounded-xl font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {isFeedbackSubmitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </form>
      </Modal>

      {/* ADMIN LOGIN MODAL */}
      <Modal isOpen={isAdminLoginOpen} onClose={() => setIsAdminLoginOpen(false)} title="Admin Login">
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#555555] dark:text-[#B8BDCA] mb-1.5">Email</label>
            <input
              type="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#171B24] border border-[#E5E5E5] dark:border-[#292E3A] rounded-xl focus:border-[#2C3480] dark:focus:border-[#3D4CC4] text-sm text-[#000000] dark:text-[#FFFFFF] outline-none transition"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#555555] dark:text-[#B8BDCA] mb-1.5">Password</label>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#171B24] border border-[#E5E5E5] dark:border-[#292E3A] rounded-xl focus:border-[#2C3480] dark:focus:border-[#3D4CC4] text-sm text-[#000000] dark:text-[#FFFFFF] outline-none transition"
              placeholder="••••••••"
            />
          </div>
          {loginError && (
            <p className="text-red-600 dark:text-red-400 text-xs font-medium">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={isSigningIn}
            className="w-full py-2.5 rounded-xl font-semibold text-xs transition-colors bg-[#2C3480] hover:bg-[#3D4CC4] text-white disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {isSigningIn ? "Signing In..." : "Sign In"}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E5E5E5] dark:border-[#292E3A]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-[#858B99] font-bold">
              <span className="bg-white dark:bg-[#14171F] px-3">or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 border border-[#E5E5E5] dark:border-[#292E3A] bg-white dark:bg-[#171B24] py-2.5 rounded-xl font-semibold text-xs text-[#000000] dark:text-[#FFFFFF] hover:bg-[#F7F8FA] dark:hover:bg-[#1A1E28] transition-colors min-h-[44px]"
          >
            <span className="text-sm font-bold text-[#2C3480] dark:text-[#3D4CC4]">G</span>
            Continue with Google
          </button>
        </form>
      </Modal>
    </div>
  );
}
