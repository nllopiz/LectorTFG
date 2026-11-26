import test from 'node:test';
import assert from 'node:assert/strict';

import { prepareDocument } from '../js/document.js';
import { installDom } from './helpers/dom.mjs';

test('prepareDocument rejects containers that are not HTML elements', () => {
  const { document } = installDom();

  assert.throws(() => prepareDocument(null), TypeError);
  assert.throws(() => prepareDocument({}), TypeError);
  assert.throws(() => prepareDocument(document), TypeError);
});

test('prepareDocument generates stable heading IDs and metadata', () => {
  const { container } = installDom(`
    <h2 id="introduction-title">Introducción</h2>
    <h3>¿Quién es Milo J?</h3>
    <h4>Capítulo 2</h4>
    <h4>Capítulo 2</h4>
    <h2>Capítulo 2</h2>
  `);

  const { headings } = prepareDocument(container);

  assert.deepEqual(headings, [
    { id: 'introduction-title', text: 'Introducción', level: 2 },
    { id: 'quien-es-milo-j', text: '¿Quién es Milo J?', level: 3 },
    { id: 'capitulo-2', text: 'Capítulo 2', level: 4 },
    { id: 'capitulo-2-2', text: 'Capítulo 2', level: 4 },
    { id: 'capitulo-2-3', text: 'Capítulo 2', level: 2 }
  ]);

  for (const heading of container.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    assert.equal(heading.getAttribute('tabindex'), '-1');
  }
});

test('prepareDocument avoids IDs reserved by other elements', () => {
  const { container } = installDom(`
    <div id="capitulo-2"></div>
    <h2>Capítulo 2</h2>
  `);

  const { headings } = prepareDocument(container);

  assert.equal(headings[0].id, 'capitulo-2-2');
});

test('prepareDocument enhances safe external links', () => {
  const { container } = installDom(`
    <a id="external" href="https://example.com/path?q=1">Ejemplo</a>
  `);

  prepareDocument(container);

  const link = container.querySelector('#external');

  assert.equal(link.getAttribute('href'), 'https://example.com/path?q=1');
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(link.referrerPolicy, 'strict-origin-when-cross-origin');
  assert.ok(link.classList.contains('doc-link--external'));
  assert.equal(
    link.querySelector('.sr-only').textContent,
    ' (se abre en una pestaña nueva)'
  );
});

test('prepareDocument preserves mailto and tel links', () => {
  const { container } = installDom(`
    <a id="mail" href="mailto:hola@example.com">Correo</a>
    <a id="phone" href="tel:+541112345678">Teléfono</a>
  `);

  prepareDocument(container);

  const mail = container.querySelector('#mail');
  const phone = container.querySelector('#phone');

  assert.equal(mail.getAttribute('href'), 'mailto:hola@example.com');
  assert.equal(phone.getAttribute('href'), 'tel:+541112345678');
  assert.equal(mail.hasAttribute('target'), false);
  assert.equal(phone.hasAttribute('target'), false);
  assert.equal(mail.hasAttribute('data-blocked-link'), false);
});

test('prepareDocument blocks unsafe and empty links', () => {
  const { container } = installDom(`
    <a id="javascript" href="javascript:alert(1)">JavaScript</a>
    <a id="data" href="data:text/html,hola">Data</a>
    <a id="file" href="file:///C:/secreto.txt">Archivo</a>
    <a id="ftp" href="ftp://example.com/file">FTP</a>
    <a id="malformed" href="http://[">Malformado</a>
    <a id="empty" href="">Vacío</a>
  `);

  prepareDocument(container);

  for (const link of container.querySelectorAll('a')) {
    assert.equal(link.hasAttribute('href'), false);
    assert.equal(link.hasAttribute('target'), false);
    assert.equal(link.getAttribute('data-blocked-link'), 'protocolo no permitido');
    assert.ok(link.classList.contains('doc-link--blocked'));
    assert.equal(link.getAttribute('title'), 'Este enlace se bloqueó por seguridad.');
    assert.equal(
      link.querySelector('.sr-only').textContent,
      ' (enlace bloqueado por seguridad)'
    );
  }
});

test('prepareDocument validates internal anchors against the container', () => {
  const { container, document } = installDom(`
    <h2>Sección</h2>
    <h2>Capítulo 2</h2>
    <a id="valid" href="#seccion">Sección</a>
    <a id="generated" href="#capitulo-2">Capítulo</a>
    <a id="missing" href="#no-existe">Falta</a>
    <a id="outside-link" href="#outside">Fuera</a>
  `);

  const outside = document.createElement('div');
  outside.id = 'outside';
  document.body.append(outside);

  prepareDocument(container);

  const valid = container.querySelector('#valid');
  const generated = container.querySelector('#generated');
  const missing = container.querySelector('#missing');
  const outsideLink = container.querySelector('#outside-link');

  assert.equal(valid.hasAttribute('data-broken-anchor'), false);
  assert.equal(generated.hasAttribute('data-broken-anchor'), false);
  assert.equal(missing.hasAttribute('data-broken-anchor'), true);
  assert.equal(outsideLink.hasAttribute('data-broken-anchor'), true);
  assert.ok(missing.classList.contains('doc-link--broken'));
  assert.equal(
    missing.getAttribute('title'),
    'El destino de este enlace no está en el documento.'
  );
});

