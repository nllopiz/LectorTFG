import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseHTML } from 'linkedom';

import { prepareDocument } from '../js/document.js';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const BASE_URL = 'https://example.test/';
const BASE_ORIGIN = new URL(BASE_URL).origin;
const IDREF_ATTRIBUTES = [
  'aria-controls',
  'aria-describedby',
  'aria-labelledby',
  'aria-owns',
  'aria-activedescendant',
  'aria-details',
  'aria-errormessage'
];

const requestedFile = process.argv[2];
const htmlFile = requestedFile
  ? path.resolve(process.cwd(), requestedFile)
  : path.join(ROOT, 'index.html');

const errors = [];
const warnings = [];
const checkedFiles = new Map();

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function describe(element) {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';

  return `<${tag}${id}>`;
}

function textOf(element) {
  return String(element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function hasRelToken(element, token) {
  return (element.getAttribute('rel') || '')
    .toLowerCase()
    .split(/\s+/)
    .includes(token);
}

function isSpecialUrl(value) {
  return !value ||
    value.startsWith('#') ||
    value.startsWith('//') ||
    /^(?:https?:|mailto:|tel:|data:)/i.test(value);
}

async function checkLocalFile(raw, context) {
  const value = String(raw ?? '').trim();

  if (isSpecialUrl(value)) {
    return;
  }

  let url;

  try {
    url = new URL(value, BASE_URL);
  } catch {
    fail(`${context}: URL local inválida "${value}".`);
    return;
  }

  if (url.origin !== BASE_ORIGIN) {
    return;
  }

  let pathname;

  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    fail(`${context}: la ruta "${value}" tiene una codificación inválida.`);
    return;
  }

  const filePath = path.resolve(ROOT, `.${pathname}`);
  const relativePath = path.relative(ROOT, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    fail(`${context}: la ruta "${value}" queda fuera del proyecto.`);
    return;
  }

  if (checkedFiles.has(filePath)) {
    return;
  }

  try {
    const info = await stat(filePath);

    if (!info.isFile()) {
      fail(`${context}: "${value}" no es un archivo.`);
    }
  } catch {
    fail(`${context}: no existe el archivo local "${value}".`);
  }

  checkedFiles.set(filePath, value);
}

function srcsetUrls(value) {
  return String(value)
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function checkInlineCode(document) {
  for (const element of document.querySelectorAll('*')) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith('on')) {
        fail(`${describe(element)}: atributo de evento en línea "${attribute.name}".`);
      }

      if (attribute.name.toLowerCase() === 'style') {
        fail(`${describe(element)}: estilo en línea bloqueado por la CSP.`);
      }
    }
  }

  for (const script of document.querySelectorAll('script')) {
    if (!script.hasAttribute('src')) {
      fail('Hay un script en línea; la CSP solo permite scripts locales.');
    }
  }
}

function checkExternalLinks(document) {
  for (const link of document.querySelectorAll('a[target="_blank"]')) {
    if (!hasRelToken(link, 'noopener') || !hasRelToken(link, 'noreferrer')) {
      fail(
        `${describe(link)}: target="_blank" sin rel="noopener noreferrer" ` +
        `(${link.getAttribute('href') || 'sin href'}).`
      );
    }
  }

  for (const link of document.querySelectorAll('a[href]')) {
    const raw = (link.getAttribute('href') || '').trim();

    if (!raw) {
      fail(`${describe(link)}: enlace con href vacío.`);
      continue;
    }

    if (raw.startsWith('#')) {
      continue;
    }

    let url;

    try {
      url = new URL(raw, BASE_URL);
    } catch {
      fail(`${describe(link)}: URL inválida "${raw}".`);
      continue;
    }

    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
      fail(`${describe(link)}: protocolo no permitido "${url.protocol}".`);
    }
  }
}

