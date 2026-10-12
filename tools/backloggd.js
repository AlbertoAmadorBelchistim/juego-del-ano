// Pegar en una pestaña de backloggd.com (javascript_tool). Define window.BLTOOLS.
(() => {
const sleep = ms => new Promise(r=>setTimeout(r,ms)); let LAST=0;
const throttled = async (url) => { for(let t=0;t<8;t++){ const wait=Math.max(0, LAST+700-Date.now()); LAST=Date.now()+wait; await sleep(wait);
  const r=await fetch(url); if(r.status===429){ LAST=Date.now()+15000*(t+1); continue;} return await r.text(); } throw new Error('429 '+url); };
const normT = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/&/g,'and').replace(/\b(the|of)\b/g,'').replace(/\bii\b/g,'2').replace(/\biii\b/g,'3').replace(/[^a-z0-9]/g,'');
async function getStats(slug){ try{ const h=await throttled('/games/'+slug+'/'); const d=new DOMParser().parseFromString(h,'text/html'); const seen=new Set(); let n=0,s=0;
  [...d.querySelectorAll('[data-tippy-content*="★ Ratings"]')].forEach(e=>{const m=e.getAttribute('data-tippy-content').match(/^([\d,]+) \| ([\d.]+) ★/); if(m&&!seen.has(m[2])){seen.add(m[2]); const c=+m[1].replace(/,/g,''); n+=c; s+=c*+m[2];}});
  return {slug,title:d.querySelector('h1')?.textContent.trim(),n,avg:n?Math.round(s/n*100)/100:null,cover:(d.querySelector('img[src*="t_cover_big"]')?.getAttribute('src')||'').split('/').pop().replace('.jpg','')}; }catch(e){ return {slug,error:String(e)} } }
async function listSlugs(y,pages){ const out=[]; for(let p=1;p<=pages;p++){ const h=await throttled(`/games/lib/rating/release_year:${y}/?page=${p}`); const d=new DOMParser().parseFromString(h,'text/html');
  [...d.querySelectorAll('.game-cover a.cover-link')].forEach(a=>out.push(a.getAttribute('href').split('/')[2])); } return [...new Set(out)]; }
async function lookup(title, year){ const j=JSON.parse(await throttled('/autocomplete.json?query='+encodeURIComponent(title))); const S=(j.suggestions||[]).map(s=>s.data); const nt=normT(title);
  const pick=S.find(s=>normT(s.title)===nt && Math.abs(+s.year-year)<=1) || S.find(s=>normT(s.title)===nt) || S.find(s=>Math.abs(+s.year-year)<=1 && (normT(s.title).includes(nt)||nt.includes(normT(s.title))));
  if(!pick) return null; return {...await getStats(pick.slug), year:pick.year}; }
// Uso: BLTOOLS.run(2026, ["Titulo A","Titulo B"]) -> arranca en segundo plano; consulta BLTOOLS.state hasta done=true; luego BLTOOLS.output()
const state={done:false, top:[], look:{}};
async function run(year, titles){ state.done=false; const slugs=await listSlugs(year,2); const top=[]; for(const s of slugs) top.push(await getStats(s)); state.top=top;
  for(const t of titles){ const nt=normT(t); const hit=top.find(r=>r.title&&normT(r.title)===nt); state.look[t]=hit||await lookup(t,year); } state.done=true; }
function output(){ const top=state.top.filter(r=>r.n>=500 && !/Upgrade|Booster|Season Pass|DLC|Soundtrack/i.test(r.title||'')).sort((a,b)=>b.avg-a.avg).slice(0,40).map(r=>[r.slug,r.title,r.n,r.avg,r.cover].join('|')).join('\n');
  const look=Object.entries(state.look).filter(([t,r])=>r&&r.n).map(([t,r])=>[t,r.slug,r.title,r.year||'',r.n,r.avg,r.cover].join('|')).join('\n'); return {bl_top:top, bl_lookup:look}; }
window.BLTOOLS={run,output,state};
})();
