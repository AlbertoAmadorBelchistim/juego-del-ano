// Genera public/data/hogar.json: las listas y notas que la web manda a la app Hogar.
// Reutiliza el clasificador de public/app.js para que web y Hogar cuenten igual.
// Uso (desde la raíz del repo): node tools/listas_hogar.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const root = new URL("..", import.meta.url);
const read = p => readFileSync(new URL(p, root), "utf8");
const app = read("public/app.js");
const a = app.indexOf("const KIND_OVERRIDE"), b = app.indexOf('  return "nuevo";\n}', a) + '  return "nuevo";\n}'.length;
const kindOf = new Function(app.slice(a, b) + "\nreturn kindOf;")();

const hist = JSON.parse(read("public/data/games.json"));
const y26 = JSON.parse(read("public/data/y2026.json"));
const all = [...hist, ...y26.games.map(g => ({ ...g, y: 2026 }))].map(g => ({ ...g, aw: g.aw || {}, k: kindOf(g.t, g.y ?? 2026) }));
const histAw = g => g.y !== 2026 && Object.keys(g.aw).length > 0;
const eligible = g => g.k !== "port" || histAw(g);

// índice por defecto de la web: 40 % crítica, 40 % jugadores (Backloggd ajustado por votos), 20 % premios
const AWK = ["TGA", "DICE", "GDC", "BAFTA", "Golden Joystick"];
const awPts = g => AWK.reduce((p, k) => { const s = g.aw[k]; return !s ? p : p + (k === "TGA" ? (s === "won" ? 10 : 3) : (s === "won" ? 5 : 1.5)); }, 0) / 30 * 100;
const blMean = {};
for (const y of new Set(all.map(g => g.y))) {
  const v = all.filter(g => g.y === y && g.bl != null), n = v.reduce((s, g) => s + g.bln, 0);
  blMean[y] = n ? v.reduce((s, g) => s + g.bl * g.bln, 0) / n : 4;
}
const blAdj = g => (g.bln * g.bl + 1000 * blMean[g.y]) / (g.bln + 1000);
const index = g => { const p = []; if (g.mc != null) p.push([40, g.mc]); if (g.bl != null) p.push([40, blAdj(g) * 20]); p.push([20, awPts(g)]); const w = p.reduce((s, [x]) => s + x, 0); return p.reduce((s, [x, v]) => s + x * v, 0) / w; };

const item = (g, posicion) => ({ id: g.id, titulo: g.t, ...(g.bls ? { slug: g.bls } : {}), posicion });
const years = [...new Set(all.map(g => g.y))].sort();
const listas = [];

// Premios gordos (años cerrados)
const AWL = { TGA: "GOTY TGA", DICE: "GOTY DICE", GDC: "GOTY GDC", BAFTA: "GOTY BAFTA", "Golden Joystick": "GOTY Joystick" };
for (const k of AWK) listas.push({ lista: AWL[k], juegos: all.filter(g => g.y !== 2026 && g.aw[k]).map(g => item(g, `${g.aw[k] === "won" ? "ganador" : "nominado"} ${g.y}`)) });

// Rankings por año
const rank = (name, pick, score, top, fmt) => {
  const out = [];
  for (const y of years) {
    if (y === 2026 && name !== "Candidato 2026") continue;
    all.filter(g => g.y === y && pick(g)).map(g => ({ g, s: score(g) })).sort((x, z) => z.s - x.s).slice(0, top)
      .forEach(({ g }, i) => out.push(item(g, fmt(i + 1, y))));
  }
  listas.push({ lista: name, juegos: out });
};
rank("Consenso anual", eligible, index, 20, (n, y) => `#${n} de ${y}`);
rank("Top Metacritic anual", g => eligible(g) && g.mc != null && (g.via || []).includes("mc"), g => g.mc, 20, (n, y) => `#${n} de ${y}`);
rank("Top Backloggd anual", g => eligible(g) && g.bl != null && (g.via || []).includes("bl"), g => g.bl, 20, (n, y) => `#${n} de ${y}`);
rank("Candidato 2026", g => g.y === 2026 && eligible(g), index, 20, n => `#${n} provisional`);

// Notas de Backloggd (los juegos de 2026 llevan la fecha de su última actualización)
const fechaHist = "2026-10-11", fecha26 = y26.meta.updated || fechaHist;
const notas = all.filter(g => g.bl != null).map(g => ({ id: g.id, titulo: g.t, ...(g.bls ? { slug: g.bls } : {}), nota_backloggd: g.bl, votos_backloggd: g.bln, fecha: g.y === 2026 ? fecha26 : fechaHist }));

const body = { listas, notas };
const version = createHash("sha1").update(JSON.stringify(body)).digest("hex").slice(0, 12);
writeFileSync(new URL("public/data/hogar.json", root), JSON.stringify({ version, ...body }));
console.log("hogar.json", version, listas.map(l => `${l.lista}: ${l.juegos.length}`).join(" · "), `· notas: ${notas.length}`);
