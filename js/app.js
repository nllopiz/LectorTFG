/**
 * Lector del TFG
 * Coordina el documento fijo, las preferencias de lectura y el panel de medios.
 */

import { prepareDocument } from './document.js';
import { buildHash, parseHashTarget } from './hash.js';
import { getVideoAnalysis, isVideoAnalysesData } from './video-analyses.js';

import {
  FONT_MAX,
  FONT_MIN,
  FONT_STEP,
  normalizeFontSize,
  clearReadingPosition,
  readReadingPosition,
  readPrefs,
  writeReadingPosition,
  writePrefs
} from './storage.js';

const docPane = document.getElementById('doc-pane');
const docSheet = document.getElementById('doc-sheet');
const docContent = document.getElementById('doc-content');
const docInfo = document.getElementById('doc-info');
const docTitle = document.getElementById('doc-title');
const docName = document.getElementById('doc-name');
const fontControls = document.getElementById('font-controls');
const fontDecrease = document.getElementById('font-decrease');
const fontIncrease = document.getElementById('font-increase');
const tocButton = document.getElementById('toc-button');
const tocSidebar = document.getElementById('toc-sidebar');
const tocClose = document.getElementById('toc-close');
const tocBackdrop = document.getElementById('toc-backdrop');
const mediaButton = document.getElementById('media-button');
const mediaCount = document.getElementById('media-count');
const mediaDialog = document.getElementById('media-dialog');
const tocList = document.getElementById('toc-list');
const tocTooltip = document.getElementById('toc-tooltip');
const mediaList = document.getElementById('media-list');
const skipLink = document.getElementById('skip-link');
const toastRegion = document.getElementById('toasts');
const themeToggle = document.getElementById('theme-toggle');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const liveRegion = document.getElementById('sr-status');

const appContainer = document.querySelector('.app');
const workspace = document.getElementById('workspace');
const mediaPanel = document.getElementById('media-panel');
const mediaPanelInner = mediaPanel.querySelector('.media-panel__inner');
const mediaBar = mediaPanel.querySelector('.media-panel__bar');
const mediaStage = document.getElementById('media-stage');
const mediaAnalysisTrigger = document.getElementById('media-analysis-trigger');
const mediaAnalysisDialog = document.getElementById('media-analysis-dialog');
const mediaAnalysisTitle = document.getElementById('media-analysis-title');
const mediaAnalysisContent = mediaAnalysisDialog.querySelector('.media-analysis-dialog__content');
const mediaProvider = document.getElementById('media-provider');
const mediaLabel = document.getElementById('media-label');
const mediaExternal = document.getElementById('media-external');
const mediaClose = document.getElementById('media-close');
const mediaFallback = document.getElementById('media-fallback');
const mediaFallbackMessage = document.getElementById('media-fallback-message');
const mediaFallbackPeriod = document.getElementById('media-fallback-period');
const mediaNote = document.getElementById('media-note');

const desktopQuery = window.matchMedia('(min-width: 900px)');
const landscapeQuery = window.matchMedia('(orientation: landscape)');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

const DOCUMENT_NAME = 'El cuándo de mi por qué';
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

const state = {
  headings: [],
  media: [],
  prefs: readPrefs()
};

const PROVIDERS = {
  youtube: {
    name: 'YouTube',
    externalLabel: 'Abrir en YouTube',
    frameTitle: 'Reproductor de YouTube',
    allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen'
  },
  spotify: {
    name: 'Spotify',
    externalLabel: 'Abrir en Spotify',
    frameTitle: 'Reproductor de Spotify',
    allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'
  },
  instagram: {
    name: 'Instagram',
    externalLabel: 'Abrir en Instagram',
    frameTitle: 'Reproductor de Instagram',
    allow: ''
  }
};

const TYPE_LABELS = {
  video: 'Video de YouTube',
  playlist: 'Lista de YouTube',
  track: 'Pista de Spotify',
  album: 'Álbum de Spotify',
  episode: 'Episodio de Spotify',
  show: 'Programa de Spotify',
  artist: 'Artista de Spotify'
};

let activeMedia = null;
let activeTrigger = null;
let videoAnalyses = null;
let currentIframe = null;
let isOpen = false;
let loadTimer = 0;
let closeCleanupTimer = 0;
let resizeTimer = 0;
let resizeFrame = 0;
let announceTimer = 0;
let anchorFrame = 0;
let readingPositionTimer = 0;
let readingPositionWarningShown = false;
let readingPositionReady = false;
let headingObserver = null;
const visibleHeadingIds = new Set();
let lastHandledHash = window.location.hash;

let currentInstagramEmbed = null;
let instagramRenderToken = 0;
let instagramScriptPromise = null;
let instagramObserver = null;
/* ---------- Utilidades ---------- */

function announce(message) {
  window.clearTimeout(announceTimer);
  liveRegion.textContent = '';

  announceTimer = window.setTimeout(() => {
    liveRegion.textContent = message;
  }, 80);
}

function showToast(message, tone = 'info', duration = 6500) {
  const toast = document.createElement('div');
  const text = document.createElement('p');

  toast.className = `toast toast--${tone}`;
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  text.textContent = message;
  toast.append(text);
  toastRegion.append(toast);

  // Cada aviso programa su propia salida; uno nuevo no cancela los anteriores.
  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), motionQuery.matches ? 0 : 240);
  }, duration);
}

/* ---------- Enlaces internos y URL ---------- */

function currentHashTarget() {
  return parseHashTarget(window.location.hash);
}

function scrollToDocumentTarget(target, { smooth = false, focus = false } = {}) {
  if (!target || !docContent.contains(target)) {
    return false;
  }

  target.scrollIntoView({
    behavior: smooth && !motionQuery.matches ? 'smooth' : 'auto',
    block: 'start'
  });

  if (target.matches(HEADING_SELECTOR)) {
    setActiveTocHeading(target.id);
  }

  if (focus) {
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }

    target.focus({ preventScroll: true });
  }

  return true;
}

