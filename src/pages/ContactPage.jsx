import { memo } from "react";
import LegalLayout from "../components/LegalLayout";
import { Mail, MessageSquare, Send } from "lucide-react";

export const ContactPage = memo(function ContactPage({ onOpenFeedback }) {
  return (
    <LegalLayout
      title="Contact & Support"
      subtitle="Reach out to the JITS Notes maintenance team for academic inquiries, corrections, or support."
      badge="Contact Information"
      lastUpdated="October 2026"
    >
      <section className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-[#151515] dark:text-white">Get in Touch</h2>
        <p>
          Whether you want to report a typo in syllabus notes, request study material for a specific subject, or contribute question papers, we welcome all communications.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Email Card */}
          <div className="p-5 rounded-2xl border border-[#EDEDED] dark:border-[#292929] bg-[#FAFAFA] dark:bg-[#151515] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#FCF4F5] dark:bg-[#241217] border border-[#F8E9EC] dark:border-[#381B22] text-[#8F1D32] dark:text-[#A21F3D] flex items-center justify-center mb-3">
                <Mail className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#151515] dark:text-white mb-1">Direct Email</h3>
              <p className="text-xs text-[#666666] dark:text-[#999999] mb-3">
                For general academic questions, copyright concerns, and platform support.
              </p>
            </div>
            <a
              href="mailto:23c41a05a1@jits.in"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8F1D32] dark:text-[#A21F3D] hover:underline"
            >
              <span>23c41a05a1@jits.in</span>
              <Send className="w-3 h-3" />
            </a>
          </div>

          {/* Feedback Modal Card */}
          <div className="p-5 rounded-2xl border border-[#EDEDED] dark:border-[#292929] bg-[#FAFAFA] dark:bg-[#151515] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#FCF4F5] dark:bg-[#241217] border border-[#F8E9EC] dark:border-[#381B22] text-[#8F1D32] dark:text-[#A21F3D] flex items-center justify-center mb-3">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#151515] dark:text-white mb-1">In-App Feedback</h3>
              <p className="text-xs text-[#666666] dark:text-[#999999] mb-3">
                Send notes corrections or suggest missing topics directly through our fast feedback modal.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenFeedback}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8F1D32] dark:text-[#A21F3D] hover:underline cursor-pointer"
            >
              <span>Open Feedback Form</span>
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3 pt-6 border-t border-[#EDEDED] dark:border-[#292929]">
        <h2 className="text-base sm:text-lg font-bold text-[#151515] dark:text-white">Response Time</h2>
        <p className="text-xs sm:text-sm text-[#666666] dark:text-[#B5B5B5]">
          As this is a student and faculty-supported educational platform, feedback and email inquiries are typically addressed within 24–48 hours. Urgent exam material requests are prioritized before mid-semester and end-semester university examinations.
        </p>
      </section>
    </LegalLayout>
  );
});

export default ContactPage;
