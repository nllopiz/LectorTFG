#!/usr/bin/env python3
"""
Genera versiones WebP optimizadas para el lector.

Uso:
    python scripts/optimize_images.py

Los originales se leen de sources/images y las versiones web se escriben en
assets/images. Se generan variantes de 480 y 800 px de ancho cuando la imagen
original es mas grande. Tambien se crea sources/images/manifest.json con las
dimensiones y los archivos generados.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Falta Pillow. Instalalo con: python -m pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "sources" / "images"
OUTPUT_DIR = ROOT / "assets" / "images"
MANIFEST_PATH = SOURCE_DIR / "manifest.json"
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}
VARIANT_WIDTHS = (480, 800)
QUALITY = 82


def ascii_slug(value: str) -> str:
    """Convierte nombres con acentos o simbolos a un nombre seguro para URL."""
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^A-Za-z0-9_-]+", "-", normalized).strip("-")
    return slug or "imagen"


def main() -> int:
    if not SOURCE_DIR.is_dir():
        print(f"No existe {SOURCE_DIR.relative_to(ROOT)}. Coloca ahi los originales.")
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {}
    generated_count = 0

    for source in sorted(SOURCE_DIR.iterdir()):
        if not source.is_file() or source.suffix.lower() not in IMAGE_SUFFIXES:
            continue

        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened)
            width, height = image.size
            has_alpha = image.mode in {"RGBA", "LA"} or "transparency" in image.info
            image = image.convert("RGBA" if has_alpha else "RGB")
            base_name = ascii_slug(source.stem)
            variants = []

            full_path = OUTPUT_DIR / f"{base_name}.webp"
            image.save(full_path, "WEBP", quality=QUALITY, method=6)
            variants.append(full_path.name)
            generated_count += 1

            for target_width in VARIANT_WIDTHS:
                if width <= target_width:
                    continue

                target_height = max(1, round(height * target_width / width))
                variant = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
                variant_path = OUTPUT_DIR / f"{base_name}-{target_width}.webp"
                variant.save(variant_path, "WEBP", quality=QUALITY, method=6)
                variants.append(variant_path.name)
                generated_count += 1

        manifest[source.name] = {
            "base": base_name,
            "width": width,
            "height": height,
            "variants": variants,
        }
        print(f"{source.name}: {width}x{height} -> {', '.join(variants)}")

    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    total_bytes = sum(path.stat().st_size for path in OUTPUT_DIR.glob("*.webp"))
    print(f"\n{generated_count} archivos WebP, {total_bytes / 1024 / 1024:.1f} MB en assets/images/")
    print(f"Manifiesto: {MANIFEST_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