function commitSectionHash(targetId) {
  const nextTarget = String(targetId ?? '').trim();

  if (currentHashTarget() === nextTarget) {
    lastHandledHash = window.location.hash;
    return;
  }

  const url = buildHash(nextTarget) || `${window.location.pathname}${window.location.search}`;

  history.pushState(null, '', url);
  lastHandledHash = window.location.hash;
}

function handleHashNavigation() {
  if (window.location.hash === lastHandledHash) {
    return;
  }

  lastHandledHash = window.location.hash;

  const targetId = currentHashTarget();

  if (!targetId) {
    docPane.scrollTo({ top: 0, behavior: 'auto' });

    if (state.headings.length) {
      setActiveTocHeading(state.headings[0].id);
    }

    return;
  }

  const target = document.getElementById(targetId);

  if (!target || !docContent.contains(target)) {
    showToast('La sección del enlace ya no existe.', 'warning');
    return;
  }

  scrollToDocumentTarget(target);
}

function updateTocLayout() {
  const isDesktop = desktopQuery.matches;
  const wasOpen = tocSidebar.classList.contains('is-open');

  tocSidebar.classList.remove('is-open');
  tocSidebar.inert = !isDesktop;
  tocSidebar.setAttribute('aria-hidden', String(!isDesktop));
  tocBackdrop.hidden = true;
  tocButton.hidden = isDesktop;
  tocButton.setAttribute('aria-expanded', 'false');
  tocButton.setAttribute('aria-label', 'Abrir índice de contenidos');

  if (wasOpen && isDesktop) {
    docPane.focus({ preventScroll: true });
  }
}

function setTocOpen(open, { restoreFocus = false } = {}) {
  if (desktopQuery.matches) {
    return;
  }

  tocSidebar.classList.toggle('is-open', open);
  tocSidebar.inert = !open;
  tocSidebar.setAttribute('aria-hidden', String(!open));
  tocBackdrop.hidden = !open;
  tocButton.setAttribute('aria-expanded', String(open));
  tocButton.setAttribute(
    'aria-label',
    open ? 'Cerrar índice de contenidos' : 'Abrir índice de contenidos'
  );

  if (open) {
    tocClose.focus({ preventScroll: true });
  } else if (restoreFocus) {
    tocButton.focus({ preventScroll: true });
  }
}

function updateDocInfo() {
  docTitle.textContent = document.querySelector('.brand__name').textContent.trim();
  docName.textContent = 'Trabajo Final de Grado';
  docName.title = 'Trabajo Final de Grado';
}

function showReader(headings, { focus = true } = {}) {
  state.headings = headings;
  enhanceMediaLinks();
  updateNavigation();
  observeHeadings();

  updateDocInfo();
  docPane.hidden = false;
  docInfo.hidden = false;
  fontControls.hidden = false;
  updateTocLayout();

  const firstHeading = state.headings[0];
  skipLink.setAttribute('href', `#${firstHeading ? firstHeading.id : 'doc-pane'}`);
  document.title = `${DOCUMENT_NAME} · Lector TFG`;

  if (focus) {
    docPane.focus({ preventScroll: true });
  }

  announce(`Lectura abierta: ${DOCUMENT_NAME}.`);
}

/* ---------- Índice y lista de medios ---------- */

function extractMedia() {
  const unique = new Map();

  docContent.querySelectorAll('.media-link[data-media]').forEach((link) => {
    const media = mediaFromLink(link);

    if (!media) {
      return;
    }

    if (!unique.has(media.key)) {
      unique.set(media.key, media);
    }
  });

  return Array.from(unique.values());
}

function renderToc() {
  hideTocTooltip();
  tocList.replaceChildren();

  if (!state.headings.length) {
    const empty = document.createElement('p');
    empty.className = 'navigation-empty';
    empty.textContent = 'Este documento no tiene encabezados.';
    tocList.append(empty);
    return;
  }

  for (const [index, heading] of state.headings.entries()) {
    const fullLabel = heading.text || 'Sección sin título';
    const row = document.createElement('div');
    row.className = 'toc-item-row';

    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'toc-item';
    item.dataset.level = String(heading.level);
    item.dataset.headingId = heading.id;
    item.dataset.fullLabel = fullLabel;
    item.setAttribute('aria-label', fullLabel);
    if (fullLabel.length > 56) {
      item.title = fullLabel;
    }

    const label = document.createElement('span');
    label.className = 'toc-item__label';
    label.textContent = fullLabel;

    const compactLabel = document.createElement('span');
    compactLabel.className = 'toc-item__compact-label';
    compactLabel.textContent = compactTocLabel(heading, index);
    compactLabel.setAttribute('aria-hidden', 'true');

    const info = document.createElement('button');
    info.type = 'button';
    info.className = 'toc-item-info';
    info.textContent = 'i';
    info.setAttribute('aria-label', `Mostrar título completo: ${fullLabel}`);
    info.setAttribute('aria-controls', 'toc-tooltip');
    info.setAttribute('aria-expanded', 'false');

    item.append(label, compactLabel);
    row.append(item, info);
    tocList.append(row);
  }
}

function compactTocLabel(heading, index) {
  const text = heading.text.trim();

  if (heading.level === 1 || index === 0) {
    return 'Portada';
  }

  if (text === 'Introducción') {
    return 'Intro.';
  }

  if (text === 'Conclusión') {
    return 'Cierre';
  }

  const chapter = text.match(/^Capítulo\s+(\d+)$/i);

  if (chapter) {
    return `Cap. ${chapter[1]}`;
  }

  const numberedSection = text.match(/^(\d+)\./);

  if (numberedSection) {
    return `Tema ${numberedSection[1]}`;
  }

  return text.split(/\s+/)[0] || 'Sección';
}

function isCompactToc() {
  return (
    workspace.classList.contains('has-open-media') &&
    desktopQuery.matches &&
    landscapeQuery.matches
  );
}

