import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowUpCircle, Coins, Expand, Factory, Home, Landmark, Lock, Mountain, RotateCw, Route, Store, Trash2, Trees } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Button, Card, PageLoader } from "@/components/ui";

/* City Builder — port of game_screen.dart + city_game.dart (Flame).
   Buildings are drawn procedurally as isometric SVG blocks, so no image assets are needed. */

const W = 64; // tile width
const H = 32; // tile height
const CAT_ICONS = { housing: Home, roads: Route, commercial: Store, industrial: Factory, parks: Trees, terrain: Mountain };
const STYLE = {
  cottage: { top: "#F6D7A7", left: "#E2B77A", right: "#C99A5B", h: 18, roof: "#C0392B" },
  townhouse: { top: "#F3E3C3", left: "#D9C29A", right: "#BFA57A", h: 26, roof: "#8E44AD" },
  apartment: { top: "#D6E4F0", left: "#AFC6DC", right: "#8EABC6", h: 40 },
  road: { top: "#6B7280", flat: true, stripe: true },
  plaza: { top: "#D1D5DB", flat: true, tiles: true },
  cafe: { top: "#FDE68A", left: "#F5C451", right: "#D9A52B", h: 16, awning: "#E85D04" },
  shop: { top: "#FBCFE8", left: "#F49AC9", right: "#DB76AE", h: 20, awning: "#C2185B" },
  office: { top: "#C7D2FE", left: "#97A6F5", right: "#7383E0", h: 48 },
  workshop: { top: "#E5E7EB", left: "#C4C8CE", right: "#A3A8B0", h: 18 },
  factory: { top: "#D1D5DB", left: "#9CA3AF", right: "#7C838F", h: 24, chimney: true },
  tree: { tree: true, color: "#2D6A4F" },
  garden: { top: "#86EFAC", flat: true, flowers: true },
  fountain: { top: "#BAE6FD", flat: true, fountain: true },
  water: { top: "#38BDF8", flat: true, water: true },
  hill: { top: "#84CC16", left: "#65A30D", right: "#4D7C0F", h: 12 },
  rocks: { rocks: true },
};
const pretty = (k) => k.charAt(0).toUpperCase() + k.slice(1);

function iso(x, y, ox) {
  return [ox + (x - y) * (W / 2), (x + y) * (H / 2)];
}
const pts = (arr) => arr.map((p) => p.join(",")).join(" ");

function Block({ sx, sy, s, level, facing }) {
  const h = (s.h || 0) * (1 + (level - 1) * 0.45);
  const top = [[sx, sy - h], [sx + W / 2, sy + H / 2 - h], [sx, sy + H - h], [sx - W / 2, sy + H / 2 - h]];
  const left = [[sx - W / 2, sy + H / 2 - h], [sx, sy + H - h], [sx, sy + H], [sx - W / 2, sy + H / 2]];
  const right = [[sx, sy + H - h], [sx + W / 2, sy + H / 2 - h], [sx + W / 2, sy + H / 2], [sx, sy + H]];
  const doorOnLeft = facing === "sw" || facing === "nw";
  // Small parallelograms that follow each face's slope (left face slopes down-right, right face up-right)
  const facePoly = (cx, cy, w, hh, slope) => pts([[cx - w / 2, cy - (w / 2) * slope - hh], [cx + w / 2, cy + (w / 2) * slope - hh], [cx + w / 2, cy + (w / 2) * slope], [cx - w / 2, cy - (w / 2) * slope]]);
  const windows = [];
  const floors = Math.max(1, Math.floor(h / 12));
  for (let f = 0; f < floors; f++) {
    const cy = sy + (3 * H) / 4 - 7 - f * 12;
    windows.push(<polygon key={`l${f}`} points={facePoly(sx - W / 4 + (doorOnLeft && f === 0 ? 9 : 0), cy, 7, 5, 0.5)} fill="#fff" opacity=".7" />);
    windows.push(<polygon key={`r${f}`} points={facePoly(sx + W / 4 - (!doorOnLeft && f === 0 ? 9 : 0), cy, 7, 5, -0.5)} fill="#fff" opacity=".7" />);
  }
  const doorX = doorOnLeft ? sx - W / 4 - 4 : sx + W / 4 + 4;
  const doorY = sy + (3 * H) / 4 + (doorOnLeft ? -2 : -2);
  return (
    <g>
      <polygon points={pts(left)} fill={s.left} />
      <polygon points={pts(right)} fill={s.right} />
      <polygon points={pts(top)} fill={s.roof || s.top} />
      {h > 12 && windows}
      {/* door shows which way the building faces */}
      <polygon points={facePoly(doorX, doorY, 6, 9, doorOnLeft ? 0.5 : -0.5)} fill="#3f2a14" opacity=".85" />
      {s.awning && <polygon points={pts([[sx - W / 2, sy + H / 2 - h + 6], [sx, sy + H - h + 6], [sx + W / 2, sy + H / 2 - h + 6], [sx, sy + H - h + 10]])} fill={s.awning} opacity=".9" />}
      {s.chimney && <rect x={sx + 8} y={sy - h - 18} width="7" height="20" fill="#6B7280" />}
      {s.chimney && <circle cx={sx + 12} cy={sy - h - 24} r="5" fill="#E5E7EB" opacity=".8" className="animate-float" />}
    </g>
  );
}

