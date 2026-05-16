/**
 * Supports running the site in a subdirectory (e.g. /tronex-importation-website on localhost).
 * Requires <meta name="tronex-base" content="..."> injected by the server.
 */
(function () {
  function base() {
    var m = document.querySelector('meta[name="tronex-base"]');
    if (!m) return '';
    return (m.getAttribute('content') || '').replace(/\/$/, '');
  }

  window.tronexBase = base;

  window.tronexUrl = function (path) {
    if (!path) return path;
    if (/^(https?:|tel:|mailto:|#)/i.test(path)) return path;
    if (path.charAt(0) !== '/') path = '/' + path;
    var b = base();
    if (!b) return path;
    // Avoid doubling the base when fetch() and callers both use tronexUrl().
    if (path === b || path.indexOf(b + '/') === 0) return path;
    return b + path;
  };

  var origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (input, init) {
      if (typeof input === 'string') {
        input = window.tronexUrl(input);
      }
      return origFetch.call(this, input, init);
    };
  }

  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    var args = Array.prototype.slice.call(arguments);
    if (typeof url === 'string') {
      args[1] = window.tronexUrl(url);
    }
    return origOpen.apply(this, args);
  };
})();