test('prepareDocument enriches YouTube links with media metadata', () => {
  const { container } = installDom(`
    <a id="media" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90">Bajo de la piel</a>
  `);

  prepareDocument(container);

  const link = container.querySelector('#media');

  assert.equal(link.dataset.provider, 'youtube');
  assert.equal(link.dataset.type, 'video');
  assert.equal(link.dataset.id, 'dQw4w9WgXcQ');
  assert.equal(
    link.dataset.embed,
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&start=90'
  );
  assert.equal(link.dataset.height, '');
  assert.equal(link.dataset.start, '90');
  assert.equal(link.dataset.label, 'Bajo de la piel · 1:30');
  assert.equal(link.getAttribute('aria-expanded'), 'false');
  assert.equal(link.getAttribute('aria-controls'), 'media-panel');
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.ok(link.classList.contains('media-link'));
  assert.ok(link.hasAttribute('data-media'));
  assert.equal(link.textContent, 'Bajo de la piel');
  assert.equal(link.querySelectorAll('.media-link__text').length, 1);
});

test('prepareDocument enriches Instagram reels without a provider badge', () => {
  const { container } = installDom(`
    <a id="instagram" href="https://www.instagram.com/reel/Dfw_T_UhpPb/?utm_source=ig_web_copy_link">Reel</a>
  `);

  prepareDocument(container);

  const link = container.querySelector('#instagram');

  assert.equal(link.dataset.provider, 'instagram');
  assert.equal(link.dataset.type, 'reel');
  assert.equal(link.dataset.id, 'Dfw_T_UhpPb');
  assert.equal(link.dataset.embed, '');
  assert.equal(link.dataset.height, '');
  assert.equal(link.dataset.start, '');
  assert.equal(link.dataset.label, 'Reel');
  assert.equal(link.getAttribute('aria-expanded'), 'false');
  assert.equal(link.getAttribute('aria-controls'), 'media-panel');
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(link.getAttribute('href'), 'https://www.instagram.com/reel/Dfw_T_UhpPb/');
  assert.equal(link.querySelector('.media-badge'), null);
  assert.equal(link.textContent, 'Reel');
  assert.equal(link.querySelector('.media-link__text').textContent, 'Reel');
});

test('prepareDocument keeps bibliography link text and uses the title as label', () => {
  const { container } = installDom(`
    <p class="bibliography-entry">
      Boxeador neuquino sube al ring cantando folklore
      <a id="bibliography" href="https://www.instagram.com/reel/Dfw_T_UhpPb/" target="_blank" rel="noopener noreferrer">https://www.instagram.com/reel/Dfw_T_UhpPb/</a>
    </p>
  `);

  prepareDocument(container);
  prepareDocument(container);

  const link = container.querySelector('#bibliography');
  const text = link.querySelector('.media-link__text');

  assert.equal(link.dataset.label, 'Boxeador neuquino sube al ring cantando folklore');
  assert.equal(link.dataset.embed, '');
  assert.equal(link.querySelectorAll('.media-link__text').length, 1);
  assert.equal(text.textContent, 'https://www.instagram.com/reel/Dfw_T_UhpPb/');
  assert.equal(link.textContent, 'https://www.instagram.com/reel/Dfw_T_UhpPb/');
  assert.equal(link.querySelector('.media-badge'), null);
});

test('prepareDocument wraps tables once and names them accessibly', () => {
  const { container } = installDom(`
    <table id="first"><caption>Datos</caption><tbody><tr><td>1</td></tr></tbody></table>
    <table id="second"><tbody><tr><td>2</td></tr></tbody></table>
  `);

  prepareDocument(container);

  const first = container.querySelector('#first');
  const second = container.querySelector('#second');

  assert.equal(first.parentElement.className, 'table-scroll');
  assert.equal(second.parentElement.className, 'table-scroll');
  assert.equal(first.parentElement.getAttribute('role'), 'region');
  assert.equal(first.parentElement.getAttribute('tabindex'), '0');
  assert.equal(first.parentElement.getAttribute('aria-label'), 'Datos');
  assert.equal(second.parentElement.getAttribute('aria-label'), 'Tabla 2');

  prepareDocument(container);

  assert.equal(container.querySelectorAll('.table-scroll').length, 2);
});

test('prepareDocument fills image defaults without overwriting explicit values', () => {
  const { container } = installDom(`
    <img id="default" src="one.webp">
    <img id="explicit" src="two.webp" loading="eager" decoding="sync" alt="Texto">
  `);

  prepareDocument(container);

  const defaultImage = container.querySelector('#default');
  const explicitImage = container.querySelector('#explicit');

  assert.equal(defaultImage.getAttribute('loading'), 'lazy');
  assert.equal(defaultImage.getAttribute('decoding'), 'async');
  assert.equal(defaultImage.getAttribute('alt'), '');
  assert.equal(explicitImage.getAttribute('loading'), 'eager');
  assert.equal(explicitImage.getAttribute('decoding'), 'sync');
  assert.equal(explicitImage.getAttribute('alt'), 'Texto');
});
