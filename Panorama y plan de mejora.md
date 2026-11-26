# Panorama y plan de mejora

Actualizado: 26 de noviembre de 2026.

Estado: fases 1 a 3 cerradas; Fase 4 aplicada en el árbol de trabajo, solo pendiente el despliegue en Netlify y la verificación en producción.

## Estado actual

- El proyecto sigue siendo estático, sin framework, y el contenido se puede leer aunque falle JavaScript. `npm run build` solo copia archivos a `dist/`.
- Las 31 pruebas pasan con `npm test`.
- `npm run lint` y `npm run audit` pasan sin errores; la auditoría no tiene advertencias (la tabla tiene `caption`).
- `assets/images/` contiene 78 archivos WebP y pesa 2,5 MB; los originales están en `sources/images/`.
- La CSP y los estilos de impresión ya están integrados.
- El repositorio está en GitHub (`nllopiz/LectorTFG`), rama `main`. La CI de `.github/workflows/ci.yml` pasó en el push de la Fase 4 (run #7).

## Lo que ya está resuelto

| Área | Estado | Evidencia |
| --- | --- | --- |
| Imágenes | Convertidas a WebP con variantes 480/800, `srcset`, `sizes`, `width`, `height`, `loading` y `decoding`. Portada con `fetchpriority="high"`. | `assets/images/`, `scripts/optimize_images.py`, `scripts/update_image_tags.py` |
| Contraste | Tokens `--link` y `--link-hover` separados del color decorativo `--accent`. | `css/app.css` |
| Enlaces profundos | Hash por sección, `pushState`, `popstate` y `hashchange`; el hash tiene prioridad sobre la posición guardada. | `js/hash.js`, `js/app.js`, `tests/hash.test.mjs` |
| Escape en el panel de medios | El manejador global comprueba `mediaDialog.open` antes de cerrar el panel. | `js/app.js` |
| Posición de lectura | Anclaje al cambiar el tamaño del texto y reanclaje al redimensionar; las imágenes reservan altura. | `beginScrollAnchor()`, `runScrollAnchor()` |
| HTML y accesibilidad | `document-title` existe, `aria-controls` está en los enlaces multimedia, la lista de medios es una lista real y los encabezados vacíos se eliminaron. | `index.html`, `js/app.js` |
| Archivos heredados | Se eliminaron `assets/TESISFINAL.html` y `assets/TESISFINAL2.html`; `AnalisisVideos.md` se movió a `sources/`. | historial de Git |
| CSS muerto | Se eliminaron `.document-placeholder` y el bloque `.doc-empty`. | `css/app.css` |
| Seguridad | CSP restrictiva por `<meta>`, `referrer` estricto y `allowfullscreen` en los iframes. | `index.html`, `js/app.js` |
| Impresión | `@media print` oculta la interfaz, pasa el documento a blanco y negro y evita cortes en figuras y tablas. | `css/app.css` |
| Metadatos | Título, descripción y `DOCUMENT_NAME` usan el título real del TFG. | `index.html`, `js/app.js` |
| README | Título, estructura, publicación, calidad y flujo de imágenes actualizados. | `README.md` |
| Pruebas del DOM | 11 pruebas con `linkedom` para encabezados, protocolos, enlaces internos, multimedia, tablas e imágenes. | `tests/document.test.mjs`, `tests/helpers/dom.mjs` |
| Datos de análisis | Validación del esquema, claves de YouTube y correspondencia con `index.html`; la lógica se extrajo a un módulo puro. | `js/video-analyses.js`, `tests/video-analyses.test.mjs` |
| Lint | ESLint 10 con configuración plana, globals de navegador y Node, y `npm run lint`. | `eslint.config.js`, `package.json` |
| Auditoría HTML | Comprueba encabezados, IDs, ARIA, imágenes, enlaces, archivos locales, CSP y estructura de tablas y medios. | `scripts/audit-html.mjs` |
| Servidor local | Servidor con `node:http`, MIME, cabeceras de seguridad, protección de rutas y soporte de `GET`/`HEAD`. | `scripts/serve.mjs` |
| CI | `npm ci`, pruebas, lint y auditoría en cada push a `main` y pull request. | `.github/workflows/ci.yml` |
| Seguridad de enlaces | Se agregó `rel="noopener noreferrer"` al enlace de YouTube que faltaba y a los enlaces multimedia generados. | `index.html`, `js/document.js` |
| Accesibilidad de contenidos | 33 `alt` aplicados (incluye corrección tapa libro y 3 gráficos); `<caption>` a la tabla; `<details>` con datos después de cada gráfico. | `index.html` |

## Pendiente priorizado

| Prioridad | Tema | Impacto | Esfuerzo |
| --- | --- | --- | --- |
| 1 | Desplegar en Netlify y verificar la CSP y los headers en producción. | Medio | 1 h |

Los opcionales (smoke test de Playwright, barra de progreso, offline/PWA y `figcaption`) se descartaron por decisión: no hay cambios de interfaz previstos y agregan dependencias o mantenimiento sin impacto en la lectura.

## Plan por fases

### Fase 1 — Limpieza y cierre (aplicada)

- [x] Eliminar `assets/TESISFINAL.html` y `assets/TESISFINAL2.html`.
- [x] Mover `AnalisisVideos.md` a `sources/AnalisisVideos.md`.
- [x] Eliminar el CSS sin uso (`.document-placeholder`, `.doc-empty`).
- [x] Renombrar los restos visibles de «WebMili»; las claves `webmili:*` de localStorage se mantienen por compatibilidad.
- [x] Convertir `#media-list` en `<ul>` con elementos `<li>`.
- [x] Agregar `allowfullscreen` a los iframes.
- [x] Agregar la CSP por `<meta>`.
- [x] Agregar estilos de impresión.
- [x] Actualizar el README.
- [x] Preparar `sources/propuesta-textos-alt.md` para revisión.

**Criterio de aceptación:** `npm test` en verde, la aplicación funciona con la CSP y la impresión no muestra la interfaz de lectura.

### Fase 2 — Calidad y automatización (aplicada)

- [x] Agregar `linkedom`, `eslint`, `@eslint/js` y `globals` como dependencias de desarrollo; generar `package-lock.json`.
- [x] Pruebas de `js/document.js`: protocolos permitidos y bloqueados, enlaces internos, generación de IDs, tablas, imágenes, multimedia y rechazo de contenedores que no son `HTMLElement`.
- [x] Extraer la validación de `video-analyses.json` a `js/video-analyses.js` y probar esquema, IDs y correspondencia con `index.html`.
- [x] Auditoría HTML con encabezados, IDs duplicados, ARIA, imágenes, archivos locales, enlaces, CSP y estructura.
- [x] ESLint con configuración plana y `npm run lint`.
- [x] Servidor local `scripts/serve.mjs` con `node:http` y `npm run serve`.
- [x] CI en `.github/workflows/ci.yml` con `npm ci`, `npm test`, `npm run lint` y `npm run audit`.
- [ ] Opcional descartado: smoke test con Playwright para índice, medios, Escape y restauración de posición.

**Criterio de aceptación:** `npm run check` pasa en local; la CI ejecuta las mismas comprobaciones en cada push y pull request.

### Fase 3 — Contenido y pulido (aplicada)

- [x] Aplicar los `alt` aprobados de `sources/propuesta-textos-alt.md`.
- [x] Agregar un `<details>` con tabla de datos después de cada gráfico.
- [x] Agregar un `<caption>` a la tabla para reemplazar el nombre accesible genérico «Tabla 1».
- [x] Revisar las etiquetas de la lista de medios: los enlaces de «Material audiovisual complementario» se muestran como URL; conviene usar el texto de la entrada como etiqueta o excluirlos de la lista.
- [x] Normalizar las entidades HTML a UTF-8 literal, dejando intactos `&`, `<`, `>`, `"` y `&nbsp;`; revisar el diff. Se convirtieron 3.074 entidades; quedan 109 intencionales (`&nbsp;` 86, `&quot;` 15, `&amp;` 8). El texto visible se verificó idéntico al anterior.
- [ ] Opcional descartado: barra de progreso de lectura, offline/PWA y `figcaption` en todas las figuras.

**Decisión sobre el tema:** se mantiene el tema oscuro por defecto y el selector claro/oscuro. No se agrega la opción `system`.

### Fase 4 — Publicación (aplicada, pendiente de despliegue)

- [x] Script `npm run build` que copie solo lo necesario a `dist/`:`index.html`, `css/`, `js/`, `assets/favicon.svg`, `assets/fonts/`, `assets/images/`, `video-analyses.json` y `_headers`.
- [x] Headers del hosting (Netlify, archivo `_headers`): CSP completa, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, `no-cache` para HTML y JSON, una hora con revalidación para CSS y JS, y un año `immutable` para imágenes y fuentes.
- [ ] Verificar la CSP y los headers en el entorno real (requiere desplegar en Netlify).
- [x] Confirmar que no se despliegan `sources/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `eslint.config.js`, `.github/`, `README.md` ni `Panorama y plan de mejora.md`. Verificado sobre `dist/`: 95 archivos, 3,06 MB, sin `.bak` ni rutas excluidas.

## Decisiones tomadas

- `TESISFINAL*.html`: eliminados; quedan recuperables desde el historial de Git.
- Tema: oscuro por defecto, sin opción `system` en la interfaz.
- Trabajo por fases: primero calidad y accesibilidad, después publicación.
- Textos alternativos: se revisan antes de aplicarlos; la propuesta está en `sources/propuesta-textos-alt.md`.
- Hosting: Netlify, con `npm run build` como comando de build y `dist` como directorio de publicación. La agrupación de la lista de medios por sección se descartó.
- Opcionales descartados: smoke test de Playwright, barra de progreso, offline/PWA y `figcaption`.
- Entidades HTML: normalizadas a UTF-8 literal (3.074 conversiones); se conservan `&amp;`, `&quot;` y `&nbsp;`.

## Notas técnicas

- La CSP por `<meta>` no admite `frame-ancestors` ni `report-uri`. El archivo `_headers` añade la CSP completa (con `frame-ancestors 'none'`) y el resto de las cabeceras de seguridad para Netlify; el `<meta>` se conserva como respaldo si el archivo se abre sin headers.
- Los nombres de CSS y JS no llevan hash de contenido, por eso su caché es de una hora con revalidación; las imágenes y fuentes usan un año `immutable`. Si se reemplaza una imagen conservando el nombre, el CDN de Netlify la actualiza en el deploy, pero los navegadores que la tengan en caché pueden tardar en verla.
- El build excluye archivos `.bak` y verifica que no se publiquen `sources/`, `scripts/`, `tests/`, configuración ni documentación.
- Las claves `webmili:prefs:v1` y `webmili:reading-position:v1` se conservan para no perder preferencias ni posiciones guardadas.
- `video-analyses.json` tiene 15 análisis y todas sus claves corresponden a enlaces de YouTube presentes en el documento; los videos sin análisis son una decisión editorial. La validación compartida vive en `js/video-analyses.js`.
- `linkedom`, ESLint y `globals` son dependencias de desarrollo; no se publican ni afectan al lector.
- La auditoría recorre el DOM con el mismo `prepareDocument` que usa el navegador, por lo que valida también los IDs generados en tiempo de ejecución.
- La tabla del documento tiene `caption`; la auditoría lo informa como superado.
- Quedan 109 entidades HTML intencionales (`&nbsp;` 86, `&quot;` 15, `&amp;` 8); el resto del documento usa UTF-8 literal.
- Los tres gráficos tienen `alt` incorrectos en el HTML actual; la propuesta incluye los textos corregidos y los datos principales.