function showTocTooltip(row, { pinned = false } = {}) {
  if (!isCompactToc()) {
    return;
  }

  const item = row.querySelector('.toc-item');

  if (!item) {
    return;
  }

  tocTooltip.textContent = item.dataset.fullLabel;
  tocTooltip.dataset.headingId = item.dataset.headingId;
  tocTooltip.dataset.pinned = String(pinned);
  tocTooltip.hidden = false;

  const rowRect = row.getBoundingClientRect();
  const sidebarRect = tocSidebar.getBoundingClientRect();
  const tooltipHalfHeight = tocTooltip.offsetHeight / 2;
  const minTop = tooltipHalfHeight + 8;
  const maxTop = Math.max(minTop, tocSidebar.clientHeight - tooltipHalfHeight - 8);
  const rowCenter = rowRect.top - sidebarRect.top + rowRect.height / 2;

  tocTooltip.style.top = `${Math.round(Math.max(minTop, Math.min(rowCenter, maxTop)))}px`;

  tocList.querySelectorAll('.toc-item-info').forEach((button) => {
    button.setAttribute('aria-expanded', String(row.contains(button)));
  });
}

function hideTocTooltip() {
  tocTooltip.hidden = true;
  tocTooltip.textContent = '';
  tocTooltip.removeAttribute('data-heading-id');
  tocTooltip.removeAttribute('data-pinned');
  tocTooltip.style.removeProperty('top');
  tocList.querySelectorAll('.toc-item-info').forEach((button) => {
    button.setAttribute('aria-expanded', 'false');
  });
}

function renderMediaList() {
  mediaList.replaceChildren();

  if (!state.media.length) {
    const empty = document.createElement('li');
    empty.className = 'navigation-empty';
    empty.textContent = 'Este documento no contiene enlaces multimedia compatibles.';
    mediaList.append(empty);
    return;
  }

  state.media.forEach((media, index) => {
    const listItem = document.createElement('li');
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'media-list-item';
    item.dataset.mediaIndex = String(index);

    const provider = document.createElement('span');
    provider.className = `media-list-item__provider media-list-item__provider--${media.provider}`;
    provider.textContent = PROVIDERS[media.provider].name;

    const copy = document.createElement('span');
    copy.className = 'media-list-item__copy';

    const label = document.createElement('span');
    label.className = 'media-list-item__label';
    label.textContent = media.label;

    const type = document.createElement('span');
    type.className = 'media-list-item__type';
    type.textContent = TYPE_LABELS[media.type] || media.type;

    copy.append(label, type);
    item.append(provider, copy);
    listItem.append(item);
    mediaList.append(listItem);
  });
}

function updateNavigation() {
  state.media = extractMedia();
  renderToc();
  renderMediaList();

  mediaCount.textContent = String(state.media.length);
  mediaCount.hidden = state.media.length === 0;
  mediaButton.hidden = state.media.length === 0;
  mediaButton.setAttribute(
    'aria-label',
    `Abrir lista de medios. ${state.media.length} ${state.media.length === 1 ? 'enlace único' : 'enlaces únicos'}`
  );
}

function observeHeadings() {
  if (headingObserver) {
    headingObserver.disconnect();
  }

  visibleHeadingIds.clear();

  headingObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        visibleHeadingIds.add(entry.target.id);
      } else {
        visibleHeadingIds.delete(entry.target.id);
      }
    });

    const activeHeading = state.headings.find((heading) => visibleHeadingIds.has(heading.id));

    if (activeHeading) {
      setActiveTocHeading(activeHeading.id);
    }
  }, {
    root: docPane,
    rootMargin: '0px 0px -75% 0px'
  });

  state.headings.forEach((heading) => {
    const element = document.getElementById(heading.id);

    if (element) {
      headingObserver.observe(element);
    }
  });

  if (state.headings.length) {
    setActiveTocHeading(state.headings[0].id);
  }
}

function setActiveTocHeading(headingId) {
  const activeItem = Array.from(tocList.querySelectorAll('.toc-item'))
    .find((item) => item.dataset.headingId === headingId);

  if (!activeItem) {
    return;
  }

  const currentItem = tocList.querySelector('.toc-item[aria-current="location"]');

  if (currentItem === activeItem) {
    return;
  }

  if (currentItem) {
    currentItem.removeAttribute('aria-current');
  }

  activeItem.setAttribute('aria-current', 'location');

  const listRect = tocList.getBoundingClientRect();
  const itemRect = activeItem.getBoundingClientRect();

  if (itemRect.top < listRect.top) {
    tocList.scrollTop -= listRect.top - itemRect.top;
  } else if (itemRect.bottom > listRect.bottom) {
    tocList.scrollTop += itemRect.bottom - listRect.bottom;
  }
}

function openNavigationDialog(dialog) {
  if (!dialog.open) {
    dialog.showModal();
  }
}

function closeNavigationDialog(dialog) {
  if (dialog.open) {
    dialog.close();
  }
}

function createAnalysisParagraph(text) {
  // El JSON usa *texto* para énfasis; se convierte en <em> sin interpretar HTML.
  const paragraph = document.createElement('p');
  const parts = text.split(/(\*[^*]+\*)/g);

  for (const part of parts) {
    if (!part) {
      continue;
    }

    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
      const emphasis = document.createElement('em');
      emphasis.textContent = part.slice(1, -1);
      paragraph.append(emphasis);
    } else {
      paragraph.append(part);
    }
  }

  return paragraph;
}

function renderVideoAnalysis(analysis) {
  mediaAnalysisContent.replaceChildren(
    ...analysis.paragraphs.map(createAnalysisParagraph)
  );
}

function updateMediaAnalysisDialogPosition() {
  if (desktopQuery.matches) {
    mediaAnalysisDialog.style.removeProperty('--media-analysis-top');
    return;
  }

  const mediaPanelBottom = mediaPanel.getBoundingClientRect().bottom;
  mediaAnalysisDialog.style.setProperty(
    '--media-analysis-top',
    `${Math.ceil(mediaPanelBottom + 8)}px`
  );
}

