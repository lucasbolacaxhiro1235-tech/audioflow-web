/* ============================================================
   AudioFlow — Frontend logic
   Ponte com o host Python via window.pywebview.api
   ============================================================ */

"use strict";

const $ = (id) => document.getElementById(id);

const el = {
  input: $("url-input"),
  clear: $("clear-btn"),
  meta: $("meta-line"),
  statusDot: $("status-dot"),
  format: $("format"),
  quality: $("quality"),
  folder: $("folder"),
  folderBtn: $("folder-btn"),
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
  appVersion: $("app-version"),
  checkUpdateBtn: $("check-update-btn"),
  updateModal: $("update-modal"),
  updateTitle: $("update-modal-title"),
  updateSubtitle: $("update-modal-subtitle"),
  updateSize: $("update-size"),
  updateNotes: $("update-notes"),
  updateError: $("update-error"),
  updateProgress: $("update-progress"),
  updateProgressFill: $("update-progress-fill"),
  updateProgressMeta: $("update-progress-meta"),
  updateLater: $("update-later-btn"),
  updateNow: $("update-now-btn"),
  wmEnabled: $("wm-enabled"),
  wmOptions: $("wm-options"),
  wmText: $("wm-text"),
  wmPosition: $("wm-position"),
  wmVolume: $("wm-volume"),
  wmVolumeLabel: $("wm-volume-label"),
  wmEcho: $("wm-effect-echo"),
  wmReverb: $("wm-effect-reverb"),
  wmDeep: $("wm-effect-deep"),
  wmRadio: $("wm-effect-radio"),
  wmVoice: $("wm-voice"),
  wmVoiceBtn: $("wm-voice-btn"),
  wmVoiceName: $("wm-voice-name"),
};

/**
 * Configurações de API
 * Se você tiver um servidor backend rodando o AudioFlow, 
 * substitua '/api' pela URL do seu servidor.
 */
const API_BASE_URL = '/api';

