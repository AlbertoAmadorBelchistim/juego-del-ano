"""Empaqueta docs/*.json (salida de build2026.py) en public/data/y2026.json, que es lo que lee la web.
Uso (desde tools/):  python3 build2026.py && python3 pack2026.py"""
import json, os, sys
D = sys.argv[1] if len(sys.argv) > 1 else 'docs'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'data', 'y2026.json')
meta = json.load(open(f'{D}/_meta.json')); games = []
for f in sorted(os.listdir(D)):
    if f == '_meta.json' or not f.endswith('.json'): continue
    d = json.load(open(f'{D}/{f}')); d['id'] = '2026-' + f[:-5]
    games.append({k: v for k, v in d.items() if v not in (None, []) or k in ('aw', 'via')})
# Un juego que ya fue candidato no desaparece aunque baje del corte: puede tener marcas de los usuarios.
if os.path.exists(OUT):
    have = {g['id'] for g in games}
    for g in json.load(open(OUT)).get('games', []):
        if g['id'] not in have:
            games.append(g)
            print('se mantiene (ya fue candidato):', g.get('t'))
json.dump({"meta": meta, "games": games}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(games), 'juegos ->', os.path.normpath(OUT))

# Listas y notas para la app Hogar (public/data/hogar.json); la web las envía sola cuando cambian.
import subprocess
subprocess.run(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "listas_hogar.mjs")], check=True)
