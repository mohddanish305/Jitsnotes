import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";

export default function Modal({ isOpen, onClose, title, children, sizeClassName = "max-w-md" }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={onClose}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className={`w-full ${sizeClassName} max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-gray-150 dark:border-gray-800 bg-white dark:bg-[#111827] shadow-2xl pointer-events-auto`}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 px-5 py-4 sm:px-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-[#F8FAFC] leading-tight">{title}</h2>
                <motion.button
                  onClick={onClose}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-850 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors flex-shrink-0 ml-4"
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>
              {/* Content */}
              <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
