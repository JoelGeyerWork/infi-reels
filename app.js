(() => {
  "use strict";

  const feed = document.getElementById("feed");
  const progressEl = document.getElementById("progress");
  const hintEl = document.getElementById("hint");

  const filterToggle = document.getElementById("filter-toggle");
  const filterLabel = document.getElementById("filter-label");
  const filterPanel = document.getElementById("filter-panel");
  const chipRow = document.getElementById("chapter-chips");

  const BATCH = 6, MAX_SLIDES = 60, KEEP_SLIDES = 40;

  // Curated, harmonious per-chapter accents (shift as you scroll → "reels" feel)
  const CH_COLORS = {
    1: "#f0a93b", 2: "#ef6b54", 3: "#e85d8c", 4: "#a884ec",
    5: "#5f8bef", 6: "#34b3a6", 7: "#76c04a", 8: "#d2a64f",
  };
  const colorFor = (c) => CH_COLORS[c] || "#cfcfcf";
  const numOf = (ref) => (ref.match(/[\d.]+/) || [""])[0];

  let ALL = [];
  const selected = new Set();
  let bag = [], lastRef = null, removedCount = 0, filling = false;

  const KATEX_OPTS = {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
    ],
    throwOnError: false,
  };

  const toParagraphs = (t) =>
    t.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

  // ---------- card faces ----------
  function buildFace(kind, t) {
    const face = document.createElement("div");
    face.className = "face " + (kind === "statement" ? "face-front" : "face-back");

    const num = document.createElement("div");
    num.className = "bg-num";
    num.textContent = numOf(t.ref);
    face.appendChild(num);

    const kicker = document.createElement("div");
    kicker.className = "kicker";
    const lead = kind === "statement" ? t.ref : "הוכחה · " + t.ref;
    kicker.innerHTML =
      `<span class="kdot"></span><span class="klead">${lead}</span>` +
      (kind === "statement" && t.title
        ? `<span class="ktitle">${t.title}</span>`
        : "");
    face.appendChild(kicker);

    const content = document.createElement("div");
    content.className = "content";
    const body = kind === "statement" ? t.statement : t.proof;
    for (const para of toParagraphs(body)) {
      const p = document.createElement("p");
      p.textContent = para;
      content.appendChild(p);
    }
    if (kind === "proof" && t.note) {
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = "† הערה: " + t.note;
      content.appendChild(note);
    }
    face.appendChild(content);

    const cue = document.createElement("div");
    cue.className = "cue";
    cue.innerHTML = kind === "statement"
      ? '<span class="dot">↑</span> הקש לחשיפת ההוכחה'
      : '<span class="dot">↓</span> הקש לחזרה למשפט';
    face.appendChild(cue);

    content.addEventListener("click", (e) => e.stopPropagation());
    return face;
  }

  function buildSlide(t) {
    const slide = document.createElement("section");
    slide.className = "slide";
    slide.style.setProperty("--ch", colorFor(t.chapter));

    const card = document.createElement("article");
    card.className = "card";
    const inner = document.createElement("div");
    inner.className = "card-inner";
    inner.appendChild(buildFace("statement", t));
    inner.appendChild(buildFace("proof", t));
    card.appendChild(inner);
    card.addEventListener("click", () => card.classList.toggle("flipped"));

    slide.appendChild(card);
    return slide;
  }

  const renderMath = (root) =>
    window.renderMathInElement && renderMathInElement(root, KATEX_OPTS);

  // ---------- shuffled-bag randomness ----------
  const pool = () =>
    selected.size ? ALL.filter((t) => selected.has(t.chapter)) : ALL;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function nextTheorem() {
    if (!bag.length) {
      bag = shuffle(pool());
      if (bag.length > 1 && bag[bag.length - 1].ref === lastRef) {
        [bag[bag.length - 1], bag[0]] = [bag[0], bag[bag.length - 1]];
      }
    }
    const t = bag.pop();
    lastRef = t ? t.ref : null;
    return t;
  }

  // ---------- infinite feed ----------
  function fill() {
    if (filling || !pool().length) return;
    filling = true;
    const frag = document.createDocumentFragment();
    const fresh = [];
    for (let i = 0; i < BATCH; i++) {
      const t = nextTheorem();
      if (!t) break;
      const slide = buildSlide(t);
      fresh.push(slide);
      frag.appendChild(slide);
    }
    feed.appendChild(frag);
    fresh.forEach(renderMath);
    prune();
    filling = false;
  }

  function prune() {
    const slides = feed.querySelectorAll(".slide");
    if (slides.length <= MAX_SLIDES) return;
    const slideH = feed.clientHeight;
    const remove = slides.length - KEEP_SLIDES;
    for (let i = 0; i < remove; i++) slides[i].remove();
    feed.scrollTop -= remove * slideH;
    removedCount += remove;
  }

  function resetFeed() {
    feed.innerHTML = "";
    feed.scrollTop = 0;
    bag = []; lastRef = null; removedCount = 0;
    fill(); fill();
    updateCounter();
  }

  function updateCounter() {
    const slides = feed.querySelectorAll(".slide");
    if (!slides.length) { progressEl.textContent = "∞"; return; }
    const mid = feed.scrollTop + feed.clientHeight / 2;
    let idx = 0;
    slides.forEach((s, i) => { if (s.offsetTop <= mid) idx = i; });
    progressEl.textContent = "∞ " + (removedCount + idx + 1);
  }

  function onScroll() {
    updateCounter();
    if (feed.scrollHeight - feed.scrollTop - feed.clientHeight < feed.clientHeight * 2)
      fill();
  }

  // ---------- multi-select chapter filter ----------
  function updateFilterLabel() {
    if (!selected.size) filterLabel.textContent = "כל הפרקים";
    else if (selected.size === 1) filterLabel.textContent = "פרק " + [...selected][0];
    else filterLabel.textContent = "פרקים · " + selected.size;
  }

  function syncChips() {
    chipRow.querySelectorAll(".chip").forEach((c) => {
      const v = c.dataset.ch;
      c.classList.toggle("active",
        v === "all" ? selected.size === 0 : selected.has(Number(v)));
    });
  }

  function buildChips() {
    const chapters = [...new Set(ALL.map((t) => t.chapter))].sort((a, b) => a - b);
    const all = document.createElement("button");
    all.className = "chip"; all.dataset.ch = "all"; all.textContent = "הכל";
    all.addEventListener("click", () => {
      selected.clear(); syncChips(); updateFilterLabel(); resetFeed();
    });
    chipRow.appendChild(all);
    chapters.forEach((c) => {
      const chip = document.createElement("button");
      chip.className = "chip"; chip.dataset.ch = String(c);
      chip.textContent = "פרק " + c;
      chip.style.setProperty("--ch", colorFor(c));
      chip.addEventListener("click", () => {
        if (selected.has(c)) selected.delete(c); else selected.add(c);
        syncChips(); updateFilterLabel(); resetFeed();
      });
      chipRow.appendChild(chip);
    });
    syncChips();
  }

  function togglePanel(open) {
    const show = open ?? filterPanel.hidden;
    filterPanel.hidden = !show;
    filterToggle.setAttribute("aria-expanded", String(show));
  }
  filterToggle.addEventListener("click", (e) => { e.stopPropagation(); togglePanel(); });
  filterPanel.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => togglePanel(false));

  // ---------- init ----------
  async function init() {
    try {
      const res = await fetch("theorems.json");
      ALL = await res.json();
    } catch (e) {
      feed.innerHTML =
        '<section class="slide"><div class="content" style="text-align:center">שגיאה בטעינת המשפטים</div></section>';
      return;
    }
    buildChips();
    updateFilterLabel();

    document.getElementById("shuffle-btn")
      .addEventListener("click", () => resetFeed());

    const start = () => resetFeed();
    if (window.renderMathInElement) start();
    else window.addEventListener("load", start);

    feed.addEventListener("scroll", onScroll, { passive: true });
    const hide = () => hintEl.classList.add("hide");
    setTimeout(hide, 5000);
    feed.addEventListener("scroll", hide, { once: true, passive: true });
  }

  init();
})();
