import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Menu, X, Mail, Shield, Search, GraduationCap, Laptop, Brain, Award } from "lucide-react";
import { FaGithub, FaLinkedin } from "./components/icons";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import Modal from "./components/Modal";
import NotesSection from "./components/NotesSection";
import QuickAccess from "./components/QuickAccess";
import ContinueReading from "./components/ContinueReading";
import GlobalSearch from "./components/GlobalSearch";
import { subjectsApi, feedbackApi } from "./lib/api";
import { supabase } from "./lib/supabase";
import { sendFeedbackEmailNotification } from "./lib/email";
import { useAuth } from "./context/AuthContext";
import SEO from "./components/SEO";
import AcceptTeacherInvitation from "./components/AcceptTeacherInvitation";
import { isInvitationFlow } from "./lib/authCallback";
import PdfViewerModal from "./components/PdfViewerModal";
import { trackPageView, trackYearSelection, trackFeedbackSubmit } from "./utils/analytics";

const AdminRoute = lazy(() => import("./components/AdminRoute"));
const SeoLandingPage = lazy(() => import("./components/SeoLandingPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const CookiePolicyPage = lazy(() => import("./pages/CookiePolicyPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const NotFoundPage = lazy(() => import("./components/NotFoundPage"));

export default function App() {
  const { isAdmin, signIn, signInWithGoogle, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isInviteRoute = isInvitationFlow();

  const isAdminLoginRoute = location.pathname === "/admin-login" && !isInviteRoute;
  const isAdminDashboardRoute = location.pathname.startsWith("/admin") && !isAdminLoginRoute && !isInviteRoute;

  const [selectedYear, setSelectedYear] = useState(1);
  const [activeSubject, setActiveSubject] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({ name: "", email: "", message: "" });
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [activeGlobalDoc, setActiveGlobalDoc] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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

  // Global Ctrl+K / Cmd+K search shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Academic years ordered: 1st Year, 2nd Year, 3rd Year, 4th Year with clean academic icons without numbers
  const years = [
    { id: 1, label: "1st Year", subtitle: "Core foundations & engineering sciences", icon: GraduationCap },
    { id: 2, label: "2nd Year", subtitle: "Data structures & core CSE foundations", icon: Laptop },
    { id: 3, label: "3rd Year", subtitle: "AIML, algorithms & specialized data", icon: Brain },
    { id: 4, label: "4th Year", subtitle: "Electives, major projects & advanced topics", icon: Award },
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

  // Synchronize clean paths with selectedYear, activeSubject, and active document state
  useEffect(() => {
    // 1. Direct document route: /documents/:documentId or /document/:documentId
    const docMatch = location.pathname.match(/^\/documents?\/([^/]+)$/i);
    if (docMatch) {
      const docId = docMatch[1];
      supabase
        .from("documents")
        .select("id, title, description, file_size, page_count, unit_id, folder_id, category_id, is_active, created_at, updated_at, subjects(id, name, short_name, year_id)")
        .eq("id", docId)
        .eq("is_active", true)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setActiveGlobalDoc({ doc: data, subject: data.subjects });
            if (data.subjects?.year_id) {
              setSelectedYear(data.subjects.year_id);
            }
          }
        });
      return;
    }

    // 2. Subject notes route: /subjects/:subjectId/notes or /subject/:subjectId/notes or /subject/:subjectId
    const subjectMatch = location.pathname.match(/^\/subjects?\/([^/]+)(?:\/notes)?$/i);
    if (subjectMatch) {
      const subId = subjectMatch[1];
      if (subId !== "notes") {
        const found = subjects.find((s) => s.id === subId);
        if (found) {
          setActiveSubject(found);
          if (found.year_id && found.year_id !== selectedYear) {
            setSelectedYear(found.year_id);
          }
        } else {
          supabase
            .from("subjects")
            .select("id, name, short_name, year_id, description, is_active")
            .eq("id", subId)
            .single()
            .then(({ data, error }) => {
              if (!error && data) {
                setActiveSubject(data);
                if (data.year_id) setSelectedYear(data.year_id);
              }
            });
        }
        return;
      }
    }

    // 3. Years route: /years/:yearId/subjects or /year/:yearId
    const yearMatch = location.pathname.match(/^\/(?:years?\/(\d)(?:\/subjects)?)$/i);
    if (yearMatch) {
      const yearNum = parseInt(yearMatch[1], 10);
      if (yearNum >= 1 && yearNum <= 4) {
        if (yearNum !== selectedYear) setSelectedYear(yearNum);
        setActiveSubject(null);
      }
      return;
    }

    // 4. Base /years route
    if (location.pathname === "/years") {
      setActiveSubject(null);
      return;
    }

    // 5. Query parameter ?year=X fallback
    const params = new URLSearchParams(location.search);
    const yearParam = params.get("year");
    if (yearParam) {
      const yearNum = parseInt(yearParam, 10);
      if (yearNum >= 1 && yearNum <= 4 && yearNum !== selectedYear) {
        setSelectedYear(yearNum);
      }
    }
  }, [location.pathname, location.search, subjects, selectedYear]);

  const handleYearClick = useCallback((id) => {
    setSelectedYear(id);
    setActiveSubject(null);
    navigate(`/years/${id}/subjects`, { replace: true });
    trackYearSelection(id);

    const section = document.getElementById("notes-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  }, [navigate]);

  const handleSubjectChange = useCallback((subject) => {
    setActiveSubject(subject);
    if (subject) {
      navigate(`/subjects/${subject.id}/notes`);
    } else {
      navigate(`/years/${selectedYear}/subjects`);
    }
    const section = document.getElementById("notes-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  }, [navigate, selectedYear]);

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

  const scrollToNotes = () => {
    const section = document.getElementById("notes-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (isInviteRoute) {
    return <AcceptTeacherInvitation />;
  }

  if (isAdminLoginRoute) {
    if (isAdmin) {
      navigate("/admin", { replace: true });
      return null;
    }
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7] px-4 dark:bg-[#000000]">
        <div className="w-full max-w-md rounded-2xl border border-[#EAEAEA] bg-white p-8 shadow-subtle dark:border-[#222222] dark:bg-[#0A0A0A]">
          <div className="text-center">
            <span className="inline-block rounded-full bg-[#F7F7F7] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#111111] dark:bg-[#161616] dark:text-white border border-[#EAEAEA] dark:border-[#222222]">
              JITS Notes
            </span>
            <h1 className="mt-3 text-2xl font-bold text-[#111111] dark:text-white">Admin Portal</h1>
            <p className="mt-1 text-xs text-[#666666] dark:text-[#8A8A8A]">Sign in to manage curriculum and academic notes</p>
          </div>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#666666] dark:text-[#B3B3B3] mb-1.5">Email</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#111111] border border-[#EAEAEA] dark:border-[#222222] rounded-xl focus:border-[#111111] dark:focus:border-white text-sm text-[#111111] dark:text-white outline-none transition"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#666666] dark:text-[#B3B3B3] mb-1.5">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 bg-white dark:bg-[#111111] border border-[#EAEAEA] dark:border-[#222222] rounded-xl focus:border-[#111111] dark:focus:border-white text-sm text-[#111111] dark:text-white outline-none transition"
                placeholder="••••••••"
              />
            </div>
            {loginError && (
              <p className="text-[#DC2626] text-xs font-medium">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={isSigningIn}
              className="w-full py-2.5 rounded-xl font-semibold text-xs transition-colors bg-[#111111] hover:bg-[#262626] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-black disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {isSigningIn ? "Signing In..." : "Sign In"}
            </button>
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#EAEAEA] dark:border-[#222222]" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-[#8A8A8A] font-bold">
                <span className="bg-white dark:bg-[#0A0A0A] px-3">or continue with</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2 border border-[#EAEAEA] dark:border-[#222222] bg-white dark:bg-[#111111] py-2.5 rounded-xl font-semibold text-xs text-[#111111] dark:text-white hover:bg-[#F2F2F2] dark:hover:bg-[#171717] transition-colors min-h-[44px]"
            >
              <span className="text-sm font-bold text-[#111111] dark:text-white">G</span>
              Continue with Google
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (isAdminDashboardRoute) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-[#F7F7F7] dark:bg-[#000000] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EAEAEA] border-t-[#111111] dark:border-[#222222] dark:border-t-white" />
        </div>
      }>
        <AdminRoute />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000] text-[#111111] dark:text-white transition-colors duration-150">
      <SEO yearNumber={selectedYear} />
      
      {/* 1. NAVBAR (64-68px, sticky, backdrop blur) */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/95 dark:bg-[#000000]/95 border-b border-[#EAEAEA] dark:border-[#222222] transition-colors duration-150">
        <div className="w-full max-w-content mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-[68px]">
            {/* Logo + Brand */}
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
                src="/icons.png"
                alt="JITS Notes logo"
                width="40"
                height="40"
                decoding="async"
                fetchPriority="high"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border border-[#EAEAEA] dark:border-[#222222] bg-[#F7F7F7] dark:bg-[#0A0A0A] shrink-0"
              />
              <div className="flex flex-col">
                <span className="font-bold text-base sm:text-lg tracking-tight leading-tight">
                  <span className="text-[#151515] dark:text-white">JITS </span>
                  <span className="text-[#8F1D32] dark:text-[#A21F3D]">Notes</span>
                </span>
                <span className="text-[10px] sm:text-xs text-[#666666] dark:text-[#8A8A8A] font-medium leading-none mt-0.5">
                  B.Tech CSE & AIML • JNTUH R22
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-5 lg:gap-6 text-sm font-semibold">
              <button
                type="button"
                onClick={() => {
                  if (location.pathname !== "/") {
                    navigate("/", { state: { scrollTo: "notes-section" } });
                  } else {
                    scrollToNotes();
                  }
                }}
                className="text-[#666666] dark:text-[#B3B3B3] hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors"
              >
                Notes
              </button>
              <button
                type="button"
                onClick={() => navigate("/about")}
                className="text-[#666666] dark:text-[#B3B3B3] hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors"
              >
                About
              </button>
              <button
                type="button"
                onClick={handleSendFeedback}
                className="text-[#666666] dark:text-[#B3B3B3] hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors"
              >
                Feedback
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleAdminClick}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAEAEA] dark:border-[#222222] bg-[#F7F7F7] dark:bg-[#111111] text-[#111111] dark:text-white hover:bg-[#F2F2F2] dark:hover:bg-[#171717] transition-colors text-xs font-semibold"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-[#DC2626] hover:text-red-700 text-xs font-semibold transition-colors"
                >
                  Logout
                </button>
              )}

              {/* Desktop Compact Search (Expands inline in navbar) */}
              <GlobalSearch
                isMobile={false}
                isOpen={isSearchOpen}
                onOpen={() => setIsSearchOpen(true)}
                onClose={() => setIsSearchOpen(false)}
                onSelectSubject={(subject) => {
                  setIsSearchOpen(false);
                  handleSubjectChange(subject);
                }}
                onSelectFolder={(folder, subject) => {
                  setIsSearchOpen(false);
                  if (subject) handleSubjectChange(subject);
                }}
                onOpenDocument={(doc, subject) => {
                  setIsSearchOpen(false);
                  setActiveGlobalDoc({ doc, subject });
                }}
              />

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="w-10 h-10 rounded-[10px] bg-white dark:bg-[#0A0A0A] hover:bg-[#F2F2F2] dark:hover:bg-[#171717] text-[#111111] dark:text-white transition-colors flex items-center justify-center border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs"
                aria-label="Toggle theme"
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
            </nav>

            {/* Mobile Actions */}
            <div className="md:hidden flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSearchOpen((prev) => !prev)}
                className="w-9 h-9 rounded-[10px] bg-white dark:bg-[#0A0A0A] hover:bg-[#F2F2F2] dark:hover:bg-[#171717] text-[#111111] dark:text-white transition-colors flex items-center justify-center border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs"
                aria-label="Toggle search"
              >
                {isSearchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className="w-9 h-9 rounded-[10px] bg-white dark:bg-[#0A0A0A] hover:bg-[#F2F2F2] dark:hover:bg-[#171717] text-[#111111] dark:text-white transition-colors flex items-center justify-center border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs"
                aria-label="Toggle theme"
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="w-9 h-9 rounded-[10px] hover:bg-[#F7F7F7] dark:hover:bg-[#111111] text-[#111111] dark:text-white transition-colors flex items-center justify-center border border-[#E5E5E5] dark:border-[#2A2A2A] shadow-xs"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Compact Search Bar directly below Navbar */}
        {isSearchOpen && (
          <div className="md:hidden px-3 pt-1 pb-3 border-t border-[#EAEAEA] dark:border-[#222222] bg-white dark:bg-[#000000]">
            <GlobalSearch
              isMobile={true}
              isOpen={isSearchOpen}
              onClose={() => setIsSearchOpen(false)}
              onSelectSubject={(subject) => {
                setIsSearchOpen(false);
                handleSubjectChange(subject);
              }}
              onSelectFolder={(folder, subject) => {
                setIsSearchOpen(false);
                if (subject) handleSubjectChange(subject);
              }}
              onOpenDocument={(doc, subject) => {
                setIsSearchOpen(false);
                setActiveGlobalDoc({ doc, subject });
              }}
            />
          </div>
        )}

        {/* Mobile Dropdown Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="md:hidden border-b border-[#EAEAEA] dark:border-[#222222] bg-white dark:bg-[#0A0A0A] overflow-hidden"
            >
              <div className="px-4 py-3 space-y-1 font-semibold text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    if (location.pathname !== "/") {
                      navigate("/", { state: { scrollTo: "notes-section" } });
                    } else {
                      scrollToNotes();
                    }
                  }}
                  className="block w-full text-left px-3 py-2.5 rounded-xl text-[#666666] dark:text-[#B3B3B3] hover:bg-[#F7F7F7] dark:hover:bg-[#111111] hover:text-[#8F1D32] dark:hover:text-[#A21F3D] min-h-[44px] flex items-center"
                >
                  Notes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate("/about");
                  }}
                  className="block w-full text-left px-3 py-2.5 rounded-xl text-[#666666] dark:text-[#B3B3B3] hover:bg-[#F7F7F7] dark:hover:bg-[#111111] hover:text-[#8F1D32] dark:hover:text-[#A21F3D] min-h-[44px] flex items-center"
                >
                  About
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleSendFeedback();
                  }}
                  className="block w-full text-left px-3 py-2.5 rounded-xl text-[#666666] dark:text-[#B3B3B3] hover:bg-[#F7F7F7] dark:hover:bg-[#111111] hover:text-[#8F1D32] dark:hover:text-[#A21F3D] min-h-[44px] flex items-center"
                >
                  Feedback
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleAdminClick();
                    }}
                    className="block w-full text-left px-3 py-2.5 rounded-xl text-[#111111] dark:text-white hover:bg-[#F7F7F7] dark:hover:bg-[#111111] min-h-[44px] flex items-center font-bold"
                  >
                    Admin Dashboard
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="block w-full text-left px-3 py-2.5 rounded-xl text-[#DC2626] hover:bg-red-50 dark:hover:bg-red-950/20 min-h-[44px] flex items-center"
                  >
                    Logout
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 2. ROUTE CONTENT SWITCHER */}
      {location.pathname.startsWith("/resources") ? (
        <Navigate to="/" replace />
      ) : location.pathname === "/units" ? (
        <Navigate to="/" replace />
      ) : location.pathname.match(/^\/unit\/[^/]+\/documents/i) ? (
        <Navigate to="/" replace />
      ) : location.pathname.match(/^\/subjects?\/([^/]+)\/units/i) ? (
        <Navigate to={`/subjects/${location.pathname.split("/")[2]}/notes`} replace />
      ) : location.pathname === "/notes" ? (
        <Navigate to="/" replace state={{ scrollTo: "notes-section" }} />
      ) : location.pathname === "/about" || location.pathname === "/jits-info" ? (
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <AboutPage onOpenFeedback={handleSendFeedback} />
        </Suspense>
      ) : location.pathname === "/privacy-policy" || location.pathname === "/privacy" ? (
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <PrivacyPolicyPage />
        </Suspense>
      ) : location.pathname === "/terms" || location.pathname === "/terms-and-conditions" ? (
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <TermsPage />
        </Suspense>
      ) : location.pathname === "/cookie-policy" || location.pathname === "/cookies" ? (
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <CookiePolicyPage />
        </Suspense>
      ) : location.pathname === "/contact" || location.pathname === "/support" ? (
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <ContactPage onOpenFeedback={handleSendFeedback} />
        </Suspense>
      ) : ["/jits-notes", "/jits-r22-notes", "/jits-previous-papers", "/jits-important-questions", "/jits-placement-materials"].includes(location.pathname) ? (
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <SeoLandingPage />
        </Suspense>
      ) : (location.pathname === "/" || location.pathname.startsWith("/year") || location.pathname.startsWith("/subject")) ? (
        <main id="main-content">
          {/* HERO & ACADEMIC YEARS SECTION */}
          <section className="relative w-full border-b border-[#EDEDED] dark:border-[#292929] bg-white dark:bg-[#0B0B0B] py-10 sm:py-12 lg:py-14 overflow-hidden">
            <div className="relative z-10 w-full max-w-content mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-8 lg:gap-12 items-center">
                
                {/* LEFT COLUMN: HERO CONTENT */}
                <div className="text-left">
                  {/* Curriculum Badge */}
                  <div className="mb-3 inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#FCF4F5] dark:bg-[#241217] border border-[#F8E9EC] dark:border-[#381B22] text-[#8F1D32] dark:text-[#A21F3D] text-[11px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8F1D32] dark:bg-[#A21F3D]" />
                    <span>JNTUH R22 Curriculum</span>
                  </div>

                  {/* Main Title */}
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 leading-tight tracking-tight">
                    <span className="text-[#151515] dark:text-white">JITS </span>
                    <span className="text-[#8F1D32] dark:text-[#A21F3D]">Notes</span>
                  </h1>

                  {/* Subtitle */}
                  <h2 className="text-base sm:text-lg lg:text-xl font-medium text-[#666666] dark:text-[#B5B5B5] mb-3 tracking-tight">
                    B.Tech CSE & AIML • Academic Study Material
                  </h2>

                  {/* Summary */}
                  <p className="text-xs sm:text-sm text-[#666666] dark:text-[#858585] mb-6 max-w-lg leading-relaxed">
                    Access organized unit-wise lecture notes, question papers, and study guides curated for engineering students.
                  </p>

                  {/* CTAs */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={scrollToNotes}
                      className="bg-[#151515] hover:bg-[#8F1D32] text-white dark:bg-white dark:hover:bg-[#FCF4F5] dark:hover:text-[#8F1D32] dark:text-black px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm shadow-subtle dark:shadow-subtle-dark transition-colors duration-150 min-h-[40px] cursor-pointer"
                    >
                      Browse Notes
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/about")}
                      className="border border-[#EDEDED] dark:border-[#292929] text-[#151515] dark:text-white bg-white dark:bg-[#151515] hover:bg-[#FCF4F5] dark:hover:bg-[#1F1F1F] hover:border-[#8F1D32]/30 px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-colors duration-150 min-h-[40px] cursor-pointer"
                    >
                      About Platform
                    </button>
                  </div>
                </div>

                {/* RIGHT COLUMN: ACADEMIC YEARS (Clean neutral cards without permanent pre-selection color) */}
                <div className="w-full">
                  <div className="bg-white dark:bg-[#151515] border border-[#EDEDED] dark:border-[#292929] rounded-2xl p-4 sm:p-5 shadow-subtle dark:shadow-subtle-dark">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#EDEDED] dark:border-[#292929]">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#151515] dark:text-white">
                        Academic Years
                      </span>
                      <span className="text-[11px] text-[#858585] font-medium">
                        Select to Browse
                      </span>
                    </div>

                    <div className="space-y-2">
                      {years.map((y) => {
                        const YearIcon = y.icon;
                        const isNavigated = location.pathname === `/years/${y.id}/subjects` || location.pathname === `/year/${y.id}`;
                        return (
                          <div
                            key={y.id}
                            onClick={() => handleYearClick(y.id)}
                            className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-xl cursor-pointer transition-all duration-150 border ${
                              isNavigated
                                ? "bg-[#8F1D32] text-white border-[#8F1D32] dark:bg-[#A21F3D] dark:border-[#A21F3D] shadow-sm"
                                : "bg-[#FAFAFA] dark:bg-[#1B1B1B] border-[#EDEDED] dark:border-[#292929] text-[#151515] dark:text-white hover:border-[#8F1D32]/50 dark:hover:border-[#A21F3D]/50 hover:bg-[#FFFFFF] dark:hover:bg-[#1F1F1F]"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                  isNavigated
                                    ? "bg-white text-[#8F1D32] dark:text-[#A21F3D]"
                                    : "bg-[#FCF4F5] dark:bg-[#241217] text-[#8F1D32] dark:text-[#A21F3D] border border-[#F8E9EC] dark:border-[#381B22] group-hover:bg-[#8F1D32] group-hover:text-white dark:group-hover:bg-[#A21F3D]"
                                }`}
                              >
                                <YearIcon className="w-4 h-4" />
                              </span>
                              <div className="min-w-0">
                                <span className="font-semibold text-xs sm:text-sm block leading-tight truncate">
                                  {y.label}
                                </span>
                                <span className={`text-[10px] sm:text-[11px] truncate block ${isNavigated ? "text-white/80" : "text-[#666666] dark:text-[#858585]"}`}>
                                  {y.subtitle}
                                </span>
                              </div>
                            </div>
                            <span className={`text-xs font-semibold group-hover:translate-x-0.5 transition-transform shrink-0 ml-2 ${isNavigated ? "text-white" : "text-[#999999] group-hover:text-[#8F1D32] dark:group-hover:text-[#A21F3D]"}`}>
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

          {/* QUICK ACCESS (Recent Notes, Important Documents, etc.) */}
          <QuickAccess onScrollToNotes={scrollToNotes} />

          {/* CONTINUE READING (Only shows if user has genuine reading progress) */}
          <ContinueReading
            onOpenDocument={(doc) => {
              setActiveGlobalDoc({ doc, subject: null });
            }}
          />

          {/* MAIN NOTES & SUBJECTS SECTION */}
          <NotesSection
            selectedYear={selectedYear}
            onYearChange={handleYearClick}
            subjects={subjects}
            loading={loading}
            isAdmin={isAdmin}
            onOpenAdmin={handleAdminClick}
            activeSubject={activeSubject}
            onSubjectChange={handleSubjectChange}
            onOpenDocumentDirect={(doc, subj) => {
              setActiveGlobalDoc({ doc, subject: subj });
            }}
          />

          {/* 5. FEEDBACK SECTION (Compact & Non-intrusive) */}
          <section className="w-full max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 border-t border-[#EDEDED] dark:border-[#292929]">
            <div className="max-w-md mx-auto p-5 sm:p-6 rounded-2xl bg-[#FAFAFA] dark:bg-[#151515] border border-[#EDEDED] dark:border-[#292929] text-center shadow-subtle dark:shadow-subtle-dark">
              <h2 className="text-sm sm:text-base font-bold text-[#151515] dark:text-white mb-1 tracking-tight">
                Help improve JITS Notes
              </h2>
              <p className="text-xs text-[#666666] dark:text-[#858585] mb-4 leading-relaxed">
                Found an issue, missing notes, or have an academic suggestion?
              </p>
              <button
                type="button"
                onClick={handleSendFeedback}
                className="inline-flex items-center justify-center bg-[#8F1D32] hover:bg-[#74152A] text-white px-5 py-2 rounded-xl font-semibold text-xs shadow-xs transition-colors min-h-[38px] cursor-pointer"
              >
                Send Feedback
              </button>
            </div>
          </section>
        </main>
      ) : (
        <Suspense fallback={<div className="min-h-[50vh]" />}>
          <NotFoundPage />
        </Suspense>
      )}

      {/* 7. FOOTER — STRUCTURED MULTI-COLUMN ARCHITECTURE */}
      <footer className="w-full bg-white dark:bg-[#0B0B0B] border-t border-[#EDEDED] dark:border-[#292929] pt-10 pb-8 transition-colors duration-150">
        <div className="w-full max-w-content mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-8 border-b border-[#EDEDED] dark:border-[#292929]">
            
            {/* Column 1: Brand & Subtitle */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2.5">
                <img
                  src="/icons.png"
                  alt="JITS Notes logo"
                  width="28"
                  height="28"
                  className="w-7 h-7 rounded-lg object-cover border border-[#EDEDED] dark:border-[#292929] shrink-0"
                />
                <h3 className="font-bold text-base tracking-tight leading-tight">
                  <span className="text-[#151515] dark:text-white">JITS </span>
                  <span className="text-[#8F1D32] dark:text-[#A21F3D]">Notes</span>
                </h3>
              </div>
              <p className="text-xs text-[#666666] dark:text-[#858585] max-w-sm leading-relaxed">
                Academic study material repository for B.Tech Computer Science & Engineering (CSE) and Artificial Intelligence & Machine Learning (AIML) students following JNTUH R22.
              </p>
              <div className="pt-1 flex items-center gap-3">
                <a
                  href="https://github.com/mohddanish305"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="p-1.5 rounded-lg text-[#666666] dark:text-[#858585] hover:text-[#151515] dark:hover:text-white hover:bg-[#F7F7F7] dark:hover:bg-[#151515] transition-colors"
                >
                  <FaGithub className="w-4 h-4" />
                </a>
                <a
                  href="https://www.linkedin.com/in/mohd-danish-986a5b2a3/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="p-1.5 rounded-lg text-[#666666] dark:text-[#858585] hover:text-[#151515] dark:hover:text-white hover:bg-[#F7F7F7] dark:hover:bg-[#151515] transition-colors"
                >
                  <FaLinkedin className="w-4 h-4" />
                </a>
                <a
                  href="mailto:23c41a05a1@jits.in"
                  aria-label="Email support"
                  className="p-1.5 rounded-lg text-[#666666] dark:text-[#858585] hover:text-[#151515] dark:hover:text-white hover:bg-[#F7F7F7] dark:hover:bg-[#151515] transition-colors"
                >
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Column 2: Academic Navigation */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#151515] dark:text-white mb-3">
                Academic
              </h4>
              <ul className="space-y-2 text-xs text-[#666666] dark:text-[#B5B5B5]">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      if (location.pathname !== "/") {
                        navigate("/", { state: { scrollTo: "notes-section" } });
                      } else {
                        scrollToNotes();
                      }
                    }}
                    className="hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors text-left"
                  >
                    Curriculum Notes
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleYearClick(1)}
                    className="hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors text-left"
                  >
                    1st Year Subjects
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleYearClick(2)}
                    className="hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors text-left"
                  >
                    2nd Year Subjects
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleYearClick(3)}
                    className="hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors text-left"
                  >
                    3rd Year Subjects
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleYearClick(4)}
                    className="hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors text-left"
                  >
                    4th Year Subjects
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: About & Support */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#151515] dark:text-white mb-3">
                About & Help
              </h4>
              <ul className="space-y-2 text-xs text-[#666666] dark:text-[#B5B5B5]">
                <li>
                  <button
                    type="button"
                    onClick={() => navigate("/about")}
                    className="hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors text-left"
                  >
                    About JITS Notes
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={handleSendFeedback}
                    className="hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors text-left"
                  >
                    Send Feedback
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate("/contact")}
                    className="hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors text-left"
                  >
                    Contact Maintainers
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={handleAdminClick}
                    className="hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors text-left"
                  >
                    Admin Portal
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: Legal & Policies */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#151515] dark:text-white mb-3">
                Legal & Policy
              </h4>
              <ul className="space-y-2 text-xs text-[#666666] dark:text-[#B5B5B5]">
                <li>
                  <button
                    type="button"
                    onClick={() => navigate("/privacy-policy")}
                    className="hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors text-left"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate("/terms")}
                    className="hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors text-left"
                  >
                    Terms & Conditions
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate("/cookie-policy")}
                    className="hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors text-left"
                  >
                    Cookie Policy
                  </button>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 text-[11px] text-[#858585]">
            <p>© 2026 JITS Notes. Built for B.Tech CSE & AIML students.</p>
            <p className="flex items-center gap-1.5">
              <span>Academic regulation: JNTUH R22</span>
            </p>
          </div>
        </div>
      </footer>



      {/* GLOBAL SEARCH OPENED PDF VIEWER */}
      {activeGlobalDoc && (
        <PdfViewerModal
          document={activeGlobalDoc.doc}
          subject={activeGlobalDoc.subject}
          yearLabel={activeGlobalDoc.subject ? `Year ${activeGlobalDoc.subject.year_id || 1}` : null}
          onClose={() => setActiveGlobalDoc(null)}
        />
      )}

      {/* FEEDBACK MODAL */}
      <Modal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        title="Send Feedback"
      >
        <form onSubmit={handleFeedbackSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#666666] dark:text-[#B3B3B3] mb-1.5">Name</label>
            <input
              type="text"
              name="name"
              value={feedbackForm.name}
              onChange={handleFeedbackChange}
              required
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#111111] border border-[#EAEAEA] dark:border-[#222222] rounded-xl focus:border-[#111111] dark:focus:border-white text-sm text-[#111111] dark:text-white outline-none transition"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#666666] dark:text-[#B3B3B3] mb-1.5">Email</label>
            <input
              type="email"
              name="email"
              value={feedbackForm.email}
              onChange={handleFeedbackChange}
              required
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#111111] border border-[#EAEAEA] dark:border-[#222222] rounded-xl focus:border-[#111111] dark:focus:border-white text-sm text-[#111111] dark:text-white outline-none transition"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#666666] dark:text-[#B3B3B3] mb-1.5">Message</label>
            <textarea
              name="message"
              value={feedbackForm.message}
              onChange={handleFeedbackChange}
              required
              rows={4}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#111111] border border-[#EAEAEA] dark:border-[#222222] rounded-xl focus:border-[#111111] dark:focus:border-white text-sm text-[#111111] dark:text-white outline-none transition resize-none"
              placeholder="Your feedback or suggestion..."
            />
          </div>
          <button
            type="submit"
            disabled={isFeedbackSubmitting}
            className="w-full bg-[#111111] hover:bg-[#262626] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-black py-2.5 rounded-xl font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {isFeedbackSubmitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </form>
      </Modal>

      {/* ADMIN LOGIN MODAL */}
      <Modal isOpen={isAdminLoginOpen} onClose={() => setIsAdminLoginOpen(false)} title="Admin Login">
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#666666] dark:text-[#B3B3B3] mb-1.5">Email</label>
            <input
              type="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#111111] border border-[#EAEAEA] dark:border-[#222222] rounded-xl focus:border-[#111111] dark:focus:border-white text-sm text-[#111111] dark:text-white outline-none transition"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#666666] dark:text-[#B3B3B3] mb-1.5">Password</label>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              required
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#111111] border border-[#EAEAEA] dark:border-[#222222] rounded-xl focus:border-[#111111] dark:focus:border-white text-sm text-[#111111] dark:text-white outline-none transition"
              placeholder="••••••••"
            />
          </div>
          {loginError && (
            <p className="text-[#DC2626] text-xs font-medium">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={isSigningIn}
            className="w-full py-2.5 rounded-xl font-semibold text-xs transition-colors bg-[#111111] hover:bg-[#262626] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-black disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {isSigningIn ? "Signing In..." : "Sign In"}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#EAEAEA] dark:border-[#222222]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider text-[#8A8A8A] font-bold">
              <span className="bg-white dark:bg-[#0A0A0A] px-3">or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 border border-[#EAEAEA] dark:border-[#222222] bg-white dark:bg-[#111111] py-2.5 rounded-xl font-semibold text-xs text-[#111111] dark:text-white hover:bg-[#F2F2F2] dark:hover:bg-[#171717] transition-colors min-h-[44px]"
          >
            <span className="text-sm font-bold text-[#111111] dark:text-white">G</span>
            Continue with Google
          </button>
        </form>
      </Modal>
    </div>
  );
}