async function loadVideoAnalyses() {
  try {
    const response = await fetch(new URL('../video-analyses.json', import.meta.url));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const analyses = await response.json();

    if (!isVideoAnalysesData(analyses)) {
      throw new TypeError('El archivo no tiene el formato esperado.');
    }

    videoAnalyses = analyses;
    updateMediaAnalysisAvailability();

    if (isOpen) {
      updateMediaSize();
    }
  } catch (error) {
    console.error('No se pudieron cargar los análisis de las canciones.', error);
    showToast('No se pudieron cargar los análisis de las canciones.', 'error');
  }
}

function updateMediaAnalysisAvailability() {
  const canShowAnalysis = getVideoAnalysis(videoAnalyses, activeMedia) !== null;
  mediaAnalysisTrigger.hidden = !canShowAnalysis;
}

tocButton.addEventListener('click', () => {
  setTocOpen(!tocSidebar.classList.contains('is-open'));
});
tocClose.addEventListener('click', () => setTocOpen(false, { restoreFocus: true }));
tocBackdrop.addEventListener('click', () => setTocOpen(false, { restoreFocus: true }));
mediaButton.addEventListener('click', () => openNavigationDialog(mediaDialog));
mediaAnalysisTrigger.addEventListener('click', () => {
  const analysis = getVideoAnalysis(videoAnalyses, activeMedia);

  if (!analysis) {
    return;
  }

  updateMediaAnalysisDialogPosition();
  renderVideoAnalysis(analysis);
  mediaAnalysisTitle.innerHTML = 'Análisis de la canción:<br>' + activeMedia.label;
  openNavigationDialog(mediaAnalysisDialog);
});
desktopQuery.addEventListener('change', updateTocLayout);

document.querySelectorAll('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', () => {
    const dialog = document.getElementById(button.dataset.closeDialog);

    if (dialog instanceof HTMLDialogElement) {
      closeNavigationDialog(dialog);
    }
  });
});

[mediaDialog, mediaAnalysisDialog].forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      closeNavigationDialog(dialog);
    }
  });
});

tocList.addEventListener('click', (event) => {
  const info = event.target.closest('.toc-item-info');

  if (info) {
    const row = info.closest('.toc-item-row');
    const item = row.querySelector('.toc-item');
    const alreadyPinned =
      tocTooltip.dataset.pinned === 'true' &&
      tocTooltip.dataset.headingId === item.dataset.headingId;

    if (alreadyPinned) {
      hideTocTooltip();
    } else {
      showTocTooltip(row, { pinned: true });
    }

    return;
  }

  const item = event.target.closest('.toc-item');

  if (!item) {
    return;
  }

  hideTocTooltip();

  const target = document.getElementById(item.dataset.headingId);

  if (!target || !docContent.contains(target)) {
    return;
  }

  setActiveTocHeading(target.id);
  setTocOpen(false);
  scrollToDocumentTarget(target, { smooth: true, focus: true });
  commitSectionHash(target.id);
  announce(`Sección: ${target.textContent.trim().slice(0, 90)}`);
});

tocList.addEventListener('pointerover', (event) => {
  if (event.pointerType === 'touch' || !(event.target instanceof Element)) {
    return;
  }

  const row = event.target.closest('.toc-item-row');

  if (row) {
    showTocTooltip(row);
  }
});

tocList.addEventListener('pointerout', (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const row = event.target.closest('.toc-item-row');
  const isSameRow =
    row && event.relatedTarget instanceof Node && row.contains(event.relatedTarget);

  if (
    !row ||
    isSameRow ||
    tocTooltip.dataset.pinned === 'true'
  ) {
    return;
  }

  hideTocTooltip();
});

tocList.addEventListener('focusin', (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const row = event.target.closest('.toc-item-row');

  if (row) {
    showTocTooltip(row);
  }
});

tocList.addEventListener('focusout', (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const row = event.target.closest('.toc-item-row');
  const isSameRow =
    row && event.relatedTarget instanceof Node && row.contains(event.relatedTarget);

  if (
    !row ||
    isSameRow ||
    tocTooltip.dataset.pinned === 'true'
  ) {
    return;
  }

  hideTocTooltip();
});

document.addEventListener('pointerdown', (event) => {
  if (
    tocTooltip.dataset.pinned === 'true' &&
    event.target instanceof Node &&
    !tocSidebar.contains(event.target)
  ) {
    hideTocTooltip();
  }
});

mediaList.addEventListener('click', (event) => {
  const item = event.target.closest('.media-list-item');

  if (!item) {
    return;
  }

  const media = state.media[Number(item.dataset.mediaIndex)];

  if (!media) {
    return;
  }

  closeNavigationDialog(mediaDialog);
  openMedia(media, media.trigger);
});

/* ---------- Enlaces internos del documento ---------- */

docContent.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const link = event.target.closest('a');

  if (!(link instanceof HTMLAnchorElement) || !docContent.contains(link)) {
    return;
  }

  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  if (link.hasAttribute('data-blocked-link')) {
    event.preventDefault();
    showToast('Ese enlace se bloqueó por seguridad.', 'warning');
    return;
  }

  const href = link.getAttribute('href');

  if (!href || !href.startsWith('#')) {
    return;
  }

  event.preventDefault();

  const targetId = parseHashTarget(href);

  if (!targetId) {
    docPane.scrollTo({ top: 0, behavior: motionQuery.matches ? 'auto' : 'smooth' });
    commitSectionHash('');
    return;
  }

  const target = document.getElementById(targetId);

  if (!target || !docContent.contains(target)) {
    showToast('Ese enlace interno no tiene destino en el documento.', 'warning');
    announce('El enlace interno no tiene destino.');
    return;
  }

  scrollToDocumentTarget(target, { smooth: true, focus: true });
  commitSectionHash(target.id);
  announce(`Sección: ${target.textContent.trim().slice(0, 90) || targetId}`);
});

/* ---------- Preferencias: tema y tamaño ---------- */

function syncThemeButton() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  const nextLabel = isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

  themeToggle.setAttribute('aria-label', nextLabel);
  themeToggle.title = nextLabel;

  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', isDark ? '#4E381E' : '#F7EBD1');
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  syncThemeButton();
}

