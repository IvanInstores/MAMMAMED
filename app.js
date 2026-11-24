/* PillolAPP - app unica: la mamma vede gli avvisi, Ivan gestisce le medicine */
(() => {
  const API = window.MAMMAMED_API;
  // versione dell'app: a ogni pubblicazione va cambiata QUI e in version.json (stesso valore)
  const VERSION = "2026-11-24.2";
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

  // ---------------------------------------------------------------- icone
  // Icone Lucide (lucide.dev, licenza ISC), copiate qui come SVG: nessuno strumento da installare.
  // Sono uguali su tutti i telefoni, a differenza delle emoji.
  // class="f" = parte piena (colore del testo), class="w" = tratti bianchi sopra la parte piena.
  const ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path class="f" d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><g class="w"><path d="M12 9v4"/><path d="M12 17h.01"/></g>',
    smile: '<circle class="f" cx="12" cy="12" r="10"/><g class="w"><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/></g>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    alarm: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/>',
    minus: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
    bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M22 8c0-2.3-.8-4.3-2-6"/><path class="f" d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/><path d="M4 2C2.8 3.7 2 5.7 2 8"/>',
  };
  const ico = (name) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  // ================================================================ MAMMA
  let momLast = "";
  let momData = null;
  let lastBeep = 0;
  let momOffline = false; // true quando l'ultimo aggiornamento non è riuscito

  function momAlertBlock() {
    if (pushOn) return "";
    if (!pushSupported) {
      return isIOS && !isStandalone
        ? `<div class="hint"><b>Per ricevere gli avvisi:</b><br>1. Tocca il tasto <b>Condividi</b> in basso<br>2. Scegli <b>«Aggiungi a Home»</b><br>3. Apri l'app <b>PillolAPP</b> dalla schermata Home</div>`
        : `<div class="hint">Su questo telefono gli avvisi non funzionano.<br><b>Chiama Ivan.</b></div>`;
    }
    if (Notification.permission === "denied") {
      return `<div class="hint">Gli avvisi sono spenti.<br><b>Chiama Ivan.</b></div>`;
    }
    return `<button class="btn-alert" id="enable">${ico("bell")} TOCCA QUI PER ATTIVARE GLI AVVISI</button>`;
  }

  function renderMom(force) {
    const d = momData;
    const now = new Date();
    if (!d) {
      if (momOffline) $app.innerHTML = `<p class="big-msg">Manca la connessione.<br>Riprovo da solo…</p>`;
      return;
    }
    const clock = now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    const date = now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
    let h = "";
    if (momOffline) {
      h += `<div class="offline" role="alert"><div class="t">${ico("alert")} Manca la connessione</div>
        Non so dirti se è ora di una medicina.<br><b>Chiama Ivan.</b></div>`;
    }
    h += momAlertBlock();

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
          <button class="btn-take" data-take="${esc(p.id)}">${ico("check")}<span>L'HO PRESA</span></button>
        </section>`;
      }
    } else if (!momOffline) {
      const next = d.today.find((t) => !t.taken_at && new Date(t.due_at) > now);
      h += `<div class="calm"><div class="face">${ico("smile")}</div><div class="t">Adesso non devi prendere niente</div>
        ${next
          ? `<div class="next">La prossima medicina è alle<b>ore ${esc(next.time)}</b><span class="nextname">${esc(next.name)}</span></div>`
          : `<div class="next">${d.today.every((t) => t.taken_at) ? "Per oggi hai finito. Brava!" : "Per oggi non c'è altro."}</div>`}</div>`;
    }

    // Elenco di oggi. Regola: arancione "Da prendere" SOLO se in alto c'è la scheda con il tasto verde.
    //  - dose passata e mai avvisata (medicina aggiunta o modificata dopo quell'orario): non si mostra
    //  - dose passata e non più in attesa (scaduta): grigia "Non segnata" (l'app non sa se l'ha presa)
    const waiting = new Set(d.pending.map((p) => p.id));
    const rows = [];
    for (const t of d.today) {
      const late = now - new Date(t.due_at);
      if (t.taken_at) rows.push([t, "done", "check", "Presa"]);
      else if (late < 0) rows.push([t, "later", "clock", "Più tardi"]);
      else if (waiting.has(t.dose_id)) rows.push([t, "todo", "alarm", "Da prendere"]);
      else if (t.dose_id) rows.push([t, "missed", "minus", "Non segnata"]);
      else if (late < 120000) rows.push([t, "later", "clock", "Più tardi"]); // il server la sta per creare
    }
    if (rows.length) {
      h += `<h2>Le medicine di oggi</h2><ul class="daylist">`;
      for (const [t, ...st] of rows) {
        h += `<li class="${st[0]}"><span class="h">${esc(t.time)}</span>
          <span class="what">${esc(t.name)}<small>${esc(t.dose)}</small></span>
          <span class="st">${ico(st[1])} ${st[2]}</span></li>`;
      }
      h += `</ul>`;
    }

    // Niente sfarfallio: la schermata non viene ridisegnata tutta ogni minuto.
    // L'ora si aggiorna da sola; il resto (foto compresa) si ridisegna solo se cambia davvero.
    let root = $app.querySelector(".mom");
    if (!root) {
      $app.innerHTML = `<div class="mom"><div class="top"><div class="clock"></div><div class="date"></div></div><div class="body"></div></div>`;
      root = $app.querySelector(".mom");
      momLast = "";
    }
    root.classList.toggle("busy", d.pending.length > 0);
    const setText = (q, v) => { const e = root.querySelector(q); if (e.textContent !== v) e.textContent = v; };
    setText(".clock", clock);
    setText(".date", date);
    if (h === momLast) return;
    momLast = h;
    root.querySelector(".body").innerHTML = h;
    fitCard();
    root.querySelector(".card img")?.addEventListener("load", fitCard);
  }

  // La prima scheda deve stare tutta nello schermo, tasto verde compreso, senza scorrere:
  // se non ci sta rimpicciolisce prima la foto, poi le scritte. Niente finisce sotto il tasto.
  function fitCard() {
    const card = $app.querySelector(".card");
    if (!card) return;
    const img = card.querySelector("img");
    card.classList.remove("tight");
    if (img) img.style.maxHeight = "";
    const over = () => Math.ceil(card.getBoundingClientRect().bottom + scrollY + 6 - innerHeight);
    const shrink = (min) => {
      const o = over();
      if (o > 0 && img) img.style.maxHeight = Math.max(min, Math.floor(img.getBoundingClientRect().height - o)) + "px";
    };
    shrink(110);
    if (over() <= 0) return;
    card.classList.add("tight");
    if (img) img.style.maxHeight = "";
    shrink(64);
  }

  async function momRefresh() {
    try {
      momData = await api("state");
      momOffline = false;
      renderMom();
      if (updateWaiting && !momData.pending.length) checkVersion();
      if (momData.pending.length && Date.now() - lastBeep > 25000 && document.visibilityState === "visible") {
        lastBeep = Date.now();
        beep();
      }
    } catch (e) {
      if (e.status === 401) return badLink();
      // senza rete: lo dice chiaramente (la schermata potrebbe essere vecchia) e riprova da solo
      momOffline = true;
      renderMom();
    }
  }

  // errore a tutto schermo: resta finché non tocca il tasto
  function momOops(doseId) {
    document.querySelector(".oops")?.remove();
    const o = document.createElement("div");
    o.className = "oops";
    o.setAttribute("role", "alertdialog");
    o.innerHTML = `<div class="t">${ico("alert")} Non è stata segnata</div>
      <p>Tocca di nuovo il tasto verde.</p><p>Se non funziona, <b>chiama Ivan.</b></p>
      <button class="btn-oops">HO CAPITO</button>`;
    o.querySelector("button").addEventListener("click", () => {
      o.remove();
      // torna sul tasto verde di quella medicina, pronto per riprovare
      const again = [...$app.querySelectorAll("[data-take]")].find((x) => x.dataset.take === doseId);
      if (again) { again.disabled = false; again.scrollIntoView({ block: "end" }); }
      else scrollTo(0, 0);
    });
    document.body.appendChild(o);
  }

  function startMom() {
    addEventListener("online", momRefresh);
    addEventListener("resize", fitCard);
    $app.addEventListener("click", async (ev) => {
      const take = ev.target.closest("[data-take]");
      if (take) {
        take.disabled = true;
        try {
          await api("confirm", { dose_id: take.dataset.take });
          const b = document.createElement("div");
          b.className = "bravo";
          b.innerHTML = `<div class="disc">${ico("check")}</div>Brava!`;
          document.body.appendChild(b);
          setTimeout(() => b.remove(), 2500);
          closeNotifications();
          await momRefresh();
        } catch (_) {
          take.disabled = false;
          momOops(take.dataset.take);
        }
        return;
      }
      if (ev.target.closest("#enable")) {
        try { pushOn = await syncPush(true); } catch (_) { pushOn = false; }
        if (pushOn) toast("Avvisi attivati");
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

  // Aggiornamento automatico: l'app installata può restare aperta per giorni e non ricaricarsi mai.
  // Controlla version.json (mai dalla copia salvata) e, se è uscita una versione nuova, si ricarica da sola.
  let updateWaiting = false; // c'è una versione nuova, ma si aspetta che la schermata sia tranquilla
  async function checkVersion() {
    try {
      const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      const v = (await r.json()).v;
      if (!v || v === VERSION) return;
      // non interrompe chi sta facendo qualcosa: mai con una medicina da prendere sullo schermo
      updateWaiting = true;
      if (editing || momData?.pending?.length || document.querySelector(".oops, .bravo")) return;
      // un solo tentativo ogni 11 minuti per versione: il telefono può tenere i file vecchi per 10 minuti
      let last = {};
      try { last = JSON.parse(sessionStorage.getItem("pillolapp_upd") || "{}"); } catch (_) {}
      if (last.v === v && Date.now() - last.t < 11 * 60000) return;
      sessionStorage.setItem("pillolapp_upd", JSON.stringify({ v, t: Date.now() }));
      location.reload();
    } catch (_) {}
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
      if (document.visibilityState === "visible") { hello.role === "admin" ? adminRefresh() : momRefresh(); checkVersion(); }
    });
    checkVersion();
    setInterval(checkVersion, 30 * 60000);

    hello.role === "admin" ? startAdmin() : startMom();
  }
  start();
})();
