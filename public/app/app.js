// the newest APK's version, from the file the apps check too
fetch("/app-update/latest.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (l) {
  if (!l.android) return;
  var fa = function (s) { return String(s).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; }); };
  document.getElementById("ver").textContent = "نسخهٔ " + fa(l.android.versionName) + " · اندروید ۷ به بالا";
}).catch(function () {});
