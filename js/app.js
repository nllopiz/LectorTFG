/**
 * Lector del TFG
 * Coordina el documento fijo, las preferencias de lectura y el panel de medios.
 */

import { prepareDocument } from './docx.js';

import {
  FONT_MAX,
  FONT_MIN,
  FONT_STEP,
  normalizeFontSize,
  readPrefs,
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

const workspace = document.getElementById('workspace');
const mediaPanel = document.getElementById('media-panel');
const mediaPanelInner = mediaPanel.querySelector('.media-panel__inner');
const mediaBar = mediaPanel.querySelector('.media-panel__bar');
const mediaStage = document.getElementById('media-stage');
const mediaProvider = document.getElementById('media-provider');
const mediaLabel = document.getElementById('media-label');
const mediaExternal = document.getElementById('media-external');
const mediaClose = document.getElementById('media-close');
const mediaFallback = document.getElementById('media-fallback');
const mediaNote = document.getElementById('media-note');

const desktopQuery = window.matchMedia('(min-width: 900px)');
const landscapeQuery = window.matchMedia('(orientation: landscape)');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

const DOCUMENT_NAME = 'Lector TFG';

const state = {
  view: 'reader',
  doc: null,
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
let currentIframe = null;
let isOpen = false;
let loadTimer = 0;
let closeCleanupTimer = 0;
let resizeTimer = 0;
let resizeFrame = 0;
let announceTimer = 0;
let anchorFrame = 0;
let headingObserver = null;

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

/* ---------- Vistas ---------- */

function setView({ focus = true } = {}) {
  state.view = 'reader';
  docPane.hidden = false;
  docInfo.hidden = false;
  fontControls.hidden = false;
  updateTocLayout();

  const firstHeading = state.headings[0];
  skipLink.setAttribute('href', `#${firstHeading ? firstHeading.id : 'doc-pane'}`);
  document.title = `${DOCUMENT_NAME}`;

  if (!focus) {
    return;
  }

  docPane.focus({ preventScroll: true });
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

function showReader(doc, headings, { focus = true } = {}) {
  state.doc = doc;
  state.headings = headings;
  enhanceMediaLinks();
  updateNavigation();
  observeHeadings();

  updateDocInfo();
  setView({ focus });

  announce(`Documento abierto: ${doc.name}.`);
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
    const empty = document.createElement('p');
    empty.className = 'navigation-empty';
    empty.textContent = 'Este documento no contiene enlaces de YouTube o Spotify.';
    mediaList.append(empty);
    return;
  }

  state.media.forEach((media, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'media-list-item';
    item.dataset.mediaIndex = String(index);

    const provider = document.createElement('span');
    provider.className = `media-list-item__provider media-list-item__provider--${media.provider}`;
    provider.textContent = media.provider === 'youtube' ? 'YouTube' : 'Spotify';

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
    mediaList.append(item);
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

  headingObserver = new IntersectionObserver((entries) => {
    const visibleHeadings = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

    if (visibleHeadings.length) {
      setActiveTocHeading(visibleHeadings[0].target.id);
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

tocButton.addEventListener('click', () => {
  setTocOpen(!tocSidebar.classList.contains('is-open'));
});
tocClose.addEventListener('click', () => setTocOpen(false, { restoreFocus: true }));
tocBackdrop.addEventListener('click', () => setTocOpen(false, { restoreFocus: true }));
mediaButton.addEventListener('click', () => openNavigationDialog(mediaDialog));
desktopQuery.addEventListener('change', updateTocLayout);

document.querySelectorAll('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', () => {
    const dialog = document.getElementById(button.dataset.closeDialog);

    if (dialog instanceof HTMLDialogElement) {
      closeNavigationDialog(dialog);
    }
  });
});

[mediaDialog].forEach((dialog) => {
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
  target.scrollIntoView({
    behavior: motionQuery.matches ? 'auto' : 'smooth',
    block: 'start'
  });
  target.focus({ preventScroll: true });
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

  let targetId = href.slice(1);

  try {
    targetId = decodeURIComponent(targetId);
  } catch (error) {
    targetId = href.slice(1);
  }

  if (!targetId) {
    docPane.scrollTo({ top: 0, behavior: motionQuery.matches ? 'auto' : 'smooth' });
    return;
  }

  const target = document.getElementById(targetId);

  if (!target || !docContent.contains(target)) {
    showToast('Ese enlace interno no tiene destino en el documento.', 'warning');
    announce('El enlace interno no tiene destino.');
    return;
  }

  target.setAttribute('tabindex', '-1');
  target.scrollIntoView({
    behavior: motionQuery.matches ? 'auto' : 'smooth',
    block: 'start'
  });
  target.focus({ preventScroll: true });
  announce(`Sección: ${target.textContent.trim().slice(0, 90) || targetId}`);
});

/* ---------- Preferencias: tema y tamaño ---------- */

function syncThemeButton() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  const nextLabel = isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

  themeToggle.setAttribute('aria-label', nextLabel);
  themeToggle.title = nextLabel;

  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', isDark ? '#2B1F10' : '#F3EFDD');
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

  applyFontSize(next);
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
  const blocks = Array.from(docContent.children);

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

/* ---------- Panel de medios (Hito 0 conservado) ---------- */

function mediaFromLink(link) {
  const provider = link.dataset.provider;
  const type = link.dataset.type;
  const id = link.dataset.id;
  const embedUrl = link.dataset.embed;

  if (!PROVIDERS[provider] || !type || !id || !embedUrl) {
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
  } catch (error) {
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

    return allowedHosts.has(parsed.hostname) ? parsed.href : null;
  } catch (error) {
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
  const availableForStage = Math.max(
    80,
    maxPanelHeight - barHeight - fallbackHeight - noteHeight
  );

  stageHeight = Math.min(stageHeight, availableForStage);

  const panelHeight = Math.min(
    barHeight + stageHeight + fallbackHeight + noteHeight,
    maxPanelHeight
  );

  mediaPanel.style.setProperty('--stage-h', `${Math.round(stageHeight)}px`);
  mediaPanel.style.setProperty('--media-h', `${Math.round(panelHeight)}px`);
}

function destroyIframe() {
  window.clearTimeout(loadTimer);
  loadTimer = 0;

  if (currentIframe) {
    currentIframe.remove();
    currentIframe = null;
  }

  mediaStage.classList.remove('is-ready');
  mediaStage.setAttribute('aria-busy', 'false');
}

function createIframe(media) {
  const provider = PROVIDERS[media.provider];
  const iframe = document.createElement('iframe');

  iframe.src = media.embedUrl;
  iframe.title = `${provider.frameTitle}: ${media.label}`;
  iframe.allow = provider.allow;
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

  if (!isAllowedEmbed(media.embedUrl, media.provider)) {
    console.error('Se rechazó una URL de embed no permitida.', media.embedUrl);
    announce('No se pudo abrir el reproductor.');
    return;
  }

  if (isOpen && activeMedia && activeMedia.key === media.key) {
    mediaClose.focus({ preventScroll: true });
    announce(`El reproductor de ${PROVIDERS[media.provider].name} ya está abierto.`);
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
    mediaFallback.textContent = `Si no se reproduce aquí, usa «${provider.externalLabel}».`;
  } else {
    mediaExternal.hidden = true;
    mediaExternal.removeAttribute('href');
    mediaFallback.textContent = 'No hay un enlace externo disponible para este contenido.';
  }

  mediaNote.hidden = navigator.onLine;
  mediaNote.textContent = navigator.onLine
    ? ''
    : 'Sin conexión. El documento sigue disponible, pero YouTube o Spotify no se pueden cargar.';

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

  const anchor = beginScrollAnchor();
  const focusTarget = activeTrigger;

  isOpen = false;

  mediaPanel.classList.add('is-closing');
  destroyIframe();
  mediaPanel.classList.remove('is-open');
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

/* ---------- Eventos de la interfaz ---------- */

themeToggle.addEventListener('click', toggleTheme);
fontDecrease.addEventListener('click', () => changeFontSize(-FONT_STEP));
fontIncrease.addEventListener('click', () => changeFontSize(FONT_STEP));

/* ---------- Arranque ---------- */

applyFontSize(state.prefs.fontSize);
syncThemeButton();
showReader({ name: DOCUMENT_NAME }, prepareDocument(docContent).headings, { focus: false });

window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => {
    document.documentElement.classList.remove('no-transitions');
  });
});
