# Panorama y plan de mejora

Actualizado: 25 de noviembre de 2026.

Estado: fase 1 aplicada en el árbol de trabajo; fases 2 a 4 pendientes.

## Estado actual

- El proyecto sigue siendo estático, sin build, y el contenido se puede leer aunque falle JavaScript.
- Las 16 pruebas pasan con `npm test`.
- `assets/images/` contiene 78 archivos WebP y pesa 2,5 MB; los originales están en `sources/images/`.
- La CSP y los estilos de impresión ya están integrados.
- El repositorio está en GitHub (`nllopiz/LectorTFG`), rama `main`, sin CI todavía.

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
| README | Título, estructura, publicación y flujo de imágenes actualizados. | `README.md` |

## Pendiente priorizado

| Prioridad | Tema | Impacto | Esfuerzo |
| --- | --- | --- | --- |
| 1 | Aplicar los textos alternativos propuestos y agregar la alternativa textual de los gráficos. | Alto | 2–3 h |
| 2 | Pruebas de `js/document.js` y validación de `video-analyses.json`. | Alto | 2–3 h |
| 3 | Auditoría HTML, ESLint y CI. | Medio-alto | 3–4 h |
| 4 | Servidor local, build de publicación y headers del hosting. | Medio | 2–3 h |
| 5 | Normalizar las 3.183 entidades HTML a UTF-8 literal. | Bajo-medio | 1–2 h |
| 6 | Opcionales: barra de progreso, offline/PWA, `figcaption` en todas las figuras. | Bajo | variable |

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

### Fase 2 — Calidad y automatización

1. Agregar `linkedom`, `eslint`, `@eslint/js` y `globals` como dependencias de desarrollo; generar `package-lock.json`.
2. Pruebas de `js/document.js`:
   - protocolos permitidos y bloqueados;
   - enlaces internos válidos y rotos;
   - generación de IDs, acentos, colisiones e IDs reservados;
   - tablas, imágenes y enlaces multimedia;
   - rechazo de contenedores que no son `HTMLElement`.
3. Prueba de `video-analyses.json`: esquema, IDs válidos y correspondencia con enlaces reales de `index.html`.
4. Auditoría HTML (`scripts/audit-html.mjs`): encabezados vacíos, IDs duplicados, referencias ARIA rotas, imágenes sin `alt`/dimensiones, archivos inexistentes y enlaces internos sin destino.
5. ESLint con configuración plana; `npm run lint`.
6. Servidor local `scripts/serve.mjs` con `node:http`; `npm run serve`.
7. CI en `.github/workflows/ci.yml` con `npm ci`, `npm test`, `npm run lint` y `npm run audit`.
8. Opcional: smoke test con Playwright para índice, medios, Escape y restauración de posición.

**Criterio de aceptación:** las pruebas, el lint y la auditoría pasan en CI en cada push y pull request.

### Fase 3 — Contenido y pulido

- Aplicar los `alt` aprobados de `sources/propuesta-textos-alt.md`.
- Agregar un `<details>` con tabla de datos después de cada gráfico.
- Revisar las etiquetas de la lista de medios: los enlaces de «Material audiovisual complementario» se muestran como URL; conviene usar el texto de la entrada como etiqueta o excluirlos de la lista.
- Normalizar las entidades HTML a UTF-8 literal, dejando intactos `&amp;`, `&lt;`, `&gt;`, `&quot;` y `&nbsp;`; revisar el diff.
- Opcional: barra de progreso de lectura, offline/PWA y `figcaption` en todas las figuras.

**Decisión sobre el tema:** se mantiene el tema oscuro por defecto y el selector claro/oscuro. No se agrega la opción `system`.

### Fase 4 — Publicación

- Script `npm run build` que copie solo lo necesario a `dist/`: `index.html`, `css/`, `js/`, `assets/favicon.svg`, `assets/fonts/`, `assets/images/` y `video-analyses.json`.
- Headers del hosting: CSP como header si es posible, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, caché larga para imágenes y fuentes, `no-cache` para HTML.
- Verificar la CSP en el entorno real y documentar sus límites si se publica en GitHub Pages.
- Confirmar que no se despliegan `sources/`, `scripts/`, `tests/`, `package.json`, `README.md` ni `Panorama y plan de mejora.md`.

## Decisiones tomadas

- `TESISFINAL*.html`: eliminados; quedan recuperables desde el historial de Git.
- Tema: oscuro por defecto, sin opción `system` en la interfaz.
- Trabajo por fases: primero calidad y accesibilidad, después publicación.
- Textos alternativos: se revisan antes de aplicarlos; la propuesta está en `sources/propuesta-textos-alt.md`.

## Notas técnicas

- La CSP por `<meta>` no admite `frame-ancestors` ni `report-uri`; si el hosting permite headers, conviene moverla allí.
- Las claves `webmili:prefs:v1` y `webmili:reading-position:v1` se conservan para no perder preferencias ni posiciones guardadas.
- `video-analyses.json` tiene 15 análisis y todas sus claves corresponden a enlaces de YouTube presentes en el documento; los videos sin análisis son una decisión editorial.
- Quedan 3.183 entidades HTML; no rompen nada, pero dificultan la edición.
- Los tres gráficos tienen `alt` incorrectos en el HTML actual; la propuesta incluye los textos corregidos y los datos principales.
