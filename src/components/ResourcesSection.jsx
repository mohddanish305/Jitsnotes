import { motion } from "framer-motion";
import { FaFileAlt, FaFlask, FaGraduationCap, FaBriefcase, FaBook, FaArrowRight } from "./icons";

const PREVIEW_CATEGORIES = [
  {
    title: "Question Papers",
    desc: "Previous years' university exam questions for JNTUH R22 regulation.",
    icon: <FaFileAlt className="w-6 h-6 text-emerald-500" />,
    count: "R22 Exams"
  },
  {
    title: "Lab Manuals",
    desc: "Detailed instructions and experiments documentation for computer science and engineering laboratories.",
    icon: <FaFlask className="w-6 h-6 text-indigo-500" />,
    count: "All Semesters"
  },
  {
    title: "Syllabus Books",
    desc: "Official JNTUH R22 course syllabus structures and references for B.Tech.",
    icon: <FaGraduationCap className="w-6 h-6 text-amber-500" />,
    count: "R22 Regulation"
  },
  {
    title: "Placement Material",
    desc: "Aptitude, coding, interview guides, and reference material for placement preparation.",
    icon: <FaBriefcase className="w-6 h-6 text-rose-500" />,
    count: "Career Hub"
  }
];

export default function ResourcesSection({ onViewAll }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  return (
    <section id="resources-preview-section" className="max-w-[1400px] mx-auto px-4 sm:px-6 py-12 sm:py-16 transition-colors duration-300">
      <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-[#7DD3A7] text-xs font-semibold"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-550 dark:bg-[#7DD3A7]" />
          Additional Academic Materials
        </motion.div>
        
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-[#F8FAFC] mb-3"
        >
          Academic Resources Hub
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-xs sm:text-sm text-gray-500 dark:text-[#94A3B8] leading-relaxed"
        >
          Access syllabus books, past year question papers, lab manuals, and placement preparation resources curated specifically for JITS engineering students.
        </motion.p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 justify-center"
      >
        {PREVIEW_CATEGORIES.map((cat, i) => (
          <motion.article
            key={i}
            variants={itemVariants}
            whileHover={{ y: -6 }}
            className="flex flex-col justify-between p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] hover:bg-gray-50/50 dark:hover:bg-[#1E293B] shadow-sm hover:shadow-md transition-all duration-300"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-4 border border-gray-100 dark:border-gray-700/50">
                {cat.icon}
              </div>
              <h3 className="font-bold text-base text-gray-900 dark:text-[#F8FAFC] mb-2">{cat.title}</h3>
              <p className="text-xs text-gray-500 dark:text-[#94A3B8] leading-relaxed mb-4">{cat.desc}</p>
            </div>
            <span className="inline-flex w-fit rounded-full border border-gray-200 dark:border-gray-750 bg-gray-50 dark:bg-[#1E293B]/50 px-2.5 py-0.5 text-[10px] font-bold text-gray-500 dark:text-[#94A3B8] uppercase tracking-wider">
              {cat.count}
            </span>
          </motion.article>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-center mt-10"
      >
        <motion.button
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          onClick={onViewAll}
          className="inline-flex items-center gap-2 bg-black dark:bg-[#6366F1] text-white px-6 py-3 rounded-xl font-semibold text-sm hover:shadow-lg transition-all"
        >
          <span>Browse All Resources</span>
          <FaArrowRight className="w-3.5 h-3.5" />
        </motion.button>
      </motion.div>
    </section>
  );
}