function toggleTheme() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  const nextTheme = isDark ? 'light' : 'dark';

  applyTheme(nextTheme);
  state.prefs = writePrefs({ ...state.prefs, theme: nextTheme });
  announce(nextTheme === 'dark' ? 'Tema oscuro activado.' : 'Tema claro activado.');
}

function applyFontSize(size) {
  const normalized = normalizeFontSize(size);

  state.prefs.fontSize = normalized;
  docSheet.style.setProperty('--reader-size', `${normalized}px`);
  fontDecrease.disabled = normalized <= FONT_MIN;
  fontIncrease.disabled = normalized >= FONT_MAX;
}

function changeFontSize(delta) {
  const next = normalizeFontSize(state.prefs.fontSize + delta);

  if (next === state.prefs.fontSize) {
    announce(
      delta < 0
        ? `El tamaño mínimo es ${FONT_MIN} píxeles.`
        : `El tamaño máximo es ${FONT_MAX} píxeles.`
    );
    return;
  }

  const anchor = beginScrollAnchor();

  applyFontSize(next);
  runScrollAnchor(anchor, 0);
  scheduleReadingPositionSave();
  state.prefs = writePrefs({ ...state.prefs, fontSize: next });
  announce(`Tamaño del texto: ${next} píxeles.`);
}

darkQuery.addEventListener('change', (event) => {
  if (state.prefs.theme === 'system') {
    applyTheme(event.matches ? 'dark' : 'light');
  }
});

/* ---------- Anclaje del scroll ---------- */

function beginScrollAnchor() {
  if (docPane.scrollTop <= 1 || docContent.hidden) {
    return null;
  }

  const paneTop = docPane.getBoundingClientRect().top;
  const blocks = Array.from(
    docContent.querySelectorAll(':scope > section > *, :scope > :not(section)')
  );

  for (const block of blocks) {
    const rect = block.getBoundingClientRect();

    if (rect.height === 0) {
      continue;
    }

    if (rect.bottom > paneTop + 1) {
      return {
        element: block,
        offset: rect.top - paneTop
      };
    }
  }

  return null;
}

function runScrollAnchor(anchor, duration) {
  const token = ++anchorFrame;

  if (!anchor) {
    return;
  }

  const end = performance.now() + duration;

  const adjust = () => {
    if (!anchor.element.isConnected) {
      return;
    }

    const paneTop = docPane.getBoundingClientRect().top;
    const delta = anchor.element.getBoundingClientRect().top - paneTop - anchor.offset;

    if (Math.abs(delta) > 0.5) {
      docPane.scrollTop += delta;
    }
  };

  const step = () => {
    if (token !== anchorFrame) {
      return;
    }

    adjust();

    if (performance.now() < end) {
      window.requestAnimationFrame(step);
    }
  };

  window.requestAnimationFrame(step);
}

function currentReadingPosition() {
  if (docPane.scrollTop <= 1 || !state.headings.length) {
    return null;
  }

  const paneTop = docPane.getBoundingClientRect().top;
  let firstHeading = null;
  let currentHeading = null;

  for (const item of state.headings) {
    const heading = document.getElementById(item.id);

    if (!heading || !docContent.contains(heading)) {
      continue;
    }

    if (!firstHeading) {
      firstHeading = heading;
    }

    if (heading.getBoundingClientRect().top <= paneTop + 1) {
      currentHeading = heading;
    } else {
      break;
    }
  }

  const anchor = currentHeading || firstHeading;

  return anchor
    ? {
      anchorId: anchor.id,
      offset: anchor.getBoundingClientRect().top - paneTop
    }
    : null;
}

function warnReadingPositionStorage() {
  if (readingPositionWarningShown) {
    return;
  }

  readingPositionWarningShown = true;
  showToast('El navegador no permitió guardar tu posición de lectura.', 'warning');
}

function saveReadingPosition() {
  readingPositionTimer = 0;

  if (!readingPositionReady) {
    return;
  }

  if (docPane.scrollTop <= 1) {
    if (!clearReadingPosition()) {
      warnReadingPositionStorage();
    }

    return;
  }

  const position = currentReadingPosition();

  if (position && !writeReadingPosition(position)) {
    warnReadingPositionStorage();
  }
}

function scheduleReadingPositionSave() {
  if (!readingPositionReady) {
    return;
  }

  window.clearTimeout(readingPositionTimer);
  readingPositionTimer = window.setTimeout(saveReadingPosition, 250);
}

function flushReadingPosition() {
  window.clearTimeout(readingPositionTimer);
  saveReadingPosition();
}

function restoreReadingPosition() {
  const saved = readReadingPosition();

  if (!saved) {
    readingPositionReady = true;
    return;
  }

  const restore = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (currentHashTarget()) {
          readingPositionReady = true;
          return;
        }

        const anchor = document.getElementById(saved.anchorId);

        if (!anchor || !docContent.contains(anchor)) {
          clearReadingPosition();
          readingPositionReady = true;
          return;
        }

        const paneTop = docPane.getBoundingClientRect().top;
        const delta = anchor.getBoundingClientRect().top - paneTop - saved.offset;

        if (!Number.isFinite(delta)) {
          clearReadingPosition();
          readingPositionReady = true;
          return;
        }

        readingPositionReady = true;
        docPane.scrollTop = Math.max(0, docPane.scrollTop + delta);

        if (docPane.scrollTop > 1) {
          showToast('Se retomó la lectura desde tu última posición.', 'info', 4000);
          announce('Se retomó la lectura desde tu última posición.');
        }
      });
    });
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(restore, restore);
  } else {
    restore();
  }
}

function restoreHashPosition(targetId) {
  const restore = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (currentHashTarget() !== targetId) {
          readingPositionReady = true;
          return;
        }

        const target = document.getElementById(targetId);

        if (!target || !docContent.contains(target)) {
          const baseUrl = `${window.location.pathname}${window.location.search}`;

          history.replaceState(null, '', baseUrl);
          lastHandledHash = '';
          showToast('La sección del enlace ya no existe.', 'warning');
          restoreReadingPosition();
          return;
        }

        scrollToDocumentTarget(target);
        readingPositionReady = true;
      });
    });
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(restore, restore);
  } else {
    restore();
  }
}

