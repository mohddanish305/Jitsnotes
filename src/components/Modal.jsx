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
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={onClose}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className={`w-full ${sizeClassName} max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-[#E5E5E5] dark:border-[#292E3A] bg-white dark:bg-[#14171F] shadow-2xl pointer-events-auto`}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#E5E5E5] dark:border-[#292E3A] px-5 py-4 sm:px-6 bg-white dark:bg-[#10131A]">
                <h2 className="text-lg sm:text-xl font-bold text-[#000000] dark:text-[#FFFFFF] leading-tight">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F7F8FA] dark:bg-[#1A1E28] hover:bg-gray-200 dark:hover:bg-[#292E3A] text-[#555555] dark:text-[#B8BDCA] hover:text-[#000000] dark:hover:text-[#FFFFFF] transition-colors flex-shrink-0 ml-4"
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Content */}
              <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 bg-white dark:bg-[#14171F] text-[#000000] dark:text-[#FFFFFF]">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
