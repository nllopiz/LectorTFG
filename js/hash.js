/**
 * Utilidades puras para enlaces internos por fragmento.
 * No usan DOM para poder probarse de forma aislada.
 */

export function parseHashTarget(value) {
  const raw = String(value ?? '').replace(/^#/, '').trim();

  if (!raw) {
    return '';
  }

  try {
    return decodeURIComponent(raw);
  } catch (error) {
    return raw;
  }
}

export function buildHash(targetId) {
  const id = String(targetId ?? '').trim();
  return id ? `#${encodeURIComponent(id)}` : '';
}
