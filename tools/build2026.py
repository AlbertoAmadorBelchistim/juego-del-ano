"""Construye los candidatos 2026. Entradas: mc2026.json (finder de Metacritic), bl_top.txt, bl_lookup.txt, awards.json.
Salida: docs/*.json (uno por juego) + docs/_meta.json. Uso: python3 build2026.py"""
import json,re,io,os,time,base64,unicodedata,urllib.request,urllib.parse
from datetime import date
from PIL import Image
K="1MOZgmNFxvmljaQR1X9KAij9Mo4xAY3u"; Y=2026
P={'PC':'PC','PlayStation 4':'PS4','PlayStation 5':'PS5','Xbox One':'Xbox One','Xbox Series X':'Xbox Series','Nintendo Switch':'Switch','Nintendo Switch 2':'Switch 2','iOS (iPhone/iPad)':'iOS','Meta Quest':'Quest'}
def norm(s):
    s=unicodedata.normalize('NFD',s); s=''.join(c for c in s if unicodedata.category(c)!='Mn').lower().replace('&','and')
    s=re.sub(r'\b(the|of)\b','',s); return re.sub(r'[^a-z0-9]','',s)
def get(u):
    for k in range(3):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"}),timeout=30))
        except Exception: time.sleep(2)
def mcsearch(t):
    d=get(f"https://backend.metacritic.com/finder/metacritic/search/{urllib.parse.quote(t)}/web?apiKey={K}&offset=0&limit=10&mcoTypeId=13") or {}
    for i in (d.get('data') or {}).get('items',[]):
        if i.get('type')=='game-title' and i.get('premiereYear')==Y and (norm(i['title'])==norm(t) or norm(t) in norm(i['title']) or norm(i['title']) in norm(t)):
            c=i.get('criticScoreSummary') or {}
            return {"title":i['title'],"slug":i['slug'],"score":c.get('score'),"reviews":c.get('reviewCount'),"platforms":[p['name'] for p in i.get('platforms') or []],"img":(i.get('image') or {}).get('bucketPath'),"date":i.get('releaseDate')}
def thumb(url):
    try:
        b=urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=30).read()
        im=Image.open(io.BytesIO(b)).convert('RGB'); W,H=96,128; s=max(W/im.width,H/im.height)
        im=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS); l=(im.width-W)//2; t=(im.height-H)//2
        buf=io.BytesIO(); im.crop((l,t,l+W,t+H)).save(buf,'JPEG',quality=70,optimize=True); return 'data:image/jpeg;base64,'+base64.b64encode(buf.getvalue()).decode()
    except Exception: return None
mc=json.load(open('mc2026.json')); aw=json.load(open('awards2026.json'))
mctop=[i for i in mc if (i['reviews'] or 0)>=25 and not re.search(r'DLC|Season Pass',i['title'])][:20]
LK={}
for l in open('bl_lookup.txt'):
    q,slug,t,yr,n,avg,cov=l.rstrip('\n').split('|'); LK[norm(q)]=dict(slug=slug,title=t,n=int(n),avg=float(avg),cov=cov)
G={}
def add(key,**kw):
    r=G.setdefault(key,dict(via=set(),aw={},titles=[])); 
    for k,v in kw.items():
        if k=='via': r['via'].add(v)
        elif k=='title': r['titles'].append(v)
        elif v is not None and r.get(k) is None: r[k]=v
    return r
def findkey(mcslug=None,blslug=None):
    for k,r in G.items():
        if (mcslug and r.get('mc',{}) and r['mc'].get('slug')==mcslug) or (blslug and r.get('bl') and r['bl']['slug']==blslug): return k
for i in mctop:
    b=LK.get(norm(i['title'])); k=findkey(i['slug'], b and b['slug']) or i['slug']
    add(k,title=i['title'],via='mc',mc=i,bl=b if b and b['n']>=100 else None)
for t,a in aw.get('games',{}).items():
    b=LK.get(norm(t)); m=None
    k=findkey(None,b and b['slug'])
    if not k:
        m=next((i for i in mc if norm(i['title'])==norm(t)),None) or mcsearch(t)
        k=findkey(m and m['slug'], None) or (m['slug'] if m else norm(t))
    r=add(k,title=t,via='aw',mc=m,bl=b if b and b['n']>=100 else None)
    r['aw'].update(a)
