# Descarga todo Metacritic con metascore >= 75, ordenado por nota. Salida: mc_all.json
import json,urllib.request,time,sys
K="1MOZgmNFxvmljaQR1X9KAij9Mo4xAY3u"; MIN=75; out=[]; off=0
def get(u):
    for t in range(5):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"}),timeout=40))
        except Exception as e: time.sleep(4*(t+1)); err=e
    raise err
while True:
    d=get(f"https://backend.metacritic.com/finder/metacritic/web?sortBy=-metaScore&productType=games&offset={off}&limit=24&apiKey={K}")
    items=d['data']['items']
    if not items: break
    for it in items:
        cs=it.get('criticScoreSummary') or {}
        out.append({"t":it['title'],"slug":it['slug'],"date":it.get('releaseDate'),"y":it.get('premiereYear'),"mc":cs.get('score'),"mcn":cs.get('reviewCount'),
                    "mcu":(it.get('userScore') or {}).get('score'),"pl":[p['name'] for p in it.get('platforms') or []],"genres":[g['name'] for g in it.get('genres') or []],
                    "img":(it.get('image') or {}).get('bucketPath')})
    last=out[-1]['mc'] or 0; off+=24
    print(off,last,flush=True)
    if last<MIN: break
    time.sleep(0.4)
import os; json.dump([o for o in out if (o["mc"] or 0)>=MIN],open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"datos","mc_all.json"),"w"),ensure_ascii=False)
print('fin',len(out))
