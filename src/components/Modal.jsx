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
            <div className={`w-full ${sizeClassName} max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-[#EDEDED] dark:border-[#292929] bg-white dark:bg-[#151515] shadow-2xl pointer-events-auto`}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#EDEDED] dark:border-[#292929] px-5 py-4 sm:px-6 bg-white dark:bg-[#151515]">
                <h2 className="text-lg sm:text-xl font-bold text-[#151515] dark:text-white leading-tight">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F7F7F7] dark:bg-[#1B1B1B] hover:bg-[#FCF4F5] dark:hover:bg-[#241217] text-[#666666] dark:text-[#B5B5B5] hover:text-[#8F1D32] dark:hover:text-[#A21F3D] transition-colors flex-shrink-0 ml-4 cursor-pointer"
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Content */}
              <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 bg-white dark:bg-[#151515] text-[#151515] dark:text-white">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
