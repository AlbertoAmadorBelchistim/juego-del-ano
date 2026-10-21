"""Construye el catálogo de todos los tiempos y los años 1998–2013 del ranking anual.

Entradas (en tools/catalogo/datos/):
  mc_all.json        Metacritic (finder) con metascore >= 75: t, slug, date, y, mc, mcn, mcu, pl, genres, img
  blx.json           Backloggd leído desde el navegador: {slug: {title, n, avg, year, genres, pl, cover}}
  bl_2025.csv        Backloggd de junio de 2025 (respaldo para lo que no se haya vuelto a leer)
  igdb_map.csv       Cruce metacritic_url -> igdb_slug (de los cuadernos de Colab)
  awards_1998_2013.json   Premios GOTY 1998–2013 (VGA, DICE, GDC, BAFTA, Golden Joystick)
  hogar.json         (opcional) inventario de Hogar: [{id, titulo, slug, plataforma, formato}]
Salidas:
  public/data/catalogo.json      catálogo completo para la pestaña Catálogo
  public/data/games.json         años 1998–2013 añadidos (los de 2014–2025 no se tocan)
  public/data/other.json         premios 1998–2013 añadidos (VGA incluido)
  tools/catalogo/datos/covers_todo.json   carátulas por año que faltan en los sprites
Uso (desde la raíz del repo):  python3 tools/catalogo/build_catalogo.py
"""
import csv, json, os, re, unicodedata, datetime
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
D = os.path.join(ROOT, "tools", "catalogo", "datos")
PUB = os.path.join(ROOT, "public", "data")
csv.field_size_limit(10**8)
load = lambda p: json.load(open(p, encoding="utf-8"))

def norm(s):
    s = unicodedata.normalize("NFD", str(s or "")); s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower().replace("&", "and")
    s = re.sub(r"\s*\((19|20)\d{2}\)$", "", s); s = re.sub(r"\b(the|of|a)\b", "", s)
    for r, a in (("viii", "8"), ("vii", "7"), ("vi", "6"), ("iv", "4"), ("iii", "3"), ("ii", "2")): s = re.sub(rf"\b{r}\b", a, s)
    return re.sub(r"[^a-z0-9]", "", s)

PLAT = [(r"playstation 5|^ps5$", "PS5"), (r"playstation 4|^ps4$", "PS4"), (r"playstation 3|^ps3$", "PS3"), (r"playstation 2|^ps2$", "PS2"),
        (r"playstation vita|^vita$", "Vita"), (r"playstation portable|^psp$", "PSP"), (r"^playstation$|^ps1$|^psx$", "PS1"),
        (r"xbox series", "Xbox Series"), (r"xbox one", "Xbox One"), (r"xbox 360", "Xbox 360"), (r"^xbox$", "Xbox"),
        (r"switch 2", "Switch 2"), (r"switch", "Switch"), (r"wii u", "Wii U"), (r"^wii$", "Wii"), (r"gamecube", "GameCube"),
        (r"nintendo 64|^n64$", "N64"), (r"super nintendo|^snes$|super famicom", "SNES"), (r"^nes$|nintendo entertainment|famicom", "NES"),
        (r"3ds", "3DS"), (r"nintendo ds|^ds$", "DS"), (r"game boy advance", "GBA"), (r"game boy", "Game Boy"),
        (r"dreamcast", "Dreamcast"), (r"genesis|mega drive", "Mega Drive"), (r"saturn", "Saturn"),
        (r"^pc$|windows|^mac$|macos|linux|dos", "PC"), (r"ios|iphone|ipad|android", "Móvil"), (r"stadia", "Stadia")]
def plat(name):
    n = str(name).lower().strip()
    for rx, short in PLAT:
        if re.search(rx, n): return short
    return None
def plats(lst): return sorted({p for p in (plat(x) for x in lst or []) if p}, key=lambda p: [x[1] for x in PLAT].index(p))

# ---------- fuentes ----------
mc = load(os.path.join(D, "mc_all.json"))
if os.path.exists(os.path.join(D, "mc_extra.json")):     # fichas de Metacritic por debajo de 75 (juegos de casa, premiados)
    seen = {m["slug"] for m in mc}; mc += [m for m in load(os.path.join(D, "mc_extra.json")) if m["slug"] not in seen]