/* ---------- Panel de medios (Hito 0 conservado) ---------- */

function mediaFromLink(link) {
  const provider = link.dataset.provider;
  const type = link.dataset.type;
  const id = link.dataset.id;
  const embedUrl = link.dataset.embed;

  if (
    !PROVIDERS[provider] ||
    !type ||
    !id ||
    (provider !== 'instagram' && !embedUrl)
  ) {
    return null;
  }

  return {
    key: `${provider}:${type}:${id}`,
    provider,
    type,
    id,
    label: (link.dataset.label || TYPE_LABELS[type] || 'Contenido multimedia').trim(),
    href: link.href,
    embedUrl,
    height: Number(link.dataset.height) || null,
    trigger: link
  };
}

function isAllowedEmbed(url, provider) {
  try {
    const parsed = new URL(url, document.baseURI);

    if (parsed.protocol !== 'https:') {
      return false;
    }

    if (provider === 'youtube') {
      return (
        parsed.hostname === 'www.youtube-nocookie.com' &&
        parsed.pathname.startsWith('/embed/')
      );
    }

    if (provider === 'spotify') {
      return parsed.hostname === 'open.spotify.com' && parsed.pathname.startsWith('/embed/');
    }

    return false;
  } catch {
    return false;
  }
}

function safeExternalUrl(url) {
  try {
    const parsed = new URL(url, document.baseURI);

    if (parsed.protocol !== 'https:') {
      return null;
    }

    const allowedHosts = new Set([
      'www.youtube.com',
      'youtube.com',
      'm.youtube.com',
      'music.youtube.com',
      'youtu.be',
      'open.spotify.com'
    ]);

    const isInstagramReel =
      ['instagram.com', 'www.instagram.com'].includes(parsed.hostname) &&
      /^\/reel\/[A-Za-z0-9_-]+\/?$/.test(parsed.pathname);

    return allowedHosts.has(parsed.hostname) || isInstagramReel
      ? parsed.href
      : null;


  } catch {
    return null;
  }
}

function transitionDuration(opening) {
  if (motionQuery.matches) {
    return 0;
  }

  return opening ? 360 : 320;
}

function stageHeightFor(media, availableWidth) {
  if (media.provider === 'youtube') {
    return Math.round((availableWidth * 9) / 16);
  }

  return media.height || 352;
}

function updateMediaSize() {
  if (!activeMedia) {
    return;
  }

  const width = mediaPanelInner.getBoundingClientRect().width;

  if (!width) {
    return;
  }

  const barHeight = mediaBar.getBoundingClientRect().height;
  const fallbackHeight = mediaFallback.getBoundingClientRect().height;
  const noteHeight = mediaNote.hidden ? 0 : mediaNote.getBoundingClientRect().height;
  const isDesktop = desktopQuery.matches;

  let stageHeight = stageHeightFor(activeMedia, width);

  if (isDesktop) {
    const maxStage = Math.max(
      160,
      window.innerHeight - barHeight - fallbackHeight - noteHeight - 36
    );
    stageHeight = Math.min(stageHeight, maxStage);
    mediaPanel.style.setProperty('--stage-h', `${Math.round(stageHeight)}px`);
    mediaPanel.style.removeProperty('--media-h');
    return;
  }

  const maxPanelHeight = Math.round(workspace.clientHeight * 0.55);
  const analysisTriggerHeight = mediaAnalysisTrigger.hidden
    ? 0
    : mediaAnalysisTrigger.getBoundingClientRect().height +
    Number.parseFloat(getComputedStyle(mediaAnalysisTrigger).marginTop) +
    Number.parseFloat(getComputedStyle(mediaAnalysisTrigger).marginBottom);
  const availableForStage = Math.max(
    80,
    maxPanelHeight - barHeight - fallbackHeight - noteHeight - analysisTriggerHeight
  );

  stageHeight = Math.min(stageHeight, availableForStage);

  const panelHeight = Math.min(
    barHeight + stageHeight + fallbackHeight + noteHeight + analysisTriggerHeight,
    maxPanelHeight
  );

  mediaPanel.style.setProperty('--stage-h', `${Math.round(stageHeight)}px`);
  mediaPanel.style.setProperty('--media-h', `${Math.round(panelHeight)}px`);

  if (mediaAnalysisDialog.open) {
    updateMediaAnalysisDialogPosition();
  }
}

function destroyIframe() {
  window.clearTimeout(loadTimer);
  loadTimer = 0;

  // Invalida cualquier proceso de carga de Instagram pendiente.
  instagramRenderToken++;

  if (instagramObserver) {
    instagramObserver.disconnect();
    instagramObserver = null;
  }

  if (currentIframe) {
    currentIframe.remove();
    currentIframe = null;
  }

  if (currentInstagramEmbed) {
    currentInstagramEmbed.remove();
    currentInstagramEmbed = null;
  }

  mediaStage
  .querySelectorAll('iframe.instagram-media-rendered')
  .forEach((iframe) => iframe.remove());

  mediaStage.classList.remove('is-ready');
  mediaStage.setAttribute('aria-busy', 'false');
}

function isAllowedInstagramUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' &&
      ['instagram.com', 'www.instagram.com'].includes(url.hostname) &&
      /^\/reel\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function loadInstagramScript() {
  if (window.instgrm?.Embeds?.process) {
    return Promise.resolve();
  }

  if (instagramScriptPromise) {
    return instagramScriptPromise;
  }

  instagramScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');

    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;

    script.addEventListener('load', resolve, { once: true });

    script.addEventListener(
      'error',
      () => reject(new Error('No se pudo cargar Instagram Embed.')),
      { once: true }
    );

    document.head.append(script);
  }).catch((error) => {
    instagramScriptPromise = null;
    throw error;
  });

  return instagramScriptPromise;
}

