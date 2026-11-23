(function () {
  var theme = 'dark';

  try {
    var raw = window.localStorage.getItem('webmili:prefs:v1');
    var prefs = raw ? JSON.parse(raw) : null;
    var saved = prefs && typeof prefs === 'object' ? prefs.theme : null;

    if (saved === 'light' || saved === 'dark') {
      theme = saved;
    } else if (saved === 'system' && window.matchMedia) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch (error) {
    theme = 'dark';
  }

  document.documentElement.setAttribute('data-theme', theme);

  var themeColorMeta = document.querySelector('meta[name="theme-color"]');

  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', theme === 'dark' ? '#2B1F10' : '#F3EFDD');
  }
})();
