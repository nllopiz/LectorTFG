import { parseHashTarget } from "./hash.js";
import { parseMediaUrl, parseMediaTimeLabel } from "./links.js";

const HEADINGS = "h1, h2, h3, h4, h5, h6";
const SAFE_EXTERNAL = new Set(["http:", "https:"]);
const SAFE_HANDLER = new Set(["mailto:", "tel:"]);

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function blockLink(link) {
  link.removeAttribute("href");
  link.removeAttribute("target");
  link.removeAttribute("rel");
  link.dataset.blockedLink = "protocolo no permitido";
  link.classList.add("doc-link--blocked");
  link.setAttribute("title", "Este enlace se bloqueó por seguridad.");

  const note = document.createElement("span");
  note.className = "sr-only";
  note.textContent = " (enlace bloqueado por seguridad)";
  link.append(note);
}

function enhanceExternalLink(link, url) {
  link.href = url.href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.referrerPolicy = "strict-origin-when-cross-origin";
  link.classList.add("doc-link--external");

  const note = document.createElement("span");
  note.className = "sr-only";
  note.textContent = " (se abre en una pestaña nueva)";
  link.append(note);
}

function defaultMediaLabel(media) {
  if (media.provider === "youtube") {
    return media.type === "playlist" ? "Lista de YouTube" : "Video de YouTube";
  }

  if (media.provider === "instagram") {
    return "Reel de Instagram";
  }

  return "Contenido multimedia";
}

function enhanceMediaLink(link, media) {
  link.href = media.href;
  link.rel = "noopener noreferrer";
  link.dataset.media = "";
  link.dataset.provider = media.provider;
  link.dataset.type = media.type;
  link.dataset.id = media.id;
  link.dataset.embed = media.embedUrl || "";
  link.dataset.height = media.height ? String(media.height) : "";
  link.dataset.start = media.start ? String(media.start) : "";
  link.classList.add("media-link");

  const visibleText = cleanText(link.textContent);
  const isUrl = /^(https?:\/\/|www\.)/i.test(visibleText);
  const bibliographyEntry = link.closest(".bibliography-entry");

  const contextualTitle = bibliographyEntry
    ? cleanText(
        [...bibliographyEntry.childNodes]
          .filter((node) => node !== link)
          .map((node) => node.textContent)
          .join(" "),
      )
    : "";

  const label =
    contextualTitle || (!isUrl && visibleText) || defaultMediaLabel(media);
  const timeLabel = parseMediaTimeLabel(media);

  link.dataset.label = timeLabel ? `${label} · ${timeLabel}` : label;
  link.setAttribute("aria-expanded", "false");
  link.setAttribute("aria-controls", "media-panel");

  if (
    link.children.length === 1 &&
    link.firstElementChild?.classList.contains("media-link__text")
  ) {
    return;
  }

  const text = document.createElement("span");
  text.className = "media-link__text";

  while (link.firstChild) {
    text.append(link.firstChild);
  }

  link.append(text);
}

function markBrokenAnchor(link) {
  link.dataset.brokenAnchor = "";
  link.classList.add("doc-link--broken");
  link.setAttribute(
    "title",
    "El destino de este enlace no está en el documento.",
  );
}

function wrapTables(container) {
  const tables = Array.from(container.querySelectorAll("table"));

  tables.forEach((table, index) => {
    if (
      table.parentElement &&
      table.parentElement.classList.contains("table-scroll")
    ) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");

    const caption = cleanText(table.querySelector("caption")?.textContent);
    wrapper.setAttribute("aria-label", caption || `Tabla ${index + 1}`);

    table.before(wrapper);
    wrapper.append(table);
  });
}

function prepareImages(container) {
  for (const img of Array.from(container.querySelectorAll("img"))) {
    if (!img.hasAttribute("loading")) {
      img.setAttribute("loading", "lazy");
    }

    if (!img.hasAttribute("decoding")) {
      img.setAttribute("decoding", "async");
    }

    if (!img.hasAttribute("alt")) {
      img.setAttribute("alt", "");
    }
  }
}

function prepareHeadings(container) {
  const usedIds = new Set();
  const reserved = new Set();

  container.querySelectorAll("[id]").forEach((element) => {
    if (!element.matches(HEADINGS) && element.id) {
      reserved.add(element.id);
    }
  });

  const headings = [];

  for (const heading of container.querySelectorAll(HEADINGS)) {
    const text = cleanText(heading.textContent);
    let candidate =
      heading.getAttribute("id")?.trim() || slugify(text) || "seccion";

    if (!/^[A-Za-z][A-Za-z0-9_.:-]*$/.test(candidate)) {
      candidate = slugify(candidate) || "seccion";
    }

    let id = candidate;
    let suffix = 2;

    while (usedIds.has(id) || reserved.has(id)) {
      id = `${candidate}-${suffix}`;
      suffix += 1;
    }

    heading.id = id;
    heading.setAttribute("tabindex", "-1");
    usedIds.add(id);

    headings.push({
      id,
      text,
      level: Number(heading.tagName.charAt(1)),
    });
  }

  return headings;
}

function prepareLinks(container) {
  for (const link of Array.from(container.querySelectorAll("a"))) {
    const raw = (link.getAttribute("href") || "").trim();

    if (!raw) {
      if (cleanText(link.textContent)) {
        blockLink(link);
      }

      continue;
    }

    if (raw.startsWith("#")) {
      const targetId = parseHashTarget(raw);
      const target = document.getElementById(targetId);

      if (!target || !container.contains(target)) {
        markBrokenAnchor(link);
      }

      continue;
    }

    let url;

    try {
      url = new URL(raw, document.baseURI);
    } catch {
      blockLink(link);
      continue;
    }

    if (SAFE_EXTERNAL.has(url.protocol)) {
      const media = parseMediaUrl(url.href);

      if (media) {
        enhanceMediaLink(link, media);
      } else {
        enhanceExternalLink(link, url);
      }
    } else if (SAFE_HANDLER.has(url.protocol)) {
      link.href = url.href;
    } else {
      blockLink(link);
    }
  }
}

export function prepareDocument(container) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError("Se esperaba un contenedor HTML.");
  }

  wrapTables(container);
  prepareImages(container);

  const headings = prepareHeadings(container);
  prepareLinks(container);

  return { headings };
}