function checkImages(document) {
  for (const image of document.querySelectorAll('img')) {
    const src = image.getAttribute('src') || '(sin src)';
    const alt = image.getAttribute('alt');

    if (alt === null || !alt.trim()) {
      fail(`${describe(image)}: imagen sin texto alternativo (${src}).`);
    }

    for (const dimension of ['width', 'height']) {
      const value = image.getAttribute(dimension);

      if (!value || !/^\d+$/.test(value)) {
        fail(`${describe(image)}: falta ${dimension} numérico (${src}).`);
      }
    }

    if (!image.hasAttribute('src')) {
      fail(`${describe(image)}: imagen sin src.`);
    }
  }
}

async function checkLocalResources(document) {
  for (const element of document.querySelectorAll('[src]')) {
    await checkLocalFile(element.getAttribute('src'), `${describe(element)}[src]`);
  }

  for (const element of document.querySelectorAll('[srcset]')) {
    for (const url of srcsetUrls(element.getAttribute('srcset'))) {
      await checkLocalFile(url, `${describe(element)}[srcset]`);
    }
  }

  for (const element of document.querySelectorAll('a[href]')) {
    await checkLocalFile(element.getAttribute('href'), `${describe(element)}[href]`);
  }

  for (const element of document.querySelectorAll('link[href]')) {
    await checkLocalFile(element.getAttribute('href'), `${describe(element)}[href]`);
  }
}

function checkIdsAndAria(document) {
  const ids = new Set();

  for (const element of document.querySelectorAll('[id]')) {
    if (ids.has(element.id)) {
      fail(`ID duplicado "${element.id}" en ${describe(element)}.`);
    } else {
      ids.add(element.id);
    }
  }

  for (const element of document.querySelectorAll('*')) {
    for (const attributeName of IDREF_ATTRIBUTES) {
      const value = element.getAttribute(attributeName);

      if (!value) {
        continue;
      }

      for (const id of value.split(/\s+/).filter(Boolean)) {
        if (!document.getElementById(id)) {
          fail(
            `${describe(element)}: ${attributeName} apunta a un ID inexistente ` +
            `("${id}").`
          );
        }
      }
    }
  }
}

function checkHeadings(document, container) {
  const headings = Array.from(
    container.querySelectorAll('h1, h2, h3, h4, h5, h6')
  );
  let previousLevel = 0;

  if (document.querySelectorAll('h1').length !== 1) {
    fail('El documento debe tener exactamente un h1.');
  }

  for (const heading of headings) {
    const level = Number(heading.tagName.charAt(1));
    const text = textOf(heading);

    if (!text) {
      fail(`${describe(heading)}: encabezado vacío.`);
    }

    if (previousLevel && level > previousLevel + 1) {
      fail(
        `${describe(heading)}: salto de nivel de h${previousLevel} a h${level} ` +
        `("${text.slice(0, 60)}").`
      );
    }

    if (heading.getAttribute('tabindex') !== '-1') {
      fail(`${describe(heading)}: encabezado sin tabindex="-1".`);
    }

    previousLevel = level;
  }

  return headings.length;
}

function checkTables(container) {
  for (const table of container.querySelectorAll('table')) {
    const wrapper = table.parentElement;

    if (!wrapper?.classList.contains('table-scroll')) {
      fail(`${describe(table)}: tabla sin contenedor .table-scroll.`);
      continue;
    }

    if (wrapper.getAttribute('role') !== 'region') {
      fail(`${describe(table)}: contenedor de tabla sin role="region".`);
    }

    if (wrapper.getAttribute('tabindex') !== '0') {
      fail(`${describe(table)}: contenedor de tabla sin tabindex="0".`);
    }

    if (!wrapper.getAttribute('aria-label')) {
      fail(`${describe(table)}: contenedor de tabla sin aria-label.`);
    }

    if (!table.querySelector('caption')) {
      warn(`${describe(table)}: tabla sin caption; el nombre accesible es genérico.`);
    }
  }
}

