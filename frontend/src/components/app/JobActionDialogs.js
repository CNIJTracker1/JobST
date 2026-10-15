import { useState } from "react";
import { ALL_STATUSES, STATUS_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ConfirmDialog, Dialog } from "@/components/ui";

/** Renders the confirm + "move to" dialogs driven by useJobActions(). */
export default function JobActionDialogs({ confirm, setConfirm, moving, setMoving, actions }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          await confirm.onConfirm();
          setBusy(false);
          setConfirm(null);
        }}
      />
      <Dialog open={!!moving} onClose={() => setMoving(null)} title="Move to stage" description={moving ? `${moving.job_name} · ${moving.company_name}` : ""} size="sm">
        <div className="grid gap-2 pb-3">
          {ALL_STATUSES.filter((s) => s !== "Deleted").map((s) => (
            <button key={s} disabled={moving?.status === s}
              onClick={() => { actions.setStatus(moving, s); setMoving(null); }}
              className={cn("flex items-center justify-between rounded-xl border border-line px-4 py-3 text-left font-semibold transition hover:bg-surface-2 disabled:opacity-50")}>
              <span className="flex items-center gap-2.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].color }} />{s}</span>
              <span className="text-xs font-normal text-ink-muted">{moving?.status === s ? "Current" : STATUS_META[s].hint}</span>
            </button>
          ))}
        </div>
      </Dialog>
    </>
  );
}