function Tile({ x, y, ox, building, selected, onClick, gridColor }) {
  const [sx, sy] = iso(x, y, ox);
  const diamond = [[sx, sy], [sx + W / 2, sy + H / 2], [sx, sy + H], [sx - W / 2, sy + H / 2]];
  const s = building ? STYLE[building.kind] || {} : null;
  return (
    <g onClick={onClick} className="cursor-pointer" role="button" aria-label={building ? `${pretty(building.kind)} level ${building.level} at ${x},${y}` : `Empty tile ${x},${y}`}>
      <polygon points={pts(diamond)} fill={s?.flat ? s.top : gridColor} stroke="#00000014" strokeWidth="1" />
      {s?.stripe && <line x1={sx - W / 4} y1={sy + H / 4} x2={sx + W / 4} y2={sy + (3 * H) / 4} stroke="#FDE68A" strokeDasharray="5 4" strokeWidth="2" />}
      {s?.tiles && <polygon points={pts([[sx, sy + 6], [sx + W / 2 - 10, sy + H / 2], [sx, sy + H - 6], [sx - W / 2 + 10, sy + H / 2]])} fill="none" stroke="#9CA3AF" />}
      {s?.water && <path d={`M${sx - 14} ${sy + H / 2} q7 -4 14 0 t14 0`} stroke="#E0F2FE" strokeWidth="2" fill="none" />}
      {s?.flowers && [[-10, 0], [6, -4], [10, 5], [-2, 7]].map(([dx, dy], i) => <circle key={i} cx={sx + dx} cy={sy + H / 2 + dy} r="2.6" fill={["#F472B6", "#FDE047", "#F87171", "#A78BFA"][i]} />)}
      {s?.fountain && (
        <g>
          <ellipse cx={sx} cy={sy + H / 2} rx="16" ry="8" fill="#7DD3FC" stroke="#94A3B8" strokeWidth="2" />
          <rect x={sx - 2} y={sy + H / 2 - 14 - building.level * 3} width="4" height={14 + building.level * 3} fill="#94A3B8" />
          <circle cx={sx} cy={sy + H / 2 - 16 - building.level * 3} r="4" fill="#E0F2FE" className="animate-float" />
        </g>
      )}
      {s?.tree &&
        Array.from({ length: building.level }).map((_, i) => {
          const dx = [0, -12, 12][i];
          const dy = [0, 4, 4][i];
          return (
            <g key={i}>
              <rect x={sx + dx - 2} y={sy + H / 2 - 8 + dy} width="4" height="10" fill="#7C4A1E" />
              <circle cx={sx + dx} cy={sy + H / 2 - 14 + dy} r="9" fill={s.color} />
              <circle cx={sx + dx - 3} cy={sy + H / 2 - 17 + dy} r="4" fill="#40916C" />
            </g>
          );
        })}
      {s?.rocks && [[-8, 2, 7], [6, -1, 6], [1, 6, 4]].slice(0, building.level + 1).map(([dx, dy, r], i) => <ellipse key={i} cx={sx + dx} cy={sy + H / 2 + dy} rx={r} ry={r * 0.7} fill="#9CA3AF" stroke="#6B7280" />)}
      {s && !s.flat && !s.tree && !s.rocks && <Block sx={sx} sy={sy} s={s} level={building.level} facing={building.facing} />}
      {building && building.level > 1 && <text x={sx} y={sy + H - 3} textAnchor="middle" fontSize="8" fontWeight="800" fill="#111" opacity=".55">L{building.level}</text>}
      {selected && <polygon points={pts(diamond)} fill="rgb(var(--primary) / .25)" stroke="rgb(var(--primary))" strokeWidth="2.5" pointerEvents="none" />}
    </g>
  );
}

