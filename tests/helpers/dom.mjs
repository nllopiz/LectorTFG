import { parseHTML } from 'linkedom';

const BASE_URL = 'https://example.test/';

export function installDom(markup = '') {
  const { window, document } = parseHTML(`<!doctype html>
<html lang="es">
<head><base href="${BASE_URL}"></head>
<body><main id="doc-content">${markup}</main></body>
</html>`);

  Object.defineProperty(document, 'baseURI', {
    configurable: true,
    value: BASE_URL
  });

  globalThis.window = window;
  globalThis.document = document;
  globalThis.HTMLElement = window.HTMLElement;

  return {
    window,
    document,
    container: document.getElementById('doc-content')
  };
}
