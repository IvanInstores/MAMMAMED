/* PillolAPP - app unica: la mamma vede gli avvisi, Ivan gestisce le medicine */
(() => {
  const API = window.MAMMAMED_API;
  const $app = document.getElementById("app");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeImg = (p) => (typeof p === "string" && p.startsWith("data:image/") ? esc(p) : "");

  // --- chiave personale: arriva dal link e resta salvata sul telefono ---
  const qs = new URLSearchParams(location.search);
  let K = qs.get("k");
  try {
    if (K) localStorage.setItem("mammamed_k", K);
    else K = localStorage.getItem("mammamed_k");
  } catch (_) {}

  async function api(action, extra = {}) {
    const r = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, k: K, ...extra }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || "Errore"), { status: r.status });
    return data;
  }

  const fmtTime = (iso) =>
    new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  const todayRome = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
  const fmtDate = (ymd) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  };
  const fmtDay = (iso) =>
    new Date(iso).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Rome" });

  function toast(msg) {
    document.querySelector(".toast")?.remove();
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  // ---------------------------------------------------------------- avvisi
  let VAPID = "";
  const pushSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let pushOn = false;

  const b64ToU8 = (b64) => {
    const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  };

  async function syncPush(ask) {
    if (!pushSupported) return false;
    if (ask && Notification.permission !== "granted") await Notification.requestPermission();
    if (Notification.permission !== "granted") return false;
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, no) => setTimeout(() => no(new Error("sw")), 5000)),
    ]);
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID) });
    }
    await api("subscribe", { sub: sub.toJSON() });
    return true;
  }

  async function closeNotifications() {
    try {
      const reg = await navigator.serviceWorker.ready;
      (await reg.getNotifications()).forEach((n) => n.close());
    } catch (_) {}
  }

  // ---------------------------------------------------------------- suono
  let audio = null;
  addEventListener("pointerdown", () => {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
    } catch (_) {}
  });
  function beep() {
    if (!audio || audio.state !== "running") return;
    [0, 0.35, 0.7].forEach((t) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.5, audio.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + t + 0.28);
      o.connect(g).connect(audio.destination);
      o.start(audio.currentTime + t);
      o.stop(audio.currentTime + t + 0.3);
    });
  }

  // ================================================================ MAMMA
  let momLast = "";
  let momData = null;
  let lastBeep = 0;

  function momAlertBlock() {
    if (pushOn) return "";
    if (!pushSupported) {
      return isIOS && !isStandalone
        ? `<div class="hint"><b>Per ricevere gli avvisi:</b><br>1. Tocca il tasto <b>Condividi</b> in basso<br>2. Scegli <b>«Aggiungi a Home»</b><br>3. Apri l'app <b>PillolAPP</b> dalla schermata Home</div>`
        : `<div class="hint">Questo telefono non riesce a mandare gli avvisi. Tieni aperta questa pagina.</div>`;
    }
    if (Notification.permission === "denied") {
      return `<div class="hint">Gli avvisi sono bloccati. Chiedi aiuto a Ivan.</div>`;
    }
    return `<button class="btn-alert" id="enable">🔔 TOCCA QUI PER ATTIVARE GLI AVVISI</button>`;
  }

  function renderMom(force) {
    const d = momData;
    const now = new Date();
    const key = JSON.stringify([d, pushOn, now.getHours(), now.getMinutes()]);
    if (!force && key === momLast) return;
    momLast = key;

    const clock = now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    const date = now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
    let h = `<div class="mom"><div class="clock">${clock}</div><div class="date">${date}</div>${momAlertBlock()}`;

    if (d.pending.length) {
      h += `<h1>${d.pending.length === 1 ? "È ora della medicina" : "È ora delle medicine"}</h1>`;
      for (const p of d.pending) {
        const img = safeImg(p.photo);
        h += `<section class="card">
          ${img ? `<img src="${img}" alt="">` : ""}
          <div class="when">Ore ${fmtTime(p.due_at)}</div>
          <div class="name">${esc(p.name)}</div>
          <div class="qty">${esc(p.dose)}${p.kind ? `<small>${esc(p.kind)}</small>` : ""}</div>
          ${p.note ? `<div class="note">${esc(p.note)}</div>` : ""}
          <button class="btn-take" data-take="${esc(p.id)}">✅ L'HO PRESA</button>
        </section>`;
      }
    } else {
      const next = d.today.find((t) => !t.taken_at && new Date(t.due_at) > now);
      h += `<div class="calm"><div class="face">😊</div><div class="t">Adesso non devi prendere niente</div>
        ${next
          ? `<div class="next">La prossima medicina è alle<b>ore ${esc(next.time)}</b></div>`
          : `<div class="next">Per oggi hai finito. Brava!</div>`}</div>`;
    }

    if (d.today.length) {
      h += `<h2>Le medicine di oggi</h2><ul class="daylist">`;
      for (const t of d.today) {
        const due = new Date(t.due_at) <= now;
        const st = t.taken_at ? ["✅", "Presa"] : due ? ["⏰", "Da prendere"] : ["", "Più tardi"];
        h += `<li><span class="h">${esc(t.time)}</span>
          <span>${esc(t.name)}<small>${esc(t.dose)} · ${st[1]}</small></span>
          <span class="s">${st[0]}</span></li>`;
      }
      h += `</ul>`;
    }
    h += `</div>`;
    $app.innerHTML = h;
  }

  async function momRefresh() {
    try {
      momData = await api("state");
      renderMom();
      if (momData.pending.length && Date.now() - lastBeep > 25000 && document.visibilityState === "visible") {
        lastBeep = Date.now();
        beep();
      }
    } catch (e) {
      if (e.status === 401) return badLink();
      // senza rete: lascia quello che c'è e riprova
    }
  }

  function startMom() {
    $app.addEventListener("click", async (ev) => {
      const take = ev.target.closest("[data-take]");
      if (take) {
        take.disabled = true;
        try {
          await api("confirm", { dose_id: take.dataset.take });
          const b = document.createElement("div");
          b.className = "bravo";
          b.innerHTML = `<span>👍</span>Brava!`;
          document.body.appendChild(b);
          setTimeout(() => b.remove(), 2500);
          closeNotifications();
          await momRefresh();
        } catch (_) {
          take.disabled = false;
          toast("Non funziona. Riprova tra poco.");
        }
        return;
      }
      if (ev.target.closest("#enable")) {
        try { pushOn = await syncPush(true); } catch (_) { pushOn = false; }
        if (pushOn) toast("Avvisi attivati 👍");
        renderMom(true);
      }
    });
    momRefresh();
    setInterval(momRefresh, 30000);
    setInterval(() => momData && renderMom(), 5000);
  }

  // ================================================================= IVAN
  const KINDS = ["Compressa", "Capsula", "Gocce", "Sciroppo", "Bustina", "Puntura", "Pomata", "Spray", "Altro"];
  const DAYS = [[1, "Lun"], [2, "Mar"], [3, "Mer"], [4, "Gio"], [5, "Ven"], [6, "Sab"], [0, "Dom"]];
  let ov = null;       // dati dal server
  let editing = null;  // medicina in modifica

  const doseAt = (m, t) => (m.time_doses && m.time_doses[t]) || m.dose;
  const momLink = () => new URL("./?k=" + ov.mom_token, location.href).href;

  function renderAdmin() {
    if (editing) return renderForm();
    const now = new Date();
    const alertMs = ov.settings.alert_minutes * 60000;
    let h = `<div class="admin"><h1>💊 Medicine di ${esc(ov.settings.mom_name)}</h1>
      <p class="sub">Pannello di gestione</p>`;

    h += `<h2>Oggi</h2>`;
    if (!ov.today.length) h += `<p class="muted">Nessuna medicina prevista oggi.</p>`;
    for (const t of ov.today) {
      const due = new Date(t.due_at);
      let pill, btn = "";
      if (t.taken_at) {
        pill = `<span class="pill ok">✅ Presa alle ${fmtTime(t.taken_at)}</span>`;
        btn = `<button class="btn small" data-undo="${esc(t.dose_id)}">Annulla</button>`;
      } else if (due > now) {
        pill = `<span class="pill later">Più tardi</span>`;
      } else {
        pill = now - due >= alertMs
          ? `<span class="pill late">⚠️ Non confermata</span>`
          : `<span class="pill wait">⏰ In attesa</span>`;
        if (t.dose_id) btn = `<button class="btn small" data-mark="${esc(t.dose_id)}">Segna presa</button>`;
      }
      h += `<div class="box row"><div class="grow"><b>${esc(t.time)} · ${esc(t.name)}</b>
        <div class="muted">${esc(t.dose)}${t.kind ? " · " + esc(t.kind) : ""}</div>
        <div style="margin-top:6px">${pill}</div></div>${btn}</div>`;
    }

    if (ov.missed.length) {
      h += `<h2>Non confermate (ultimi 7 giorni)</h2>`;
      for (const m of ov.missed) {
        h += `<div class="box"><b>${esc(m.name)}</b>
          <div class="muted">${fmtDay(m.due_at)} ore ${fmtTime(m.due_at)} · ${esc(m.dose)}</div></div>`;
      }
    }

    h += `<h2>Medicine</h2>`;
    if (!ov.medicines.length) h += `<p class="muted">Ancora nessuna medicina. Aggiungi la prima.</p>`;
    for (const m of ov.medicines) {
      const img = safeImg(m.photo);
      const days = m.days.length === 7 ? "tutti i giorni"
        : DAYS.filter(([n]) => m.days.includes(n)).map(([, l]) => l).join(", ");
      const ended = m.end_date && m.end_date < todayRome();
      const endTxt = !m.end_date ? "" : ended
        ? `<div class="muted"><b>🏁 TERAPIA FINITA il ${fmtDate(m.end_date)}</b></div>`
        : `<div class="muted">🏁 Fino al ${fmtDate(m.end_date)}</div>`;
      h += `<div class="box row" ${m.active && !ended ? "" : 'style="opacity:.55"'}>
        ${img ? `<img class="thumb" src="${img}" alt="">` : ""}
        <div class="grow"><b>${esc(m.name)}</b>
        ${m.kind ? `<div class="muted">${esc(m.kind)}</div>` : ""}
        ${m.times.map((x) => `<div class="muted">🕒 ${esc(x)} → ${esc(doseAt(m, x))}</div>`).join("")}
        <div class="muted">${days}${m.active ? "" : " — IN PAUSA"}</div>${endTxt}</div>
        <button class="btn small" data-edit="${esc(m.id)}">Modifica</button></div>`;
    }
    h += `<button class="btn primary wide" id="add">＋ Aggiungi medicina</button>`;

    h += `<h2>Telefono della mamma</h2>
      <div class="status ${ov.mom_devices ? "good" : "bad"}">${ov.mom_devices
        ? "✅ Collegato: gli avvisi arrivano"
        : "❌ Non ancora collegato: apri il link sul suo telefono e attiva gli avvisi"}</div>
      <button class="btn wide" id="share">📤 Invia il link alla mamma</button>
      <button class="btn wide" id="test-mom" ${ov.mom_devices ? "" : "disabled"}>🔔 Manda un avviso di prova alla mamma</button>`;

    h += `<h2>Il mio telefono</h2>
      <div class="status ${pushOn ? "good" : "bad"}">${pushOn
        ? "✅ Ricevo le conferme e gli allarmi"
        : "❌ Notifiche non attive su questo telefono"}</div>
      ${pushOn
        ? `<button class="btn wide" id="test-me">🔔 Manda una prova a me</button>`
        : pushSupported
          ? `<button class="btn primary wide" id="enable">🔔 Attiva le notifiche qui</button>`
          : `<p class="muted">${isIOS && !isStandalone
              ? "iPhone: tocca Condividi → «Aggiungi a Home», poi apri l'app dalla Home e torna qui."
              : "Questo browser non supporta le notifiche."}</p>`}`;

    h += `<h2>Impostazioni</h2><div class="box">
      <label for="s-name">Come si chiama (nei messaggi)</label>
      <input type="text" id="s-name" maxlength="30" value="${esc(ov.settings.mom_name)}">
      <label for="s-rep">Ripeti l'avviso ogni (minuti)</label>
      <input type="number" id="s-rep" min="2" max="120" inputmode="numeric" value="${ov.settings.repeat_minutes}">
      <label for="s-alert">Avvisa me se non conferma dopo (minuti)</label>
      <input type="number" id="s-alert" min="5" max="600" inputmode="numeric" value="${ov.settings.alert_minutes}">
      <button class="btn primary wide" id="save-set">Salva impostazioni</button></div></div>`;
    $app.innerHTML = h;
  }

  function renderForm() {
    const m = editing;
    const img = safeImg(m.photo);
    $app.innerHTML = `<div class="admin"><h1>${m.id ? "Modifica medicina" : "Nuova medicina"}</h1>
      <label for="f-name">Nome della medicina</label>
      <input type="text" id="f-name" maxlength="80" placeholder="Es. Cardioaspirina" value="${esc(m.name)}">
      <label for="f-kind">Tipo</label>
      <select id="f-kind"><option value="">—</option>${KINDS.map((k) =>
        `<option ${k === m.kind ? "selected" : ""}>${k}</option>`).join("")}</select>
      <label>Orari e quantità (una riga per ogni volta che la prende nel giorno)</label>
      <div class="times">${m.slots.map((sl, i) => `<div class="row">
        <input type="time" data-time="${i}" value="${esc(sl.time)}" aria-label="Orario ${i + 1}">
        <input type="text" class="grow" data-dose="${i}" maxlength="80" placeholder="Es. 1 compressa" value="${esc(sl.dose)}" aria-label="Quantità ${i + 1}">
        ${m.slots.length > 1 ? `<button class="btn danger small" data-deltime="${i}" aria-label="Togli orario">✕</button>` : ""}
        </div>`).join("")}</div>
      <button class="btn small" id="addtime">＋ Aggiungi un altro orario</button>
      <label>Giorni</label>
      <div class="days">${DAYS.map(([n, l]) =>
        `<button type="button" data-day="${n}" class="${m.days.includes(n) ? "on" : ""}" aria-pressed="${m.days.includes(n)}">${l}</button>`).join("")}</div>
      <label for="f-end">Fine terapia (facoltativa)</label>
      <div class="row"><input type="date" id="f-end" class="grow" min="${todayRome()}" value="${esc(m.end_date || "")}">
        ${m.end_date ? `<button class="btn small" id="clearend">Senza fine</button>` : ""}</div>
      <div class="muted">L'ultimo giorno di avvisi è quello che scegli. Se la lasci vuota, continua sempre.</div>
      <label for="f-note">Nota per la mamma (facoltativa)</label>
      <input type="text" id="f-note" maxlength="200" placeholder="Es. Dopo mangiato, con acqua" value="${esc(m.note)}">
      <label for="f-photo">Foto della scatola (facoltativa)</label>
      ${img ? `<img class="preview" src="${img}" alt="Foto"><button class="btn danger small" id="delphoto">Togli foto</button>` : ""}
      <input type="file" id="f-photo" accept="image/*">
      <label class="row" style="font-weight:400"><input type="checkbox" id="f-active" ${m.active ? "checked" : ""} style="width:28px;height:28px">
        <span>Attiva (togli la spunta per metterla in pausa)</span></label>
      <button class="btn primary wide" id="save-med">Salva</button>
      <button class="btn wide" id="cancel">Indietro</button>
      ${m.id ? `<button class="btn danger wide" id="del-med">Elimina medicina</button>` : ""}</div>`;
    scrollTo(0, 0);
  }

  // legge i campi del modulo dentro "editing" (così non si perdono ai ridisegni)
  function readForm() {
    const v = (id) => document.getElementById(id)?.value.trim() ?? "";
    editing.name = v("f-name");
    editing.kind = v("f-kind");
    editing.note = v("f-note");
    editing.end_date = v("f-end") || null;
    editing.active = document.getElementById("f-active").checked;
    editing.slots = [...document.querySelectorAll("[data-time]")].map((el, i) => ({
      time: el.value,
      dose: document.querySelector(`[data-dose="${i}"]`).value.trim(),
    }));
  }

  function shrinkPhoto(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 640 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        res(c.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }

  async function adminRefresh() {
    try {
      const data = await api("overview");
      ov = data;
      if (!editing && !$app.contains(document.activeElement?.closest?.("input,select"))) renderAdmin();
    } catch (e) {
      if (e.status === 401) badLink();
    }
  }

  async function act(fn, okMsg) {
    try {
      const r = await fn();
      if (r?.error) return toast(r.error);
      if (okMsg) toast(typeof okMsg === "function" ? okMsg(r) : okMsg);
      ov = await api("overview");
      renderAdmin();
    } catch (e) {
      toast(e.message === "Errore" ? "Non funziona. Riprova." : e.message);
    }
  }

  function startAdmin() {
    $app.addEventListener("change", async (ev) => {
      if (ev.target.id === "f-photo" && ev.target.files[0]) {
        readForm();
        try { editing.photo = await shrinkPhoto(ev.target.files[0]); editing.photoChanged = true; }
        catch (_) { toast("Foto non leggibile"); }
        renderForm();
      }
    });
    $app.addEventListener("click", async (ev) => {
      const t = ev.target.closest("button");
      if (!t) return;
      const d = t.dataset;

      if (d.mark) return act(() => api("confirm", { dose_id: d.mark }), "Segnata come presa");
      if (d.undo) return act(() => api("unconfirm", { dose_id: d.undo }), "Conferma annullata");
      if (d.edit) {
        const m = ov.medicines.find((x) => x.id === d.edit);
        editing = { ...m, days: [...m.days], slots: m.times.map((x) => ({ time: x, dose: doseAt(m, x) })) };
        return renderForm();
      }
      if (t.id === "add") {
        editing = { name: "", kind: "", note: "", photo: null, end_date: null, slots: [{ time: "08:00", dose: "" }], days: [0, 1, 2, 3, 4, 5, 6], active: true };
        return renderForm();
      }
      if (t.id === "share") {
        const url = momLink();
        if (navigator.share) return navigator.share({ title: "PillolAPP", url }).catch(() => {});
        try { await navigator.clipboard.writeText(url); toast("Link copiato"); }
        catch (_) { prompt("Copia questo link:", url); }
        return;
      }
      if (t.id === "test-mom") return act(() => api("test_push", { to: "mom" }), (r) => r.sent ? "Avviso di prova inviato" : "Nessun telefono collegato");
      if (t.id === "test-me") return act(() => api("test_push", { to: "admin" }), "Prova inviata");
      if (t.id === "enable") {
        try { pushOn = await syncPush(true); } catch (_) { pushOn = false; }
        toast(pushOn ? "Notifiche attivate 👍" : "Notifiche non attivate");
        return adminRefresh();
      }
      if (t.id === "save-set") {
        const settings = {
          mom_name: document.getElementById("s-name").value,
          repeat_minutes: Number(document.getElementById("s-rep").value),
          alert_minutes: Number(document.getElementById("s-alert").value),
        };
        document.activeElement?.blur();
        return act(() => api("save_settings", { settings }), "Impostazioni salvate");
      }

      // --- modulo medicina ---
      if (!editing) return;
      if (d.day !== undefined) {
        readForm();
        const n = Number(d.day);
        editing.days = editing.days.includes(n) ? editing.days.filter((x) => x !== n) : [...editing.days, n];
        return renderForm();
      }
      if (d.deltime !== undefined) { readForm(); editing.slots.splice(Number(d.deltime), 1); return renderForm(); }
      if (t.id === "addtime") { readForm(); editing.slots.push({ time: "", dose: editing.slots[editing.slots.length - 1].dose }); return renderForm(); }
      if (t.id === "clearend") { readForm(); editing.end_date = null; return renderForm(); }
      if (t.id === "delphoto") { readForm(); editing.photo = null; editing.photoChanged = true; return renderForm(); }
      if (t.id === "cancel") { editing = null; return renderAdmin(); }
      if (t.id === "del-med") {
        if (!confirm(`Eliminare «${editing.name}»? Si cancella anche il suo storico.`)) return;
        const id = editing.id;
        editing = null;
        return act(() => api("delete_med", { id }), "Medicina eliminata");
      }
      if (t.id === "save-med") {
        readForm();
        const m = editing;
        const times = m.slots.map((x) => x.time);
        if (!m.name) return toast("Scrivi il nome della medicina");
        if (!times.length || times.some((x) => !x)) return toast("Controlla gli orari");
        if (m.slots.some((x) => !x.dose)) return toast("Scrivi la quantità per ogni orario");
        if (!m.days.length) return toast("Scegli almeno un giorno");
        if (new Set(times).size !== times.length) return toast("Ci sono due orari uguali");
        const time_doses = Object.fromEntries(m.slots.map((x) => [x.time, x.dose]));
        const med = { id: m.id, name: m.name, dose: m.slots[0].dose, time_doses, kind: m.kind, note: m.note, times, days: m.days, active: m.active, end_date: m.end_date || null };
        if (m.photoChanged) med.photo = m.photo;
        t.disabled = true;
        try {
          const r = await api("save_med", { med });
          if (r.error) { t.disabled = false; return toast(r.error); }
          editing = null;
          toast("Salvata");
          ov = await api("overview");
          renderAdmin();
        } catch (_) { t.disabled = false; toast("Non funziona. Riprova."); }
      }
    });
    adminRefresh();
    setInterval(adminRefresh, 30000);
  }

  // ================================================================ avvio
  function badLink() {
    $app.innerHTML = `<p class="big-msg">Il link non è giusto.<br>Chiedi a Ivan.</p>`;
  }

  async function start() {
    if (!API) return ($app.innerHTML = `<p class="big-msg">App non ancora collegata.</p>`);
    if (!K) return badLink();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
      // pulizia: spegne gli avvisi rimasti legati a QUALSIASI indirizzo diverso da quello attuale
      // (vecchi nomi /MAMMAMED/ e /pillolapp/: maiuscole e minuscole contano), così non arrivano notifiche doppie
      const here = new URL("./", location.href).href;
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach(async (r) => {
        if (r.scope === here) return;
        try { await (await r.pushManager.getSubscription())?.unsubscribe(); } catch (_) {}
        r.unregister();
      })).catch(() => {});
    }

    let hello;
    try {
      hello = await api("hello");
    } catch (e) {
      if (e.status === 401) return badLink();
      $app.innerHTML = `<p class="big-msg">Manca la connessione.<br>Riprovo da solo…</p>`;
      return setTimeout(start, 5000);
    }
    VAPID = hello.vapid;
    try { pushOn = await syncPush(false); } catch (_) { pushOn = false; }

    navigator.serviceWorker?.addEventListener("message", (e) => {
      if (e.data?.type === "refresh") hello.role === "admin" ? adminRefresh() : momRefresh();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") hello.role === "admin" ? adminRefresh() : momRefresh();
    });

    hello.role === "admin" ? startAdmin() : startMom();
  }
  start();
})();