async function callApi(method, ...args) {
  try {
    const r = await fetch(`${API_BASE_URL}/call`, {
      method: \"POST\",
      headers: { \"Content-Type\": \"application/json\" },
      body: JSON.stringify({ method, args }),
    });
    
    if (!r.ok) throw new Error(`Erro HTTP: ${r.status}`);
    
    const data = await r.json();
    if (!data || !data.ok) {
      throw new Error(data?.error || \"O servidor retornou um erro.\");
    }
    return data.result;
  } catch (e) {
    console.error(\"Erro na chamada de API:\", e);
    throw e;
  }
}


function startEventPoll() {
  let since = 0;
  async function tick() {
    try {
      const r = await fetch("/api/events?since=" + since);
      const data = await r.json();
      if (data && Array.isArray(data.events) && data.events.length) {
        for (const ev of data.events) window.audioflow_event(ev);
      }
      if (data && typeof data.seq === "number") since = data.seq;
    } catch { /* sem conexão com o host */ }
    setTimeout(tick, 800);
  }
  tick();
}

const Icons = {
  ok: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  err: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
  info: '<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
};

const MUSIC_PH = '<svg class="track__ph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a9 9 0 0 0-3.6 17.24c.45.08.62-.19.62-.43v-1.5c-2.52.55-3.05-1.22-3.05-1.22-.41-1.05-1-1.33-1-1.33-.82-.56.06-.55.06-.55.9.06 1.38.93 1.38.93.8 1.38 2.11.98 2.63.75.08-.58.31-.98.57-1.2-2-.23-4.1-1-4.1-4.45 0-.98.35-1.79.93-2.42-.1-.23-.4-1.15.08-2.39 0 0 .76-.24 2.48.93a8.6 8.6 0 0 1 4.52 0c1.72-1.17 2.48-.93 2.48-.93.49 1.24.18 2.16.09 2.39.58.63.92 1.44.92 2.42 0 3.45-2.1 4.22-4.1 4.45.32.28.61.82.61 1.66v2.46c0 .24.16.52.62.43A9 9 0 0 0 12 3z"/></svg>';

const STATE = {
  busy: false,
  meta: null, // {type, name, total, cover}
  tracks: new Map(), // id -> {name, status, cover}
};

/* ---------------- Utilidades ---------------- */

function toast(kind, message) {
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
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function setStatus(mode) {
  el.statusDot.className = "pill" + (mode === "busy" ? " pill--busy" : " pill--success");
  el.statusDot.querySelector(".dot").textContent = "";
  el.statusDot.lastChild.textContent = mode === "busy" ? " Baixando" : " Pronto";
}

function setDownloadLoading(loading) {
  el.download.disabled = loading || STATE.busy;
  el.download.classList.toggle("btn--loading", loading);
  el.downloadLabel.textContent = loading ? "Preparando…" : "Baixar";
}

function setBusy(busy) {
  STATE.busy = busy;
  el.stop.disabled = !busy;
  el.download.disabled = busy;
  el.download.classList.remove("btn--loading");
  setStatus(busy ? "busy" : "ready");
  if (!busy) el.downloadLabel.textContent = "Baixar";
}

/* ---------------- Meta info ao colar link ---------------- */

function setHeroCover(url) {
  if (!url) {
    el.heroCover.hidden = true;
    el.heroCoverImg.removeAttribute("src");
    return;
  }
  el.heroCover.hidden = false;
  el.heroCoverImg.onerror = () => {
    el.heroCoverImg.hidden = true;
  };
  el.heroCoverImg.onload = () => {
    el.heroCoverImg.hidden = false;
  };
  el.heroCoverImg.src = url;
}

async function refreshMeta() {
  const url = el.input.value.trim();
  if (!url) {
    el.meta.textContent = "Cole um link para ver a contagem de músicas.";
    el.meta.className = "meta";
    setHeroCover(null);
    return;
  }
  el.meta.textContent = "Analisando link…";
  el.meta.className = "meta meta--loading";
  try {
    const info = await callApi("fetch_meta", url);
    STATE.meta = info;
    setHeroCover(info.cover || null);
    const label =
      info.type === "playlist" ? "Playlist" :
      info.type === "album" ? "Álbum" : "Faixa";
    const name = info.name ? ` — ${info.name}` : "";
    const total = info.total ? ` · ${info.total} ${info.total === 1 ? "música" : "músicas"}` : "";
    el.meta.textContent = `${label}${name}${total}`;
    el.meta.className = "meta";
  } catch (e) {
    setHeroCover(null);
    el.meta.textContent = e?.message || "Não foi possível analisar este link.";
    el.meta.className = "meta meta--error";
  }
}

/* ---------------- Renderização das músicas ---------------- */

const badgeLabel = {
  downloading: "Baixando…",
  ok: "✓ Baixada",
  skip: "= Já existia",
  fail: "✗ Falhou",
};

function makeThumb(cover) {
  const thumb = document.createElement("span");
  thumb.className = "track__thumb";
  if (!cover) {
    thumb.classList.add("track__thumb--ph");
    thumb.innerHTML = MUSIC_PH;
    return thumb;
  }
  const img = document.createElement("img");
  img.alt = "";
  img.loading = "lazy";
  img.onerror = () => {
    thumb.classList.add("track__thumb--ph");
    thumb.innerHTML = MUSIC_PH;
  };
  img.src = cover;
  thumb.appendChild(img);
  return thumb;
}

function renderTracks() {
  el.trackList.innerHTML = "";
  const entries = [...STATE.tracks.entries()];
  if (!entries.length) {
    el.trackList.appendChild(el.trackEmpty);
    el.trackEmpty.hidden = false;
    el.countBadge.hidden = true;
    return;
  }
  el.trackEmpty.hidden = true;
  el.countBadge.hidden = false;
  el.countBadge.textContent = String(entries.length);
  for (const [id, t] of entries) {
    const row = document.createElement("div");
    row.className = "track";
    row.dataset.id = id;
    const name = document.createElement("span");
    name.className = "track__name";
    name.textContent = t.name;
    name.title = t.name;
    const badge = document.createElement("span");
    badge.className = `badge badge--${t.status}`;
    badge.textContent = badgeLabel[t.status] || t.status;
    row.append(makeThumb(t.cover), name, badge);
    el.trackList.appendChild(row);
  }
  el.trackList.scrollTop = el.trackList.scrollHeight;
}

function upsertTrack(id, name, status, cover) {
  STATE.tracks.set(id, { name, status, cover });
  renderTracks();
}

function clearTracks() {
  STATE.tracks.clear();
  renderTracks();
}

/* ---------------- Progresso ---------------- */

function setProgress(percent, label) {
  el.progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  el.progressLabel.textContent = label || "";
}

/* ---------------- Download ---------------- */

async function startDownload() {
  const url = el.input.value.trim();
  if (!url) {
    toast("error", "Cole um link do Spotify primeiro.");
    return;
  }
  const settings = {
    format: el.format.value,
    quality: parseInt(el.quality.value, 10),
    folder: el.folder.value.trim(),
    tracknum: el.tracknum.checked,
    watermark: wmState(),
  };

  clearTracks();
  setProgress(0, "Iniciando…");
  setBusy(true);

  try {
    await callApi("download", url, settings);
    el.downloadLabel.textContent = "Baixando…";
  } catch (e) {
    toast("error", e?.message || "Erro ao iniciar o download.");
    setBusy(false);
    setDownloadLoading(false);
    setProgress(0, "");
  }
}

async function stopDownload() {
  setBusy(false);
  try {
    await callApi("cancel");
  } catch { /* ignore */ }
  toast("info", "Download interrompido.");
  setProgress(0, "");
  setDownloadLoading(false);
}

/* ---------------- Atualização ---------------- */

const Update = {
  info: null,      // ReleaseInfo {version, notes, size}
  state: "idle",   // idle | available | downloading | ready | error
};

function fmtBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function fmtSpeed(bytesPerSec) {
  if (!bytesPerSec) return "…";
  return `${fmtBytes(bytesPerSec)}/s`;
}

function updateModalOpen() {
  el.updateModal.hidden = false;
}

function updateModalClose() {
  el.updateModal.hidden = true;
}

function updateSetState(state) {
  Update.state = state;
  const downloading = state === "downloading";
  const ready = state === "ready";
  const error = state === "error";

  el.updateError.hidden = !error;
  el.updateProgress.hidden = !downloading;
  el.updateNotes.hidden = !(state === "available" || state === "ready");

  const canDismiss = !downloading;
  el.updateLater.disabled = !canDismiss;
  el.updateLater.hidden = downloading;

  el.updateNow.hidden = false;
  el.updateNow.disabled = false;

  if (state === "available") {
    el.updateTitle.textContent = "Nova versão disponível";
    el.updateNow.textContent = "Atualizar agora";
  } else if (state === "downloading") {
    el.updateTitle.textContent = "Baixando atualização…";
    el.updateNow.hidden = true;
  } else if (state === "ready") {
    el.updateTitle.textContent = "Atualização pronta";
    el.updateNow.textContent = "Instalar e reiniciar";
  } else if (state === "error") {
    el.updateTitle.textContent = "Falha na atualização";
    el.updateNow.textContent = "Tentar novamente";
  }
}

function updateShowInfo(info) {
  Update.info = info;
  el.updateSubtitle.textContent = `AudioFlow ${info.current || "v?"} → ${info.version}`;
  const size = fmtBytes(info.size);
  el.updateSize.textContent = size
    ? `Tamanho do download: ${size}. As notas da versão:`
    : "As notas da versão:";
  if (info.notes) {
    el.updateNotes.hidden = false;
    el.updateNotes.textContent = info.notes;
  } else {
    el.updateNotes.hidden = true;
  }
  updateSetState("available");
  updateModalOpen();
}

function updateSetError(message) {
  el.updateError.textContent = message || "Não foi possível atualizar agora.";
  updateSetState("error");
}

function updateSetProgress(percent, downloaded, total, speed) {
  el.updateProgressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  const base = `${fmtBytes(downloaded)} de ${fmtBytes(total)}`;
  el.updateProgressMeta.textContent = speed
    ? `${base} · ${fmtSpeed(speed)}`
    : base;
}

async function updateStartDownload() {
  updateSetState("downloading");
  el.updateProgressFill.style.width = "0%";
  el.updateProgressMeta.textContent = "Conectando…";
  try {
    await callApi("download_update");
  } catch (e) {
    updateSetError(e?.message || "Não foi possível baixar a atualização.");
  }
}

async function updateInstall() {
  try {
    await callApi("install_update");
    el.updateTitle.textContent = "Aplicando atualização…";
    el.updateNow.disabled = true;
    el.updateLater.disabled = true;
    toast("info", "Aplicando atualização… o app vai reiniciar.");
  } catch (e) {
    updateSetError(e?.message || "Não foi possível aplicar a atualização.");
  }
}

el.updateNow.addEventListener("click", () => {
  if (Update.state === "downloading") return;
  if (Update.state === "ready") {
    updateInstall();
    return;
  }
  if (Update.state === "error" || Update.state === "available") {
    updateStartDownload();
    return;
  }
});

el.updateLater.addEventListener("click", () => {
  if (Update.state === "downloading") return;
  callApi("dismiss_update", Update.info).catch(() => {});
  updateModalClose();
});

el.checkUpdateBtn.addEventListener("click", () => {
  toast("info", "Verificando atualizações…");
  callApi("check_update_async").catch(() => {});
});

function updateHandleEvent(payload) {
  switch (payload.type) {
    case "update_available":
      updateShowInfo(payload);
      break;
    case "update_download_progress":
      updateSetProgress(
        payload.percent,
        payload.downloaded,
        payload.total,
        payload.speed
      );
      break;
    case "update_download_done":
      updateSetState("ready");
      break;
    case "update_download_error":
      updateSetError(payload.message);
      break;
    case "update_error":
      // Falha silenciosa (sem conexão): nada a fazer.
      break;
  }
}

/* ---------------- Assinatura de áudio ---------------- */

function wmEffects() {
  const out = [];
  if (el.wmEcho.checked) out.push("echo");
  if (el.wmReverb.checked) out.push("reverb");
  if (el.wmDeep.checked) out.push("deep");
  if (el.wmRadio.checked) out.push("radio");
  return out;
}

function wmState() {
  return {
    enabled: el.wmEnabled.checked,
    text: el.wmText.value.trim() || "LJCD",
    position: el.wmPosition.value,
    volume: parseInt(el.wmVolume.value, 10) / 100,
    effects: wmEffects(),
    voice: el.wmVoice.value === "custom" ? window.__wmVoicePath || "custom" : "tts",
  };
}

function wmApplyConfig(wm) {
  if (!wm) return;
  el.wmEnabled.checked = Boolean(wm.enabled);
  el.wmOptions.hidden = !wm.enabled;
  if (wm.text) el.wmText.value = wm.text;
  if (["start", "middle", "end"].includes(wm.position)) el.wmPosition.value = wm.position;
  if (typeof wm.volume === "number") {
    el.wmVolume.value = String(Math.round(wm.volume * 100));
    el.wmVolumeLabel.textContent = `${Math.round(wm.volume * 100)}%`;
  }
  const effects = wm.effects || [];
  el.wmEcho.checked = effects.includes("echo");
  el.wmReverb.checked = effects.includes("reverb");
  el.wmDeep.checked = effects.includes("deep");
  el.wmRadio.checked = effects.includes("radio");
  if (wm.voice) {
    if (wm.voice === "tts") {
      el.wmVoice.value = "tts";
    } else {
      el.wmVoice.value = "custom";
      window.__wmVoicePath = wm.voice;
      el.wmVoiceName.hidden = false;
      el.wmVoiceName.textContent = wm.voice.split(/[\\/]/).pop();
    }
  }
  wmSyncVoiceUI();
}

function wmSyncVoiceUI() {
  const custom = el.wmVoice.value === "custom";
  el.wmVoiceBtn.hidden = !custom;
}

function wmSyncVolumeLabel() {
  el.wmVolumeLabel.textContent = `${el.wmVolume.value}%`;
}

el.wmEnabled.addEventListener("change", () => {
  el.wmOptions.hidden = !el.wmEnabled.checked;
  scheduleSave();
});

el.wmVolume.addEventListener("input", () => {
  wmSyncVolumeLabel();
  scheduleSave();
});

[el.wmText, el.wmPosition, el.wmEcho, el.wmReverb, el.wmDeep, el.wmRadio, el.wmVoice].forEach((node) =>
  node.addEventListener("change", () => {
    wmSyncVoiceUI();
    scheduleSave();
  })
);
el.wmText.addEventListener("input", scheduleSave);

el.wmVoiceBtn.addEventListener("click", async () => {
  try {
    const file = await callApi("pick_voice_file");
    if (file) {
      el.wmVoiceName.hidden = false;
      el.wmVoiceName.textContent = file.split(/[\\/]/).pop();
      window.__wmVoicePath = file;
      scheduleSave();
    }
  } catch (e) {
    toast("error", e?.message || "Não foi possível escolher o arquivo de voz.");
  }
});

/* ---------------- Pasta ---------------- */

async function pickFolder() {
  try {
    const folder = await callApi("pick_folder");
    if (folder) el.folder.value = folder;
  } catch (e) {
    toast("error", e?.message || "Não foi possível escolher a pasta.");
  }
}

/* ---------------- Eventos vindos do Python ---------------- */

window.audioflow_event = (payload) => {
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return;
    }
  }
  if (!payload || typeof payload !== "object") return;
  switch (payload.type) {
    case "meta":
      STATE.meta = payload;
      el.meta.textContent = `${payload.name || ""} · ${payload.total || 0} músicas`;
      el.meta.className = "meta";
      break;

    case "track_start":
      setBusy(true);
      upsertTrack(payload.id, payload.name, "downloading", payload.cover);
      break;

    case "track_done":
      upsertTrack(payload.id, payload.name, "ok", payload.cover);
      break;

    case "track_skip":
      upsertTrack(payload.id, payload.name, "skip", payload.cover);
      break;

    case "track_fail":
      upsertTrack(payload.id, payload.name, "fail", payload.cover);
      break;

    case "progress":
      setProgress(payload.percent, payload.label);
      break;

    case "finish":
      setBusy(false);
      setProgress(100, payload.summary || "Concluído.");
      toast("success", payload.summary || "Download concluído.");
      break;

    case "error":
      setBusy(false);
      setDownloadLoading(false);
      setProgress(0, "");
      toast("error", payload.message || "Ocorreu um erro.");
      break;
  }
  updateHandleEvent(payload);
};

/* ---------------- Eventos da página ---------------- */

let metaTimer = null;
el.input.addEventListener("input", () => {
  el.clear.hidden = !el.input.value;
  clearTimeout(metaTimer);
  metaTimer = setTimeout(refreshMeta, 450);
});

el.clear.addEventListener("click", () => {
  el.input.value = "";
  el.clear.hidden = true;
  refreshMeta();
});

el.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startDownload();
});

