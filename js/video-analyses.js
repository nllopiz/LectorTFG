/**
 * Validación y acceso a los análisis de canciones.
 * El módulo es puro para poder probarlo sin DOM.
 */

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function isVideoAnalysis(value) {
  return value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Array.isArray(value.paragraphs) &&
    value.paragraphs.length > 0 &&
    value.paragraphs.every((paragraph) =>
      typeof paragraph === 'string' && paragraph.trim().length > 0
    );
}

export function isVideoAnalysesData(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value);

  return keys.length > 0 &&
    keys.every((key) => YOUTUBE_VIDEO_ID.test(key) && isVideoAnalysis(value[key]));
}

export function getVideoAnalysis(videoAnalyses, media) {
  if (
    !videoAnalyses ||
    !media ||
    media.provider !== 'youtube' ||
    media.type !== 'video'
  ) {
    return null;
  }

  return Object.prototype.hasOwnProperty.call(videoAnalyses, media.id)
    ? videoAnalyses[media.id]
    : null;
}