export default function CityBuilder() {
  const { setTokens } = useAuth();
  const [town, setTown] = useState(null);
  const [sel, setSel] = useState(null);
  const [cat, setCat] = useState("housing");
  const [facing, setFacing] = useState("se");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/town").then((r) => setTown(r.data)).catch((e) => toast.error(errorMessage(e)));
  }, []);

  const call = async (path, body, msg) => {
    setBusy(true);
    try {
      const { data } = await api.post(path, body);
      setTown(data);
      setTokens(data.tokens);
      if (msg) toast.success(msg);
      return data;
    } catch (err) {
      toast.error(errorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const byTile = useMemo(() => Object.fromEntries((town?.buildings || []).map((b) => [`${b.x},${b.y}`, b])), [town]);
  if (!town) return <PageLoader />;

  const size = town.grid_size;
  const ox = (size * W) / 2;
  const tiles = [];
  for (let s = 0; s < size * 2 - 1; s++) for (let x = 0; x < size; x++) { const y = s - x; if (y >= 0 && y < size) tiles.push([x, y]); }
  const current = sel ? byTile[`${sel[0]},${sel[1]}`] : null;
  const baseCost = current ? town.categories[current.category]?.items[current.kind] : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <Card className="relative overflow-hidden p-3 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div>
            <h2 className="text-lg font-bold">Your town</h2>
            <p className="text-sm text-ink-muted">{size}×{size} · {town.buildings.length} buildings · Level {town.expansion_level}/{town.max_expansion}</p>
          </div>
          {town.next_expand_cost && (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => call("/town/expand", {}, "Town expanded!")} disabled={town.tokens < town.next_expand_cost}>
              <Expand className="h-4 w-4" /> Expand · {town.next_expand_cost} <Coins className="h-3.5 w-3.5 text-amber-500" />
            </Button>
          )}
        </div>
        <div className="rounded-2xl bg-gradient-to-b from-sky-100 to-sky-50 p-2 dark:from-slate-800 dark:to-slate-900">
          <svg viewBox={`${-10} ${-60} ${size * W + 20} ${size * H + 80}`} className="mx-auto w-full max-h-[70vh] select-none" role="img" aria-label="Isometric town grid">
            {tiles.map(([x, y]) => (
              <Tile key={`${x},${y}`} x={x} y={y} ox={ox} building={byTile[`${x},${y}`]} selected={sel && sel[0] === x && sel[1] === y}
                gridColor={(x + y) % 2 ? "#A3D977" : "#B5E48C"} onClick={() => setSel([x, y])} />
            ))}
          </svg>
        </div>
        <p className="mt-2 px-1 text-xs text-ink-muted">Tap a tile to build. Earn tokens by completing missions — every application grows your town.</p>
      </Card>

      <Card className="p-5">
        {!sel ? (
          <div className="text-center">
            <Landmark className="mx-auto h-10 w-10 text-primary" />
            <h3 className="mt-3 font-bold">Pick a tile to start building</h3>
            <p className="mt-1 text-sm text-ink-muted">Unlock buildings with tokens, then place them as often as you like. Upgrades make them taller and grander.</p>
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Coins className="h-4 w-4" /> {town.tokens} tokens</p>
          </div>
        ) : current ? (
          <div>
            <p className="eyebrow">Tile {sel[0]},{sel[1]}</p>
            <h3 className="mt-1 text-xl font-extrabold">{pretty(current.kind)}</h3>
            <p className="text-sm text-ink-muted">Level {current.level} of {town.max_level} · facing {current.facing.toUpperCase()}</p>
            <div className="mt-5 grid gap-2">
              <Button disabled={current.level >= town.max_level || town.tokens < baseCost * current.level} loading={busy}
                onClick={() => call("/town/upgrade", { x: sel[0], y: sel[1] }, "Upgraded!")}>
                <ArrowUpCircle className="h-4 w-4" /> {current.level >= town.max_level ? "Max level" : <>Upgrade · {baseCost * current.level} <Coins className="h-3.5 w-3.5" /></>}
              </Button>
              <Button variant="secondary" onClick={() => call("/town/rotate", { x: sel[0], y: sel[1] })}><RotateCw className="h-4 w-4" /> Rotate</Button>
              <Button variant="ghost" className="text-red-600" onClick={() => call("/town/remove", { x: sel[0], y: sel[1] }, current.level > 1 ? "Removed — half your upgrade tokens were refunded" : "Removed")}><Trash2 className="h-4 w-4" /> Remove</Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="eyebrow">Build on tile {sel[0]},{sel[1]}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {Object.entries(town.categories).map(([k, c]) => {
                const Icon = CAT_ICONS[k];
                return (
                  <button key={k} onClick={() => setCat(k)} aria-pressed={cat === k}
                    className={cn("flex flex-col items-center gap-1 rounded-xl border-2 py-2.5 text-xs font-bold transition", cat === k ? "border-primary bg-primary-soft text-primary" : "border-line text-ink-muted hover:text-ink")}>
                    <Icon className="h-5 w-5" />{c.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-bold text-ink-muted">Facing</p>
              <div className="grid grid-cols-4 gap-1.5">
                {town.facings.map((f) => (
                  <button key={f} onClick={() => setFacing(f)} aria-pressed={facing === f} className={cn("rounded-lg border py-1.5 text-xs font-bold uppercase", facing === f ? "border-primary bg-primary-soft text-primary" : "border-line text-ink-muted")}>{f}</button>
                ))}
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {Object.entries(town.categories[cat].items).map(([kind, cost]) => {
                const unlocked = town.unlocked_items.includes(kind);
                return (
                  <li key={kind} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-3">
                    <span className="font-semibold">{pretty(kind)}</span>
                    {unlocked ? (
                      <Button size="sm" loading={busy} onClick={() => call("/town/place", { x: sel[0], y: sel[1], kind, facing }, `${pretty(kind)} placed`)}>Place</Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={town.tokens < cost || busy} onClick={() => call("/town/unlock", { kind }, `${pretty(kind)} unlocked!`)}>
                        <Lock className="h-3.5 w-3.5" /> {cost} <Coins className="h-3.5 w-3.5 text-amber-500" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
