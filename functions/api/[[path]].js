// API de la web: colecciones por usuario y correcciones de edición física.
// Identidad: Cloudflare Access pone delante de la web un login por correo y firma un JWT
// (cabecera Cf-Access-Jwt-Assertion). Aquí se verifica la firma, el emisor y la audiencia.
// Variables de entorno (Pages > Settings > Variables):
//   ACCESS_TEAM_DOMAIN  p. ej. "miequipo.cloudflareaccess.com"
//   ACCESS_AUD          el "Application Audience (AUD) Tag" de la aplicación de Access
//   DEV_EMAIL           solo para pruebas en local con `wrangler pages dev` (sin Access)

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
  let u = await env.DB.prepare("SELECT id, name, shared FROM users WHERE email = ?").bind(email).first();
  if (!u) {
    const name = email.split("@")[0].slice(0, 40);
    await env.DB.prepare("INSERT OR IGNORE INTO users (email, name) VALUES (?, ?)").bind(email, name).run();
    u = await env.DB.prepare("SELECT id, name, shared FROM users WHERE email = ?").bind(email).first();
  }
  return { id: u.id, name: u.name, shared: !!u.shared };
}

async function marksOf(env, userId) {
  const { results } = await env.DB.prepare("SELECT game_id, estado, terminado, completo FROM marks WHERE user_id = ?").bind(userId).all();
  const out = {};
  for (const r of results) out[r.game_id] = { estado: r.estado, terminado: !!r.terminado, completo: !!r.completo };
  return out;
}

/* ---------- rutas ---------- */
export async function onRequest({ request, env, params }) {
  try {
    const me = await currentUser(request, env);
    if (!me) return json({ error: "no autenticado" }, 401);
    const path = (params.path || []).map(decodeURIComponent);
    const [head, arg] = path;
    const method = request.method;

    if (head === "state" && method === "GET") {
      const users = (await env.DB.prepare(
        "SELECT u.id, u.name, COUNT(m.game_id) AS n FROM users u LEFT JOIN marks m ON m.user_id = u.id WHERE u.shared = 1 OR u.id = ? GROUP BY u.id ORDER BY u.name COLLATE NOCASE"
      ).bind(me.id).all()).results;
      const fis = (await env.DB.prepare("SELECT game_id, v FROM fisica").all()).results;
      return json({ me, users, marks: await marksOf(env, me.id), fisica: Object.fromEntries(fis.map(r => [r.game_id, r.v])) });
    }

    if (head === "marks" && method === "GET") {
      const uid = Number(new URL(request.url).searchParams.get("u"));
      if (!Number.isInteger(uid)) return json({ error: "u" }, 400);
      if (uid !== me.id) {
        const other = await env.DB.prepare("SELECT shared FROM users WHERE id = ?").bind(uid).first();
        if (!other || !other.shared) return json({ error: "colección privada" }, 403);
      }
      return json({ marks: await marksOf(env, uid) });
    }

    if (head === "marks" && method === "PUT") {
      if (!GAME_ID.test(arg || "")) return json({ error: "id" }, 400);
      const b = await request.json();
      const estado = b.estado === "tengo" || b.estado === "quiero" ? b.estado : null;
      const completo = !!b.completo, terminado = !!b.terminado || completo;
      if (!estado && !terminado) {
        await env.DB.prepare("DELETE FROM marks WHERE user_id = ? AND game_id = ?").bind(me.id, arg).run();
      } else {
        await env.DB.prepare(
          `INSERT INTO marks (user_id, game_id, estado, terminado, completo, updated) VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT (user_id, game_id) DO UPDATE SET estado = excluded.estado, terminado = excluded.terminado, completo = excluded.completo, updated = excluded.updated`
        ).bind(me.id, arg, estado, terminado ? 1 : 0, completo ? 1 : 0).run();
      }
      return json({ ok: true });
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
      return json({ me: { id: me.id, name, shared: !!shared } });
    }

    return json({ error: "no encontrado" }, 404);
  } catch (e) {
    return json({ error: "error interno" }, 500);
  }
}
