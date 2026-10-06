import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const friendlyError = (error, fallback) => {
  const message = String(error?.message || "").trim();
  if (/rate.*limit|429/i.test(message)) {
    return "Too many requests. Please wait and try again.";
  }
  if (/session.*expired|sign in again|unauthorized|401/i.test(message)) {
    return "Your session has expired. Please sign in again.";
  }
  if (/permission|forbidden|403/i.test(message)) {
    return "You do not have permission to remove this Teacher Admin.";
  }
  if (/not found|no longer exists|404/i.test(message)) {
    return "Teacher Admin not found.";
  }
  if (/conflict|conflicting|409/i.test(message)) {
    return "Teacher Admin could not be removed because of a conflicting record.";
  }
  if (/unable to remove|500/i.test(message)) {
    return "Unable to remove Teacher Admin. Please try again.";
  }
  if (message && message !== "Operation failed." && !message.includes("non-2xx status code")) {
    return message;
  }
  return fallback || message || "Unable to remove Teacher Admin. Please try again.";
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
};

export default function AdminTeachers() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(user?.id || null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  // Synchronous deduplication refs to prevent double clicks / double submits
  const isSubmittingRef = useRef(false);
  const activeActionsRef = useRef(new Set());

  // Modals
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    teacher_name: "",
    is_super_admin: false,
  });

  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm, confirmText, danger }

  const notify = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const callApi = async (body) => {
    const { data, error: functionError } = await supabase.functions.invoke("admin-teachers", { body });
    if (functionError) {
      let message = functionError.message || "Operation failed.";
      if (functionError.context) {
        try {
          if (typeof functionError.context.json === "function") {
            const bodyData = await functionError.context.json();
            if (bodyData?.error) message = bodyData.error;
            else if (bodyData?.message) message = bodyData.message;
          } else if (typeof functionError.context.text === "function") {
            const textData = await functionError.context.text();
            try {
              const parsed = JSON.parse(textData);
              if (parsed?.error) message = parsed.error;
              else if (parsed?.message) message = parsed.message;
            } catch {
              if (textData) message = textData;
            }
          }
        } catch {
          // keep functionError.message
        }
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCurrentUserId(user?.id || null);
      const data = await callApi({ action: "list" });
      setProfiles(data.profiles || []);
      setInvitations(data.invitations || []);
    } catch (err) {
      console.error("[AdminTeachers] Load error:", err);
      setError(friendlyError(err, "Unable to load administrator accounts."));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (saving || isSubmittingRef.current) return;

    const email = inviteForm.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notify("error", "Enter a valid email address.");
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);
    console.log("[AdminTeachers] send started");
    console.log("[AdminTeachers] send request for", email);

    try {
      await callApi({
        action: "invite",
        email,
        teacher_name: inviteForm.teacher_name.trim(),
        role: "teacher_admin",
        is_super_admin: false,
      });
      console.log("[AdminTeachers] send success");
      setInviteOpen(false);
      setInviteForm({ email: "", teacher_name: "", is_super_admin: false });
      await loadData();
      notify("success", "Invitation sent successfully.");
    } catch (err) {
      console.error("[AdminTeachers] send failed:", err);
      notify("error", friendlyError(err, "Failed to send invitation."));
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  const handleToggleActive = (profile) => {
    if (profile.id === currentUserId) {
      notify("error", "You cannot disable your own administrator account.");
      return;
    }

    const nextActive = profile.is_active === false;
    const actionName = nextActive ? "activate" : "deactivate";

    setConfirmModal({
      title: nextActive ? "Enable Administrator" : "Disable Administrator",
      message: nextActive
        ? `Enable access for ${profile.email}? They will be able to manage academic content.`
        : `Disable access for ${profile.email}? They will no longer be able to log in or manage content.`,
      confirmText: nextActive ? "Enable Account" : "Disable Account",
      danger: !nextActive,
      onConfirm: async () => {
        if (saving || activeActionsRef.current.has(profile.id)) return;
        activeActionsRef.current.add(profile.id);
        setActionLoadingId(profile.id);
        setSaving(true);
        try {
          await callApi({
            action: actionName,
            user_id: profile.id,
            target_user_id: profile.id,
          });
          await loadData();
          notify("success", nextActive ? "Administrator enabled." : "Administrator disabled.");
        } catch (err) {
          notify("error", friendlyError(err, "Action failed."));
        } finally {
          activeActionsRef.current.delete(profile.id);
          setActionLoadingId(null);
          setSaving(false);
          setConfirmModal(null);
        }
      },
    });
  };

  const handleChangeRole = (profile) => {
    if (profile.id === currentUserId) {
      notify("error", "You cannot modify your own administrator role.");
      return;
    }

    const nextSuper = !profile.is_super_admin;
    setConfirmModal({
      title: "Change Administrator Role",
      message: nextSuper
        ? `Promote ${profile.email} to Super Admin? They will have full administrative access including admin management.`
        : `Demote ${profile.email} to Teacher Admin? They will only manage academic content.`,
      confirmText: nextSuper ? "Promote to Super Admin" : "Demote to Teacher Admin",
      danger: false,
      onConfirm: async () => {
        if (saving || activeActionsRef.current.has(profile.id)) return;
        activeActionsRef.current.add(profile.id);
        setActionLoadingId(profile.id);
        setSaving(true);
        try {
          await callApi({
            action: "change_role",
            user_id: profile.id,
            target_user_id: profile.id,
            is_super_admin: nextSuper,
          });
          await loadData();
          notify("success", "Role updated successfully.");
        } catch (err) {
          notify("error", friendlyError(err, "Failed to update role."));
        } finally {
          activeActionsRef.current.delete(profile.id);
          setActionLoadingId(null);
          setSaving(false);
          setConfirmModal(null);
        }
      },
    });
  };

  const handleRemove = (profile) => {
    if (profile.id === currentUserId) {
      notify("error", "You cannot remove your own administrator account.");
      return;
    }
    if (profile.is_super_admin) {
      notify("error", "Super Administrator accounts cannot be removed directly.");
      return;
    }

    setConfirmModal({
      title: "Remove Teacher Admin",
      message: `Permanently remove administrator privileges for ${profile.email}? This action cannot be undone.`,
      confirmText: "Remove Account",
      danger: true,
      onConfirm: async () => {
        if (saving || activeActionsRef.current.has(profile.id)) return;
        activeActionsRef.current.add(profile.id);
        setActionLoadingId(profile.id);
        setSaving(true);

        // Safe debug logging only (no secrets/passwords/tokens/keys)
        console.log("[AdminTeachers] remove request:", {
          action: "remove",
          user_id: profile.id,
          role: "teacher_admin",
        });

        try {
          const res = await callApi({
            action: "remove",
            user_id: profile.id,
            target_user_id: profile.id,
          });
          await loadData();
          notify("success", res?.message || "Teacher Admin removed successfully.");
        } catch (err) {
          console.error("[AdminTeachers] remove failed:", err);
          notify("error", friendlyError(err, "Unable to remove Teacher Admin. Please try again."));
        } finally {
          activeActionsRef.current.delete(profile.id);
          setActionLoadingId(null);
          setSaving(false);
          setConfirmModal(null);
        }
      },
    });
  };

  const handleCancelInvite = (invitation) => {
    if (saving || actionLoadingId || activeActionsRef.current.has(invitation.id)) return;

    setConfirmModal({
      title: "Cancel Invitation",
      message: `Cancel pending invitation for ${invitation.email}? This will revoke the pending invitation and allow this email to be re-invited at any time.`,
      confirmText: "Cancel Invitation",
      danger: true,
      onConfirm: async () => {
        if (activeActionsRef.current.has(invitation.id)) return;
        activeActionsRef.current.add(invitation.id);
        setSaving(true);
        setActionLoadingId(invitation.id);
        console.log("[AdminTeachers] cancel started for", invitation.email);

        try {
          await callApi({ action: "cancel", invitation_id: invitation.id });
          console.log("[AdminTeachers] cancel success");
          await loadData();
          notify("success", "Invitation cancelled successfully. This email can now be re-invited.");
        } catch (err) {
          console.error("[AdminTeachers] cancel failed:", err);
          notify("error", friendlyError(err, "Failed to cancel invitation."));
        } finally {
          activeActionsRef.current.delete(invitation.id);
          setSaving(false);
          setActionLoadingId(null);
          setConfirmModal(null);
        }
      },
    });
  };

  const handleResendInvite = async (invitation) => {
    if (saving || actionLoadingId || activeActionsRef.current.has(invitation.id)) return;

    activeActionsRef.current.add(invitation.id);
    setSaving(true);
    setActionLoadingId(invitation.id);
    console.log("[AdminTeachers] resend started for", invitation.email);

    try {
      await callApi({ action: "resend", email: invitation.email });
      console.log("[AdminTeachers] resend success");
      await loadData();
      notify("success", "Invitation resent successfully.");
    } catch (err) {
      console.error("[AdminTeachers] resend failed:", err);
      notify("error", friendlyError(err, "Failed to resend invitation."));
    } finally {
      activeActionsRef.current.delete(invitation.id);
      setSaving(false);
      setActionLoadingId(null);
    }
  };

  const pendingInvitations = invitations.filter(
    (inv) =>
      inv.status === "pending" &&
      !profiles.some((p) => p.email?.toLowerCase() === inv.email?.toLowerCase())
  );

  return (
    <section className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-xl border px-4 py-3 text-sm font-semibold shadow-xl transition-all ${
            toast.type === "error"
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/80 dark:text-red-200"
              : "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/80 dark:text-green-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-[#292E3A] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#111111] dark:text-[#B3B3B3]">
            Administration
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Teachers & Admins
          </h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-[#858B99]">
            Manage authorized administrative roles and invitations for JITS Notes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111111] hover:bg-[#222222] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-[#111111] px-4 py-2.5 text-xs font-medium transition"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Invite Admin
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadData}
            className="rounded-lg border border-red-300 px-3 py-1 font-semibold hover:bg-red-100 dark:border-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table Content */}
      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-gray-100 dark:bg-[#14171F]" />
      ) : profiles.length === 0 && pendingInvitations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center text-xs text-gray-500 dark:border-[#292E3A] dark:text-[#858B99]">
          No administrator records found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-[#292E3A] dark:bg-[#14171F]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-gray-200 bg-[#F7F8FA] font-bold uppercase tracking-wider text-gray-500 dark:border-[#292E3A] dark:bg-[#10131A] dark:text-[#858B99]">
                <tr>
                  <th className="px-5 py-3.5">Administrator</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Created</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#1F2430]">
                {profiles.map((profile) => {
                  const isCurrent = profile.id === currentUserId;
                  const isSuper = profile.is_super_admin === true;
                  const isActive = profile.is_active !== false;

                  return (
                    <tr key={profile.id} className="hover:bg-gray-50/50 dark:hover:bg-[#171B24]/50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white">
                            {profile.email}
                          </span>
                          {isCurrent && (
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            isSuper
                              ? "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                          }`}
                        >
                          {isSuper ? "Super Admin" : "Teacher Admin"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            isActive
                              ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"
                              : "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isActive ? "bg-green-500" : "bg-orange-500"
                            }`}
                          />
                          {isActive ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-500 dark:text-[#858B99]">
                        {formatDate(profile.created_at)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isCurrent ? (
                            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-600">
                              Current User
                            </span>
                          ) : isSuper ? (
                            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-600">
                              Protected
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={saving || Boolean(actionLoadingId)}
                                onClick={() => handleToggleActive(profile)}
                                className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-[#292E3A] dark:text-[#B8BDCA] dark:hover:bg-[#1A1E28]"
                              >
                                {actionLoadingId === profile.id && saving ? "Updating..." : isActive ? "Disable" : "Enable"}
                              </button>
                              <button
                                type="button"
                                disabled={saving || Boolean(actionLoadingId)}
                                onClick={() => handleChangeRole(profile)}
                                className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-[#292E3A] dark:text-[#B8BDCA] dark:hover:bg-[#1A1E28]"
                              >
                                Change Role
                              </button>
                              <button
                                type="button"
                                disabled={saving || Boolean(actionLoadingId)}
                                onClick={() => handleRemove(profile)}
                                className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/20"
                              >
                                {actionLoadingId === profile.id && saving ? "Removing..." : "Remove"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Pending Invitations Section */}
                {pendingInvitations.map((invitation) => (
                  <tr key={invitation.id} className="bg-blue-50/20 dark:bg-[#171B24]/30">
                    <td className="px-5 py-4">
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {invitation.email}
                        </span>
                        {invitation.teacher_name && (
                          <span className="ml-2 text-[11px] text-gray-500 dark:text-[#858B99]">
                            ({invitation.teacher_name})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                        Teacher Admin
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-yellow-50 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300">
                        Pending Invite
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 dark:text-[#858B99]">
                      Expires {formatDate(invitation.expires_at)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={saving || Boolean(actionLoadingId)}
                          onClick={() => handleResendInvite(invitation)}
                          className="rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-[#292E3A] dark:text-[#B8BDCA] dark:hover:bg-[#1A1E28]"
                        >
                          {actionLoadingId === invitation.id && saving ? "Resending..." : "Resend"}
                        </button>
                        <button
                          type="button"
                          disabled={saving || Boolean(actionLoadingId)}
                          onClick={() => handleCancelInvite(invitation)}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/20"
                        >
                          {actionLoadingId === invitation.id && saving ? "Cancelling..." : "Cancel"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-[#292E3A] dark:bg-[#14171F]"
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-[#292E3A]">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Invite Administrator
                </h2>
                <p className="text-xs text-gray-500 dark:text-[#858B99]">
                  Send a single-use expiring invitation
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInvite} className="mt-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-[#B8BDCA]">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="teacher@institution.edu"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-900 focus:border-[#111111] dark:focus:border-white focus:outline-hidden dark:border-[#292E3A] dark:bg-[#171B24] dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-[#B8BDCA]">
                  Teacher Name <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Ramesh Kumar"
                  value={inviteForm.teacher_name}
                  onChange={(e) =>
                    setInviteForm((prev) => ({ ...prev, teacher_name: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-900 focus:border-[#111111] dark:focus:border-white focus:outline-hidden dark:border-[#292E3A] dark:bg-[#171B24] dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-[#B8BDCA]">
                  Role Assignment
                </label>
                <select
                  disabled
                  value="teacher"
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs text-gray-800 cursor-not-allowed dark:border-[#292E3A] dark:bg-[#1A1E28] dark:text-[#E4E7EB]"
                >
                  <option value="teacher">Teacher Admin (Academic Content Only)</option>
                </select>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-[#858B99]">
                  New invitations grant Teacher Admin rights for academic content management.
                </p>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
                Supabase Auth will dispatch a single-use invitation email with an expiring token.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  disabled={saving}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 font-bold text-gray-700 hover:bg-gray-50 dark:border-[#292E3A] dark:text-[#B8BDCA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#111111] hover:bg-[#222222] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-[#111111] disabled:opacity-50 px-5 py-2.5 font-medium"
                >
                  {saving ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-[#292E3A] dark:bg-[#14171F]"
          >
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {confirmModal.title}
            </h2>
            <p className="mt-2 text-xs text-gray-600 dark:text-[#858B99]">
              {confirmModal.message}
            </p>
            <div className="mt-5 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={saving}
                className="rounded-xl border border-gray-200 px-4 py-2.5 font-bold text-gray-700 hover:bg-gray-50 dark:border-[#292E3A] dark:text-[#B8BDCA]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                disabled={saving}
                className={`rounded-xl px-4 py-2.5 font-bold text-white disabled:opacity-50 ${
                  confirmModal.danger
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#111111] hover:bg-[#222222] text-white dark:bg-white dark:hover:bg-[#EAEAEA] dark:text-[#111111]"
                }`}
              >
                {saving ? "Processing..." : confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