function checkMediaLinks(container) {
  const mediaLinks = Array.from(
    container.querySelectorAll('.media-link[data-media]')
  );
  const uniqueMedia = new Set();

  for (const link of mediaLinks) {
    if (link.getAttribute('aria-controls') !== 'media-panel') {
      fail(`${describe(link)}: enlace multimedia sin aria-controls="media-panel".`);
    }

    if (link.getAttribute('aria-expanded') !== 'false') {
      fail(`${describe(link)}: enlace multimedia sin aria-expanded="false".`);
    }

    if (!['youtube', 'instagram'].includes(link.dataset.provider)) {
      fail(`${describe(link)}: proveedor multimedia desconocido.`);
    }

    uniqueMedia.add(`${link.dataset.provider}:${link.dataset.id}`);
  }

  return {
    total: mediaLinks.length,
    unique: uniqueMedia.size
  };
}

function checkInternalAnchors(document) {
  for (const link of document.querySelectorAll('a[href^="#"]')) {
    const raw = link.getAttribute('href') || '';
    let id;

    try {
      id = decodeURIComponent(raw.slice(1));
    } catch {
      fail(`${describe(link)}: fragmento con codificación inválida "${raw}".`);
      continue;
    }

    if (!id) {
      fail(`${describe(link)}: enlace interno vacío.`);
      continue;
    }

    if (!document.getElementById(id)) {
      fail(`${describe(link)}: enlace interno sin destino "#${id}".`);
    }
  }
}

let html;

try {
  html = await readFile(htmlFile, 'utf8');
} catch {
  console.error(`No se pudo leer ${htmlFile}.`);
  process.exit(1);
}

const { window, document } = parseHTML(html);

Object.defineProperty(document, 'baseURI', {
  configurable: true,
  value: BASE_URL
});

globalThis.window = window;
globalThis.document = document;
globalThis.HTMLElement = window.HTMLElement;

const container = document.getElementById('doc-content');

if (!container) {
  fail('No existe el contenedor #doc-content.');
}

if (!document.documentElement.getAttribute('lang')) {
  fail('El elemento html no declara el idioma.');
}

if (!textOf(document.querySelector('title'))) {
  fail('El documento no tiene título.');
}

if (!document.querySelector('meta[name="viewport"]')) {
  fail('Falta la metaetiqueta viewport.');
}

checkInlineCode(document);
checkExternalLinks(document);
checkImages(document);
await checkLocalResources(document);

let headingsCount = 0;
let mediaStats = { total: 0, unique: 0 };

if (container) {
  try {
    prepareDocument(container);
  } catch (error) {
    fail(`No se pudo preparar el documento: ${error.message}`);
  }

  for (const link of container.querySelectorAll('[data-blocked-link]')) {
    fail(`${describe(link)}: enlace bloqueado por seguridad.`);
  }

  for (const link of container.querySelectorAll('[data-broken-anchor]')) {
    fail(`${describe(link)}: enlace interno roto.`);
  }

  checkIdsAndAria(document);
  headingsCount = checkHeadings(document, container);
  checkTables(container);
  mediaStats = checkMediaLinks(container);
}

checkInternalAnchors(document);

const imagesCount = document.querySelectorAll('img').length;
const tablesCount = container
  ? container.querySelectorAll('table').length
  : 0;

console.log('Auditoría HTML');
console.log(`  archivo: ${path.relative(process.cwd(), htmlFile) || htmlFile}`);
console.log(`  encabezados: ${headingsCount}`);
console.log(`  imágenes: ${imagesCount}`);
console.log(`  enlaces multimedia: ${mediaStats.total} (${mediaStats.unique} únicos)`);
console.log(`  tablas: ${tablesCount}`);
console.log(`  archivos locales comprobados: ${checkedFiles.size}`);

if (warnings.length > 0) {
  console.warn(`\n${warnings.length} advertencia(s):`);

  for (const message of warnings) {
    console.warn(`  - ${message}`);
  }
}

if (errors.length > 0) {
  console.error(`\n${errors.length} error(es) de auditoría:`);

  for (const message of errors) {
    console.error(`  - ${message}`);
  }

  process.exitCode = 1;
} else {
  console.log('\nSin errores de auditoría.');
}