kept=0
for l in open('bl_top.txt'):
    if kept>=20: break
    slug,t,n,avg,cov=l.rstrip('\n').split('|'); n=int(n)
    if n<500 or re.search(r'Upgrade|DLC|Soundtrack',t): continue
    m=next((i for i in mc if norm(i['title'])==norm(t)),None) or mcsearch(t)
    if not m or not m.get('score'): continue
    kept+=1
    k=findkey(m['slug'],slug) or m['slug']
    add(k,title=t,via='bl',mc=m,bl=dict(slug=slug,title=t,n=n,avg=float(avg),cov=cov))
def detail(slug):
    d=get(f"https://backend.metacritic.com/games/metacritic/{slug}/web?apiKey={K}") or {}
    it=(d.get('data') or {}).get('item') or {}
    return it
PHYS_POS=[r'Limited Run Games',r'Fangamer',r'Super Rare Games',r'iam8bit',r'Special Reserve Games',r'Premium Edition Games',r'Strictly Limited Games',r'Serenity Forge',r'Skybound Games',
  r'physical (?:release|edition|version|copies|copy|retail|editions|releases|format|distribution)',r'(?:retail|boxed) (?:release|version|copies|edition)',r'released physically|physically released|a physical',r"collector'?s edition",
  r'\|\s*media\s*=[^\n]*(?:Blu-ray|[Oo]ptical disc|[Cc]artridge|Game Card|DVD)']
PHYS_NEG=r'digital[- ]only|only (?:be )?(?:available |released )?digitally|exclusively (?:digital|via digital|through digital)|digital[- ]exclusive|no physical (?:release|version|edition|copies)|without a physical'
def phys(title):
    s=get("https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch="+urllib.parse.quote(title+' video game')) or {}
    hits=(s.get('query') or {}).get('search') or []
    if not hits or norm(title)[:8] not in norm(hits[0]['title']): return None,None
    d=get("https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&titles="+urllib.parse.quote(hits[0]['title'])) or {}
    try: txt=d['query']['pages'][0]['revisions'][0]['slots']['main']['content']
    except Exception: return None,None
    for p in PHYS_POS:
        m=re.search(p,txt,re.I)
        if m: return 'si','Wikipedia: '+m.group(0)[:40]
    m=re.search(PHYS_NEG,txt,re.I)
    if m: return 'no','Wikipedia: '+m.group(0)
    return None,None
os.makedirs('docs',exist_ok=True); [os.remove('docs/'+f) for f in os.listdir('docs')]
for k,r in G.items():
    m=dict(r.get('mc') or {}); b=r.get('bl')
    if m.get('slug'):
        it=detail(m['slug'])
        if it.get('platforms'): m['platforms']=[p['name'] for p in it['platforms']]
        cs=it.get('criticScoreSummary') or {}
        if cs.get('score'): m['score']=cs['score']; m['reviews']=cs.get('reviewCount')
        m['date']=it.get('releaseDate') or m.get('date')
    t=(r['titles'] and next((x for x in r['titles'] if r['aw']),None)) or (b['title'] if b else None) or r['titles'][0]
    img = thumb(f"https://images.igdb.com/igdb/image/upload/t_cover_big/{b['cov']}.jpg") if b and b.get('cov') else (thumb("https://www.metacritic.com/a/img/catalog"+m['img']) if m.get('img') else None)
    doc=dict(t=t, mc=m.get('score') or None, mcn=m.get('reviews'), mcs=m.get('slug'), bl=b['avg'] if b else None, bln=b['n'] if b else None, bls=b['slug'] if b else None,
             pl=[P.get(p,p) for p in m.get('platforms') or []], date=m.get('date'), aw=r['aw'], via=[v for v in ('aw','mc','bl') if v in r['via']], img=img)
    fis,fsrc=phys(t); time.sleep(1)
    if fis: doc['fis']=fis; doc['fsrc']=fsrc
    did=re.sub(r'[^a-z0-9-]','',(b['slug'] if b else m.get('slug') or norm(t)))[:120]
    json.dump(doc,open(f'docs/{did}.json','w'),ensure_ascii=False)
meta=dict(updated=date.today().isoformat(), tga=aw.get('tga'), notes=aw.get('notes',[]), upcoming=aw.get('upcoming',[]), awardLabels=aw.get('labels',{}))
json.dump(meta,open('docs/_meta.json','w'),ensure_ascii=False)
print(len(G),'candidatos;',kept,'de Backloggd;', sorted(os.listdir('docs'))[:60])
