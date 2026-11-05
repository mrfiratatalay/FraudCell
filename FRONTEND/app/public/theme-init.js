// Runs before the first paint so the page never flashes the wrong theme.
// Kept as a file: the gateway's CSP (script-src 'self') blocks inline scripts.
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem('fc-theme');
  } catch (e) {}
  var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
