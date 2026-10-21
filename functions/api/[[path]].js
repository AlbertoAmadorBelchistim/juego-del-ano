// API de la web: colecciones por usuario y correcciones de edición física.
// Identidad: Cloudflare Access pone delante de la web un login por correo y firma un JWT
// (cabecera Cf-Access-Jwt-Assertion). Aquí se verifica la firma, el emisor y la audiencia.
// Variables de entorno (Pages > Settings > Variables):
//   ACCESS_TEAM_DOMAIN  p. ej. "miequipo.cloudflareaccess.com"
//   ACCESS_AUD          el "Application Audience (AUD) Tag" de la aplicación de Access
//   DEV_EMAIL           solo para pruebas en local con `wrangler pages dev` (sin Access)
//   INGESTA_TOKEN       secreto compartido con la app Hogar (mismo valor que en su Worker)
// Binding HOGAR (wrangler.toml): service binding al Worker «hogar».

const GAME_ID = /^\d{4}-[a-z0-9-]{1,90}$/;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/* ---------- verificación del JWT de Access ---------- */
let certCache = { at: 0, keys: null };
async function accessKeys(team) {
  if (certCache.keys && Date.now() - certCache.at < 3600_000) return certCache.keys;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error("certs " + r.status);
  const { keys } = await r.json();
  certCache = { at: Date.now(), keys };
  return keys;
}
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));

async function verifyAccess(request, env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion")
    || (request.headers.get("Cookie") || "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  if (!token) return null;
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) return null;
  const header = JSON.parse(new TextDecoder().decode(b64u(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64u(p)));
  const jwk = (await accessKeys(env.ACCESS_TEAM_DOMAIN)).find(k => k.kid === header.kid);
  if (!jwk || header.alg !== "RS256") return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return null;
  const now = Date.now() / 1000;
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.exp && payload.exp < now) return null;
  if (payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return null;
  if (!aud.includes(env.ACCESS_AUD)) return null;
  return typeof payload.email === "string" ? payload.email.toLowerCase() : null;
}

async function currentUser(request, env) {
  let email = null;
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) email = await verifyAccess(request, env);
  else if (env.DEV_EMAIL) email = env.DEV_EMAIL.toLowerCase();
  if (!email) return null;
  const q = "SELECT u.id, u.email, u.name, u.shared, u.persona, u.hogar_id, h.nombre AS hogar_nombre, h.binding FROM users u LEFT JOIN hogares h ON h.id = u.hogar_id WHERE u.email = ?";
  let u = await env.DB.prepare(q).bind(email).first();
  if (!u) {
    const name = email.split("@")[0].slice(0, 40);
    await env.DB.prepare("INSERT OR IGNORE INTO users (email, name) VALUES (?, ?)").bind(email, name).run();
    u = await env.DB.prepare(q).bind(email).first();
  }
  return { id: u.id, email: u.email, name: u.name, shared: !!u.shared, persona: u.persona, hogarId: u.hogar_id, hogarNombre: u.hogar_nombre, binding: u.binding };
}
const publicMe = me => ({ id: me.id, name: me.name, shared: me.shared, hogar: me.hogarId ? { id: me.hogarId, nombre: me.hogarNombre } : null });

async function marksOf(env, userId) {
  const { results } = await env.DB.prepare("SELECT game_id, estado, terminado, completo, progreso FROM marks WHERE user_id = ?").bind(userId).all();
  const out = {};
  for (const r of results) out[r.game_id] = { estado: r.estado, terminado: !!r.terminado, completo: !!r.completo, progreso: r.progreso || null };
  return out;
}

