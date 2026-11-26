import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { parseHTML } from 'linkedom';

import { parseMediaUrl } from '../js/links.js';
import { getVideoAnalysis, isVideoAnalysesData } from '../js/video-analyses.js';

const analyses = JSON.parse(
  await readFile(new URL('../video-analyses.json', import.meta.url), 'utf8')
);
const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('video analyses file matches the expected schema', () => {
  assert.equal(isVideoAnalysesData(analyses), true);

  const entries = Object.entries(analyses);
  assert.ok(entries.length > 0);

  for (const [key, analysis] of entries) {
    assert.match(key, /^[A-Za-z0-9_-]{11}$/);
    assert.ok(Array.isArray(analysis.paragraphs));
    assert.ok(analysis.paragraphs.length > 0);

    for (const paragraph of analysis.paragraphs) {
      assert.equal(typeof paragraph, 'string');
      assert.ok(paragraph.trim().length > 0);
    }
  }
});

test('video analyses validator rejects malformed data', () => {
  const invalidValues = [
    null,
    [],
    'texto',
    {},
    { short: { paragraphs: ['Texto'] } },
    { dQw4w9WgXcQ: null },
    { dQw4w9WgXcQ: { paragraphs: [] } },
    { dQw4w9WgXcQ: { paragraphs: [''] } },
    { dQw4w9WgXcQ: { paragraphs: ['   '] } },
    { dQw4w9WgXcQ: { paragraphs: [1] } },
    { dQw4w9WgXcQ: { paragraphs: 'Texto' } }
  ];

  for (const value of invalidValues) {
    assert.equal(isVideoAnalysesData(value), false);
  }

  assert.equal(
    isVideoAnalysesData({ dQw4w9WgXcQ: { paragraphs: ['Texto'] } }),
    true
  );
});

test('every analysis belongs to a YouTube video linked in the document', () => {
  const { document } = parseHTML(indexHtml);
  const videoIds = new Set();

  for (const anchor of document.querySelectorAll('a[href]')) {
    const media = parseMediaUrl(anchor.getAttribute('href'));

    if (media?.provider === 'youtube' && media.type === 'video') {
      videoIds.add(media.id);
    }
  }

  assert.ok(videoIds.size > 0);

  for (const key of Object.keys(analyses)) {
    assert.ok(
      videoIds.has(key),
      `El análisis ${key} no corresponde a ningún video del documento.`
    );
  }
});

test('getVideoAnalysis only returns analyses for YouTube videos', () => {
  const [key] = Object.keys(analyses);
  const media = { provider: 'youtube', type: 'video', id: key };

  assert.equal(getVideoAnalysis(analyses, media), analyses[key]);
  assert.equal(
    getVideoAnalysis(analyses, { provider: 'youtube', type: 'playlist', id: key }),
    null
  );
  assert.equal(
    getVideoAnalysis(analyses, { provider: 'instagram', type: 'reel', id: key }),
    null
  );
  assert.equal(
    getVideoAnalysis(analyses, { provider: 'youtube', type: 'video', id: 'missing' }),
    null
  );
  assert.equal(getVideoAnalysis(null, media), null);
});
