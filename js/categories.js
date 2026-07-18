var CAT = (function() {
  var defaults = [
    { name: "Food",          emoji: "🍔", color: "#FF6384" },
    { name: "Transport",     emoji: "🚗", color: "#36A2EB" },
    { name: "Bills",         emoji: "🧾", color: "#FFCE56" },
    { name: "Shopping",      emoji: "🛍️", color: "#4BC0C0" },
    { name: "Entertainment", emoji: "🎬", color: "#9966FF" },
    { name: "Health",        emoji: "💊", color: "#FF9F40" },
    { name: "Other",         emoji: "📦", color: "#C9CBCF" }
  ];

  // Deterministic colour for custom categories — hash the name into a
  // fixed palette so each custom category gets a stable, distinct donut-
  // chart colour instead of all sharing the default gray.
  var CUSTOM_PALETTE = ["#B39DDB", "#80CBC4", "#FFE082", "#EF9A9A", "#81D4FA", "#A5D6A7", "#F48FB1", "#CE93D8"];

  function hashColor(name) {
    var sum = 0;
    for (var i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return CUSTOM_PALETTE[sum % CUSTOM_PALETTE.length];
  }

  function getCustom() {
    try { return JSON.parse(localStorage.getItem("customCats") || "[]"); } catch(e) { return []; }
  }

  function all() {
    return defaults.concat(getCustom());
  }

  function colorFor(name) {
    var found = all().find(function(c) { return c.name === name; });
    return found ? found.color : "#C9CBCF";
  }

  function emojiFor(name) {
    var found = all().find(function(c) { return c.name === name; });
    return found ? found.emoji : "📦";
  }

  // Fetch custom categories from Supabase and merge into localStorage.
  // Server data is authoritative for existing entries; local-only entries
  // are preserved too.  Old DB rows use "icon" — map to "emoji" on read.
  async function syncFromServer(db, userId) {
    if (!db || !userId) return;
    try {
      var { data } = await db.from("settings").select("custom_categories").eq("user_id", userId).single();
      var serverCats = (data && data.custom_categories) || [];
      if (!serverCats.length) return;
      var localCats = getCustom();
      var merged = [];
      var seen = {};
      // Server categories first (authoritative for shared names)
      for (var i = 0; i < serverCats.length; i++) {
        var sc = serverCats[i];
        if (!sc.name) continue;
        seen[sc.name] = true;
        merged.push({
          name: sc.name,
          emoji: sc.emoji || sc.icon || "📦",
          color: sc.color || hashColor(sc.name)
        });
      }
      // Then any local-only categories not already on the server
      for (var j = 0; j < localCats.length; j++) {
        var lc = localCats[j];
        if (!seen[lc.name]) {
          seen[lc.name] = true;
          merged.push(lc);
        }
      }
      localStorage.setItem("customCats", JSON.stringify(merged));
    } catch(e) {}
  }

  return { defaults: defaults, getCustom: getCustom, all: all, colorFor: colorFor, emojiFor: emojiFor, hashColor: hashColor, syncFromServer: syncFromServer };
})();