blx = load(os.path.join(D, "blx.json")) if os.path.exists(os.path.join(D, "blx.json")) else {}
bl_old = {}
if os.path.exists(os.path.join(D, "bl_2025.csv")):
    for r in csv.DictReader(open(os.path.join(D, "bl_2025.csv"), encoding="utf-8")):
        slug = r["url"].rstrip("/").split("/")[-1]
        try: n = int(float(r.get("n_votes_real") or 0)); avg = float(r.get("rating_real") or 0)
        except ValueError: continue
        if not n or not avg: continue
        bl_old[slug] = dict(title=r["title"], n=n, avg=avg, year=int(r["release_date_iso"][:4]) if (r.get("release_date_iso") or "")[:4].isdigit() else None,
                            genres=[g.strip() for g in (r.get("genres") or "").split(",") if g.strip()], pl=[p.strip() for p in (r.get("platforms") or "").split(",") if p.strip()], cover="", fecha="2025-06")
hog_bl = load(os.path.join(D, "hogar_bl.json")) if os.path.exists(os.path.join(D, "hogar_bl.json")) else {}
BL = {**bl_old, **{k: {**v, "fecha": "2026-10"} for k, v in blx.items() if v.get("n")},
      **{v["slug"]: {**v, "fecha": "2026-10", "casa": True} for v in hog_bl.values() if v.get("slug") and v.get("n")}}
mc2igdb = {}
if os.path.exists(os.path.join(D, "igdb_map.csv")):
    for r in csv.DictReader(open(os.path.join(D, "igdb_map.csv"), encoding="utf-8")):
        if r.get("found") == "True" and r.get("igdb_slug"): mc2igdb[r["metacritic_url"].rstrip("/").split("/")[-1]] = r["igdb_slug"]

# equivalencias resueltas con IGDB (el slug de IGDB es el de Backloggd): {slug Metacritic: slug Backloggd}
if os.path.exists(os.path.join(D, "mc2bl.json")): mc2igdb.update(load(os.path.join(D, "mc2bl.json")))

bl_by_norm = defaultdict(list)
for slug, b in BL.items(): bl_by_norm[norm(b["title"])].append(slug)
EDITION_RE = re.compile(r"\s*[:\-–]?\s*(game of the year edition|goty edition|complete edition|definitive edition|deluxe edition|ultimate edition|gold edition|remastered|[!])\s*$", re.I)
def bl_for(mcs, title, year):
    for s in (mc2igdb.get(mcs), mcs):   # mismo slug, pero solo si el año cuadra (los remakes comparten slug base)
        if s and s in BL and (not BL[s].get("year") or not year or abs(BL[s]["year"] - year) <= 1): return s
        # adaptación posterior del mismo juego (Metacritic fecha la plataforma, Backloggd el original): mismo título exacto
        if s and s in BL and BL[s].get("year") and year and -2 <= year - BL[s]["year"] <= 12 and BL[s]["n"] >= 20 \
           and norm(EDITION_RE.sub("", BL[s]["title"])) == norm(EDITION_RE.sub("", title)): return s
    cands = [s for s in bl_by_norm.get(norm(title), []) if not BL[s].get("year") or not year or abs(BL[s]["year"] - year) <= 1]
    return sorted(cands, key=lambda s: -BL[s]["n"])[0] if cands else None

# ---------- unión Metacritic + Backloggd ----------
games = {}   # clave interna -> registro
used_bl = set()
for m in mc:
    y = m.get("y") or (int(m["date"][:4]) if m.get("date") else None)
    t = re.sub(r"\s*\((19|20)\d{2}\)$", "", m["t"])
    bls = bl_for(m["slug"], t, y)
    if bls in used_bl: bls = None          # dos fichas de Metacritic no pueden compartir una de Backloggd
    if bls: used_bl.add(bls)
    games["mc:" + m["slug"]] = dict(t=t, y=y, date=m.get("date"), mc=m["mc"], mcn=m.get("mcn"), mcs=m["slug"], bls=bls, mcimg=m.get("img"),
                                     pl=plats(m.get("pl")), gen=list(dict.fromkeys(m.get("genres") or [])))
EDITION = re.compile(r"\s*[:\-–]?\s*(game of the year edition|goty edition|goty|complete edition|definitive edition|hd edition|hd remaster|director'?s cut|enhanced edition|special edition|deluxe edition|ultimate edition|gold edition|remastered|nintendo switch 2 edition.*|royal edition)\s*$", re.I)
have_norm = {norm(re.sub(r"\s*\((19|20)\d{2}\)$", "", m["t"])) for m in mc}
for slug, b in BL.items():
    if slug in used_bl or (b["n"] < 300 and not b.get("casa")): continue
    base = EDITION.sub("", b["title"])
    if base != b["title"] and norm(base) in have_norm: continue      # ediciones de un juego que ya está
    games["bl:" + slug] = dict(t=b["title"], y=b.get("year"), mc=None, mcn=None, mcs=None, bls=slug, pl=[], gen=[])