function createInstagramEmbed(media) {
  const token = instagramRenderToken;

  const blockquote = document.createElement('blockquote');

  blockquote.className = 'instagram-media';
  blockquote.setAttribute('data-instgrm-permalink', media.href);
  blockquote.setAttribute('data-instgrm-version', '14');

  const link = document.createElement('a');

  link.href = media.href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Ver publicación en Instagram';

  blockquote.append(link);

  currentInstagramEmbed = blockquote;
  mediaStage.append(blockquote);

  const markReady = () => {
    if (
      token !== instagramRenderToken ||
      currentInstagramEmbed !== blockquote
    ) {
      return;
    }

    window.clearTimeout(loadTimer);
    loadTimer = 0;

    mediaStage.classList.add('is-ready');
    mediaStage.setAttribute('aria-busy', 'false');

    if (instagramObserver) {
      instagramObserver.disconnect();
      instagramObserver = null;
    }
  };

  loadInstagramScript()
    .then(() => {
      if (
        token !== instagramRenderToken ||
        currentInstagramEmbed !== blockquote
      ) {
        return;
      }

      instagramObserver = new MutationObserver(() => {
        const iframe = mediaStage.querySelector(
          'iframe.instagram-media-rendered'
        );

        if (iframe) {
          markReady();
        }
      });

      instagramObserver.observe(mediaStage, {
        childList: true,
        subtree: true
      });

      loadTimer = window.setTimeout(() => {
        if (
          token !== instagramRenderToken ||
          currentInstagramEmbed !== blockquote
        ) {
          return;
        }

        mediaStage.setAttribute('aria-busy', 'false');
      }, 12000);

      window.instgrm.Embeds.process();

      if (mediaStage.querySelector('iframe.instagram-media-rendered')) {
        markReady();
      }
    })
    .catch((error) => {
      if (token !== instagramRenderToken) {
        return;
      }

      console.error('Error al cargar el Reel de Instagram:', error);
      mediaStage.setAttribute('aria-busy', 'false');
      announce('No se pudo cargar el Reel de Instagram.');
    });
}

function createIframe(media) {
  if (media.provider === 'instagram') {
    createInstagramEmbed(media);
    return;
  }

  const provider = PROVIDERS[media.provider];

  const iframe = document.createElement('iframe');

  iframe.src = media.embedUrl;
  iframe.title = `${provider.frameTitle}: ${media.label}`;
  iframe.allow = provider.allow;
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.loading = 'eager';

  iframe.tabIndex = -1;
  iframe.setAttribute('aria-hidden', 'true');

  mediaStage.classList.remove('is-ready');
  mediaStage.setAttribute('aria-busy', 'true');

  iframe.addEventListener(
    'load',
    () => {
      if (iframe !== currentIframe) {
        return;
      }

      window.clearTimeout(loadTimer);
      loadTimer = 0;
      iframe.removeAttribute('tabindex');
      iframe.removeAttribute('aria-hidden');
      mediaStage.classList.add('is-ready');
      mediaStage.setAttribute('aria-busy', 'false');
    },
    { once: true }
  );

  currentIframe = iframe;
  mediaStage.append(iframe);

  loadTimer = window.setTimeout(() => {
    if (iframe !== currentIframe) {
      return;
    }

    mediaStage.setAttribute('aria-busy', 'false');
  }, 12000);
}

function clearActiveLink() {
  document.querySelectorAll('.media-link[data-media]').forEach((link) => {
    link.classList.remove('is-active');
    link.setAttribute('aria-expanded', 'false');
  });
}

function enhanceMediaLinks() {
  docContent.querySelectorAll('.media-link[data-media]').forEach((link) => {
    const media = mediaFromLink(link);

    if (!media) {
      return;
    }

    const provider = PROVIDERS[media.provider];
    const visibleText = link.textContent.replace(/\s+/g, ' ').trim();

    link.setAttribute(
      'aria-label',
      `${visibleText}. Abrir en el reproductor de ${provider.name}.`
    );
  });
}

function openMedia(media, trigger) {
  if (!media) {
    return;
  }

  const isAllowed =
    media.provider === 'instagram'
      ? isAllowedInstagramUrl(media.href)
      : isAllowedEmbed(media.embedUrl, media.provider);

  if (!isAllowed) {
    console.error('Se rechazó una URL multimedia no permitida.', media);
    announce('No se pudo abrir el reproductor.');
    return;
  }

  window.clearTimeout(closeCleanupTimer);

  const wasOpen = isOpen;
  const anchor = beginScrollAnchor();
  const provider = PROVIDERS[media.provider];

  mediaPanel.classList.remove('is-closing');
  destroyIframe();
  clearActiveLink();

  activeMedia = media;
  activeTrigger = trigger;
  isOpen = true;
  updateMediaAnalysisAvailability();

  mediaProvider.dataset.provider = media.provider;
  mediaProvider.textContent = provider.name;
  mediaLabel.textContent = media.label;
  mediaLabel.title = media.label;

  const externalUrl = safeExternalUrl(media.href);

  if (externalUrl) {
    mediaExternal.hidden = false;
    mediaExternal.href = externalUrl;
    mediaExternal.querySelector('span').textContent = provider.externalLabel;
    mediaExternal.setAttribute('aria-label', `${provider.externalLabel}: ${media.label}`);
    mediaFallbackMessage.textContent = 'Espera unos segundos. Si no se reproduce aquí, puedes';
    mediaFallbackPeriod.hidden = false;
  } else {
    mediaExternal.hidden = true;
    mediaExternal.removeAttribute('href');
    mediaFallbackMessage.textContent = 'No hay un enlace externo disponible para este contenido.';
    mediaFallbackPeriod.hidden = true;
  }

  mediaNote.hidden = navigator.onLine;
  mediaNote.textContent = navigator.onLine
    ? ''
    : 'Sin conexión. El documento sigue disponible, pero los contenidos multimedia no se pueden cargar.';

  mediaStage.dataset.provider = media.provider;

  mediaPanel.inert = false;
  mediaPanel.removeAttribute('inert');
  mediaPanel.removeAttribute('aria-hidden');

  trigger.classList.add('is-active');
  trigger.setAttribute('aria-expanded', 'true');

  updateMediaSize();
  createIframe(media);

  if (!wasOpen) {
    mediaPanel.classList.remove('is-open');
    void mediaPanel.offsetWidth;
  }

  mediaPanel.classList.add('is-open');
  appContainer.classList.add('has-open-media');
  workspace.classList.add('has-open-media');
  window.requestAnimationFrame(updateMediaSize);

  runScrollAnchor(anchor, transitionDuration(!wasOpen));

  announce(`Reproductor de ${provider.name} abierto.`);

  window.requestAnimationFrame(() => {
    mediaClose.focus({ preventScroll: true });
  });
}

