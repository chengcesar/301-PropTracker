/** Persists product accent preset (central tokens in design-system.css). */
export const ACCENT_STORAGE_KEY = 'propflow-accent'

/** Fired on `window` after accent tokens are applied (e.g. map markers read --accent-* via getComputedStyle). */
export const ACCENT_THEME_CHANGE_EVENT = 'propflow-accent-change'

export type AccentPreset = 'blue' | 'teal' | 'terracotta'

export const ACCENT_PRESETS: { id: AccentPreset; label: string; hint: string }[] = [
  { id: 'blue', label: 'Blue', hint: 'Default primary (blue)' },
  { id: 'teal', label: 'Cyan', hint: 'Secondary primary — darker cyan #338E97 (swap for blue)' },
  {
    id: 'terracotta',
    label: 'Terracotta',
    hint: 'Warm brown-red primary base #6D2F20',
  },
]

/**
 * Documented hex values for the design system page — keep in sync with
 * `:root` and `html[data-accent="teal"|"terracotta"]` in design-system.css.
 */
export const ACCENT_TOKEN_ROWS: { varName: string; usage: string }[] = [
  { varName: '--accent-bg', usage: 'Primary buttons, links, focus rings, active tabs' },
  { varName: '--accent-text', usage: 'Text on primary buttons' },
  { varName: '--accent-hover', usage: 'Primary hover, emphasis text' },
  { varName: '--accent-subtle-bg', usage: 'Selected rows, light highlight backgrounds' },
  { varName: '--accent-muted-bg', usage: 'Stronger tint (chips, pressed controls)' },
  { varName: '--accent-disabled-bg', usage: 'Disabled primary controls' },
]

export const ACCENT_HEX_BY_PRESET: Record<AccentPreset, Record<string, string>> = {
  blue: {
    '--accent-bg': '#3b82f6',
    '--accent-text': '#ffffff',
    '--accent-hover': '#2563eb',
    '--accent-subtle-bg': '#eff6ff',
    '--accent-muted-bg': '#dbeafe',
    '--accent-disabled-bg': '#93c5fd',
  },
  teal: {
    '--accent-bg': '#338e97',
    '--accent-text': '#ffffff',
    '--accent-hover': '#2a737b',
    '--accent-subtle-bg': '#e5f3f5',
    '--accent-muted-bg': '#b0d8df',
    '--accent-disabled-bg': '#7aacb5',
  },
  terracotta: {
    '--accent-bg': '#6d2f20',
    '--accent-text': '#ffffff',
    '--accent-hover': '#58261a',
    '--accent-subtle-bg': '#f8f2f0',
    '--accent-muted-bg': '#e9dcd8',
    '--accent-disabled-bg': '#b8968d',
  },
}

export function getStoredAccent(): AccentPreset {
  try {
    const v = localStorage.getItem(ACCENT_STORAGE_KEY)?.trim().toLowerCase()
    if (v === 'teal' || v === 'blue' || v === 'terracotta') return v
  } catch {
    /* ignore */
  }
  return 'blue'
}

const ACCENT_VAR_NAMES = ACCENT_TOKEN_ROWS.map((r) => r.varName)

function accentTargets(): HTMLElement[] {
  const root = document.getElementById('root')
  return [document.documentElement, document.body, ...(root ? [root] : [])].filter(
    (el): el is HTMLElement => el != null,
  )
}

function clearAccentVars(el: HTMLElement) {
  for (const name of ACCENT_VAR_NAMES) {
    el.style.removeProperty(name)
  }
}

function applyAccentVars(el: HTMLElement, map: Record<string, string>) {
  for (const name of ACCENT_VAR_NAMES) {
    const val = map[name]
    if (val) {
      // !important beats Tailwind @theme / later :root rules that can pin the blue palette
      el.style.setProperty(name, val, 'important')
    }
  }
}

/**
 * Apply preset: localStorage, data-accent on <html>, and --accent-* on html + body + #root
 * so portaled nodes and Tailwind cannot override.
 */
export function setAccentPreset(preset: AccentPreset) {
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, preset)
  } catch {
    /* ignore */
  }

  const htmlEl = document.documentElement
  const targets = accentTargets()

  if (preset === 'blue') {
    htmlEl.removeAttribute('data-accent')
    for (const el of targets) clearAccentVars(el)
  } else {
    htmlEl.setAttribute('data-accent', preset)
    const map = ACCENT_HEX_BY_PRESET[preset]
    for (const el of targets) {
      clearAccentVars(el)
      applyAccentVars(el, map)
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACCENT_THEME_CHANGE_EVENT))
  }
}

export function initAccentFromStorage() {
  setAccentPreset(getStoredAccent())
}
