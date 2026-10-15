import { useState } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { useShell } from "./ShellContext";

/** Shared job mutations used by the board, lists and detail page. Returns
 *  `actions` for JobCard plus confirm/move dialog state. */
export function useJobActions({ onChanged, onDeletedForever } = {}) {
  const { openJobForm, handleRewards, bump } = useShell();
  const [confirm, setConfirm] = useState(null); // {title, message, onConfirm, danger, confirmLabel}
  const [moving, setMoving] = useState(null); // job

  const done = (data) => {
    if (data?.rewards) handleRewards(data.rewards);
    onChanged?.(data?.job);
    bump();
  };
  const run = async (fn, success) => {
    try {
      const { data } = await fn();
      if (success) toast.success(success);
      done(data);
      return data;
    } catch (err) {
      toast.error(errorMessage(err));
      return null;
    }
  };

  const actions = {
    edit: (job) => openJobForm(job),
    setStatus: (job, status) => run(() => api.post(`/jobs/${job.id}/status`, { status }), status === "Archived" ? "Archived" : `Moved to ${status}`),
    followUp: (job) => run(() => api.post(`/jobs/${job.id}/follow-up`), "Follow-up recorded — nice work!"),
    rate: (job, priority_score) => run(() => api.patch(`/jobs/${job.id}`, { priority_score })),
    move: (job) => setMoving(job),
    restore: (job) => run(() => api.post(`/jobs/${job.id}/restore`), "Job restored"),
    offer: (job, decision) =>
      setConfirm({
        title: decision === "accept" ? "Accept this offer? 🎉" : "Decline this offer?",
        message: decision === "accept"
          ? `${job.job_name} at ${job.company_name} will be marked accepted and moved to Archived.`
          : "It will be marked as declined and moved to Archived.",
        confirmLabel: decision === "accept" ? "Accept offer" : "Decline",
        danger: decision !== "accept",
        onConfirm: () => run(() => api.post(`/jobs/${job.id}/offer`, { decision }), decision === "accept" ? "Congratulations on your offer!" : "Offer declined"),
      }),
    remove: (job) =>
      job.status === "Deleted"
        ? setConfirm({
            title: "Delete forever?",
            message: "This permanently removes the job, its interviews and documents. This can't be undone.",
            confirmLabel: "Delete forever",
            danger: true,
            onConfirm: async () => {
              try {
                await api.delete(`/jobs/${job.id}/permanent`);
                toast.success("Deleted");
                onDeletedForever?.(job);
                bump();
              } catch (err) {
                toast.error(errorMessage(err));
              }
            },
          })
        : run(() => api.delete(`/jobs/${job.id}`).then(() => ({ data: {} })), "Moved to bin — restore it anytime"),
  };
  return { actions, confirm, setConfirm, moving, setMoving };
}
