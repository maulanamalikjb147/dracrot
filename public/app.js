const FAVORITES_KEY = "dracrot:favorites:v1";

const state = {
  page: 1, limit: 18, platform: "", lang: "id", query: "", lastCount: 0,
  selectedTitle: null, selectedEpisode: null, episodes: [], requestController: null,
  playGeneration: 0, favorites: loadStoredFavorites(),
};

const elements = {
  catalogGrid: document.querySelector("#catalogGrid"), statusCard: document.querySelector("#statusCard"),
  catalogKicker: document.querySelector("#catalogKicker"), catalogTitle: document.querySelector("#catalogTitle"),
  platformFilters: document.querySelector("#platformFilters"), languageFilter: document.querySelector("#languageFilter"),
  searchForm: document.querySelector("#searchForm"), searchInput: document.querySelector("#searchInput"),
  clearSearch: document.querySelector("#clearSearch"), previousPage: document.querySelector("#previousPage"),
  nextPage: document.querySelector("#nextPage"), pageLabel: document.querySelector("#pageLabel"),
  pagination: document.querySelector("#pagination"), detailDialog: document.querySelector("#detailDialog"),
  detailContent: document.querySelector("#detailContent"), playerDialog: document.querySelector("#playerDialog"),
  videoPlayer: document.querySelector("#videoPlayer"), playerTitle: document.querySelector("#playerTitle"),
  playerEpisode: document.querySelector("#playerEpisode"), playerInfo: document.querySelector("#playerInfo"),
  playerLoading: document.querySelector("#playerLoading"), qualitySelect: document.querySelector("#qualitySelect"),
  favoriteCount: document.querySelector("#favoriteCount"), toast: document.querySelector("#toast"),
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function loadStoredFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function favoriteKey(title) { return `${title.id}::${title.lang || ""}`; }
function isFavorite(title) { return state.favorites.some((item) => favoriteKey(item) === favoriteKey(title)); }
function favoriteSnapshot(title) {
  return {
    id: title.id, lang: title.lang || "", title: title.title, poster: title.poster || null,
    platform: title.platform || "", episode_count: title.episode_count || 0,
    synopsis: title.synopsis || null, tags: Array.isArray(title.tags) ? title.tags.slice(0, 8) : [],
  };
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.add("hidden"), 2800);
}

function persistFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
  renderFavorites();
}

function favoriteButtonText(title) {
  return isFavorite(title) ? '<span aria-hidden="true">✓</span> Di Daftar Saya' : '<span aria-hidden="true">＋</span> Daftar Saya';
}

