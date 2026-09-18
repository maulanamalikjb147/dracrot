const FAVORITES_KEY = "dracrot:favorites:v1";

const elements = {
  grid: document.querySelector("#favoritesGrid"),
  empty: document.querySelector("#favoritesEmpty"),
  note: document.querySelector("#favoritesNote"),
  count: document.querySelector("#favoriteCount"),
  toast: document.querySelector("#toast"),
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function loadFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function favoriteKey(title) { return `${title.id}::${title.lang || ""}`; }

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.add("hidden"), 2400);
}

function favoriteCard(title) {
  const article = document.createElement("article");
  article.className = "drama-card";
  const params = new URLSearchParams({ title: title.id, lang: title.lang || "" });
  const poster = title.poster
    ? `<img src="${escapeHtml(title.poster)}" alt="Poster ${escapeHtml(title.title)}" loading="lazy" />`
    : '<span class="fallback-poster" aria-hidden="true">D</span>';
  article.innerHTML = `
    <div class="poster-wrap">
      <a class="poster-button favorite-open" href="/?${params}" aria-label="Lihat ${escapeHtml(title.title)}">
        <span class="card-badge">${escapeHtml(title.platform || "Dracrot")}</span>${poster}
        <span class="poster-overlay"><span class="round-play">▶</span><span>Lihat detail</span></span>
      </a>
      <button class="favorite-card saved" type="button" aria-label="Hapus ${escapeHtml(title.title)} dari Daftar Saya">✓</button>
    </div>
    <div class="card-body"><h3 title="${escapeHtml(title.title)}">${escapeHtml(title.title)}</h3>
      <div class="card-meta"><span>${title.episode_count || 0} episode</span><span>${escapeHtml(title.lang || "-")}</span></div>
    </div>`;
  article.querySelector("button").addEventListener("click", () => removeFavorite(title));
  return article;
}

function removeFavorite(title) {
  const next = loadFavorites().filter((item) => favoriteKey(item) !== favoriteKey(title));
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  showToast("Dihapus dari Daftar Saya");
  render();
}

function render() {
  const favorites = loadFavorites();
  elements.count.textContent = favorites.length;
  elements.note.textContent = `${favorites.length} judul`;
  elements.grid.innerHTML = "";
  elements.grid.classList.toggle("hidden", favorites.length === 0);
  elements.empty.classList.toggle("hidden", favorites.length !== 0);
  favorites.forEach((title) => elements.grid.append(favoriteCard(title)));
}

window.addEventListener("storage", render);
render();
