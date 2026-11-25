#!/usr/bin/env python3
"""
Actualiza las etiquetas <img> de index.html para usar las versiones WebP
generadas por optimize_images.py, agregando srcset, tamanos y dimensiones.

Uso:
    python scripts/update_image_tags.py

Es idempotente: se puede ejecutar de nuevo despues de regenerar las imagenes.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = ROOT / "index.html"
MANIFEST_PATH = ROOT / "sources" / "images" / "manifest.json"
IMAGE_DIR = ROOT / "assets" / "images"
SRC_PREFIX = "./assets/images/"
COVER_BASE = "1-portada"
CONTENT_MAX_WIDTH = 740
COVER_MAX_WIDTH = 646
IMAGE_MAX_WIDTH = 820
MOBILE_GUTTER = 40
VARIANT_WIDTHS = (480, 800)

ATTR_RE = re.compile(r'([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*"([^"]*)"')
IMG_RE = re.compile(r"<img\b[^>]*>")


def image_entry(entries: dict, filename: str, stem: str) -> dict | None:
    if filename in entries:
        return entries[filename]

    for entry in entries.values():
        if entry["base"] == stem:
            return entry

    return None


def replace_image_tag(tag: str, entries: dict, counters: dict) -> str:
    attrs = ATTR_RE.findall(tag)
    src = next((value for name, value in attrs if name == "src"), None)

    if not src or not src.startswith(SRC_PREFIX):
        return tag

    filename = Path(src).name
    entry = image_entry(entries, filename, Path(src).stem)

    if entry is None:
        print(f"AVISO: no hay entrada en el manifiesto para {filename}")
        return tag

    base = entry["base"]
    width = entry["width"]
    height = entry["height"]
    full_name = f"{base}.webp"
    full_path = IMAGE_DIR / full_name

    if not full_path.exists():
        print(f"AVISO: falta {full_path.relative_to(ROOT)}")
        return tag

    variants = []
    for variant_width in VARIANT_WIDTHS:
        variant_name = f"{base}-{variant_width}.webp"
        if variant_width < width and (IMAGE_DIR / variant_name).exists():
            variants.append((variant_name, variant_width))

    new_src = f"{SRC_PREFIX}{full_name}"
    descriptors = [f"{SRC_PREFIX}{name} {value}w" for name, value in variants]
    descriptors.append(f"{SRC_PREFIX}{full_name} {width}w")
    srcset = ", ".join(descriptors)

    if base == COVER_BASE:
        sizes = f"(max-width: {COVER_MAX_WIDTH}px) calc(100vw - {MOBILE_GUTTER}px), {COVER_MAX_WIDTH}px"
    else:
        sizes = f"(max-width: {IMAGE_MAX_WIDTH}px) calc(100vw - {MOBILE_GUTTER}px), {CONTENT_MAX_WIDTH}px"

    kept_attrs = [
        (name, value)
        for name, value in attrs
        if name
        not in {
            "src",
            "srcset",
            "sizes",
            "width",
            "height",
            "loading",
            "decoding",
            "fetchpriority",
        }
    ]

    is_cover = base == COVER_BASE
    parts = [f'src="{new_src}"']
    parts.append(f'srcset="{srcset}"')
    parts.append(f'sizes="{sizes}"')

    parts.append(f'width="{width}"')
    parts.append(f'height="{height}"')

    for name, value in kept_attrs:
        parts.append(f'{name}="{value}"')

    parts.append(f'loading="{"eager" if is_cover else "lazy"}"')
    parts.append('decoding="async"')

    if is_cover:
        parts.append('fetchpriority="high"')

    counters["updated"] += 1
    return f"<img {' '.join(parts)}>"


def main() -> int:
    if not MANIFEST_PATH.exists():
        print(f"Falta {MANIFEST_PATH.relative_to(ROOT)}. Ejecuta optimize_images.py primero.")
        return 1

    entries = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    html_bytes = INDEX_PATH.read_bytes()
    html = html_bytes.decode("utf-8")
    counters = {"updated": 0}

    updated = IMG_RE.sub(lambda match: replace_image_tag(match.group(0), entries, counters), html)

    if updated == html:
        print("No hubo cambios en index.html.")
        return 0

    INDEX_PATH.write_bytes(updated.encode("utf-8"))
    print(f"Actualizadas {counters['updated']} etiquetas <img> en index.html.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
