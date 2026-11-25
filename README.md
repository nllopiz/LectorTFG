# WebMili · Lector TFG

Lector web del Trabajo Final de Grado «El cuándo de mi por qué. La revitalización del folklore argentino en la era del Tecnoceno». El documento está incluido en `index.html` y se muestra al abrir la aplicación; no hay carga de archivos ni cuentas.

## Funcionalidades

- Portada, introducción, cuatro capítulos y conclusión.
- Índice generado desde los encabezados, con navegación lateral responsive.
- Tema claro/oscuro y tamaño de lectura ajustable; las preferencias se guardan en el dispositivo.
- La lectura se retoma desde la última posición; solo se guarda localmente el encabezado y su desplazamiento, no el contenido.
- Reproducción integrada de enlaces de YouTube y Spotify, con opción para abrirlos en el servicio original.
- Imágenes en WebP con variantes responsive, dimensiones declaradas y carga diferida para evitar saltos de maquetación.
- Navegación por teclado, foco visible de alto contraste y soporte para movimiento reducido.

## Ejecución local

Los módulos JavaScript necesitan un servidor estático; no abras `index.html` directamente con `file://`.

```powershell
python -m http.server 8080
```

Abre <http://localhost:8080>.

Para editar el contenido del TFG, modifica las secciones de `index.html`. Las fuentes y sus licencias están en `assets/fonts/`.

## Imágenes

Los originales se conservan en `sources/images/`. Las versiones publicadas se generan en `assets/images/` como WebP, con una versión completa y variantes de 480 y 800 px cuando el original es más grande. El proceso también crea `sources/images/manifest.json` con las dimensiones y los archivos generados.

Requiere Pillow:

```powershell
python -m pip install pillow
python scripts/optimize_images.py
python scripts/update_image_tags.py
```

`optimize_images.py` convierte y redimensiona; `update_image_tags.py` actualiza de forma idempotente las etiquetas `<img>` de `index.html` con `src`, `srcset`, `sizes`, `width`, `height`, `loading` y `decoding`. La portada se marca como prioritaria (`eager` y `fetchpriority="high"`); el resto se carga de forma diferida.

No edites a mano esas etiquetas si vas a regenerar las imágenes: vuelve a ejecutar ambos scripts después de cambiar un original. `js/document.js` respeta los atributos ya presentes en el HTML y solo completa los que falten.

## Pruebas

```powershell
npm test
```

Las pruebas actuales cubren el reconocimiento de enlaces multimedia y las preferencias de lectura.

## Estructura

```text
├─ index.html
├─ video-analyses.json
├─ css/app.css
├─ js/
│  ├─ app.js
│  ├─ document.js
│  ├─ links.js
│  ├─ storage.js
│  └─ theme-init.js
├─ assets/
│  ├─ favicon.svg
│  ├─ fonts/
│  └─ images/          # WebP publicados
├─ sources/
│  └─ images/          # originales y manifest.json
├─ scripts/
│  ├─ optimize_images.py
│  └─ update_image_tags.py
└─ tests/
   ├─ links.test.mjs
   └─ storage.test.mjs
```

## Publicación

Publica solo `index.html`, `css/`, `js/`, `video-analyses.json` y los archivos necesarios de `assets/` (`favicon.svg`, `fonts/` e `images/`). No es necesario desplegar `sources/`, `scripts/`, `tests/`, `package.json`, `README.md` ni el material de trabajo `AnalisisVideos.md`.

Conviene servir el HTML con `no-cache`, los archivos con hash o nombres estables con caché larga, y activar compresión Brotli o gzip para HTML, CSS, JavaScript, JSON y SVG.