function toggleFavorite(title) {
  const key = favoriteKey(title);
  const index = state.favorites.findIndex((item) => favoriteKey(item) === key);
  if (index >= 0) {
    state.favorites.splice(index, 1);
    showToast("Dihapus dari Daftar Saya");
  } else {
    state.favorites.unshift(favoriteSnapshot(title));
    showToast("Ditambahkan ke Daftar Saya");
  }
  persistFavorites();
  document.querySelectorAll("[data-favorite-key]").forEach((button) => {
    if (button.dataset.favoriteKey !== key) return;
    const saved = isFavorite(title);
    button.classList.toggle("saved", saved);
    button.setAttribute("aria-label", saved ? "Hapus dari Daftar Saya" : "Tambahkan ke Daftar Saya");
    button.innerHTML = button.classList.contains("detail-favorite") ? favoriteButtonText(title) : (saved ? "✓" : "+");
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({ success: false, error: "Respons server tidak dapat dibaca." }));
  if (!response.ok || !body.success) throw new Error(body.error || "Permintaan gagal.");
  return body;
}

function durationLabel(seconds) {
  if (!seconds) return "Durasi belum tersedia";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} menit`;
}

function renderSkeletons() {
  elements.statusCard.classList.add("hidden");
  elements.catalogGrid.innerHTML = "";
  const template = document.querySelector("#skeletonTemplate");
  for (let index = 0; index < 12; index += 1) elements.catalogGrid.append(template.content.cloneNode(true));
}

function showStatus(message, { retry = false } = {}) {
  elements.catalogGrid.innerHTML = "";
  elements.statusCard.innerHTML = `<p>${escapeHtml(message)}</p>${retry ? '<button type="button" id="retryButton">Coba lagi</button>' : ""}`;
  elements.statusCard.classList.remove("hidden");
  elements.pagination.classList.add("hidden");
  if (retry) document.querySelector("#retryButton").addEventListener("click", loadCatalog);
}

function titleCard(title) {
  const article = document.createElement("article");
  article.className = "drama-card";
  const saved = isFavorite(title);
  const poster = title.poster
    ? `<img src="${escapeHtml(title.poster)}" alt="Poster ${escapeHtml(title.title)}" loading="lazy" />`
    : '<span class="fallback-poster" aria-hidden="true">D</span>';
  article.innerHTML = `
    <div class="poster-wrap">
      <button class="poster-button" type="button" aria-label="Lihat ${escapeHtml(title.title)}">
        <span class="card-badge">${escapeHtml(title.platform)}</span>${poster}
        <span class="poster-overlay"><span class="round-play">▶</span><span>Lihat detail</span></span>
      </button>
      <button class="favorite-card ${saved ? "saved" : ""}" data-favorite-key="${escapeHtml(favoriteKey(title))}" type="button" aria-label="${saved ? "Hapus dari" : "Tambahkan ke"} Daftar Saya">${saved ? "✓" : "+"}</button>
    </div>
    <div class="card-body"><h3 title="${escapeHtml(title.title)}">${escapeHtml(title.title)}</h3>
      <div class="card-meta"><span>${title.episode_count || 0} episode</span><span>${escapeHtml(title.lang || "-")}</span></div>
    </div>`;
  article.querySelector(".poster-button").addEventListener("click", () => openDetails(title));
  article.querySelector(".favorite-card").addEventListener("click", () => toggleFavorite(title));
  return article;
}

function renderFavorites() {
  const count = state.favorites.length;
  elements.favoriteCount.textContent = count;
}

function updatePagination() {
  elements.pagination.classList.remove("hidden");
  elements.previousPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.lastCount < state.limit;
  elements.pageLabel.textContent = `Halaman ${state.page}`;
}

async function loadCatalog() {
  state.requestController?.abort();
  state.requestController = new AbortController();
  renderSkeletons();
  const params = new URLSearchParams({ page: state.page, limit: state.limit, lang: state.lang });
  if (!state.lang) params.delete("lang");
  if (state.platform) params.set("platform", state.platform);
  if (!state.query) params.set("feed", "latest");
  const endpoint = state.query
    ? `/api/search?${new URLSearchParams({ ...Object.fromEntries(params), q: state.query })}`
    : `/api/catalog?${params}`;
  try {
    const result = await api(endpoint, { signal: state.requestController.signal });
    state.lastCount = result.data.length;
    elements.catalogGrid.innerHTML = "";
    elements.statusCard.classList.add("hidden");
    if (!result.data.length) {
      showStatus(state.query ? `Belum ada hasil untuk “${state.query}”.` : "Belum ada drama pada filter ini.");
      return;
    }
    result.data.forEach((title) => elements.catalogGrid.append(titleCard(title)));
    updatePagination();
  } catch (error) {
    if (error.name !== "AbortError") showStatus(error.message, { retry: true });
  }
}

async function loadPlatforms() {
  try {
    const result = await api("/api/platforms");
    result.data.filter((item) => item.enabled).slice(0, 8).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "pill"; button.dataset.platform = item.platform; button.textContent = item.platform;
      elements.platformFilters.append(button);
    });
  } catch { /* Katalog tetap dapat dipakai. */ }
}

async function loadLanguages() {
  try {
    const query = state.platform ? `?platform=${encodeURIComponent(state.platform)}` : "";
    const result = await api(`/api/languages${query}`);
    const current = state.lang;
    elements.languageFilter.innerHTML = '<option value="">Semua bahasa</option>';
    result.data.forEach(({ lang }) => {
      const option = document.createElement("option");
      option.value = lang; option.textContent = lang === "id" ? "Indonesia" : lang.toUpperCase();
      elements.languageFilter.append(option);
    });
    elements.languageFilter.value = [...elements.languageFilter.options].some((option) => option.value === current) ? current : "";
    state.lang = elements.languageFilter.value;
  } catch { elements.languageFilter.value = state.lang; }
}

function detailsMarkup(title, episodes) {
  const tags = (title.tags || []).slice(0, 8).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const available = episodes.filter((episode) => episode.resolutions?.length);
  const poster = title.poster
    ? `<img class="detail-poster" src="${escapeHtml(title.poster)}" alt="Poster ${escapeHtml(title.title)}" />`
    : '<div class="detail-poster detail-placeholder">D</div>';
  const rows = episodes.map((episode) => {
    const canPlay = episode.resolutions?.length;
    const quality = canPlay ? Math.max(...episode.resolutions) : null;
    return `<article class="episode-row ${canPlay ? "" : "unavailable"}">
      <button class="episode-play" data-episode="${episode.ep}" type="button" ${canPlay ? "" : "disabled"}>
        <span class="episode-number">${String(episode.ep).padStart(2, "0")}</span>
        <span class="episode-copy"><strong>Episode ${episode.ep}</strong><small>${canPlay ? `${quality}p · ${durationLabel(episode.duration_sec)}` : "Belum tersedia"}</small></span>
        <span class="episode-play-icon" aria-hidden="true">▶</span>
      </button>
      ${canPlay ? `<button class="episode-download" data-download="${episode.ep}" type="button" aria-label="Unduh episode ${episode.ep}"><span aria-hidden="true">↓</span><small>Unduh</small></button>` : ""}
    </article>`;
  }).join("");
  return `
    <div class="detail-hero">
      ${title.poster ? `<img class="detail-backdrop" src="${escapeHtml(title.poster)}" alt="" aria-hidden="true" />` : ""}${poster}
      <div class="detail-copy"><p class="kicker">${escapeHtml(title.platform)} · ${escapeHtml(title.lang)}</p>
        <h2>${escapeHtml(title.title)}</h2><p>${escapeHtml(title.synopsis || "Sinopsis belum tersedia untuk judul ini.")}</p>
        <div class="detail-actions">${available.length ? '<button class="primary-action" data-play-first type="button"><span>▶</span> Mulai nonton</button>' : ""}
          <button class="secondary-action detail-favorite ${isFavorite(title) ? "saved" : ""}" data-favorite-key="${escapeHtml(favoriteKey(title))}" type="button">${favoriteButtonText(title)}</button>
        </div><div class="detail-tags">${tags}</div>
      </div>
    </div>
    <section class="episode-section">
      <div class="episode-heading"><div><h3>Episode</h3><p>${available.length} dari ${episodes.length} episode tersedia</p></div><span>Unduh per episode</span></div>
      <p class="download-note">File otomatis dinamai <strong>${escapeHtml(title.title)} - Episode XX.mp4</strong>.</p>
      <div class="episode-list">${rows || "<p>Belum ada episode.</p>"}</div>
    </section>`;
}

function wireDetailActions() {
  elements.detailContent.querySelector("[data-play-first]")?.addEventListener("click", () => openPlayer(state.episodes.find((item) => item.resolutions?.length)));
  elements.detailContent.querySelector(".detail-favorite")?.addEventListener("click", () => toggleFavorite(state.selectedTitle));
  elements.detailContent.querySelectorAll("[data-episode]").forEach((button) => {
    button.addEventListener("click", () => openPlayer(state.episodes.find((item) => item.ep === Number(button.dataset.episode))));
  });
  elements.detailContent.querySelectorAll("[data-download]").forEach((button) => {
    button.addEventListener("click", () => downloadEpisode(state.episodes.find((item) => item.ep === Number(button.dataset.download)), button));
  });
}

async function openDetails(summary) {
  state.selectedTitle = summary;
  elements.detailContent.innerHTML = '<div class="status-card"><p>Memuat detail dan episode...</p></div>';
  elements.detailDialog.showModal();
  try {
    const params = new URLSearchParams({ id: summary.id, lang: summary.lang || "" });
    const [titleResult, episodesResult] = await Promise.all([api(`/api/title?${params}`), api(`/api/episodes?id=${encodeURIComponent(summary.id)}`)]);
    state.selectedTitle = titleResult.data; state.episodes = episodesResult.data;
    elements.detailContent.innerHTML = detailsMarkup(state.selectedTitle, state.episodes);
    wireDetailActions();
  } catch (error) { elements.detailContent.innerHTML = `<div class="status-card"><p>${escapeHtml(error.message)}</p></div>`; }
}

function downloadEpisode(episode, button) {
  if (!episode?.resolutions?.length || !state.selectedTitle) return;
  const params = new URLSearchParams({
    id: state.selectedTitle.id, ep: episode.ep, res: Math.max(...episode.resolutions),
    lang: state.selectedTitle.lang || "", title: state.selectedTitle.title,
  });
  const original = button.innerHTML;
  button.disabled = true; button.innerHTML = '<span aria-hidden="true">…</span><small>Siapkan</small>';
  const link = document.createElement("a");
  link.href = `/api/download?${params}`; link.download = ""; document.body.append(link); link.click(); link.remove();
  showToast(`Menyiapkan Episode ${episode.ep} untuk QuickTime…`);
  setTimeout(() => { button.disabled = false; button.innerHTML = original; }, 1600);
}

function configureQuality(episode, preferred) {
  elements.qualitySelect.innerHTML = "";
  [...(episode.resolutions || [])].sort((a, b) => b - a).forEach((resolution) => {
    const option = document.createElement("option");
    option.value = resolution; option.textContent = `${resolution}p`; option.selected = resolution === preferred;
    elements.qualitySelect.append(option);
  });
}

function enableDefaultSubtitle() {
  const tracks = elements.videoPlayer.textTracks;
  const trackElements = elements.videoPlayer.querySelectorAll("track");
  let enabled = false;
  for (let index = 0; index < tracks.length; index += 1) {
    const shouldShow = Boolean(trackElements[index]?.default) || (!enabled && index === 0);
    tracks[index].mode = shouldShow && !enabled ? "showing" : "disabled";
    if (shouldShow) enabled = true;
  }
}

async function requestPlayback({ keepTime = false } = {}) {
  if (!state.selectedTitle || !state.selectedEpisode) return;
  const generation = ++state.playGeneration;
  const resumeAt = keepTime ? elements.videoPlayer.currentTime : 0;
  const wasPlaying = !elements.videoPlayer.paused;
  elements.playerLoading.classList.remove("hidden");
  try {
    const result = await api("/api/play", { method: "POST", body: JSON.stringify({
      id: state.selectedTitle.id, ep: state.selectedEpisode.ep,
      res: Number(elements.qualitySelect.value) || undefined, lang: state.selectedTitle.lang,
    }) });
    if (generation !== state.playGeneration) return;
    const play = result.data;
    elements.videoPlayer.innerHTML = "";
    (play.subtitles || []).forEach((subtitle) => {
      const track = document.createElement("track");
      track.kind = "subtitles"; track.srclang = subtitle.lang; track.label = subtitle.label || subtitle.lang;
      track.src = subtitle.url; track.default = Boolean(subtitle.default); elements.videoPlayer.append(track);
    });
    elements.videoPlayer.src = play.url;
    elements.videoPlayer.dataset.expiresAt = String(Date.now() + (play.expires_in * 1000));
    const subtitleInfo = play.subtitles?.length ? ` · ${play.subtitles.length} subtitle` : " · tanpa track subtitle";
    elements.playerInfo.textContent = `Kualitas ${play.resolution}p${subtitleInfo} · tautan aktif ${Math.round(play.expires_in / 60)} menit`;
    elements.qualitySelect.value = String(play.resolution);
    elements.videoPlayer.addEventListener("loadedmetadata", () => {
      enableDefaultSubtitle();
      if (resumeAt > 0 && resumeAt < elements.videoPlayer.duration) elements.videoPlayer.currentTime = resumeAt;
      if (wasPlaying || !keepTime) elements.videoPlayer.play().catch(() => {});
    }, { once: true });
    elements.videoPlayer.load();
  } catch (error) { elements.playerInfo.textContent = error.message; }
  finally { if (generation === state.playGeneration) elements.playerLoading.classList.add("hidden"); }
}

function openPlayer(episode) {
  if (!episode?.resolutions?.length) return;
  state.selectedEpisode = episode;
  configureQuality(episode, Math.max(...episode.resolutions));
  elements.playerTitle.textContent = state.selectedTitle.title;
  elements.playerEpisode.textContent = `Episode ${episode.ep}`;
  elements.videoPlayer.removeAttribute("src"); elements.videoPlayer.load();
  elements.detailDialog.close(); elements.playerDialog.showModal(); requestPlayback();
}

function closeDialog(name) {
  const dialog = name === "player" ? elements.playerDialog : elements.detailDialog;
  if (name === "player") {
    state.playGeneration += 1; elements.videoPlayer.pause(); elements.videoPlayer.removeAttribute("src");
    elements.videoPlayer.innerHTML = ""; elements.videoPlayer.load();
  }
  dialog.close();
}

elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = elements.searchInput.value.trim();
  if (query.length < 2) { elements.searchInput.setCustomValidity("Masukkan minimal 2 karakter."); elements.searchInput.reportValidity(); return; }
  elements.searchInput.setCustomValidity(""); state.query = query; state.page = 1;
  elements.catalogKicker.textContent = "Hasil pencarian"; elements.catalogTitle.textContent = `“${query}”`;
  elements.clearSearch.classList.remove("hidden"); document.querySelector("#jelajah").scrollIntoView({ behavior: "smooth" }); loadCatalog();
});
elements.clearSearch.addEventListener("click", () => {
  state.query = ""; state.page = 1; elements.searchInput.value = "";
  elements.catalogKicker.textContent = "Pilihan untukmu"; elements.catalogTitle.textContent = "Sedang hangat";
  elements.clearSearch.classList.add("hidden"); loadCatalog();
});
elements.platformFilters.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-platform]"); if (!button) return;
  elements.platformFilters.querySelectorAll(".pill").forEach((pill) => pill.classList.toggle("active", pill === button));
  state.platform = button.dataset.platform; state.page = 1; await loadLanguages(); loadCatalog();
});
elements.languageFilter.addEventListener("change", () => { state.lang = elements.languageFilter.value; state.page = 1; loadCatalog(); });
elements.previousPage.addEventListener("click", () => { state.page -= 1; loadCatalog(); document.querySelector("#jelajah").scrollIntoView(); });
elements.nextPage.addEventListener("click", () => { state.page += 1; loadCatalog(); document.querySelector("#jelajah").scrollIntoView(); });
elements.qualitySelect.addEventListener("change", () => requestPlayback({ keepTime: true }));
elements.videoPlayer.addEventListener("error", () => {
  if (Date.now() > Number(elements.videoPlayer.dataset.expiresAt || 0) && elements.playerDialog.open) requestPlayback({ keepTime: true });
});
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => closeDialog(button.dataset.close)));
document.querySelector("#mobileSearchButton").addEventListener("click", () => { elements.searchInput.focus(); elements.searchForm.scrollIntoView({ behavior: "smooth", block: "center" }); });
[elements.detailDialog, elements.playerDialog].forEach((dialog) => dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeDialog(dialog === elements.playerDialog ? "player" : "detail");
}));
elements.playerDialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog("player"); });

renderFavorites();
const requestedTitle = new URLSearchParams(location.search);
if (requestedTitle.get("title")) {
  openDetails({ id: requestedTitle.get("title"), lang: requestedTitle.get("lang") || "" });
}
Promise.allSettled([loadPlatforms(), loadLanguages()]).finally(loadCatalog);
