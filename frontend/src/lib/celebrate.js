import confetti from "canvas-confetti";
import { toast } from "sonner";
import { ACTION_META } from "./constants";

const burst = (big) =>
  confetti({ particleCount: big ? 160 : 70, spread: big ? 100 : 60, origin: { y: 0.7 }, colors: ["#76BC21", "#C49C48", "#4A8C8E", "#ffffff"], disableForReducedMotion: true });

/** Show toasts/confetti for the `rewards` payload every mutating endpoint returns. */
export function celebrate(rewards, onTokens) {
  if (!rewards) return;
  const { missions_completed = [], goals_completed = [], badges_unlocked = [], points_earned = 0 } = rewards;
  missions_completed.forEach((m) => toast.success(`Mission complete: ${m.name}`, { description: `+${m.points} points & tokens` }));
  goals_completed.forEach((g) =>
    toast.success(`${g.goal_type === "daily" ? "Daily" : "Weekly"} goal reached!`, {
      description: `${ACTION_META[g.action_type]?.emoji || "🎯"} ${g.target} × ${ACTION_META[g.action_type]?.label || g.action_type}`,
    })
  );
  badges_unlocked.forEach((b) => toast(`${b.icon} Badge unlocked: ${b.name}`, { description: b.description }));
  if (badges_unlocked.length || missions_completed.some((m) => m.points >= 100)) burst(true);
  else if (missions_completed.length || goals_completed.length) burst(false);
  if (points_earned && onTokens) onTokens();
}
