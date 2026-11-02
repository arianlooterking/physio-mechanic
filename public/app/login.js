// /app/login.html: Google sign-in for the phone apps. The app opens this page in the phone's browser with a PKCE
// challenge (?ch=…). After Google sign-in here (or with the account this browser is already signed in to on the site),
// the page asks for a one-time code (POST /api/app-code) and hands it back to the app through the app's own address,
// com.biomana.app://signin?code=…. The app swaps it, with the verifier only it knows, for its session (worker/index.ts).
// Sign in with Apple (when it is on) goes through /api/apple-start and comes back here with the code in #code=….
(function () {
  var APP = "com.biomana.app://signin";
  var ch = new URLSearchParams(location.search).get("ch") || "";
  var $ = function (id) { return document.getElementById(id); };
  var show = function (id) {
    ["start", "busy", "done", "bad", "old"].forEach(function (k) { $(k).hidden = k !== id; });
  };
  if (!/^[A-Za-z0-9_-]{43}$/.test(ch)) return show("old");

  function finish(code) {
    var url = APP + "?code=" + encodeURIComponent(code);
    $("back").href = url;
    show("done");
    // the browser may open the app right away, or only after a tap on the button
    location.href = url;
  }
  function ask(body) {
    show("busy");
    body.challenge = ch;
    return fetch("/api/app-code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (j) { finish(j.code); })
      .catch(function () { show("bad"); });
  }
  $("retry").onclick = function () { show("start"); };
  $("same").onclick = function () { ask({}); };

  // back from Sign in with Apple (worker/apple.ts): the code is ready, or Apple's sign-in didn't finish
  var back = /^#code=([A-Za-z0-9_-]+)$/.exec(location.hash);
  if (back) {
    history.replaceState(null, "", location.pathname + location.search);
    return finish(back[1]);
  }
  if (new URLSearchParams(location.search).get("apple") === "failed") show("bad");

  // already signed in to the site in this browser: one tap
  fetch("/api/session", { credentials: "same-origin", cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (!j.account || !j.account.email) return;
      $("email").textContent = j.account.email;
      $("known").hidden = false;
    })
    .catch(function () {});

  fetch("/api/config", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      if (cfg.apple) {
        $("apple").href = "/api/apple-start?ch=" + ch;
        $("apple-row").hidden = false;
      }
      if (!cfg.googleClientId) throw new Error("no client id");
      return new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.onload = function () { resolve(cfg.googleClientId); };
        s.onerror = reject;
        document.head.appendChild(s);
      });
    })
    .then(function (id) {
      var g = window.google.accounts.id;
      g.initialize({ client_id: id, ux_mode: "popup", auto_select: false, callback: function (r) { ask({ credential: r.credential }); } });
      g.renderButton($("gsi"), { theme: "outline", size: "large", shape: "pill", text: "continue_with", locale: "fa", width: Math.min(320, $("gsi").clientWidth || 300) });
      $("loading").hidden = true;
    })
    .catch(function () {
      $("loading").textContent = "دکمهٔ گوگل بار نشد. اینترنت را بررسی کن و صفحه را دوباره باز کن.";
    });
})();
