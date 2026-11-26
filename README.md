# El cuándo de mi por qué · Lector TFG

Lector web del Trabajo Final de Grado «El cuándo de mi por qué. La revitalización del folklore argentino en la era del Tecnoceno». El documento está incluido en `index.html` y se muestra al abrir la aplicación; no hay carga de archivos ni cuentas.

## Funcionalidades

- Portada, introducción, cuatro capítulos y conclusión.
- Índice generado desde los encabezados, con navegación lateral responsive.
- Tema claro/oscuro y tamaño de lectura ajustable; las preferencias se guardan en el dispositivo.
- La lectura se retoma desde la última posición; solo se guarda localmente el encabezado y su desplazamiento, no el contenido.
- Reproducción integrada de enlaces de YouTube y Spotify, con opción para abrirlos en el servicio original.
- Direcciones compartibles por sección (`#chapter-2-title`) y navegación con Atrás/Adelante del navegador.
- Imágenes en WebP con variantes responsive, dimensiones declaradas y carga diferida para evitar saltos de maquetación.
- Navegación por teclado, foco visible de alto contraste y soporte para movimiento reducido.
- Política de seguridad de contenido (CSP) restrictiva y reproducción externa limitada a YouTube y Spotify.
- Estilos de impresión para guardar el documento en PDF sin la interfaz de lectura.

## Ejecución local

Requiere Node.js 22 o posterior. Los módulos JavaScript necesitan un servidor estático; no abras `index.html` directamente con `file://`.

```powershell
npm install
npm run serve
```

Abre <http://127.0.0.1:8080>. El servidor escucha en `127.0.0.1:8080`; puedes cambiarlo con las variables `HOST` y `PORT`. También sirve cualquier servidor estático.

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

## Calidad

```powershell
npm test
npm run lint
npm run audit
npm run check
```

`npm test` ejecuta las pruebas de enlaces multimedia, enlaces internos, preferencias, preparación del DOM y esquema de `video-analyses.json`. `npm run lint` analiza JavaScript con ESLint; `npm run audit` comprueba encabezados, IDs, referencias ARIA, imágenes, enlaces y archivos locales de `index.html`. `npm run check` encadena las tres tareas.

La integración continua de `.github/workflows/ci.yml` ejecuta `npm ci`, las pruebas, el lint y la auditoría en cada push a `main` y en cada pull request.

## Estructura

```text
├─ .github/workflows/ci.yml
├─ .nvmrc
├─ eslint.config.js
├─ package.json
├─ package-lock.json
├─ index.html
├─ video-analyses.json
├─ css/app.css
├─ js/
│  ├─ app.js
│  ├─ document.js
│  ├─ hash.js
│  ├─ links.js
│  ├─ storage.js
│  ├─ theme-init.js
│  └─ video-analyses.js
├─ assets/
│  ├─ favicon.svg
│  ├─ fonts/
│  └─ images/          # WebP publicados
├─ sources/
│  ├─ AnalisisVideos.md       # material de trabajo, no se publica
│  ├─ propuesta-textos-alt.md # propuesta de accesibilidad, no se publica
│  └─ images/                 # originales y manifest.json
├─ scripts/
│  ├─ audit-html.mjs
│  ├─ optimize_images.py
│  ├─ serve.mjs
│  └─ update_image_tags.py
└─ tests/
   ├─ helpers/dom.mjs
   ├─ document.test.mjs
   ├─ hash.test.mjs
   ├─ links.test.mjs
   ├─ storage.test.mjs
   └─ video-analyses.test.mjs
```

## Publicación

El sitio se publica en Netlify desde la carpeta `dist/`, que genera `npm run build`. El build copia solo lo necesario: `index.html`, `css/`, `js/`, `video-analyses.json`, `assets/` (`favicon.svg`, `fonts/` e `images/`) y `_headers`. Quedan fuera `sources/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `eslint.config.js`, `.github/`, `README.md`, `Panorama y plan de mejora.md` y cualquier archivo `.bak`.

### Netlify

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- El archivo `_headers` se copia a `dist/` y define la CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` y las políticas de caché: `no-cache` para HTML y JSON, una hora con revalidación para CSS y JS, y un año `immutable` para imágenes y fuentes.
- La CSP también está en `index.html` como `<meta>` para que el documento tenga la política aun sin headers. La versión de `_headers` agrega `frame-ancestors 'none'`, que no es válido dentro de un `<meta>`.

Conviene mantener activada la compresión Brotli de Netlify para HTML, CSS, JavaScript, JSON y SVG.
