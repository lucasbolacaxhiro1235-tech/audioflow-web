"use strict";

const $ = (id) => document.getElementById(id);

// URL ABSOLUTA E SEGURA DO SERVIDOR RAILWAY
const API_BASE_URL = 'https://web-production-00052.up.railway.app';

const el = {
  input: $("url-input"),
  clear: $("clear-btn"),
  meta: $("meta-line"),
  statusDot: $("status-dot"),
  format: $("format-select"),
  quality: $("quality-select"),
  tracknum: $("tracknum"),
  download: $("download-btn"),
  downloadLabel: $("download-label"),
  stop: $("stop-btn"),
  progressFill: $("progress-fill"),
  progressLabel: $("progress-label"),
  trackList: $("track-list"),
  trackEmpty: $("track-empty"),
  countBadge: $("count-badge"),
  toastWrap: $("toast-wrap"),
  heroCover: $("hero-cover"),
  heroCoverImg: $("hero-cover-img"),
  wmEnabled: $("wm-enabled"),
  wmOptions: $("wm-options"),
  wmText: $("wm-text"),
  // Fixed: Removed missing references that cause crashes
};

async function callApi(method, ...args) {
  try {
    // Force HTTPS and absolute URL to avoid Mixed Content errors
    const response = await fetch(`${API_BASE_URL}/api/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, args }),
      mode: 'cors' // Force CORS mode
    });

    if (!response.ok) throw new Error(`Erro no Servidor: ${response.status}`);

    const data = await response.json();
    if (!data || !data.ok) {
      throw new Error(data?.error || "O servidor retornou um erro.");
    }
    return data.result;
  } catch (e) {
    console.error("API Connection Error:", e);
    throw e;
  }
}

const Icons = {
  ok: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  err: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
  info: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
};

const MUSIC_PH = '<svg class="track__ph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a9 9 0 0 0-3.6 17.24c.45.08.62-.19.62-.43v-1.5c-2.52.55-3.05-1.22-3.05-1.22-.41-1.05-1-1.33-1-1.33-.82-.56.06-.55.06-.55.9.06 1.38.93 1.38.93.8 1.38 2.11.98 2.63.75.08-.58.31-.98.57-1.2-2-.23-4.1-1-4.1-4.45 0-.98.35-1.79.93-2.42-.1-.23-.4-1.15.08-2.39 0 0 .76-.24 2.48.93a8.6 8.6 0 0 1 4.52 0c1.72-1.17 2.48-.93 2.48-.93.49 1.24.18 2.16.09 2.39.58.63.92 1.44.92 2.42 0 3.45-2.1 4.22-4.1 4.45.32.28.61.82.61 1.66v2.46c0 .24.16.52.62.43A9 9 0 0 0 12 3z"/></svg>';

const STATE = {
  busy: false,
  meta: null,
  tracks: new Map(),
};

function toast(kind, message) {
  if (!el.toastWrap) return;
  const node = document.createElement("div");
  node.className = `toast toast--${kind}`;
  node.innerHTML = `${Icons[kind] || ""}<span>${escapeHtml(message)}</span>`;
  el.toastWrap.appendChild(node);
  setTimeout(() => {
    node.classList.add("toast--out");
    setTimeout(() => node.remove(), 260);
  }, 3200);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function setStatus(mode) {
  if (!el.statusDot) return;
  el.statusDot.className = "pill" + (mode === "busy" ? " pill--busy" : " pill--success");
  const dot = el.statusDot.querySelector(".dot");
  if (dot) dot.textContent = "";
  const text = el.statusDot.querySelector(".status-text");
  if (text) text.textContent = mode === "busy" ? " Baixando" : " Pronto";
}

function setBusy(busy) {
  STATE.busy = busy;
  if (el.stop) el.stop.disabled = !busy;
  if (el.download) el.download.disabled = busy;
  setStatus(busy ? "busy" : "ready");
}

function setHeroCover(url) {
  if (!el.heroCover) return;
  if (!url) {
    el.heroCover.hidden = true;
    if (el.heroCoverImg) el.heroCoverImg.removeAttribute("src");
    return;
  }
  el.heroCover.hidden = false;
  if (el.heroCoverImg) {
    el.heroCoverImg.src = url;
  }
}

async function refreshMeta() {
  const url = el.input.value.trim();
  if (!url) {
    if (el.meta) {
        el.meta.textContent = "Cole um link para ver a contagem de músicas.";
        el.meta.className = "meta";
    }
    setHeroCover(null);
    return;
  }
  
  if (el.meta) {
    el.meta.textContent = "Analisando link...";
    el.meta.className = "meta meta--loading";
  }
  
  try {
    const info = await callApi("fetch_meta", url);
    STATE.meta = info;
    setHeroCover(info.cover || null);
    const label = info.type === "playlist" ? "Playlist" : info.type === "album" ? "Álbum" : "Faixa";
    const name = info.name ? ` — ${info.name}` : "";
    const total = info.total ? ` · ${info.total} ${info.total === 1 ? "música" : "músicas"}` : "";
    if (el.meta) {
        el.meta.textContent = `${label}${name}${total}`;
        el.meta.className = "meta";
    }
  } catch (e) {
    setHeroCover(null);
    if (el.meta) {
        el.meta.textContent = "Erro ao analisar link. Verifique a conexão com o servidor.";
        el.meta.className = "meta meta--error";
    }
  }
}

function makeThumb(cover) {
  const thumb = document.createElement("span");
  thumb.className = "track__thumb";
  if (!cover) {
    thumb.classList.add("track__thumb--ph");
    thumb.innerHTML = MUSIC_PH;
    return thumb;
  }
  const img = document.createElement("img");
  img.src = cover;
  thumb.appendChild(img);
  return thumb;
}

function renderTracks() {
  if (!el.trackList) return;
  el.trackList.innerHTML = "";
  const entries = [...STATE.tracks.entries()];
  if (!entries.length) {
    if (el.trackEmpty) {
        el.trackList.appendChild(el.trackEmpty);
        el.trackEmpty.hidden = false;
    }
    if (el.countBadge) el.countBadge.hidden = true;
    return;
  }
  if (el.trackEmpty) el.trackEmpty.hidden = true;
  if (el.countBadge) {
      el.countBadge.hidden = false;
      el.countBadge.textContent = String(entries.length);
  }
  for (const [id, t] of entries) {
    const row = document.createElement("div");
    row.className = "track";
    const name = document.createElement("span");
    name.className = "track__name";
    name.textContent = t.name;
    const badge = document.createElement("span");
    badge.className = `badge badge--${t.status}`;
    badge.textContent = t.status;
    row.append(makeThumb(t.cover), name, badge);
    el.trackList.appendChild(row);
  }
}

async function startDownload() {
  const url = el.input.value.trim();
  if (!url) {
    toast("error", "Cole um link do Spotify primeiro.");
    return;
  }
  
  await refreshMeta();
  if (STATE.meta === null) {
      toast("error", "Link inválido ou servidor offline.");
      return;
  }
  
  const settings = {
    format: getCustomValue("format-select") || "mp3",
    quality: getCustomValue("quality-select") || "192",
    tracknum: el.tracknum ? el.tracknum.checked : false,
    watermark: {
        enabled: el.wmEnabled ? el.wmEnabled.checked : false,
        text: el.wmText ? el.wmText.value : "LJCD",
        position: el.wmPosition ? el.wmPosition.value : "middle",
        volume: el.wmVolume ? parseInt(el.wmVolume.value) / 100 : 0.3,
    },
  };


  STATE.tracks.clear();
  renderTracks();
  setProgress(0, "Iniciando...");
  setBusy(true);

  try {
    const downloadId = await callApi("download", url, settings);
    startEventPoll(downloadId);
  } catch (e) {
    toast("error", e?.message || "Erro ao iniciar o download.");
    setBusy(false);
    setProgress(0, "");
  }
}

async function startEventPoll(downloadId) {
  let since = 0;
  async function tick() {
    try {
      const r = await fetch(`${API_BASE_URL}/api/events/${downloadId}`);
      const data = await r.json();
      if (data && Array.isArray(data.events)) {
        for (const ev of data.events) {
          if (ev.type === "track_start") {
            STATE.tracks.set(ev.id, { name: ev.name, status: "downloading", cover: ev.cover });
          } else if (ev.type === "track_done") {
            STATE.tracks.set(ev.id, { name: ev.name, status: "ok", cover: ev.cover });
          } else if (ev.type === "track_fail") {
            STATE.tracks.set(ev.id, { name: ev.name, status: "fail", cover: ev.cover });
          } else if (ev.type === "finish") {
            setBusy(false);
            setProgress(100, ev.summary);
            toast("success", ev.summary);
          }
        }
        renderTracks();
      }
    } catch (e) { console.error("Poll error:", e); }
    setTimeout(tick, 2000);
  }
  tick();
}

function setProgress(percent, label) {
  if (el.progressFill) el.progressFill.style.width = `${percent}%`;
  if (el.progressLabel) el.progressLabel.textContent = label;
}

function initCustomSelects() {
  const selects = ['format-select', 'quality-select'];
  selects.forEach(id => {
    const selectEl = $(id);
    if (!selectEl) return;
    const trigger = selectEl.querySelector('.select-trigger');
    const options = selectEl.querySelector('.select-options');

    trigger.addEventListener('click', () => selectEl.classList.toggle('open'));

    options.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', () => {
        trigger.querySelector('span').textContent = opt.textContent;
        selectEl.classList.remove('open');
      });
    });
  });
}

function getCustomValue(selectId) {
    const selectEl = $(selectId);
    if (!selectEl) return null;
    const currentText = selectEl.querySelector('.select-trigger span').textContent;
    const options = selectEl.querySelectorAll('.option');
    for (let opt of options) {
        if (opt.textContent === currentText) return opt.dataset.value;
    }
    return null;
}

(async function init() {
  initCustomSelects();
  
  if (el.input) {
    el.input.addEventListener("input", () => {
      if (el.clear) el.clear.hidden = !el.input.value;
      refreshMeta();
    });
    if (el.clear) el.clear.addEventListener("click", () => {
      el.input.value = "";
      el.clear.hidden = true;
      refreshMeta();
    });
    el.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") startDownload();
    });
  }
  
  if (el.download) {
    el.download.addEventListener("click", startDownload);
  }
  
  if (el.stop) {
    el.stop.addEventListener("click", async () => {
        setBusy(false);
        try { await callApi("cancel"); } catch(e) {}
        toast("info", "Download interrompido.");
        setProgress(0, "");
    });
  }

  if (el.wmEnabled) {
      el.//S_ENABLED: el.//S_ENABLED: el.wmEnabled.addEventListener("change", () => {
          if (el.//S_OPTIONS: el.//S_OPTIONS: el.wmOptions) el.//S_OPTIONS: el.//S_OPTIONS: el.wmOptions.classList.toggle("hidden", !el.//S_ENABLED: el.//S_ENABLED: el.wmEnabled.checked);
      });
  }

  setStatus("ready");
})();
