/**
 * Shared same-origin preferences, loaded on every portal page.
 *
 * Kept as a small public script (not an Astro-bundled module) so it is emitted
 * once instead of being inlined into all 160+ pages, which would blow the
 * JavaScript budget. The typed implementation lives in `src/lib/prefs.ts`.
 */
(function () {
  var KEY = 'yoto-community:prefs:v1';
  var THEMES = ['light', 'dark', 'system'];
  var LOCALES = ['en', 'fr'];

  function parse(raw) {
    if (!raw) return {};
    try {
      var value = JSON.parse(raw);
      if (!value || typeof value !== 'object' || value.version !== 1) return {};
      return value;
    } catch (error) {
      return {};
    }
  }

  function read() {
    var prefs;
    try {
      prefs = parse(localStorage.getItem(KEY));
    } catch (error) {
      return {};
    }
    var theme = THEMES.indexOf(prefs.theme) !== -1 ? prefs.theme : null;
    var locale = LOCALES.indexOf(prefs.locale) !== -1 ? prefs.locale : null;
    try {
      if (!theme) {
        var legacyTheme = localStorage.getItem('yoto-icons-theme');
        if (THEMES.indexOf(legacyTheme) !== -1) theme = legacyTheme;
      }
      if (!locale) {
        var legacyLocale = localStorage.getItem('yoto-locale') || localStorage.getItem('locale');
        if (LOCALES.indexOf(legacyLocale) !== -1) locale = legacyLocale;
      }
    } catch (error) {
      /* storage unavailable */
    }
    return { theme: theme, locale: locale };
  }

  function write(patch) {
    try {
      var current = read();
      localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          theme: patch.theme || current.theme || 'system',
          locale: patch.locale || current.locale || 'en',
        }),
      );
    } catch (error) {
      /* storage unavailable */
    }
  }

  function applyTheme() {
    var theme = read().theme || 'system';
    var dark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }

  function redirectHome() {
    var path = window.location.pathname;
    if (path !== '/' && path !== '/fr/') return;
    var locale = read().locale;
    if (locale === 'fr' && path === '/') window.location.replace('/fr/');
    if (locale === 'en' && path === '/fr/') window.location.replace('/');
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var link = target.closest('[data-locale-switch]');
    var locale = link && link.getAttribute('data-locale-switch');
    if (locale === 'fr' || locale === 'en') write({ locale: locale });
  });

  window.addEventListener('storage', function (event) {
    if (
      event.key === KEY ||
      event.key === 'yoto-icons-theme' ||
      event.key === 'yoto-locale' ||
      event.key === 'locale'
    ) {
      applyTheme();
    }
  });

  redirectHome();
  applyTheme();
})();
