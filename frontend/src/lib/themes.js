/** Theme palettes ported from app_theme.dart / theme_provider.dart.
 *  `primary` is the brand color; dark mode auto-lightens very dark primaries. */
export const THEME_COLORS = {
  executiveBlue: { primary: "#1F3B4D", accent: "#C49C48" },
  growthTeal: { primary: "#4A8C8E", accent: "#1F3B4D" },
  foundationGrey: { primary: "#4C4C4C", accent: "#1F3B4D" },
  obsidian: { primary: "#1C1C1C", accent: "#9CA3AF" },
  ocean: { primary: "#0077B6", accent: "#48CAE4" },
  forest: { primary: "#2D6A4F", accent: "#95D5B2" },
  slate: { primary: "#475569", accent: "#94A3B8" },
  navy: { primary: "#1E3A5F", accent: "#5B8DEF" },
  deepPurple: { primary: "#6750A4", accent: "#D0BCFF" },
  sunset: { primary: "#E85D04", accent: "#FFBA08" },
  midnight: { primary: "#1A1A2E", accent: "#E94560" },
  gold: { primary: "#EFBF04", accent: "#8A6D00" },
  aurora: { primary: "#0D9488", accent: "#A78BFA" },
  achievementGold: { primary: "#C49C48", accent: "#1F3B4D" },
  careerNiche: { primary: "#76BC21", accent: "#385510" },
};

export const FONT_SCALE = { defaultSize: 1, large: 1.12, extraLarge: 1.25 };

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const rgbStr = ([r, g, b]) => `${r} ${g} ${b}`;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const luminance = ([r, g, b]) => {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

export function themeVars(key, dark) {
  const t = THEME_COLORS[key] || THEME_COLORS.executiveBlue;
  let primary = hexToRgb(t.primary);
  let accent = hexToRgb(t.accent);
  if (dark && luminance(primary) < 0.08) primary = mix(primary, [255, 255, 255], 0.55);
  if (!dark && luminance(accent) > 0.6) accent = mix(accent, [0, 0, 0], 0.35);
  const fg = luminance(primary) > 0.4 ? [17, 17, 17] : [255, 255, 255];
  const white = [255, 255, 255];
  const black = [10, 12, 10];
  const tint = (amt) => mix(white, primary, amt);
  const shade = (amt) => mix([14, 16, 14], primary, amt);
  return dark
    ? {
        "--primary": rgbStr(primary), "--primary-fg": rgbStr(fg), "--primary-soft": rgbStr(shade(0.22)), "--accent": rgbStr(accent),
        "--bg": rgbStr(mix(black, primary, 0.04)), "--surface": rgbStr(mix([22, 24, 22], primary, 0.05)), "--surface-2": rgbStr(mix([32, 35, 32], primary, 0.07)),
        "--ink": "236 239 233", "--ink-muted": "165 172 160", "--ink-faint": "110 116 106", "--line": rgbStr(mix([45, 49, 45], primary, 0.08)),
      }
    : {
        "--primary": rgbStr(primary), "--primary-fg": rgbStr(fg), "--primary-soft": rgbStr(tint(0.1)), "--accent": rgbStr(accent),
        "--bg": rgbStr(mix([248, 249, 246], primary, 0.02)), "--surface": "255 255 255", "--surface-2": rgbStr(mix([244, 246, 241], primary, 0.03)),
        "--ink": "22 26 20", "--ink-muted": "92 101 88", "--ink-faint": "150 158 146", "--line": rgbStr(mix([229, 232, 225], primary, 0.04)),
      };
}

export function applyTheme({ app_theme, dark_mode, font_size }) {
  const root = document.documentElement;
  Object.entries(themeVars(app_theme, dark_mode)).forEach(([k, v]) => root.style.setProperty(k, v));
  root.classList.toggle("dark", !!dark_mode);
  root.style.fontSize = `${16 * (FONT_SCALE[font_size] || 1)}px`;
}

/** Landing page always uses CareerNiche brand green, light. */
export function applyBrand() {
  applyTheme({ app_theme: "careerNiche", dark_mode: false, font_size: "defaultSize" });
}
