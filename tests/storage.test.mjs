import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = {
  localStorage: {
    values: new Map(),
    getItem(key) {
      return this.values.has(key) ? this.values.get(key) : null;
    },
    setItem(key, value) {
      this.values.set(key, value);
    }
  }
};

const {
  FONT_DEFAULT,
  FONT_MAX,
  FONT_MIN,
  normalizeFontSize,
  readPrefs,
  writePrefs
} = await import('../js/storage.js');

test('font size normalization stays inside 16–24 px', () => {
  assert.equal(normalizeFontSize(10), FONT_MIN);
  assert.equal(normalizeFontSize(19), 20);
  assert.equal(normalizeFontSize(40), FONT_MAX);
  assert.equal(normalizeFontSize('invalid'), FONT_DEFAULT);
});

test('readPrefs defaults to the dark theme and standard font size', () => {
  window.localStorage.values.clear();
  const prefs = readPrefs();

  assert.equal(prefs.theme, 'dark');
  assert.equal(prefs.fontSize, FONT_DEFAULT);
});

test('theme and font preferences persist without legacy document settings', () => {
  window.localStorage.values.clear();
  writePrefs({ theme: 'light', fontSize: 22, remember: false });

  const prefs = readPrefs();
  assert.equal(prefs.theme, 'light');
  assert.equal(prefs.fontSize, 22);
  assert.deepEqual(
    JSON.parse(window.localStorage.values.get('webmili:prefs:v1')),
    { theme: 'light', fontSize: 22 }
  );
});
