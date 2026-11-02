/* بیومانا: apply the learner's saved theme before the first paint, so the loading screen and the app open in it.
   Loaded as a small blocking script from index.html (no inline script, so the CSP can keep script-src 'self').
   Progress lives under 'biomana:v1', or 'biomana:v1:<account id>' for a signed-in account (src/lib/store.ts). */
(function () {
  try {
    var key = 'biomana:v1';
    var account = JSON.parse(localStorage.getItem('biomana:account') || 'null');
    if (account && typeof account.id === 'string') key += ':' + account.id;
    var profile = (JSON.parse(localStorage.getItem(key) || '{}') || {}).profile || {};
    if (profile.theme === 'light' || profile.theme === 'dark') document.documentElement.setAttribute('data-theme', profile.theme);
  } catch (e) {
    /* storage blocked: the device setting decides */
  }
})();