el.download.addEventListener("click", () => {
  setDownloadLoading(true);
  startDownload();
});

el.stop.addEventListener("click", stopDownload);
el.folderBtn.addEventListener("click", pickFolder);

/* ---------------- Persistência de configurações ---------------- */

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    callApi("save_config", {
      format: el.format.value,
      quality: parseInt(el.quality.value, 10),
      folder: el.folder.value.trim(),
      tracknum: el.tracknum.checked,
      watermark: wmState(),
    }).catch(() => {});
  }, 400);
}

[el.format, el.quality, el.tracknum].forEach((node) =>
  node.addEventListener("change", scheduleSave)
);
el.folder.addEventListener("input", scheduleSave);

/* ---------------- Inicialização ---------------- */

function waitForBridge(timeoutMs) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const probe = () => {
      if (getApi()) return resolve(true);
      if (Date.now() >= deadline) return resolve(false);
      setTimeout(probe, 120);
    };
    probe();
  });
}

function bridgeReady() {
  return isHttpMode() || !!getApi();
}

function callApiTimeout(method, timeoutMs, ...args) {
  return Promise.race([
    callApi(method, ...args),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`bridge ${method} demorou demais`)), timeoutMs)
    ),
  ]);
}

function applyAndroidConfig(config) {
  // Sem seletor de pasta nem atualização automática no celular.
  const folderField = document.querySelector(".field--wide");
  if (folderField) folderField.hidden = true;
  el.checkUpdateBtn.hidden = true;
  // No Android não há ffmpeg: sem assinatura de áudio.
  const wmSwitch = el.wmEnabled.closest(".switch--wide");
  if (wmSwitch) wmSwitch.hidden = true;
  el.wmOptions.hidden = true;
  // No Android não há ffmpeg: só formatos sem conversão.
  [...el.format.options].forEach((opt) => {
    if (!["m4a", "opus"].includes(opt.value)) opt.hidden = true;
  });
  if (!["m4a", "opus"].includes(el.format.value)) {
    el.format.value = "m4a";
  }
  if (config.folder) el.folder.value = config.folder;
  window.__android = true;
}

(async function init() {
  // A ponte pywebview às vezes demora a ser injetada (WebView2). Em vez de
  // tentar uma vez e desistir, repete até conseguir config + versão (máx. 60s).
  window.__initRan = true;
  let android = false;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (bridgeReady()) {
      try {
        const config = await callApiTimeout("get_config", 3000);
        if (config) {
          if (config.format) el.format.value = config.format;
          if (config.quality) el.quality.value = String(config.quality);
          if (config.folder) el.folder.value = config.folder;
          if (config.tracknum != null) el.tracknum.checked = Boolean(config.tracknum);
          if (config.platform === "android") {
            applyAndroidConfig(config);
            android = true;
          }
          if (config.watermark) wmApplyConfig(config.watermark);
        }
      } catch { /* configuração indisponível */ }
      try {
        const version = await callApiTimeout("get_app_version", 3000);
        if (version) {
          el.appVersion.textContent = version;
          window.__versionSet = true;
          break;
        }
      } catch { /* sem api */ }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (isHttpMode()) startEventPoll();

  // Verificação de atualização no boot (não bloqueia a interface).
  callApi("check_update_async").catch(() => {});
  setStatus("ready");
})();
