// MAMMAMED - unica funzione: gestisce app della mamma, pannello di Ivan e invio avvisi
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

type Cfg = Record<string, string>;

async function getCfg(): Promise<Cfg> {
  const { data, error } = await db.from("config").select("key,value");
  if (error) throw error;
  const cfg: Cfg = {};
  for (const r of data!) cfg[r.key] = r.value;
  if (!cfg.vapid_public) {
    const keys = webpush.generateVAPIDKeys();
    await db.from("config").upsert(
      [
        { key: "vapid_public", value: keys.publicKey },
        { key: "vapid_private", value: keys.privateKey },
      ],
      { onConflict: "key", ignoreDuplicates: true },
    );
    return getCfg();
  }
  return cfg;
}

async function push(cfg: Cfg, role: "mom" | "admin", payload: Record<string, unknown>) {
  webpush.setVapidDetails("mailto:noreply@mammamed.app", cfg.vapid_public, cfg.vapid_private);
  const { data: subs } = await db.from("push_subs").select("*").eq("role", role);
  const k = role === "mom" ? cfg.mom_token : cfg.admin_token;
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ ...payload, k }),
        { TTL: 3600, urgency: "high" },
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await db.from("push_subs").delete().eq("endpoint", s.endpoint);
      } else console.error("push error", code, (e as Error).message);
    }
  }
  return sent;
}

const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));

const describe = (d: { name: string; dose: string; kind: string }) =>
  `${d.name} — ${d.dose}${d.kind ? " (" + d.kind + ")" : ""}`;

const PENDING_HOURS = 12;
const MAX_REMINDERS = 12;

async function pendingDoses() {
  const since = new Date(Date.now() - PENDING_HOURS * 3600_000).toISOString();
  const { data, error } = await db.from("doses").select("*")
    .is("taken_at", null).gte("due_at", since).lte("due_at", new Date().toISOString())
    .order("due_at");
  if (error) throw error;
  return data!;
}

async function tick() {
  const { error } = await db.rpc("generate_doses");
  if (error) throw error;
  const cfg = await getCfg();
  const repeatMs = Math.max(2, Number(cfg.repeat_minutes) || 10) * 60_000;
  const alertMs = Math.max(5, Number(cfg.alert_minutes) || 30) * 60_000;
  const now = Date.now();
  let notified = 0;
  for (const d of await pendingDoses()) {
    const last = d.last_notified_at ? new Date(d.last_notified_at).getTime() : 0;
    if (d.notify_count < MAX_REMINDERS && now - last >= repeatMs - 20_000) {
      // aggiornamento "a prova di doppione": invia solo chi riesce a prenotare l'avviso
      const { data: upd } = await db.from("doses")
        .update({ notify_count: d.notify_count + 1, last_notified_at: new Date().toISOString() })
        .eq("id", d.id).eq("notify_count", d.notify_count).is("taken_at", null).select("id");
      if (upd?.length) {
        notified++;
        await push(cfg, "mom", {
          title: "💊 È ora della medicina",
          body: describe(d),
          tag: "dose-" + d.id,
          doseId: d.id,
        });
      }
    }
    if (!d.admin_alerted_at && now - new Date(d.due_at).getTime() >= alertMs) {
      const { data: upd } = await db.from("doses")
        .update({ admin_alerted_at: new Date().toISOString() })
        .eq("id", d.id).is("admin_alerted_at", null).is("taken_at", null).select("id");
      if (upd?.length) {
        await push(cfg, "admin", {
          title: `⚠️ ${cfg.mom_name} non ha confermato`,
          body: `${describe(d)} delle ${hhmm(d.due_at)}`,
          tag: "late-" + d.id,
        });
      }
    }
  }
  return { ok: true, notified };
}

async function momState(cfg: Cfg) {
  const pend = await pendingDoses();
  const ids = [...new Set(pend.map((d) => d.medicine_id))];
  const photos: Record<string, string | null> = {};
  if (ids.length) {
    const { data } = await db.from("medicines").select("id,photo").in("id", ids);
    for (const m of data ?? []) photos[m.id] = m.photo;
  }
  const { data: today, error } = await db.rpc("today_schedule");
  if (error) throw error;
  return {
    name: cfg.mom_name,
    pending: pend.map((d) => ({
      id: d.id, name: d.name, dose: d.dose, kind: d.kind, note: d.note,
      due_at: d.due_at, photo: photos[d.medicine_id] ?? null,
    })),
    today,
  };
}

async function confirmDose(cfg: Cfg, id: string, who: "mom" | "admin") {
  const { data: upd, error } = await db.from("doses")
    .update({ taken_at: new Date().toISOString(), taken_by: who })
    .eq("id", id).is("taken_at", null).select("*");
  if (error) throw error;
  if (upd?.length && who === "mom") {
    const d = upd[0];
    await push(cfg, "admin", {
      title: `✅ ${cfg.mom_name} ha preso la medicina`,
      body: `${describe(d)} delle ${hhmm(d.due_at)}`,
      tag: "ok-" + d.id,
    });
  }
  return { ok: true };
}

