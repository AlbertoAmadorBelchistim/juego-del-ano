// Pegar en una pestaña de backloggd.com (javascript_tool del navegador integrado). Define window.BLX.
// BLX.run({years:[1998,...], pages:2, allPages:10})  -> tops por año y de todos los tiempos + fichas
// BLX.more(["slug-a","slug-b"])                       -> solo fichas (rotación semanal: las más antiguas de blx.json)
// Progreso: BLX.st (done, stats, todo). Resultado: BLX.st.stats  {slug: {slug,title,n,avg,year,genres,pl,cover}}
// Para sacar un resultado grande del navegador, devolverlo con un relleno de >100.000 caracteres: la herramienta lo guarda en un fichero.
(() => {
const sleep = ms => new Promise(r=>setTimeout(r,ms)); let LAST=0;
const throttled = async (url) => { for(let t=0;t<8;t++){ const wait=Math.max(0, LAST+700-Date.now()); LAST=Date.now()+wait; await sleep(wait);
  const r=await fetch(url); if(r.status===429){ LAST=Date.now()+15000*(t+1); continue;} if(r.status===404) return ''; return await r.text(); } throw new Error('429 '+url); };
async function getStats(slug){ try{ const h=await throttled('/games/'+slug+'/'); const d=new DOMParser().parseFromString(h,'text/html'); const seen=new Set(); let n=0,s=0;
  [...d.querySelectorAll('[data-tippy-content*="★ Ratings"]')].forEach(e=>{const m=e.getAttribute('data-tippy-content').match(/^([\d,]+) \| ([\d.]+) ★/); if(m&&!seen.has(m[2])){seen.add(m[2]); const c=+m[1].replace(/,/g,''); n+=c; s+=c*+m[2];}});
  const ym=h.match(/release_year:(\d{4})/); const genres=[...d.querySelectorAll('a[href*="/games/lib/popular/genre:"]')].map(a=>a.textContent.trim()).filter(Boolean);
  const plats=[...d.querySelectorAll('a[href*="/games/lib/popular/release_platform:"]')].map(a=>a.textContent.trim()).filter(Boolean);
  return {slug,title:d.querySelector('h1')?.textContent.trim(),n,avg:n?Math.round(s/n*100)/100:null,year:ym?+ym[1]:null,genres:[...new Set(genres)],pl:[...new Set(plats)],
          cover:(d.querySelector('img[src*="t_cover_big"]')?.getAttribute('src')||'').split('/').pop().replace('.jpg',''), fecha:new Date().toISOString().slice(0,10)}; }catch(e){ return {slug,error:String(e)} } }
async function listSlugs(path,pages){ const out=[]; for(let p=1;p<=pages;p++){ const h=await throttled(`${path}?page=${p}`); const d=new DOMParser().parseFromString(h,'text/html');
  [...d.querySelectorAll('.game-cover a.cover-link')].forEach(a=>out.push(a.getAttribute('href').split('/')[2])); } return [...new Set(out)]; }
const st={done:false, lists:{}, stats:{}, err:null, todo:0, inflight:new Set()};
async function worker(order){ for(const s of order){ if(st.stats[s]||st.inflight.has(s)) continue; st.inflight.add(s); st.stats[s]=await getStats(s); st.inflight.delete(s); } }
async function fetchAll(slugs){ st.todo=slugs.length; await Promise.all([worker(slugs), worker([...slugs].reverse()), worker(slugs.slice(Math.floor(slugs.length/2)))]); }
async function run(cfg){ st.done=false;
  for(const y of cfg.years||[]) st.lists['y'+y]=await listSlugs(`/games/lib/rating/release_year:${y}/`, cfg.pages||2);
  if(cfg.allPages) st.lists.all=await listSlugs('/games/lib/rating/', cfg.allPages);
  await fetchAll([...new Set(Object.values(st.lists).flat())]); st.done=true; }
async function more(slugs){ st.done=false; await fetchAll(slugs); st.done=true; }
window.BLX={run,more,st,getStats,throttled};
})();