/* ---------- integración con la app Hogar (service binding + token) ---------- */
// Hogar manda en qué juegos hay en casa (del hogar, no de cada persona).
// La web manda en Terminado / 100 % / Quiero de cada persona y en las listas de premios y rankings.
const hogarOn = (env, binding) => !!(binding && env[binding] && env.INGESTA_TOKEN);
async function hogarCall(env, binding, path, method = "GET", body) {
  const r = await env[binding].fetch(new Request("https://hogar" + path, {
    method, headers: { "X-Ingesta-Token": env.INGESTA_TOKEN, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }));
  if (!r.ok) { const t = await r.text().catch(() => ""); throw new Error(`hogar ${method} ${path} → ${r.status} ${t.slice(0, 300)}`); }
  return r.json();
}
async function kvGet(env, k) { const r = await env.DB.prepare("SELECT v FROM kv WHERE k = ?").bind(k).first(); return r ? JSON.parse(r.v) : null; }
async function kvSet(env, k, v) { await env.DB.prepare("INSERT INTO kv (k, v, updated) VALUES (?, ?, datetime('now')) ON CONFLICT (k) DO UPDATE SET v = excluded.v, updated = excluded.updated").bind(k, JSON.stringify(v)).run(); }

async function hogarData(env, request) {          // listas, notas y títulos (public/data/hogar.json)
  const r = await env.ASSETS.fetch(new Request(new URL("/data/hogar.json", request.url)));
  return r.json();
}
function titles(data) {                             // id -> {titulo, slug}
  const m = {};
  for (const x of [...data.notas, ...data.listas.flatMap(l => l.juegos)]) m[x.id] = { titulo: x.titulo, slug: x.slug };
  return m;
}
const strip = ({ id, ...rest }) => rest;

// Progreso y «Quiero» de una persona: se manda entero (reemplazar) cada vez que cambia.
async function pushPersona(env, request, user) {
  if (!hogarOn(env, user.binding) || !user.persona) return;
  const data = await hogarData(env, request), T = titles(data), marks = await marksOf(env, user.id);
  const known = Object.entries(marks).filter(([id]) => T[id]);
  const prog = await hogarCall(env, user.binding, "/ingesta/juegos-progreso", "POST", {
    usuario: user.email, reemplazar: true,
    juegos: known.filter(([, m]) => m.terminado || m.completo).map(([id, m]) => ({ ...T[id], terminado: !!m.terminado, completo: !!m.completo })),
  });
  const quiero = await hogarCall(env, user.binding, "/ingesta/juegos-listas", "POST", {
    lista: "Quiero " + user.persona, reemplazar: true,
    juegos: known.filter(([, m]) => m.estado === "quiero").map(([id]) => ({ ...T[id], posicion: true })),
  });
  await kvSet(env, "hogar_persona_" + user.id, { fecha: new Date().toISOString(), progreso: prog, quiero });
}

// Listas comunes y notas: se mandan cuando cambia la versión de hogar.json (tras cada actualización semanal).
async function pushListas(env, request, binding, force = false) {
  if (!hogarOn(env, binding)) return null;
  const data = await hogarData(env, request), key = "hogar_listas_" + binding;
  const prev = await kvGet(env, key);
  if (!force && prev && prev.version === data.version) return prev;
  const res = { version: data.version, fecha: new Date().toISOString(), listas: {}, sin_pareja: [] };
  for (const l of data.listas) {
    const r = await hogarCall(env, binding, "/ingesta/juegos-listas", "POST", { lista: l.lista, reemplazar: true, juegos: l.juegos.map(strip) });
    res.listas[l.lista] = r.actualizados ?? r.etiquetados ?? null;
    for (const t of r.sin_pareja || []) if (!res.sin_pareja.includes(t)) res.sin_pareja.push(t);
  }
  const n = await hogarCall(env, binding, "/ingesta/juegos-notas", "POST", { juegos: data.notas.map(strip) });
  res.notas = n.actualizados ?? null;
  await kvSet(env, key, res);
  return res;
}

async function hogarJuegos(env, binding) {
  if (!hogarOn(env, binding)) return null;
  try { return await hogarCall(env, binding, "/ingesta/juegos"); } catch (e) { return { error: String(e.message || e) }; }
}

/* ---------- rutas ---------- */
export async function onRequest({ request, env, params, waitUntil }) {
  try {
    const me = await currentUser(request, env);
    if (!me) return json({ error: "no autenticado" }, 401);
    const path = (params.path || []).map(decodeURIComponent);
    const [head, arg] = path;
    const method = request.method;
    const bg = (p) => waitUntil(p.catch(e => kvSet(env, "hogar_error", { fecha: new Date().toISOString(), error: String(e.message || e) })));

    if (head === "state" && method === "GET") {
      const users = (await env.DB.prepare(
        "SELECT u.id, u.name, u.hogar_id AS hogar, COUNT(m.game_id) AS n FROM users u LEFT JOIN marks m ON m.user_id = u.id WHERE u.shared = 1 OR u.id = ? GROUP BY u.id ORDER BY u.name COLLATE NOCASE"
      ).bind(me.id).all()).results;
      const fis = (await env.DB.prepare("SELECT game_id, v FROM fisica").all()).results;
      let hogar = null;
      if (me.hogarId) {
        hogar = { nombre: me.hogarNombre, conectado: hogarOn(env, me.binding), juegos: await hogarJuegos(env, me.binding) };
        if (hogar.conectado) {
          bg(pushListas(env, request, me.binding));
          if (!(await kvGet(env, "hogar_persona_" + me.id))) bg(pushPersona(env, request, me));
          hogar.sync = await kvGet(env, "hogar_listas_" + me.binding);
        }
      }
      return json({ me: publicMe(me), users, marks: await marksOf(env, me.id), fisica: Object.fromEntries(fis.map(r => [r.game_id, r.v])), hogar });
    }

    if (head === "marks" && method === "GET") {
      const uid = Number(new URL(request.url).searchParams.get("u"));
      if (!Number.isInteger(uid)) return json({ error: "u" }, 400);
      const other = await env.DB.prepare("SELECT u.shared, u.hogar_id, h.binding FROM users u LEFT JOIN hogares h ON h.id = u.hogar_id WHERE u.id = ?").bind(uid).first();
      if (!other) return json({ error: "no existe" }, 404);
      if (uid !== me.id && !other.shared) return json({ error: "colección privada" }, 403);
      const juegos = other.hogar_id ? await hogarJuegos(env, other.binding) : null;
      return json({ marks: await marksOf(env, uid), hogar: other.hogar_id ? { id: other.hogar_id, juegos } : null });
    }

    if (head === "marks" && method === "PUT") {
      if (!GAME_ID.test(arg || "")) return json({ error: "id" }, 400);
      const b = await request.json();
      let estado = b.estado === "tengo" || b.estado === "quiero" ? b.estado : null;
      if (me.hogarId && estado === "tengo") estado = null;   // con hogar, «tengo» lo decide Hogar
      const completo = !!b.completo, terminado = !!b.terminado || completo;
      const progreso = !terminado && (b.progreso === "jugando" || b.progreso === "abandonado") ? b.progreso : null;
      if (!estado && !terminado && !progreso) {
        await env.DB.prepare("DELETE FROM marks WHERE user_id = ? AND game_id = ?").bind(me.id, arg).run();
      } else {
        await env.DB.prepare(
          `INSERT INTO marks (user_id, game_id, estado, terminado, completo, progreso, updated) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT (user_id, game_id) DO UPDATE SET estado = excluded.estado, terminado = excluded.terminado, completo = excluded.completo, progreso = excluded.progreso, updated = excluded.updated`
        ).bind(me.id, arg, estado, terminado ? 1 : 0, completo ? 1 : 0, progreso).run();
      }
      if (hogarOn(env, me.binding)) bg(pushPersona(env, request, me));
      return json({ ok: true });
    }

    if (head === "hogar" && arg === "sync" && method === "POST") {   // sincronización completa, con informe por llamada
      if (!me.hogarId) return json({ error: "sin hogar" }, 400);
      if (!hogarOn(env, me.binding)) return json({ error: "hogar no conectado", binding: !!env[me.binding], token: !!env.INGESTA_TOKEN }, 400);
      const log = [], step = async (label, fn) => { try { const r = await fn(); log.push({ paso: label, ok: true, resultado: r }); return r; } catch (e) { log.push({ paso: label, ok: false, error: String(e.message || e) }); return null; } };
      const inv = await step("GET /ingesta/juegos", () => hogarCall(env, me.binding, "/ingesta/juegos"));
      if (Array.isArray(inv)) log[log.length - 1].resultado = { juegos: inv.length };
      const members = (await env.DB.prepare("SELECT u.id, u.email, u.persona, h.binding FROM users u JOIN hogares h ON h.id = u.hogar_id WHERE u.hogar_id = ?").bind(me.hogarId).all()).results;
      for (const m of members) await step("progreso y Quiero " + m.persona, async () => { await pushPersona(env, request, m); return await kvGet(env, "hogar_persona_" + m.id); });
      await step("listas y notas", () => pushListas(env, request, me.binding, true));
      return json({ log });
    }

    if (head === "hogar" && arg === "estado" && method === "GET") {
      if (!me.hogarId) return json({ error: "sin hogar" }, 400);
      return json({ conectado: hogarOn(env, me.binding), binding: !!env[me.binding], token: !!env.INGESTA_TOKEN, listas: await kvGet(env, "hogar_listas_" + me.binding),
        persona: await kvGet(env, "hogar_persona_" + me.id), error: await kvGet(env, "hogar_error") });
    }

    if (head === "fisica" && method === "PUT") {
      if (!GAME_ID.test(arg || "")) return json({ error: "id" }, 400);
      const { v } = await request.json();
      if (v == null) await env.DB.prepare("DELETE FROM fisica WHERE game_id = ?").bind(arg).run();
      else if (["si", "no", "none"].includes(v)) {
        await env.DB.prepare(
          `INSERT INTO fisica (game_id, v, by_user, updated) VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT (game_id) DO UPDATE SET v = excluded.v, by_user = excluded.by_user, updated = excluded.updated`
        ).bind(arg, v, me.id).run();
      } else return json({ error: "v" }, 400);
      return json({ ok: true });
    }

    if (head === "me" && method === "PUT") {
      const b = await request.json();
      const name = String(b.name || "").trim().slice(0, 40) || me.name;
      const shared = b.shared === false ? 0 : 1;
      await env.DB.prepare("UPDATE users SET name = ?, shared = ? WHERE id = ?").bind(name, shared, me.id).run();
      return json({ me: publicMe({ ...me, name, shared: !!shared }) });
    }

    return json({ error: "no encontrado" }, 404);
  } catch (e) {
    return json({ error: "error interno" }, 500);
  }
}