for g in games.values():
    b = BL.get(g["bls"]) if g.get("bls") else None
    if b:
        g.update(bl=b["avg"], bln=b["n"], blf=b.get("fecha"))
        if b.get("cover"): g["cv"] = b["cover"]
        g["pl"] = plats(list(g["pl"]) + list(b.get("pl") or []))
        g["gen"] = list(dict.fromkeys(list(b.get("genres") or []) + g["gen"]))
        if not g.get("y"): g["y"] = b.get("year")

# ---------- índice: crítica y jugadores a partes iguales, con ajuste por pocos votos ----------
G = [g for g in games.values() if g.get("y")]
MC_PRIOR, MC_K = 78.0, 8          # pocas críticas -> hacia 78
blv = [g for g in G if g.get("bl")]
BL_PRIOR = sum(g["bl"] * g["bln"] for g in blv) / max(1, sum(g["bln"] for g in blv)); BL_K = 1000
for g in G:
    parts = []
    if g.get("mc") is not None:
        n = g.get("mcn") or 0; g["mca"] = round((n * g["mc"] + MC_K * MC_PRIOR) / (n + MC_K), 1); parts.append(g["mca"])
    if g.get("bl") is not None:
        g["bla"] = round((g["bln"] * g["bl"] + BL_K * BL_PRIOR) / (g["bln"] + BL_K), 3); parts.append(g["bla"] * 20)
    # Si falta una de las dos fuentes, cuenta como la media (sin información = prior): así un juego con una sola nota no se cuela arriba
    if g.get("mc") is None: parts.append(MC_PRIOR)
    if g.get("bl") is None: parts.append(BL_PRIOR * 20)
    g["ix"] = round(sum(parts) / 2, 2)
    g["mp"] = bool(g.get("mc") is not None and g["mc"] >= 90 and (g.get("mcn") or 0) >= 15)

# ---------- ranking anual 1998–2013 ----------
A = load(os.path.join(D, "awards_1998_2013.json"))
AWKEY = {"VGA": "TGA", "DICE": "DICE", "GDC": "GDC", "BAFTA": "BAFTA", "Golden Joystick": "Golden Joystick"}
by_norm_year = defaultdict(list)
for k, g in games.items(): by_norm_year[norm(g["t"])].append(k)
# Títulos de Wikipedia que en Metacritic se llaman de otra forma
TITLE_ALIAS = {"No One Lives Forever": "The Operative: No One Lives Forever", "FIFA Football 2005": "FIFA Soccer 2005",
               "Pro Evolution Soccer 4": "World Soccer: Winning Eleven 8 International", "FIFA 10": "FIFA Soccer 10", "FIFA 11": "FIFA Soccer 11",
               "FIFA 12": "FIFA Soccer 12", "FIFA 13": "FIFA Soccer 13", "Dr. Kawashima's Brain Training: How Old Is Your Brain?": "Brain Age: Train Your Brain in Minutes a Day!",
               "Legend of Zelda: The Wind Waker": "The Legend of Zelda: The Wind Waker", "Guitar Hero 2": "Guitar Hero II", "Halo": "Halo: Combat Evolved"}
def find_game(title, years):
    title = TITLE_ALIAS.get(title, title)
    ks = [k for k in by_norm_year.get(norm(title), []) if games[k]["y"] in years]
    if not ks:   # títulos de Wikipedia algo distintos: «Legend of Zelda: The Wind Waker», «Guitar Hero 2»…
        nt = norm(title)
        ks = [k for k, g in games.items() if g["y"] in years and (norm(g["t"]).startswith(nt) or nt.startswith(norm(g["t"]))) and len(norm(g["t"])) > 5]
    return sorted(ks, key=lambda k: -(games[k].get("mcn") or 0) - (games[k].get("bln") or 0) / 100)[0] if ks else None
year_sets = defaultdict(dict)   # año -> clave -> {"via": set, "aw": {}}
unmatched = []
for ys, certs in A.items():
    if not ys.isdigit(): continue
    Y = int(ys)
    for cert, r in certs.items():
        key = AWKEY[cert]
        for title, res in [(r["winner"], "won")] + [(n, "nom") for n in (r.get("nominees") or []) if not (cert == "DICE" and Y == 2000)]:
            yrs = (Y - 1, Y) if cert == "Golden Joystick" else (Y, Y - 1, Y + 1)
            k = find_game(title, yrs)
            if not k: unmatched.append(f"{Y} {cert}: {title}"); continue
            gy = games[k]["y"]
            if not 1998 <= gy <= 2013: continue
            e = year_sets[gy].setdefault(k, {"via": set(), "aw": {}})
            e["via"].add("aw")
            if e["aw"].get(key) != "won": e["aw"][key] = res
