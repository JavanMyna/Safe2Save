const U = (() => {
  function fmtMYR(n) {
    if (n == null || isNaN(n)) return "RM 0.00";
    const abs = Math.abs(+n);
    const s = abs.toFixed(2);
    const parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (n < 0 ? "-" : "") + "RM " + parts.join(".");
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
  }

  function fmtDateShort(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
  }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function daysAgoStr(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function daysBetween(d1, d2) {
    const ms = new Date(d2) - new Date(d1);
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  function toast(msg, success = false) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = success ? "toast success show" : "toast show";
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => {
      el.className = "toast";
    }, 3500);
  }

  function escHtml(s) {
    if (!s) return "";
    var d = document.createElement("div");
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  return { fmtMYR, fmtDate, fmtDateShort, todayStr, daysAgoStr, daysBetween, toast, escHtml };
})();