async function overview(cfg: Cfg) {
  const [{ data: today, error: e1 }, { data: medicines, error: e2 }, { data: subs }, { data: missed }] =
    await Promise.all([
      db.rpc("today_schedule"),
      db.from("medicines").select("*").order("name"),
      db.from("push_subs").select("role"),
      db.from("doses").select("id,name,dose,kind,due_at").is("taken_at", null)
        .gte("due_at", new Date(Date.now() - 7 * 86400_000).toISOString())
        .lte("due_at", new Date(Date.now() - PENDING_HOURS * 3600_000).toISOString())
        .order("due_at", { ascending: false }),
    ]);
  if (e1 || e2) throw e1 || e2;
  return {
    today, medicines, missed: missed ?? [],
    settings: {
      mom_name: cfg.mom_name,
      repeat_minutes: Number(cfg.repeat_minutes),
      alert_minutes: Number(cfg.alert_minutes),
    },
    mom_token: cfg.mom_token,
    mom_devices: (subs ?? []).filter((s) => s.role === "mom").length,
    admin_devices: (subs ?? []).filter((s) => s.role === "admin").length,
  };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

async function saveMed(m: Record<string, unknown>) {
  const times = [...new Set((Array.isArray(m.times) ? m.times : []).map(String))]
    .filter((t) => TIME_RE.test(t)).sort();
  const days = [...new Set((Array.isArray(m.days) ? m.days : []).map(Number))]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const row: Record<string, unknown> = {
    name: str(m.name, 80), dose: str(m.dose, 80), kind: str(m.kind, 40), note: str(m.note, 200),
    times, days, active: m.active !== false, updated_at: new Date().toISOString(),
  };
  if (!row.name || !row.dose || !times.length || !days.length) {
    return { error: "Mancano dei dati: nome, quantità, orario e giorni." };
  }
  if (m.photo !== undefined) {
    const p = m.photo === null ? null : String(m.photo);
    if (p && (!p.startsWith("data:image/") || p.length > 400_000)) return { error: "Foto non valida." };
    row.photo = p;
  }
  const q = m.id
    ? db.from("medicines").update(row).eq("id", String(m.id))
    : db.from("medicines").insert(row);
  const { error } = await q;
  if (error) throw error;
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Metodo non valido" }, 405);
  try {
    const b = await req.json();
    const action = String(b.action ?? "");
    if (action === "tick") return json(await tick());

    const cfg = await getCfg();
    const role = b.k && b.k === cfg.admin_token ? "admin" : b.k && b.k === cfg.mom_token ? "mom" : null;
    if (!role) return json({ error: "Link non valido" }, 401);

    if (action === "hello") {
      return json({ role, name: cfg.mom_name, vapid: cfg.vapid_public });
    }
    if (action === "subscribe") {
      const s = b.sub;
      if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth || !String(s.endpoint).startsWith("https://")) {
        return json({ error: "Dati non validi" }, 400);
      }
      const { error } = await db.from("push_subs").upsert({
        endpoint: s.endpoint, role, p256dh: s.keys.p256dh, auth: s.keys.auth,
      });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "state") return json(await momState(cfg));
    if (action === "confirm") return json(await confirmDose(cfg, String(b.dose_id), role));

    if (role !== "admin") return json({ error: "Non permesso" }, 403);

    if (action === "overview") return json(await overview(cfg));
    if (action === "save_med") return json(await saveMed(b.med ?? {}));
    if (action === "delete_med") {
      const { error } = await db.from("medicines").delete().eq("id", String(b.id));
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "unconfirm") {
      const { error } = await db.from("doses").update({ taken_at: null, taken_by: null })
        .eq("id", String(b.dose_id));
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "save_settings") {
      const s = b.settings ?? {};
      const rows = [
        { key: "mom_name", value: str(s.mom_name, 30) || "Mamma" },
        { key: "repeat_minutes", value: String(Math.min(120, Math.max(2, Number(s.repeat_minutes) || 10))) },
        { key: "alert_minutes", value: String(Math.min(600, Math.max(5, Number(s.alert_minutes) || 30))) },
      ];
      const { error } = await db.from("config").upsert(rows);
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "test_push") {
      const sent = await push(cfg, b.to === "admin" ? "admin" : "mom", {
        title: "🔔 Prova avviso",
        body: "Funziona! Gli avvisi delle medicine arrivano così.",
        tag: "test",
      });
      return json({ ok: true, sent });
    }
    return json({ error: "Azione sconosciuta" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Errore del server" }, 500);
  }
});
