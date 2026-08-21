var CAT = (function() {
  var defaults = [
    { name: "Food",          emoji: "🍔" },
    { name: "Transport",     emoji: "🚗" },
    { name: "Bills",         emoji: "🧾" },
    { name: "Shopping",      emoji: "🛍️" },
    { name: "Entertainment", emoji: "🎬" },
    { name: "Health",        emoji: "💊" },
    { name: "Other",         emoji: "📦" }
  ];

  // 15 colors each: indices 0-6 = fixed default slots (in `defaults`
  // order); indices 7-14 = 8 hash slots for custom/unknown categories.
  // Custom categories hash only into slice(7) so they never collide
  // with a fixed default slot.
  var PALETTES = {
    legacy:  ["#FF6384", "#36A2EB", "#D4A017", "#0E9C9C", "#9966FF", "#FF7F2A", "#8E8E93", "#7E57C2", "#26A69A", "#F4B400", "#E57373", "#29B6F6", "#66BB6A", "#EC407A", "#AB47BC"],
    triadic: ["#E63946", "#2A9D8F", "#4361EE", "#9B5DE5", "#F4A261", "#06A7C6", "#8D6E63", "#457B9D", "#1D3557", "#E76F51", "#8338EC", "#0D9E6A", "#C29200", "#3A86FF", "#B5179E"],
    tetradic:["#E63946", "#2A9D8F", "#457B9D", "#F4A261", "#E76F51", "#6D597A", "#355070", "#B56576", "#6A994E", "#A7C957", "#F2E8CF", "#BC6C25", "#283618", "#DDA15E", "#606C38"],
    square:  ["#E63946", "#F4A261", "#2A9D8F", "#4361EE", "#9B5DE5", "#FFB703", "#8338EC", "#06D6A0", "#EF476F", "#118AB2", "#073B4C", "#FFD166", "#EF8354", "#3A86FF", "#7209B7"],
    forest:  ["#166534", "#15803D", "#65A30D", "#A16207", "#0F766E", "#606C38", "#3F6212", "#1B4332", "#2D6A4F", "#40916C", "#52B788", "#74C69D", "#95D5B2", "#52796F", "#081C15"],
    ocean:   ["#0E7490", "#0369A1", "#1D4ED8", "#0EA5E9", "#22D3EE", "#155E75", "#164E63", "#03045E", "#0077B6", "#0096C7", "#00B4D8", "#48CAE4", "#90E0EF", "#023E8A", "#083D77"],
    kawaii:  ["#FFB3C1", "#FFD6A5", "#FFCCD9", "#E8B4F8", "#A2D2FF", "#F8C8DC", "#BCE0D8", "#F5DDB6", "#CDB4DB", "#A9DEF9", "#FF9EBB", "#B7D4F5", "#F4E079", "#B5EAD7", "#D8C4FF"]
  };

  var PALETTE_KEYS = ["legacy", "triadic", "tetradic", "square", "forest", "ocean", "kawaii"];
  var PALETTE_LABELS = {
    legacy: "Legacy", triadic: "Triadic", tetradic: "Tetradic",
    square: "Square", forest: "Forest", ocean: "Ocean", kawaii: "Kawaii"
  };

  function hash(name) {
    var sum = 0;
    for (var i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return sum % 8;
  }

  function getCustom() {
    try { return JSON.parse(localStorage.getItem("customCats") || "[]"); } catch(e) { return []; }
  }

  function all() {
    return defaults.concat(getCustom());
  }

  function getOverrides() {
    try { return JSON.parse(localStorage.getItem("catOverrides") || "{}"); } catch(e) { return {}; }
  }

  function normalizeHex(hex) {
    if (typeof hex !== "string") return null;
    var m = hex.trim().toLowerCase().match(/^#?([0-9a-f]{6})$/);
    return m ? "#" + m[1] : null;
  }

  function setOverride(name, hex) {
    var h = normalizeHex(hex);
    var o = getOverrides();
    if (h) o[name] = h;
    else delete o[name];
    localStorage.setItem("catOverrides", JSON.stringify(o));
  }

  function clearOverride(name) {
    var o = getOverrides();
    delete o[name];
    localStorage.setItem("catOverrides", JSON.stringify(o));
  }

  function clearAllOverrides() {
    localStorage.setItem("catOverrides", "{}");
  }

  function getPaletteName() {
    var stored = localStorage.getItem("catPalette");
    return (stored && PALETTES[stored]) ? stored : "triadic";
  }

  function setPalette(name) {
    if (!PALETTES[name]) return;
    localStorage.setItem("catPalette", name);
  }

  function getPalette() {
    return PALETTES[getPaletteName()];
  }

  function colorFor(name) {
    var o = getOverrides();
    if (o[name]) return o[name];
    var palette = getPalette();
    for (var i = 0; i < defaults.length; i++) {
      if (defaults[i].name === name) return palette[i];
    }
    return palette[7 + hash(name)];
  }

  function emojiFor(name) {
    var found = all().find(function(c) { return c.name === name; });
    return found ? found.emoji : "📦";
  }

  // Fetch custom categories from Supabase and merge into localStorage.
  // Server data is authoritative for existing entries; local-only entries
  // are preserved too.  Old DB rows use "icon" — map to "emoji" on read.
  // The legacy per-category "color" field is ignored: color is now
  // palette-derived at render time, not stored per category.
  async function syncFromServer(db, userId) {
    if (!db || !userId) return;
    try {
      var { data } = await db.from("settings").select("custom_categories").eq("user_id", userId).single();
      var serverCats = (data && data.custom_categories) || [];
      if (!serverCats.length) return;
      var localCats = getCustom();
      var merged = [];
      var seen = {};
      for (var i = 0; i < serverCats.length; i++) {
        var sc = serverCats[i];
        if (!sc.name) continue;
        seen[sc.name] = true;
        merged.push({ name: sc.name, emoji: sc.emoji || sc.icon || "📦" });
      }
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

  return {
    defaults: defaults,
    PALETTES: PALETTES,
    PALETTE_KEYS: PALETTE_KEYS,
    PALETTE_LABELS: PALETTE_LABELS,
    getCustom: getCustom,
    all: all,
    colorFor: colorFor,
    emojiFor: emojiFor,
    hash: hash,
    getOverrides: getOverrides,
    setOverride: setOverride,
    clearOverride: clearOverride,
    clearAllOverrides: clearAllOverrides,
    getPaletteName: getPaletteName,
    setPalette: setPalette,
    getPalette: getPalette,
    syncFromServer: syncFromServer
  };
})();