for Y in range(1998, 2014):
    yg = [(k, g) for k, g in games.items() if g["y"] == Y]
    for k, g in sorted([x for x in yg if x[1].get("mc") is not None and (x[1].get("mcn") or 0) >= 15], key=lambda x: -x[1]["mc"])[:20]:
        year_sets[Y].setdefault(k, {"via": set(), "aw": {}})["via"].add("mc")
    for k, g in sorted([x for x in yg if x[1].get("bl") and x[1]["bln"] >= 1000 and x[1].get("mc") is not None], key=lambda x: -x[1]["bl"])[:20]:
        year_sets[Y].setdefault(k, {"via": set(), "aw": {}})["via"].add("bl")

def slugify(s): return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower())).strip("-")
hist = [g for g in load(os.path.join(PUB, "games.json")) if g["y"] >= 2014]
y26 = load(os.path.join(PUB, "y2026.json"))["games"]
existing_ids = {}
for g in hist + y26:
    for s in (g.get("bls"), g.get("mcs")):
        if s: existing_ids[s] = g["id"]
new_hist = []
for Y in range(1998, 2014):
    for k, e in year_sets[Y].items():
        g = games[k]
        gid = f"{Y}-{g['bls'] or g['mcs'] or slugify(g['t'])}"
        g["id"] = gid
        rec = dict(id=gid, y=Y, t=g["t"], mc=g.get("mc"), mcn=g.get("mcn"), bl=g.get("bl"), bln=g.get("bln"), bls=g.get("bls"), mcs=g.get("mcs"),
                   aw=e["aw"], via=sorted(e["via"]), pl=g.get("pl") or [])
        if g.get("cv"): rec["cv"] = g["cv"]
        if g.get("mcimg"): rec["mcimg"] = g["mcimg"]
        new_hist.append({k2: v for k2, v in rec.items() if v not in (None, [], "") or k2 in ("aw", "via")})
for g in games.values():
    if "id" not in g:
        g["id"] = existing_ids.get(g.get("bls")) or existing_ids.get(g.get("mcs")) or f"{g['y']}-{g['bls'] or g['mcs'] or slugify(g['t'])}"
# Equivalencias juego de la web -> objetos de Hogar para los juegos de casa buscados a mano en Backloggd
alias_path = os.path.join(PUB, "hogar_alias.json"); alias = load(alias_path)
by_bls = {g["bls"]: g["id"] for g in games.values() if g.get("bls") and g.get("id")}
for hid, v in hog_bl.items():
    gid = by_bls.get(v.get("slug"))
    if gid and int(hid) not in alias.get(gid, []): alias.setdefault(gid, []).append(int(hid))
json.dump(alias, open(alias_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# GOTY en el catálogo (ganadores de cualquier premio gordo en cualquier año)
wins = defaultdict(list)
for g in hist + new_hist:
    for k, v in (g.get("aw") or {}).items():
        if v == "won": wins[g["id"]].append(("VGA" if k == "TGA" and g["y"] < 2014 else k) + f" {g['y']}")

# ---------- salida ----------
cat = []
for g in sorted(G, key=lambda g: -g["ix"]):
    rec = {k: g.get(k) for k in ("id", "t", "y", "mc", "mcn", "mca", "bl", "bln", "bla", "ix", "mcs", "bls", "cv", "mcimg", "pl", "gen", "mp", "blf")}
    if wins.get(g["id"]): rec["goty"] = "Ganador: " + ", ".join(wins[g["id"]])
    cat.append({k: v for k, v in rec.items() if v not in (None, [], "", False)})
meta = {"updated": datetime.date.today().isoformat(), "fuentes": {"Metacritic": "API, ≥75", "Backloggd": f"{len(blx)} fichas leídas en 2026-10, {len(bl_old)} de junio de 2025"},
        "indice": "50 % Metacritic (ajustado hacia 78 con 8 críticas) + 50 % Backloggd ×20 (ajustado hacia la media con 1.000 votos)"}
json.dump({"meta": meta, "games": cat}, open(os.path.join(PUB, "catalogo.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump(sorted(hist + new_hist, key=lambda g: (g["y"], g["id"])), open(os.path.join(PUB, "games.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
other = load(os.path.join(PUB, "other.json"))
for ys, certs in A.items():
    if ys.isdigit(): other[ys] = {c: {"winner": r["winner"], "nominees": r.get("nominees") or []} for c, r in certs.items()}
json.dump(other, open(os.path.join(PUB, "other.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"catálogo: {len(cat)} juegos ({sum(1 for g in cat if 'mc' in g and 'bl' in g)} con las dos notas) · años 1998–2013: {len(new_hist)} candidatos")
print("premios sin emparejar:", len(unmatched)); print("\n".join(unmatched[:60]))
