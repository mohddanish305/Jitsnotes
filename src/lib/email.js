import emailjs from '@emailjs/browser';

/**
 * Sends a feedback notification email via EmailJS to admin Gmail.
 * Runs AFTER feedback is successfully saved to Supabase.
 * If EmailJS is missing keys or fails, error is logged silently to console
 * without breaking user submission flow.
 */
export async function sendFeedbackEmailNotification({ name, email, message, createdAt }) {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.warn('[EmailJS] Missing environment variables (VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY). Email notification skipped.');
    return;
  }

  const templateParams = {
    from_name: name || 'Anonymous',
    from_email: email,
    name: name || 'Anonymous',
    email: email,
    reply_to: email,
    message: message,
    submitted_at: createdAt ? new Date(createdAt).toLocaleString() : new Date().toLocaleString(),
    time: new Date().toLocaleString(),
  };

  try {
    const response = await emailjs.send(serviceId, templateId, templateParams, publicKey);
    console.log('[EmailJS] Feedback email notification sent successfully:', response.status, response.text);
    return response;
  } catch (error) {
    console.error('[EmailJS] Failed to send feedback email notification:', error);
  }
}
