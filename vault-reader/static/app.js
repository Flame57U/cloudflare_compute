const els = {
  tocToggle: document.getElementById("toc-toggle"),
  themeToggle: document.getElementById("theme-toggle"),
  toc: document.getElementById("toc"),
  tocList: document.getElementById("toc-list"),
  tocFilter: document.getElementById("toc-filter"),
  title: document.getElementById("note-title"),
  pageIndicator: document.getElementById("page-indicator"),
  contentWrap: document.getElementById("content-wrap"),
  content: document.getElementById("content"),
  prev: document.getElementById("prev-page"),
  next: document.getElementById("next-page"),
};

const state = {
  notes: [],
  current: null,
  page: 0,
  pageCount: 1,
  pageWidth: 0,
  notesOrder: [],
};

// ---------- theme ----------
if (localStorage.getItem("vault-theme") === "dark") {
  document.body.classList.add("dark");
}
els.themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "vault-theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
  // Re-layout because column widths may change
  if (state.current) layoutPages();
});

// ---------- TOC ----------
els.tocToggle.addEventListener("click", () => {
  els.toc.classList.toggle("hidden");
});

async function loadNotes() {
  const r = await fetch("/api/notes");
  const data = await r.json();
  state.notes = data.notes;
  state.notesOrder = data.notes.slice();
  renderToc("");
}

function renderToc(filter) {
  els.tocList.innerHTML = "";
  const folders = {};
  const f = filter.trim().toLowerCase();
  for (const path of state.notes) {
    if (f && !path.toLowerCase().includes(f)) continue;
    const parts = path.split("/");
    const folder = parts.length > 1 ? parts[0] : "（根目录）";
    (folders[folder] = folders[folder] || []).push(path);
  }
  const folderNames = Object.keys(folders).sort();
  for (const folder of folderNames) {
    const h = document.createElement("div");
    h.className = "toc-folder";
    h.textContent = folder;
    els.tocList.appendChild(h);
    for (const path of folders[folder]) {
      const a = document.createElement("a");
      a.className = "toc-item";
      a.dataset.path = path;
      const parts = path.split("/");
      a.textContent = parts[parts.length - 1].replace(/\.md$/, "");
      a.title = path;
      if (state.current === path) a.classList.add("active");
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openNote(path);
        if (window.innerWidth < 800) els.toc.classList.add("hidden");
      });
      els.tocList.appendChild(a);
    }
  }
}

els.tocFilter.addEventListener("input", (e) => renderToc(e.target.value));

// ---------- note loading ----------
async function openNote(path) {
  try {
    const r = await fetch("/api/note?path=" + encodeURIComponent(path));
    if (!r.ok) throw new Error("fetch failed");
    const data = await r.json();
    state.current = path;
    state.page = 0;
    els.title.textContent = data.title;
    els.content.innerHTML = data.html;
    bindWikilinks();
    requestAnimationFrame(() => {
      layoutPages();
      goToPage(0);
    });
    // mark active in toc
    document.querySelectorAll(".toc-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.path === path);
    });
    // restore last-page from localStorage
    const saved = parseInt(localStorage.getItem("vault-page:" + path) || "0", 10);
    if (saved > 0) {
      requestAnimationFrame(() => goToPage(saved));
    }
    history.replaceState(null, "", "#" + encodeURIComponent(path));
  } catch (e) {
    els.content.innerHTML = `<p class="hint">加载失败：${e.message}</p>`;
  }
}

function bindWikilinks() {
  els.content.querySelectorAll("a.wikilink").forEach((a) => {
    a.addEventListener("click", async (e) => {
      e.preventDefault();
      const target = a.dataset.target;
      try {
        const r = await fetch("/api/resolve?target=" + encodeURIComponent(target));
        if (!r.ok) return;
        const data = await r.json();
        openNote(data.path);
      } catch (_) {}
    });
  });
}

// ---------- pagination ----------
function layoutPages() {
  const cs = getComputedStyle(els.contentWrap);
  const padding = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const usable = els.contentWrap.clientWidth - padding;
  els.content.style.columnWidth = usable + "px";
  els.content.style.webkitColumnWidth = usable + "px";
  els.content.style.height = (els.contentWrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) + "px";
  state.pageWidth = usable + parseFloat(cs.paddingLeft); // column + gap approximation
  // Use scrollWidth to count pages
  const totalWidth = els.content.scrollWidth;
  const colGap = parseFloat(getComputedStyle(els.content).columnGap) || 0;
  // Each "page" advances by (column width + gap).
  state.pageCount = Math.max(1, Math.round((totalWidth + colGap) / (usable + colGap)));
  updateIndicator();
}

function goToPage(p) {
  state.page = Math.max(0, Math.min(p, state.pageCount - 1));
  const usable = els.content.clientWidth;
  const colGap = parseFloat(getComputedStyle(els.content).columnGap) || 0;
  els.content.scrollLeft = state.page * (usable + colGap);
  localStorage.setItem("vault-page:" + state.current, String(state.page));
  updateIndicator();
  els.prev.disabled = state.page === 0;
  els.next.disabled = state.page === state.pageCount - 1;
}

function updateIndicator() {
  els.pageIndicator.textContent = state.current
    ? `${state.page + 1} / ${state.pageCount}`
    : "";
}

function nextPage() {
  if (state.page < state.pageCount - 1) goToPage(state.page + 1);
  else gotoAdjacentNote(+1);
}
function prevPage() {
  if (state.page > 0) goToPage(state.page - 1);
  else gotoAdjacentNote(-1);
}
function gotoAdjacentNote(dir) {
  if (!state.current) return;
  const i = state.notesOrder.indexOf(state.current);
  if (i < 0) return;
  const j = i + dir;
  if (j < 0 || j >= state.notesOrder.length) return;
  openNote(state.notesOrder[j]);
}

els.prev.addEventListener("click", prevPage);
els.next.addEventListener("click", nextPage);

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown" || e.key === "j") {
    e.preventDefault();
    nextPage();
  } else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "k") {
    e.preventDefault();
    prevPage();
  } else if (e.key === "t") {
    els.toc.classList.toggle("hidden");
  } else if (e.key === "d") {
    els.themeToggle.click();
  }
});

// Tap zones for touch
els.content.addEventListener("click", (e) => {
  if (e.target.closest("a")) return;
  const rect = els.contentWrap.getBoundingClientRect();
  const x = e.clientX - rect.left;
  if (x < rect.width * 0.33) prevPage();
  else if (x > rect.width * 0.67) nextPage();
});

// Swipe
let touchStart = null;
els.contentWrap.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) touchStart = e.touches[0].clientX;
});
els.contentWrap.addEventListener("touchend", (e) => {
  if (touchStart === null) return;
  const dx = (e.changedTouches[0].clientX - touchStart);
  if (Math.abs(dx) > 40) (dx < 0 ? nextPage : prevPage)();
  touchStart = null;
});

window.addEventListener("resize", () => {
  if (state.current) {
    const p = state.page;
    layoutPages();
    goToPage(p);
  }
});

// ---------- bootstrap ----------
(async () => {
  await loadNotes();
  // open note from URL hash if present
  if (location.hash) {
    const path = decodeURIComponent(location.hash.slice(1));
    if (state.notes.includes(path)) openNote(path);
  }
})();
