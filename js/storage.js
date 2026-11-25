/**
 * Preferencias locales del lector.
 * Se guardan tema, tamaño de texto y posición de lectura; el contenido nunca se almacena.
 */

const PREFS_KEY = 'webmili:prefs:v1';
const READING_POSITION_KEY = 'webmili:reading-position:v1';
const THEMES = new Set(['system', 'light', 'dark']);

export const FONT_MIN = 16;
export const FONT_MAX = 24;
export const FONT_STEP = 2;
export const FONT_DEFAULT = 18;

function readRawPrefs() {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

/**
 * Ajusta un tamaño a la escala 16, 18, 20, 22, 24.
 */
export function normalizeFontSize(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return FONT_DEFAULT;
  }

  const rounded = Math.round((number - FONT_MIN) / FONT_STEP) * FONT_STEP + FONT_MIN;

  return Math.min(FONT_MAX, Math.max(FONT_MIN, rounded));
}

export function readPrefs() {
  const raw = readRawPrefs();

  return {
    theme: THEMES.has(raw.theme) ? raw.theme : 'dark',
    fontSize: normalizeFontSize(raw.fontSize)
  };
}

/**
 * Guarda las preferencias indicadas y devuelve el estado completo.
 * Si localStorage no está disponible, la app sigue funcionando en memoria.
 */
export function writePrefs(patch) {
  const current = readPrefs();
  const next = {
    theme: THEMES.has(patch.theme) ? patch.theme : current.theme,
    fontSize: normalizeFontSize(patch.fontSize ?? current.fontSize)
  };

  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch (error) {
    // Cuota, modo privado o almacenamiento bloqueado: no se interrumpe la lectura.
  }

  return next;
}

function normalizeReadingPosition(value) {
  if (
    !value ||
    typeof value.anchorId !== 'string' ||
    !value.anchorId.trim() ||
    !Number.isFinite(value.offset)
  ) {
    return null;
  }

  return {
    anchorId: value.anchorId.trim(),
    offset: value.offset
  };
}

export function readReadingPosition() {
  try {
    const raw = window.localStorage.getItem(READING_POSITION_KEY);

    return raw ? normalizeReadingPosition(JSON.parse(raw)) : null;
  } catch (error) {
    return null;
  }
}

export function writeReadingPosition(position) {
  const normalized = normalizeReadingPosition(position);

  if (!normalized) {
    return false;
  }

  try {
    window.localStorage.setItem(READING_POSITION_KEY, JSON.stringify(normalized));
    return true;
  } catch (error) {
    return false;
  }
}

export function clearReadingPosition() {
  try {
    window.localStorage.removeItem(READING_POSITION_KEY);
    return true;
  } catch (error) {
    return false;
  }
}
