(() => {
  "use strict";

  const feed = document.getElementById("feed");
  const progressEl = document.getElementById("progress");
  const hintEl = document.getElementById("hint");
  const filterEl = document.getElementById("chapter-filter");

  const LEARNED_KEY = "infi-reels-learned";
  const learned = new Set(JSON.parse(localStorage.getItem(LEARNED_KEY) || "[]"));

  let ALL = [];      // all theorems
  let view = [];     // currently displayed subset

  const KATEX_OPTS = {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
    ],
    throwOnError: false,
  };

  // Split Hebrew prose into paragraphs on blank lines.
  function toParagraphs(text) {
    return text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  }

  function saveLearned() {
    localStorage.setItem(LEARNED_KEY, JSON.stringify([...learned]));
  }

  function buildFace(kind, t, card) {
    const face = document.createElement("div");
    face.className = "face " + (kind === "statement" ? "face-front" : "face-back");

    const tag = document.createElement("div");
    tag.className = "tag";
    tag.innerHTML = `<span class="ref">${t.ref}</span>` +
      (t.title ? `<span class="title">${t.title}</span>` : "");
    face.appendChild(tag);

    const kindLabel = document.createElement("div");
    kindLabel.className = "kind-label";
    kindLabel.textContent = kind === "statement" ? "המשפט" : "הוכחה";
    face.appendChild(kindLabel);

    const content = document.createElement("div");
    content.className = "content";
    const body = kind === "statement" ? t.statement : t.proof;
    for (const para of toParagraphs(body)) {
      const p = document.createElement("p");
      p.textContent = para;
      content.appendChild(p);
    }

    // Correction note + "mark as learned" live on the proof side.
    if (kind === "proof") {
      if (t.note) {
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = "⚠ הערה: " + t.note;
        content.appendChild(note);
      }
      const btn = document.createElement("button");
      btn.className = "learn-btn";
      const setLabel = () =>
        (btn.textContent = learned.has(t.ref) ? "✓ נלמד" : "סמן כנלמד");
      setLabel();
      btn.addEventListener("click", (e) => {
        e.stopPropagation(); // don't flip
        if (learned.has(t.ref)) learned.delete(t.ref);
        else learned.add(t.ref);
        card.classList.toggle("learned", learned.has(t.ref));
        setLabel();
        saveLearned();
      });
      content.appendChild(btn);
    }

    face.appendChild(content);

    const cue = document.createElement("div");
    cue.className = "cue";
    cue.innerHTML = kind === "statement"
      ? 'הקש לראות את ההוכחה <span class="dot">▾</span>'
      : '<span class="dot">▴</span> הקש לחזרה למשפט';
    face.appendChild(cue);

    // Taps inside the scrollable content shouldn't flip the card.
    content.addEventListener("click", (e) => e.stopPropagation());
    return face;
  }

  function buildSlide(t) {
    const slide = document.createElement("section");
    slide.className = "slide";

    const card = document.createElement("article");
    card.className = "card";
    if (learned.has(t.ref)) card.classList.add("learned");

    const inner = document.createElement("div");
    inner.className = "card-inner";
    inner.appendChild(buildFace("statement", t, card));
    inner.appendChild(buildFace("proof", t, card));
    card.appendChild(inner);

    card.addEventListener("click", () => card.classList.toggle("flipped"));

    slide.appendChild(card);
    return slide;
  }

  function renderMath(root) {
    if (window.renderMathInElement) renderMathInElement(root, KATEX_OPTS);
  }

  function updateProgress() {
    const slides = [...feed.querySelectorAll(".slide")];
    if (!slides.length) { progressEl.textContent = "0 / 0"; return; }
    const mid = feed.scrollTop + feed.clientHeight / 2;
    let current = 1;
    slides.forEach((s, i) => { if (s.offsetTop <= mid) current = i + 1; });
    progressEl.textContent = `${current} / ${slides.length}`;
  }

  function renderFeed() {
    feed.innerHTML = "";
    feed.scrollTop = 0;
    view.forEach((t) => feed.appendChild(buildSlide(t)));
    renderMath(feed);
    updateProgress();
  }

  function applyFilter() {
    const ch = filterEl.value;
    view = ch === "all" ? ALL : ALL.filter((t) => String(t.chapter) === ch);
    renderFeed();
  }

  function populateFilter() {
    const chapters = [...new Set(ALL.map((t) => t.chapter))].sort((a, b) => a - b);
    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "כל הפרקים";
    filterEl.appendChild(optAll);
    chapters.forEach((c) => {
      const o = document.createElement("option");
      o.value = String(c);
      o.textContent = `פרק ${c}`;
      filterEl.appendChild(o);
    });
    filterEl.addEventListener("change", applyFilter);
  }

  async function init() {
    try {
      const res = await fetch("theorems.json");
      ALL = await res.json();
    } catch (e) {
      feed.innerHTML =
        '<section class="slide"><div style="color:#fff;text-align:center">שגיאה בטעינת המשפטים</div></section>';
      return;
    }

    view = ALL;
    populateFilter();

    // KaTeX scripts are deferred; render once they're ready.
    if (window.renderMathInElement) renderFeed();
    else window.addEventListener("load", renderFeed);

    feed.addEventListener("scroll", updateProgress, { passive: true });

    // Auto-hide the hint after a few seconds / first interaction.
    const hide = () => hintEl.classList.add("hide");
    setTimeout(hide, 4500);
    feed.addEventListener("scroll", hide, { once: true, passive: true });
  }

  init();
})();
