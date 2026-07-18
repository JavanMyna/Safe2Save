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

  // Convert a UTC timestamptz string to a local YYYY-MM-DD so that
  // times like midnight–8am in UTC+8 don't land on the previous day.
  function localDateStr(isoTimestamp) {
    var d = new Date(isoTimestamp);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
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

  var NON_SPEND_CATEGORIES = ["Savings"];

  function isRealSpend(t) {
    return t.type !== "income" && NON_SPEND_CATEGORIES.indexOf(t.category) === -1;
  }

  // Safe month addition that clamps to the last valid day of the target
  // month instead of rolling into the next month when the target month
  // has fewer days (e.g. Jan 31 -> Feb 28, not Mar 3).
  function addMonthsSafe(dateStr, n) {
    var d = new Date(dateStr + "T00:00:00");
    var targetDay = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    var lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(targetDay, lastDayOfTargetMonth));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function spendTotal(transactions, opts) {
    opts = opts || {};
    var from = opts.from, to = opts.to;
    return transactions.reduce(function(sum, t) {
      if (!isRealSpend(t)) return sum;
      if (from && t.occurred_on < from) return sum;
      if (to && t.occurred_on > to) return sum;
      return sum + parseFloat(t.amount);
    }, 0);
  }

  return { fmtMYR, fmtDate, fmtDateShort, todayStr, daysAgoStr, daysBetween, localDateStr, toast, escHtml, isRealSpend, spendTotal, addMonthsSafe };
})();