function closeMedia() {
  if (!isOpen) {
    return;
  }

  closeNavigationDialog(mediaAnalysisDialog);
  mediaAnalysisTrigger.hidden = true;

  const anchor = beginScrollAnchor();
  const focusTarget = activeTrigger;

  isOpen = false;

  mediaPanel.classList.add('is-closing');
  destroyIframe();
  mediaPanel.classList.remove('is-open');
  appContainer.classList.remove('has-open-media');
  workspace.classList.remove('has-open-media');
  hideTocTooltip();
  mediaPanel.setAttribute('inert', '');
  mediaPanel.setAttribute('aria-hidden', 'true');

  clearActiveLink();

  activeMedia = null;
  activeTrigger = null;

  runScrollAnchor(anchor, transitionDuration(false));

  const fallback = docContent.querySelector('.media-link[data-media]');

  if (focusTarget && focusTarget.isConnected) {
    focusTarget.focus({ preventScroll: true });
  } else if (fallback) {
    fallback.focus({ preventScroll: true });
  } else {
    docPane.focus({ preventScroll: true });
  }

  announce('Reproductor cerrado. Vuelves al documento.');

  window.clearTimeout(closeCleanupTimer);
  closeCleanupTimer = window.setTimeout(() => {
    if (isOpen) {
      return;
    }

    mediaPanel.classList.remove('is-closing');
    mediaLabel.textContent = '';
    mediaLabel.removeAttribute('title');
    mediaExternal.removeAttribute('href');
    mediaNote.hidden = true;
    mediaNote.textContent = '';
    mediaStage.removeAttribute('data-provider');
    mediaStage.classList.remove('is-ready');
    mediaStage.setAttribute('aria-busy', 'false');
  }, motionQuery.matches ? 0 : 320);
}

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const link = event.target.closest('.media-link[data-media]');

  if (!link) {
    return;
  }

  if (event.defaultPrevented || event.button !== 0) {
    return;
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  const media = mediaFromLink(link);

  if (!media) {
    return;
  }

  event.preventDefault();
  openMedia(media, link);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || event.defaultPrevented) {
    return;
  }

  if (mediaAnalysisDialog.open) {
    event.preventDefault();
    closeNavigationDialog(mediaAnalysisDialog);
    return;
  }

  if (mediaDialog.open) {
    event.preventDefault();
    closeNavigationDialog(mediaDialog);
    return;
  }

  if (!tocTooltip.hidden) {
    event.preventDefault();
    hideTocTooltip();
    return;
  }

  if (!desktopQuery.matches && tocSidebar.classList.contains('is-open')) {
    event.preventDefault();
    setTocOpen(false, { restoreFocus: true });
    return;
  }

  if (!isOpen) {
    return;
  }

  event.preventDefault();
  closeMedia();
});

mediaClose.addEventListener('click', closeMedia);

function handleResize() {
  scheduleReadingPositionSave();
  updateMediaAnalysisAvailability();

  if (!isCompactToc()) {
    hideTocTooltip();
  }

  if (!isOpen || resizeFrame) {
    return;
  }

  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = 0;

    if (!isOpen) {
      return;
    }

    const anchor = beginScrollAnchor();

    mediaPanel.classList.add('is-resizing');
    updateMediaSize();
    runScrollAnchor(anchor, 0);

    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      mediaPanel.classList.remove('is-resizing');
    }, 180);
  });
}

window.addEventListener('resize', handleResize, { passive: true });

workspace.addEventListener('transitionend', (event) => {
  if (event.target === workspace && event.propertyName === 'grid-template-columns' && isOpen) {
    updateMediaSize();
  }
});

mediaPanel.addEventListener('transitionend', (event) => {
  if (event.propertyName === 'height' && mediaAnalysisDialog.open) {
    updateMediaAnalysisDialogPosition();
  }
});

function updateConnectionNote() {
  if (!isOpen) {
    return;
  }

  const offline = !navigator.onLine;

  mediaNote.hidden = !offline;
  mediaNote.textContent = offline
    ? 'Sin conexión. El documento sigue disponible, pero YouTube o Spotify no se pueden cargar.'
    : '';

  updateMediaSize();
}

window.addEventListener('online', updateConnectionNote);
window.addEventListener('offline', updateConnectionNote);
window.addEventListener('hashchange', handleHashNavigation);
window.addEventListener('popstate', handleHashNavigation);

/* ---------- Eventos de la interfaz ---------- */

themeToggle.addEventListener('click', toggleTheme);
fontDecrease.addEventListener('click', () => changeFontSize(-FONT_STEP));
fontIncrease.addEventListener('click', () => changeFontSize(FONT_STEP));

/* ---------- Arranque ---------- */

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

applyFontSize(state.prefs.fontSize);
syncThemeButton();
showReader(prepareDocument(docContent).headings, { focus: false });
loadVideoAnalyses();
docPane.addEventListener('scroll', scheduleReadingPositionSave, { passive: true });
window.addEventListener('pagehide', flushReadingPosition);

const initialHashTarget = currentHashTarget();

if (initialHashTarget) {
  restoreHashPosition(initialHashTarget);
} else {
  restoreReadingPosition();
}

window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => {
    document.documentElement.classList.remove('no-transitions');
  });
});
