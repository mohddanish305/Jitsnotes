import { memo } from "react";
import { motion } from "framer-motion";

const HeroSection = memo(function HeroSection({ selectedYear, setSelectedYear }) {
  const scrollToNotes = () => {
    const section = document.getElementById("notes-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleYearSelect = (index) => {
    const yearNum = index + 1;
    setSelectedYear(yearNum);
    scrollToNotes();
  };

  const buttonTransition = {
    type: "spring",
    stiffness: 400,
    damping: 17,
  };

  const cardTransition = {
    type: "spring",
    stiffness: 300,
    damping: 20,
  };

  return (
    <motion.section
      initial={false}
      animate={{ opacity: 1 }}
      className="relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50 to-gray-100" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--gradient-stop))] from-gray-100/60 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <motion.div
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-3"
          >
            <motion.div
              whileHover={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 0.4 }}
              className="w-10 h-10 rounded-xl shadow-lg overflow-hidden"
            >
              <img src="/icons.webp" alt="JITS Notes logo" width="40" height="40" decoding="async" fetchPriority="high" className="w-full h-full object-cover" />
            </motion.div>
            <div>
              <h1 className="font-semibold text-lg tracking-tight">JITS Notes</h1>
              <p className="text-xs text-gray-500 font-medium">Free Learning Platform</p>
            </div>
          </motion.div>

          <motion.nav
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="hidden md:flex gap-8 text-sm font-medium text-gray-600"
          >
            {["Notes", "Resources", "Feedback"].map((item, i) => (
              <motion.a
                key={i}
                href="#"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                transition={buttonTransition}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                {item}
              </motion.a>
            ))}
          </motion.nav>
        </div>

        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 mt-8"
        >
          <motion.button
            onClick={scrollToNotes}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={buttonTransition}
            className="bg-black text-white px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all w-full sm:w-auto text-sm sm:text-base"
          >
            Browse Notes
          </motion.button>

          <motion.button
            onClick={() => {
              const section = document.getElementById("resources-section");
              if (section) {
                section.scrollIntoView({ behavior: "smooth" });
              }
            }}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={buttonTransition}
            className="border border-gray-300 bg-white/80 hover:bg-white px-6 py-3.5 sm:px-8 sm:py-4 rounded-xl font-medium hover:border-gray-400 hover:shadow-lg transition-all w-full sm:w-auto text-sm sm:text-base backdrop-blur-sm"
          >
            View Resources
          </motion.button>
        </motion.div>
      </div>

      {/* Year Selection Card */}
      <motion.div
        initial={false}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="flex justify-center lg:justify-end px-4 sm:px-6 lg:px-8 -mt-8"
      >
        <motion.div
          initial="rest"
          whileHover="hover"
          variants={{
            rest: { scale: 1, y: 0 },
            hover: { scale: 1.02, y: -6 }
          }}
          transition={cardTransition}
          className="w-full max-w-md bg-white/75 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-gray-200/60 shadow-xl hover:shadow-2xl transition-all duration-300"
        >
          <div className="space-y-2">
            {["First Year", "Second Year", "Third Year", "Fourth Year"].map((yearLabel, i) => {
              const yearNum = i + 1;
              const isActive = selectedYear === yearNum;
              return (
                <motion.div
                  key={i}
                  initial={false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => handleYearSelect(i)}
                  className={`group flex items-center justify-between p-3 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
                    isActive
                      ? "bg-black text-white border-black shadow-md"
                      : "bg-white/60 border-gray-200 hover:bg-white hover:shadow-lg"
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <motion.div
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.4 }}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-sm font-semibold ${
                        isActive ? "bg-white text-black" : "bg-black text-white"
                      }`}
                    >
                      {yearNum}
                    </motion.div>
                    <span className={`font-medium text-sm sm:text-base ${isActive ? "text-white" : "text-gray-800"}`}>
                      {yearLabel}
                    </span>
                  </div>
                  <motion.span
                    animate={{ x: isActive ? [0, 4, 0] : 0 }}
                    className={isActive ? "text-white" : "text-gray-400"}
                  >
                    →
                  </motion.span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </motion.section>
  );
});

export default HeroSection;

