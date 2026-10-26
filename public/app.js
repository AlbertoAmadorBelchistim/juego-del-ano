"use strict";
(async () => {
const getJSON = async u => { const r = await fetch(u, {cache: "no-cache"}); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); };
const [GAMES, SNAP26, DATA, MAP, OTHER] = await Promise.all(["games","y2026","tga","map","other"].map(n => getJSON("data/" + n + ".json")));
const HALIAS = await getJSON("data/hogar_alias.json").catch(() => ({}));
const HIST_YEARS = DATA.map(d=>d.year);
const YEARS = [...new Set([...GAMES.map(g=>g.y), ...HIST_YEARS, 2026])].sort((a,b)=>a-b);
const AWK = [["TGA","TGA"],["DICE","DICE"],["GDC","GDC"],["BAFTA","BAFTA"],["Golden Joystick","Joystick"]];
// Años en que existe cada premio (antes de 2014, «TGA» es su antecesor: los Spike Video Game Awards, 2003–2013)
const AW_FROM = {TGA:2003, DICE:1998, GDC:2000, BAFTA:2003, "Golden Joystick":2002};
const awardExists = (k,y) => y >= (AW_FROM[k]||0);
const GROUPS = ["Artesanía y dirección","Géneros","Indie, plataformas y servicio","Comunidad y extras","Esports y creadores","Honoríficos"];
const PLATS = ["PC","PS5","PS4","Xbox Series","Xbox One","Switch 2","Switch"];
const $ = id => document.getElementById(id);
const esc = s => String(s??"").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/&/g,"and").replace(/\b(the|of)\b/g,"").replace(/\bii\b/g,"2").replace(/[^a-z0-9]/g,"");
const fmtN = n => n>=1000 ? (n/1000).toFixed(n>=10000?0:1).replace(".",",")+"k" : String(n);
const fmtBL = v => v.toFixed(2).replace(".",",");
const fmtDate = iso => new Date(iso+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"});
const tr = n => MAP[n] || [n,"Comunidad y extras"];
const store = { get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v);}catch(e){return d} }, set(k,v){ try{localStorage.setItem(k,JSON.stringify(v))}catch(e){} } };

// Clasificador compartido con la página
const KIND_OVERRIDE = {"Dead Space|2023": "remaster", "Demon's Souls": "remaster", "Resident Evil 2|2019": "remaster", "Resident Evil 4|2023": "remaster", "Shadow of the Colossus|2018": "remaster", "The Legend of Zelda: Link's Awakening": "remaster", "The Legend of Zelda: Majora's Mask 3D": "remaster", "Silent Hill 2|2024": "remaster", "Paper Mario: The Thousand-Year Door": "remaster", "Tony Hawk's Pro Skater 1+2": "remaster", "Metal Gear Solid Delta: Snake Eater": "remaster", "Final Fantasy XII: The Zodiac Age": "remaster", "Final Fantasy Tactics: The Ivalice Chronicles": "remaster", "Trails in the Sky 1st Chapter": "remaster", "Trails in the Sky 2nd Chapter": "remaster", "Pokémon Alpha Sapphire": "remaster", "Pokémon Omega Ruby": "remaster", "The Last of Us Part I": "remaster", "NieR Replicant ver.1.22474487139...": "remaster", "Final Fantasy VI|2022": "remaster", "Xenoblade Chronicles: Definitive Edition": "remaster", "Xenoblade Chronicles X: Definitive Edition": "remaster", "Mass Effect Legendary Edition": "remaster", "Batman: Return to Arkham - Arkham City": "remaster", "Witch on the Holy Night": "remaster", "The Stanley Parable: Ultra Deluxe": "remaster", "Final Fantasy VII Remake|2020": "remaster", "Halo: The Master Chief Collection": "remaster", "Uncharted: The Nathan Drake Collection": "remaster", "Uncharted: Legacy of Thieves Collection": "remaster", "BioShock: The Collection": "remaster", "Resident Evil|2014": "remaster", "Bayonetta 2|2018": "port", "Red Dead Redemption|2023": "port", "Indiana Jones and the Great Circle|2025": "port", "Mario Kart 8 Deluxe": "port", "Pikmin 3 Deluxe": "port", "Ultra Street Fighter IV": "port", "Dark Souls II: Scholar of the First Sin": "port", "Guacamelee! Super Turbo Championship Edition": "port", "Tetris Effect: Connected": "port", "Hatsune Miku: Project Diva Mega Mix+": "port", "The World Ends with You: Final Remix": "port", "Zero Escape: The Nonary Games": "port", "The Walking Dead: The Telltale Definitive Series": "port", "Super Smash Bros. Ultimate": "nuevo", "Shinobi: Art of Vengeance": "nuevo", "Shadow Generations": "nuevo", "Persona 3 Reload": "remaster", "The Witcher 3: Wild Hunt - Blood and Wine": "dlc", "The Witcher 3: Wild Hunt - Hearts of Stone": "dlc", "Monster Hunter: World - Iceborne": "dlc", "Granblue Fantasy: Relink - Endless Ragnarok": "dlc"};
function kindOf(t,y){
  const o = KIND_OVERRIDE[t+'|'+y] || KIND_OVERRIDE[t]; if (o) return o;
  const s=t;
  if (/Nintendo Switch 2 Edition|Complete Edition|Definitive Edition|Game of the Year Edition|Ultimate Edition|Director's Cut|Tarnished Edition|Special Edition|Enhanced Edition|Legendary Edition|Final Cut|Intergrade|Gold Edition|Deluxe Edition|Anniversary Edition|Arcade Edition|Eternal Collection|Ultimate Evil Edition|Become as Gods|End of YoRHa|20 Year Celebration|Collection|Trilogy|Pristine Cut|Enhanced$|\bVengeance\b|Ultimate$|Royal\b|Final Mix|Plus\b|\+ /i.test(s)) return "port";
  if (/Remaster|Remake|Reload\b|Reroll|\bHD\b|\bR\b$|Resynced|Redux|Rebirth of|Retold|Reawakened/i.test(s)) return "remaster";
  if (/: (Hearts of Stone|Blood and Wine|The Old Hunters|Left Behind|Phantom Liberty|Shadow of the Erdtree|Separate Ways|Iceborne|Sunbreak|Shadowbringers|Endwalker|Legion|Warlords of Draenor|Reaper of Souls|War of the Chosen|The Final Shape|Bubbly Basin|Torna|Future Redeemed|Afterbirth\+|Specter of Torment|King of Cards|Delicious Last Course)/i.test(s) || /Shadow of the Erdtree|Phantom Liberty|Delicious Last Course/i.test(s)) return "dlc";
  return "nuevo";
}

const KIND_LBL={remaster:"Remake / remaster",port:"Port o edición",dlc:"Expansión"};
let S = Object.assign({year:2025, tab:"rank", wc:40, wp:40, wa:20, cc:88, cp:4, f:"all", pl:[], inc:{remaster:true,dlc:true,port:false}}, store.get("goty-ui",{}));
if(!S.inc||typeof S.inc!=="object") S.inc={remaster:true,dlc:true,port:false};
if (!YEARS.includes(S.year)) S.year = 2025;
if (!Array.isArray(S.pl)) S.pl = [];
const ST = {};
const FIS = {};   // id -> 'si' | 'no' (corrección manual compartida)          // id -> {estado, terminado, completo}
/* sesión: ME = yo; VIEW = id del usuario cuya colección se mira; ST = mis marcas; VST = marcas del que miro */
let ME = null, USERS = [], VIEW = null; const VST = {};
let Y26 = {meta: SNAP26.meta, games: SNAP26.games, live:false};

/* ---------- datos por año ---------- */
function allGames(){ return [...GAMES, ...Y26.games.map(g=>({...g, y:2026}))].map(g=>({...g, k:kindOf(g.t,g.y)})); }
const eligible = g => g.k==="nuevo" || S.inc[g.k] || hasAwStrict(g);
function hasAwStrict(g){ return g.y!==2026 && Object.keys(g.aw||{}).length>0; }
function byId(id){ return allGames().find(g=>g.id===id) || (CAT && CAT.games.find(g=>g.id===id)); }

/* ---------- índice ---------- */
function awPts(g){ let p=0, max=0; for(const [k] of AWK){ if(!awardExists(k,g.y)) continue; max += k==="TGA"?10:5; const s=g.aw[k]; if(!s) continue; p += k==="TGA" ? (s==="won"?10:3) : (s==="won"?5:1.5); } return max ? p/max*100 : 0; }
const BL_PRIOR=1000; const _blMean={};
function blMean(y){ if(_blMean[y]!=null) return _blMean[y]; const v=allGames().filter(g=>g.y===y&&g.bl!=null); const n=v.reduce((a,g)=>a+g.bln,0); return _blMean[y]= n? v.reduce((a,g)=>a+g.bl*g.bln,0)/n : 4; }
function blAdj(g){ if(g.bl==null) return null; const m=blMean(g.y); return (g.bln*g.bl + BL_PRIOR*m)/(g.bln+BL_PRIOR); }
function index(g){
  const parts=[]; if(g.mc!=null) parts.push([S.wc,g.mc]); if(g.bl!=null) parts.push([S.wp,blAdj(g)*20]); parts.push([S.wa,awPts(g)]);
  const w=parts.reduce((a,[x])=>a+x,0); return w? parts.reduce((a,[x,v])=>a+x*v,0)/w : 0;
}
const passes = g => g.mc!=null && g.bl!=null && g.mc>=S.cc && g.bl>=S.cp-1e-9;
const hasAw = g => Object.keys(g.aw).length>0;
const wonAny = g => Object.values(g.aw).includes("won");
const both = g => (g.mc!=null && g.bl!=null) ? (g.mc + g.bl*20)/2 : null;
/* «Tengo» de quien tiene hogar conectado lo decide la app Hogar (H: id -> [{formato, plataforma}]) */
let MYHOG = null, VHOG = null, HOGINFO = null;
function effOf(M, H, id){ const s = M[id] || {}; if(!H) return s; const casa = H[id];
  return {...s, estado: casa ? "tengo" : (s.estado==="quiero" ? "quiero" : null), casa}; }
const st = id => effOf(ST, MYHOG, id);
const ROMAN = {ii:"2",iii:"3",iv:"4",v:"5",vi:"6",vii:"7",viii:"8",ix:"9",x:"10",xi:"11",xii:"12",xiii:"13",xiv:"14",xv:"15",xvi:"16"};
const normH = t => String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/director'?s cut/g," ").replace(/[^a-z0-9]+/g," ")
  .split(" ").filter(w=>w && !["the","edition","complete","definitive","deluxe","remastered","hd","goty","ultimate","collection"].includes(w)).map(w=>ROMAN[w]||w).join(" ");
function matchHogar(items){
  if(!Array.isArray(items)) return null;
  const bySlug={}, byNorm={};
  const pool = [...allGames(), ...((CAT&&CAT.games)||[])];
  for(const g of pool){ if(g.bls) (bySlug[g.bls]=bySlug[g.bls]||[]).push(g.id); const n=normH(g.t); (byNorm[n]=byNorm[n]||new Map()).set(g.id,g); }
  // Varias fichas con el mismo título (original, remake, remaster): la copia de casa es una sola.
  // Se queda la de la misma plataforma que el objeto de Hogar y, entre ellas, la más votada en Backloggd.
  const pickOne = (m, plat) => { if(!m) return []; const gs=[...m.values()]; if(gs.length===1) return [gs[0].id];
    const P=String(plat||"").trim(), onP=gs.filter(g=>(g.pl||[]).includes(P) || (P==="Switch" && (g.pl||[]).includes("Switch 2")));
    const c=(onP.length?onP:gs).sort((a,b)=>(b.bln||0)-(a.bln||0) || (b.mcn||0)-(a.mcn||0) || (b.y||0)-(a.y||0));
    return [c[0].id]; };
  const H={}, aliasOf={};
  for(const [gid, hs] of Object.entries(HALIAS)) if(Array.isArray(hs)) hs.forEach(h=>(aliasOf[h]=aliasOf[h]||[]).push(gid));
  const gt = {}; for(const g of pool) gt[g.id]=g;
  const onPlat = (g, P) => !P || !(g.pl||[]).length || (g.pl||[]).includes(P) || (P==="Switch" && (g.pl||[]).includes("Switch 2"));
  for(const it of items){ const nt=normH(it.titulo), byT=pickOne(byNorm[nt], it.plataforma);
    let bySl = it.slug && bySlug[it.slug] ? [...new Set(bySlug[it.slug])] : null;
    if (bySl && byT.length && !bySl.some(id=>normH(gt[id].t)===nt && onPlat(gt[id], it.plataforma))) bySl = null;   // slug de Hogar que apunta a otro juego (p. ej. «Mario Kart 8» para el Deluxe)
    const ids = aliasOf[it.id] || bySl || byT;
    for(const id of ids) (H[id]=H[id]||[]).push({formato: it.formato||"Física", plataforma: it.plataforma||"", hid: it.id});
    if(!ids.length) H["casa-"+it.id] = [{formato: it.formato||"Física", plataforma: it.plataforma||"", hid: it.id, titulo: it.titulo, fuera: true}]; }
  return H;
}
const casaLabel = c => "En casa · " + [...new Set(c.map(x=>x.formato==="Digital"?"digital":"física"))].join(" y ");
const fisOf = g => FIS[g.id]==='none' ? null : (FIS[g.id] || g.fis || null);
function fisChip(g){ const v=fisOf(g), man=!!FIS[g.id];
  const lab = v==="si" ? "Edición física" : v==="no" ? "Solo digital" : "¿Edición física?";
  const tip = man ? "Marcado a mano" + (g.fsrc?` · dato automático: ${g.fsrc}`:"") : g.fsrc ? `Fuente: ${g.fsrc}` : "Sin confirmar en Wikipedia ni Wikidata";
  const cls = v==="si" ? "fis si" : v==="no" ? "fis no" : "fis";
  return ME ? `<button class="${cls}" data-fis="${g.id}" title="${esc(tip)} · toca para cambiar">${lab}${man?" ✎":""}</button>` : `<span class="${cls}" title="${esc(tip)}">${lab}</span>`; }
const onPlat = g => !S.pl.length || (g.pl||[]).some(p => S.pl.includes(p) || (S.pl.includes("Otras") && !PLATS.includes(p)));

/* ---------- piezas ---------- */
function spr(g){ if(!g||!g.sp) return ""; const [c,r,C,R]=g.sp; return `background-image:url(sprites/${g.y}.jpg);background-size:${C*100}% ${R*100}%;background-position:${C>1?c/(C-1)*100:0}% ${R>1?r/(R-1)*100:0}%`; }
function coverStyle(g){ if(g&&g.img) return `background-image:url('${g.img}');background-size:cover;background-position:center`; if(g&&!g.sp&&g.cv) return `background-image:url('https://images.igdb.com/igdb/image/upload/t_cover_small/${g.cv}.jpg');background-size:cover;background-position:center`; if(g&&!g.sp&&g.mcimg) return `background-image:url('https://www.metacritic.com/a/img/catalog${g.mcimg}');background-size:cover;background-position:center`; return spr(g); }
function thumb(g, cls="thumb"){ const s=coverStyle(g); return s ? `<div class="${cls}" role="img" aria-label="Carátula de ${esc(g.t)}" style="${s}"></div>` : `<div class="${cls}">${esc(((g&&g.t)||"?")[0])}</div>`; }
function pips(g){ const lab26 = g.y===2026 ? (Y26.meta.awardLabels||{}) : {};
  return `<span class="pips">${AWK.filter(([k])=>awardExists(k,g.y)).map(([k,lab0])=>{ const lab = k==="TGA" && g.y<2014 ? "VGA" : lab0; k = k==="TGA" && g.y<2014 ? "Spike VGA" : k; const s=g.aw[k==="Spike VGA"?"TGA":k]||""; const tip= lab26[k] && s ? lab26[k] : s==="won"?`Ganó: ${k}`:s==="nom"?`Nominado: ${k}`:`Sin nominación en ${k}`; return `<span class="pip ${s}" title="${esc(tip)}">${lab}</span>`; }).join("")}</span>`; }
function scores(g){
  const c = g.mc!=null ? `<span class="sc c${g.mc>=S.cc?" pass":""}" title="Metacritic${g.mcn?` · ${g.mcn} críticas`:""}">MC ${g.mc}</span>` : `<span class="sc na" title="Sin nota en Metacritic">MC —</span>`;
  const p = g.bl!=null ? `<span class="sc p${g.bl>=S.cp-1e-9?" pass":""}" title="Backloggd · ${g.bln} votos · en el índice cuenta como ${fmtBL(blAdj(g))} (ajustada por número de votos)">BL ${fmtBL(g.bl)} <span style="opacity:.75">· ${fmtN(g.bln)}</span></span>` : `<span class="sc na" title="Sin nota en Backloggd">BL —</span>`;
  return c+p;
}
function plats(g){ if(!g.pl||!g.pl.length) return ""; return `<span class="plats">${g.pl.map(p=>S.pl.includes(p)?`<b>${esc(p)}</b>`:esc(p)).join(" · ")}</span>`; }
function link(g){ const u = g.bls?`https://backloggd.com/games/${g.bls}/`: g.mcs?`https://www.metacritic.com/game/${g.mcs}/`:null; return u?`<a href="${u}" target="_blank" rel="noopener">${esc(g.t)}</a>`:esc(g.t); }
const VIA = {aw:"premios",mc:"top Metacritic",bl:"top Backloggd"};
function ownBtns(g){ if(!ME) return ""; const s=st(g.id);
  const tengo = MYHOG ? (s.casa ? `<span class="casa" title="${esc(s.casa.map(x=>x.plataforma+" · "+x.formato).join(", "))} (dato de Hogar)">${casaLabel(s.casa)}</span>` : "")
    : `<button data-own="tengo" data-id="${g.id}" aria-pressed="${s.estado==="tengo"}">Tengo</button>`;
  return `<div class="own">
    ${tengo}
    <button data-own="quiero" data-id="${g.id}" aria-pressed="${s.estado==="quiero"}">Quiero</button>
    <button data-own="terminado" data-id="${g.id}" aria-pressed="${!!s.terminado}">Terminado</button>
    <button data-own="completo" data-id="${g.id}" aria-pressed="${!!s.completo}">100%</button>
    <button data-own="jugando" data-id="${g.id}" aria-pressed="${s.progreso==="jugando"}">Jugando</button>
    <button data-own="abandonado" data-id="${g.id}" aria-pressed="${s.progreso==="abandonado"}">Abandonado</button></div>`; }

/* ---------- ranking ---------- */
function yearGames(y){ return allGames().filter(g=>g.y===y && eligible(g)).map(g=>({...g, ix:index(g)})).sort((a,b)=>b.ix-a.ix); }
function filt(g){
  const s=st(g.id);
  switch(S.f){ case "cut": return passes(g); case "aw": return hasAw(g);
    case "tengo": return s.estado==="tengo"; case "quiero": return s.estado==="quiero";
    case "fis": return fisOf(g)==="si";
    case "jugando": return s.progreso==="jugando";
    case "pend": return s.estado==="tengo" && !s.terminado; case "terminado": return !!s.terminado; case "completo": return !!s.completo; }
  return true;
}

function renderBanner26(){
  const b=$("banner26"); if(S.year!==2026){ b.hidden=true; return; }
  const m=Y26.meta||{}; b.hidden=false;
  const up=(m.upcoming||[]).map(u=>`<li><strong>${esc(u.t)}</strong> · ${u.date?fmtDate(u.date):"sin fecha"}${u.note?` — ${esc(u.note)}`:""}</li>`).join("");
  b.innerHTML = `<div class="eyebrow">2026 en curso</div>
    <ul>${(m.notes||[]).map(n=>`<li>${esc(n)}</li>`).join("")}</ul>
    ${up?`<div><strong style="font-size:13px">Por salir antes de la gala</strong><ul>${up}</ul></div>`:""}
    <div class="upd">Datos del ${m.updated?fmtDate(m.updated):"—"} · se actualiza cada lunes</div>`;
}

function renderRank(){
  renderBanner26();
  const all = yearGames(S.year);
  if (!all.length){ $("podium").innerHTML=`<p class="empty">Aún no hay candidatos cargados para ${S.year}.</p>`; $("rank").innerHTML=""; $("scatter").innerHTML=""; $("forgot").innerHTML=""; $("over").innerHTML=""; return; }
  const d = DATA.find(x=>x.year===S.year);
  const tga = d ? d.categories[0].winner : null;
  const tgaG = all.find(g=>g.aw.TGA==="won");
  const top = all[0];
  const tgaPos = tgaG ? all.indexOf(tgaG)+1 : null;
  const verdict = !d ? `The Game Awards 2026 se celebra el 10 de diciembre; este es el favorito con los datos de hoy.`
    : (tgaG && top===tgaG) ? `Coincide con el Juego del Año de The Game Awards.` : `The Game Awards eligió <strong>${esc(tga)}</strong>${tgaPos?`, que queda <strong>${tgaPos}º</strong> con estos pesos`:""}.`;
  $("podium").innerHTML = `<div class="podium">
    <div class="cv" role="img" aria-label="Carátula de ${esc(top.t)}" style="${coverStyle(top)}"></div>
    <div class="body">
      <div class="eyebrow">Nº 1 por consenso · ${S.year}${S.year===2026?" (provisional)":""}</div>
      <h2>${esc(top.t)}</h2>
      <div class="statrow">
        <div class="stat"><b>${top.ix.toFixed(1).replace(".",",")}</b><span>Índice</span></div>
        <div class="stat"><b style="color:var(--crit)">${top.mc??"—"}</b><span>Metacritic</span></div>
        <div class="stat"><b style="color:var(--play)">${top.bl!=null?fmtBL(top.bl):"—"}</b><span>Backloggd</span></div>
        <div class="stat"><b>${Object.values(top.aw).filter(x=>x==="won").length}</b><span>Premios gordos</span></div>
      </div>
      <div class="verdict">${verdict} ${all.length} candidatos; ${all.filter(passes).length} superan ambos cortes.</div>
      <div>${pips(top)}</div>${top.pl?`<div>${plats(top)}</div>`:""}
    </div></div>`;

  const list = all.filter(g=>filt(g) && onPlat(g));
  $("rank").innerHTML = list.length ? list.map(g=>{
    const r = all.indexOf(g)+1;
    return `<div class="row${r<=3?" top":""}" id="g-${g.id}">
      <div class="n">${r}</div>${thumb(g)}
      <div class="info"><div class="t">${link(g)}</div>
        <div class="meta">${scores(g)} ${pips(g)}</div>
        ${plats(g)}
        <div class="meta">${fisChip(g)}${g.k!=="nuevo"?`<span class="pip nom">${KIND_LBL[g.k]}</span>`:""}</div>
        <div class="via">Entra por: ${g.via.map(v=>VIA[v]).join(" · ")}${g.date&&g.y===2026?` · salió el ${fmtDate(g.date)}`:""}</div></div>
      <div class="right"><div class="idx">${g.ix.toFixed(1).replace(".",",")}</div><div class="bar"><i style="width:${Math.max(0,Math.min(100,g.ix))}%"></i></div>${ownBtns(g)}</div>
    </div>`; }).join("") : `<p class="empty">Ningún juego de ${S.year} cumple este filtro${S.pl.length?" en las plataformas elegidas":""}. Prueba a quitar filtros o bajar las notas de corte.</p>`;

  scatter(all.filter(onPlat));
  const sc = all.filter(g=>both(g)!=null).map(both).sort((a,b)=>a-b);
  const q75 = sc[Math.floor(sc.length*0.7)] ?? 0, med = sc[Math.floor(sc.length/2)] ?? 0;
  const forgot = all.filter(g=>!hasAw(g) && both(g)!=null && both(g)>=q75 && onPlat(g)).sort((a,b)=>both(b)-both(a)).slice(0,6);
  const over = all.filter(g=>wonAny(g) && both(g)!=null && both(g)<med && onPlat(g)).sort((a,b)=>both(a)-both(b)).slice(0,6);
  $("forgot").innerHTML = mini(forgot);
  $("over").innerHTML = mini(over, S.year===2026 ? "Sin ganadores todavía en 2026." : "Ninguno este año.");
}
function mini(arr, emptyMsg="Ninguno este año."){ return arr.length ? arr.map(g=>`<li><button data-jump="${g.id}">${esc(g.t)}</button><span class="sc c" style="border:none;padding:0">${g.mc??"—"}</span><span class="sc p" style="border:none;padding:0">${g.bl!=null?fmtBL(g.bl):"—"}</span></li>`).join("") : `<li class="empty">${emptyMsg}</li>`; }

function scatter(all){
  const pts = all.filter(g=>g.mc!=null && g.bl!=null);
  if (!pts.length){ $("scatter").innerHTML=`<p class="empty">Sin juegos con ambas notas.</p>`; return; }
  const W=360,H=300,L=34,R=10,T=10,B=28;
  const xs=pts.map(g=>g.mc), ys=pts.map(g=>g.bl);
  const x0=Math.min(78,...xs)-1, x1=Math.max(...xs,96)+1, y0=Math.min(3.6,...ys)-.05, y1=Math.min(5,Math.max(...ys,4.6)+.05);
  const X=v=>L+(v-x0)/(x1-x0)*(W-L-R), Y=v=>H-B-(v-y0)/(y1-y0)*(H-T-B);
  let g=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Metacritic frente a Backloggd, ${S.year}">`;
  for(let v=Math.ceil(x0/5)*5; v<=x1; v+=5) g+=`<line class="ax" x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H-B}"/><text x="${X(v)}" y="${H-B+14}" text-anchor="middle">${v}</text>`;
  for(let v=Math.ceil(y0*4)/4; v<=y1+1e-9; v+=.25) g+=`<line class="ax" x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L-5}" y="${Y(v)+3}" text-anchor="end">${v.toFixed(2).replace(".",",")}</text>`;
  g+=`<text x="${W-R}" y="${H-3}" text-anchor="end">Metacritic →</text><text x="${L}" y="${T-1}" text-anchor="start" style="fill:var(--play)">↑ Backloggd</text>`;
  if (S.cc>=x0 && S.cc<=x1) g+=`<line class="cut" x1="${X(S.cc)}" x2="${X(S.cc)}" y1="${T}" y2="${H-B}"/>`;
  if (S.cp>=y0 && S.cp<=y1) g+=`<line class="cut" x1="${L}" x2="${W-R}" y1="${Y(S.cp)}" y2="${Y(S.cp)}"/>`;
  const order = [...pts].sort((a,b)=>(a.aw.TGA==="won")-(b.aw.TGA==="won") || wonAny(a)-wonAny(b));
  for(const p of order){
    const tw=p.aw.TGA==="won", w=wonAny(p), n=hasAw(p);
    const fill = tw?"var(--gold)": w?"var(--fg)":"var(--surface)", stroke = tw||w?"var(--surface)": n?"var(--fg)":"var(--faint)";
    g+=`<circle cx="${X(p.mc)}" cy="${Y(p.bl)}" r="${tw?7:5.5}" fill="${fill}" stroke="${stroke}" stroke-width="2" data-id="${p.id}" style="cursor:pointer"/>`;
  }
  const lab = all.slice(0,3).filter(p=>p.mc!=null&&p.bl!=null);
  for(const p of lab){ const right = X(p.mc) < W-110; g+=`<text class="lbl" x="${X(p.mc)+(right?9:-9)}" y="${Y(p.bl)+3.5}" text-anchor="${right?"start":"end"}">${esc(p.t.length>24?p.t.slice(0,22)+"…":p.t)}</text>`; }
  $("scatter").innerHTML = g+`</svg>`;
}

/* ---------- colección ---------- */
function viewSel(){
  if(!ME) return "";
  const others = USERS.filter(u=>u.id!==ME.id);
  const opts = [`<option value="${ME.id}"${VIEW===ME.id?" selected":""}>Mi colección (${esc(ME.name)})</option>`, ...others.map(u=>`<option value="${u.id}"${u.id===VIEW?" selected":""}>${esc(u.name)} · ${u.n} marcados</option>`)].join("");
  return `<div class="viewbar">
    <label>Ver colección de <select id="viewSel">${opts}</select></label>
    <label class="me">Tu nombre <input id="meName" value="${esc(ME.name)}" maxlength="40" autocomplete="nickname"></label>
    <label class="me chk"><input type="checkbox" id="meShared" ${ME.shared?"checked":""}> Los demás pueden ver mi colección</label>
  </div>`;
}
function compareBlock(m, t, name){
  const G0 = allGames().map(g=>({...g, ix:index(g)})), seen = new Set(G0.map(g=>g.id));
  const G = [...G0, ...((CAT&&CAT.games)||[]).filter(g=>!seen.has(g.id)).map(g=>({...g, ix:g.ix??0}))];
  const casaT = {}; for (const H of [MYHOG, VHOG]) for (const [id,a] of Object.entries(H||{})) if (id.startsWith("casa-")) casaT[id]=(a[0]&&a[0].titulo)||"Juego de casa";
  for (const id of new Set([...Object.keys(ST), ...Object.keys(VST)])) if (id.startsWith("casa-") && !casaT[id]) casaT[id]="Juego de casa";
  for (const [id,t] of Object.entries(casaT)) G.push({id, t, y:null, ix:0, casa:true});
  const L = f => G.filter(g=>f(g.id)).sort((a,b)=>b.ix-a.ix);
  const both = L(id=>m(id).terminado && t(id).terminado);
  const onlyMe = L(id=>m(id).terminado && !t(id).terminado);
  const onlyThem = L(id=>t(id).terminado && !m(id).terminado);
  const swap = L(id=>t(id).terminado && m(id).estado==="tengo" && !m(id).terminado);
  const li = arr => arr.length ? `<ul class="mini">${arr.slice(0,40).map(g=>{ const lab=`${esc(g.t)}${g.y?` <span class="muted">(${g.y})</span>`:` <span class="muted">(fuera del catálogo)</span>`}`;
      return `<li>${seen.has(g.id)?`<button data-goto="${g.id}">${lab}</button>`:`<span>${lab}</span>`}<span class="idx" style="font-size:18px">${g.ix?g.ix.toFixed(1).replace(".",","):"—"}</span></li>`; }).join("")}${arr.length>40?`<li class="muted">y ${arr.length-40} más</li>`:""}</ul>` : `<p class="empty">Ninguno.</p>`;
  return `<div class="card"><h3>Tú frente a ${esc(name)}</h3>
    <div class="kpis" style="margin:8px 0 14px">
      <div class="kpi"><b style="color:var(--crit)">${both.length}</b><span>Terminados por los dos</span></div>
      <div class="kpi"><b>${onlyMe.length}</b><span>Solo tú</span></div>
      <div class="kpi"><b>${onlyThem.length}</b><span>Solo ${esc(name)}</span></div>
    </div>
    <div class="cmpgrid">
      <div><h4>Lo ha terminado ${esc(name)} y tú lo tienes pendiente</h4>${li(swap)}</div>
      <div><h4>Solo ${esc(name)}</h4>${li(onlyThem)}</div>
      <div><h4>Solo tú</h4>${li(onlyMe)}</div>
      <div><h4>Los dos</h4>${li(both)}</div>
    </div></div>`;
}
function casaCard(st, H, own){
  const fuera = Object.entries(H||{}).filter(([id])=>id.startsWith("casa-")).map(([id,v])=>({id, ...v[0], s: st(id)}));
  if(!fuera.length) return "";
  fuera.sort((a,b)=> (b.s.terminado?1:0)-(a.s.terminado?1:0) || a.titulo.localeCompare(b.titulo,"es"));
  const done = fuera.filter(x=>x.s.terminado).length;
  const row = x => `<li class="casa-row"><span>${esc(x.titulo)} <span class="muted">· ${esc(x.plataforma)}${x.formato==="Digital"?" · digital":""}</span></span>${own ? `<span class="own">
      <button data-own="terminado" data-id="${x.id}" aria-pressed="${!!x.s.terminado}">Terminado</button>
      <button data-own="completo" data-id="${x.id}" aria-pressed="${!!x.s.completo}">100%</button>
      <button data-own="jugando" data-id="${x.id}" aria-pressed="${x.s.progreso==="jugando"}">Jugando</button></span>` : (x.s.terminado ? `<span class="muted">${x.s.completo?"100 %":"terminado"}</span>` : "")}</li>`;
  return `<div class="card"><h3>Juegos de casa fuera del catálogo</h3><p>${fuera.length} juegos que hay en casa pero no son candidatos de ningún año (${done} terminados). Su progreso también se guarda aquí y se manda a Hogar.</p>
    <details${done?" open":""}><summary>Ver lista</summary><ul class="mini casa-list">${fuera.map(row).join("")}</ul></details></div>`;
}
function hogarCard(){
  if(!HOGINFO) return "";
  if(!HOGINFO.conectado) return `<div class="card"><h3>Hogar</h3><p>Tu colección está ligada a «${esc(HOGINFO.nombre)}», pero la conexión con la app Hogar aún no está activa: «Tengo» no se puede leer de casa.</p></div>`;
  if(HOGINFO.juegos && HOGINFO.juegos.error) return `<div class="card"><h3>Hogar</h3><p>No se pudo leer qué hay en casa (${esc(HOGINFO.juegos.error)}).</p></div>`;
  const n = Array.isArray(HOGINFO.juegos) ? HOGINFO.juegos.length : 0, m = Object.keys(MYHOG||{}).filter(k=>!k.startsWith("casa-")).length, sy = HOGINFO.sync;
  const sp = sy && sy.sin_pareja && sy.sin_pareja.length ? `<details><summary>${sy.sin_pareja.length} títulos de mis listas sin pareja en Hogar</summary><p class="muted" style="font-size:13px">${sy.sin_pareja.map(esc).join(" · ")}</p></details>` : "";
  return `<div class="card"><h3>Hogar · ${esc(HOGINFO.nombre)}</h3>
    <p>${n} juegos en casa según Hogar; ${m} juegos de este catálogo salen como «En casa». Terminado, 100 %, Jugando, Abandonado y Quiero se mandan a Hogar al momento.${sy?` Notas sincronizadas el ${new Date(sy.fecha).toLocaleDateString("es-ES")}.`:""}</p>${sp}</div>`;
}
function renderCol(){
  const out=$("colOut");
  if(!ME){ out.innerHTML=`<p class="empty">No se ha podido identificar tu sesión, así que la colección no está disponible. Recarga la página; si sigue igual, vuelve a entrar con tu correo.</p>`; return; }
  const own = VIEW===ME.id; const ST_ = own ? ST : VST; const H_ = own ? MYHOG : VHOG; const st = id => effOf(ST_, H_, id);
  const who = own ? null : (USERS.find(u=>u.id===VIEW)||{name:"?"}).name;
  $("colTitle").textContent = own ? "Mi colección" : "Colección de " + who;
  const G = allGames().map(g=>({...g, ix:index(g)}));               // candidatos anuales (gráfico por año)
  // Para los totales cuenta todo lo marcado o en casa: candidatos + resto del catálogo + juegos de casa fuera del catálogo
  const seen = new Set(G.map(g=>g.id));
  const GA = [...G, ...((CAT&&CAT.games)||[]).filter(g=>!seen.has(g.id)).map(g=>({...g, ix:g.ix??0, cat:true}))];
  for (const [id,arr] of Object.entries(H_||{})) if (id.startsWith("casa-")) GA.push({id, t:(arr[0]&&arr[0].titulo)||"Juego de casa", y:null, ix:0, pl:[...new Set(arr.map(x=>x.plataforma).filter(Boolean))], casa:true});
  for (const id of Object.keys(ST_)) if (id.startsWith("casa-") && !GA.some(g=>g.id===id)) GA.push({id, t:"Juego de casa", y:null, ix:0, pl:[], casa:true});
  const ids = [...new Set([...Object.keys(ST_), ...Object.keys(H_||{})])].filter(id=>byId(id) || id.startsWith("casa-"));
  const jugando = GA.filter(g=>st(g.id).progreso==="jugando").sort((a,b)=>b.ix-a.ix);
  const pick = f => GA.filter(g=>f(st(g.id)));
  const tengo=pick(s=>s.estado==="tengo"), quiero=pick(s=>s.estado==="quiero"), term=pick(s=>s.terminado), comp=pick(s=>s.completo);
  const pend = tengo.filter(g=>!st(g.id).terminado).sort((a,b)=>b.ix-a.ix);
  if(!ids.length){ out.innerHTML= viewSel() + (own ? `<p class="empty">Todavía no hay nada marcado. En el ranking, cada juego tiene botones Tengo, Quiero, Terminado y 100%.</p>` : `<p class="empty">${esc(who)} todavía no ha marcado nada.</p>`); return; }
  const pct = (a,b)=> b? Math.round(a/b*100)+"%" : "—";
  const avg = (arr,f)=>{ const v=arr.map(f).filter(x=>x!=null); return v.length? v.reduce((a,b)=>a+b,0)/v.length : null; };
  const kpis = `<div class="kpis">
    <div class="kpi"><b>${tengo.length}</b><span>${H_?"En casa (Hogar)":"Tengo"}</span></div>
    <div class="kpi"><b>${quiero.length}</b><span>Quiero</span></div>
    <div class="kpi"><b>${jugando.length}</b><span>Jugando</span></div>
    <div class="kpi"><b style="color:var(--crit)">${term.length}</b><span>Terminados</span></div>
    <div class="kpi"><b style="color:var(--gold)">${comp.length}</b><span>Al 100%</span></div>
    <div class="kpi"><b>${pct(tengo.filter(g=>st(g.id).terminado).length, tengo.length)}</b><span>De lo que tengo, terminado</span></div>
    <div class="kpi"><b>${pct(comp.length, term.length)}</b><span>De lo terminado, al 100%</span></div>
  </div>`;
  // por año
  const rows = YEARS.slice().reverse().map(y=>{
    const ys=G.filter(g=>g.y===y).sort((a,b)=>b.ix-a.ix); const top10=ys.slice(0,10).map(g=>g.id);
    const t=ys.filter(g=>st(g.id).terminado).length, c=ys.filter(g=>st(g.id).completo).length, o=ys.filter(g=>st(g.id).estado==="tengo").length;
    const t10=top10.filter(id=>st(id).terminado).length;
    return {y,n:ys.length,t,c,o,t10};
  });
  const maxN=Math.max(...rows.map(r=>r.n),1);
  const bars = `<div class="ybars">${rows.map(r=>`<div class="ybar" title="${r.y}: ${r.t} terminados, ${r.c} al 100%, ${r.o} en la estantería, de ${r.n} candidatos">
      <span class="y">${r.y}</span>
      <span class="track"><i style="width:${r.n/maxN*100}%;background:var(--surface);border:1px solid var(--line)"></i><i style="width:${r.t/maxN*100}%;background:var(--crit)"></i><i style="width:${r.c/maxN*100}%;background:var(--gold)"></i></span>
      <span class="n">${r.t} / ${r.n} · top10 ${r.t10}</span></div>`).join("")}</div>
    <div class="legend"><span><i style="background:var(--crit)"></i>Terminados</span><span><i style="background:var(--gold)"></i>Al 100%</span><span><i style="border:1px solid var(--line)"></i>Candidatos del año</span><span>“top10” = cuántos del top 10 de consenso has terminado</span></div>`;
  // plataformas
  const pc={}; term.forEach(g=>(g.pl||[]).forEach(p=>pc[p]=(pc[p]||0)+1));
  const ptab = Object.keys(pc).length ? `<table class="ptable"><thead><tr><th>Plataforma</th><th style="text-align:right">Terminados disponibles</th></tr></thead><tbody>${Object.entries(pc).sort((a,b)=>b[1]-a[1]).map(([p,n])=>`<tr><td>${esc(p)}</td><td class="n">${n}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">Marca juegos como terminados para ver el reparto por plataforma.</p>`;
  const qual = `<div class="tw"><table class="ptable"><thead><tr><th>Grupo</th><th style="text-align:right">Juegos</th><th style="text-align:right">Metacritic</th><th style="text-align:right">Backloggd</th><th style="text-align:right">Índice</th></tr></thead><tbody>${
    [["Terminados",term],["Al 100%",comp],["Tengo sin terminar",pend],["Quiero",quiero]].map(([n,a])=>`<tr><td>${n}</td><td class="n">${a.length}</td><td class="n">${avg(a,g=>g.mc)?.toFixed(1).replace(".",",")??"—"}</td><td class="n">${(v=>v!=null?fmtBL(v):"—")(avg(a,g=>g.bl))}</td><td class="n">${avg(a,g=>g.ix)?.toFixed(1).replace(".",",")??"—"}</td></tr>`).join("")}</tbody></table></div>`;
  const li = arr => arr.length ? `<ul class="mini">${arr.map(g=>{ const lab=`${esc(g.t)}${g.y?` <span class="muted">(${g.y})</span>`:g.casa?` <span class="muted">(fuera del catálogo)</span>`:""}`;
      return `<li>${seen.has(g.id)?`<button data-goto="${g.id}">${lab}</button>`:`<span>${lab}</span>`}<span class="idx" style="font-size:18px">${g.ix?g.ix.toFixed(1).replace(".",","):"—"}</span></li>`; }).join("")}</ul>` : `<p class="empty">Nada aquí todavía.</p>`;
  out.innerHTML = `${viewSel()}${kpis}${own?"":compareBlock(id=>effOf(ST,MYHOG,id), id=>effOf(VST,VHOG,id), who)}${own?hogarCard():""}${casaCard(st, H_, own)}
    <div class="statgrid">
      <div class="card"><h3>Por año</h3>${bars}</div>
      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="card"><h3>Nota media de cada grupo</h3>${qual}</div>
        <div class="card"><h3>Plataformas</h3><p>En qué plataformas están disponibles los juegos terminados.</p>${ptab}</div>
      </div>
    </div>
    <div class="statgrid">
      <div class="card"><h3>Pendientes por prioridad</h3><p>Lo que está en la estantería sin terminar, ordenado por el índice de consenso con tus pesos.</p>${li(pend)}</div>
      <div style="display:flex;flex-direction:column;gap:20px">
        ${jugando.length?`<div class="card"><h3>Jugando</h3>${li(jugando)}</div>`:""}
        <div class="card"><h3>Al 100%</h3>${li(comp.sort((a,b)=>b.ix-a.ix))}</div>
        <div class="card"><h3>Quiero</h3>${li(quiero.sort((a,b)=>b.ix-a.ix))}</div>
      </div>
    </div>`;
}

/* ---------- TGA ---------- */
const byTitle = {}; GAMES.forEach(g=>{ (byTitle[g.y+"|"+norm(g.t)] ||= g); (g.alias||[]).forEach(a=>byTitle[g.y+"|"+norm(a)] ||= g); });
const findG = (y,t) => byTitle[y+"|"+norm(t)] || null;
function sMini(g){ return g ? `<span style="display:inline-flex;gap:4px">${g.mc!=null?`<span class="sc c" style="border:none;padding:0">${g.mc}</span>`:""}${g.bl!=null?`<span class="sc p" style="border:none;padding:0">${fmtBL(g.bl)}</span>`:""}</span>` : ""; }
function renderTGA(){
  const yr = HIST_YEARS.includes(S.year) ? S.year : 2025;
  $("wall").innerHTML = [...DATA].reverse().map(d=>{ const c=d.categories[0]; const g=findG(d.year,c.winner);
    return `<button class="goty${d.year===yr?" sel":""}" data-y="${d.year}"><div class="top">${thumb(g||{t:c.winner})}<div><div class="yr">${d.year}</div><div class="win">${esc(c.winner)}</div>${sMini(g)}</div></div>
      <ul>${c.nominees.map(n=>`<li><span>${esc(n)}</span>${sMini(findG(d.year,n))}</li>`).join("")}</ul></button>`; }).join("");
  const q=$("q").value.trim().toLowerCase();
  if (q.length>=2) return tgaSearch(q);
  const d=DATA.find(x=>x.year===yr); const byG={};
  d.categories.slice(1).forEach(c=>{ const [es,grp]=tr(c.name); (byG[grp] ||= []).push({...c,es}); });
  $("tgaYearLbl").textContent = `Gala ${d.year} · ${fmtDate(d.date)}${d.venue?" · "+d.venue:""} · más premiado: ${d.mostWins.game} (${d.mostWins.count})`;
  $("tgaOut").innerHTML = GROUPS.filter(k=>byG[k]).map(k=>`<div class="group"><h3>${k}</h3><div class="cats">${byG[k].map(c=>`<div class="cat"><div class="n">${esc(c.es)}</div><div class="w">${esc(c.winner)}</div>${c.nominees.length?`<ul>${c.nominees.map(n=>`<li>${esc(n)}</li>`).join("")}</ul>`:""}</div>`).join("")}</div></div>`).join("");
}
function hl(s,q){ const i=s.toLowerCase().indexOf(q); return i<0?esc(s):esc(s.slice(0,i))+"<mark>"+esc(s.slice(i,i+q.length))+"</mark>"+esc(s.slice(i+q.length)); }
function tgaSearch(q){
  const rows=[]; DATA.forEach(d=>d.categories.forEach((c,i)=>{ const cat=i===0?"Juego del Año":tr(c.name)[0];
    if(c.winner.toLowerCase().includes(q)) rows.push({y:d.year,cat,who:c.winner,win:1});
    c.nominees.forEach(n=>{ if(n.toLowerCase().includes(q)) rows.push({y:d.year,cat,who:n,win:0}); }); }));
  rows.sort((a,b)=>b.y-a.y||b.win-a.win);
  $("tgaYearLbl").textContent = `${rows.length} nominaciones · ${rows.filter(r=>r.win).length} premios`;
  $("tgaOut").innerHTML = rows.length ? `<div style="display:flex;flex-direction:column;gap:6px">${rows.map(r=>`<div class="res"><span class="y">${r.y}</span><span><strong>${esc(r.cat)}</strong> ${r.win?`<span class="pip won">GANADOR</span>`:`<span class="pip nom">nominado</span>`}<br>${hl(r.who,q)}</span></div>`).join("")}</div>` : `<p class="empty">Nada coincide con “${esc(q)}”. Prueba con parte del título, por ejemplo “zelda” o “souls”.</p>`;
}

/* ---------- comparativa ---------- */
function renderCmp(){
  const cols=[["DICE"],["GDC"],["BAFTA"],["Golden Joystick"]];
  const head=`<tr><th>Año</th><th>TGA / VGA</th>${cols.map(([k])=>`<th>${k}</th>`).join("")}<th>Nº1 Metacritic</th><th>Nº1 Backloggd</th><th>Coinciden</th></tr>`;
  const years = YEARS.filter(y=>y<2026 && (DATA.some(d=>d.year===y) || OTHER[y])).reverse();
  const rows=years.map(year=>{ const d=DATA.find(x=>x.year===year), o=OTHER[year]||{};
    const w = d ? d.categories[0].winner : (o.VGA ? o.VGA.winner : (o.DICE ? o.DICE.winner : null)); let c=0, n=0;
    const cell = name => { n++; const s=w && norm(name)===norm(w); if(s)c++; return `<td class="${s?"same":""}">${esc(name)}</td>`; };
    const ys=allGames().filter(g=>g.y===year && (g.k==="nuevo"||g.k==="remaster"||g.k==="dlc"));
    const mcTop=[...ys].filter(g=>g.mc!=null && g.via.includes("mc")).sort((a,b)=>b.mc-a.mc||(b.mcn||0)-(a.mcn||0))[0];
    const blTop=[...ys].filter(g=>g.bl!=null && g.via.includes("bl")).sort((a,b)=>b.bl-a.bl)[0];
    const tg=w?findG(year,w):null; const sameG = g => g && tg && g.id===tg.id;
    const extra = (g,isMc) => { n++; if(sameG(g)) c++; return g?`<td class="${sameG(g)?"same":""}">${esc(g.t)} <span style="font-family:var(--mono);font-size:11px;color:var(--muted)">${isMc?g.mc:fmtBL(g.bl)}</span></td>`:`<td class="k">—</td>`; };
    const first = d||o.VGA ? `<td><strong>${esc(w)}</strong>${!d?` <span class="muted" style="font-size:11px">VGA</span>`:""}</td>` : `<td class="k">—</td>`;
    return `<tr><td class="y">${year}</td>${first}${cols.map(([k])=>o[k]?cell(o[k].winner):`<td class="k">—</td>`).join("")}${extra(mcTop,true)}${extra(blTop,false)}<td class="k">${c} de ${n}</td></tr>`; }).join("");
  $("cmpT").innerHTML=`<thead>${head}</thead><tbody>${rows}</tbody>`;
}


/* ---------- catálogo de todos los tiempos ---------- */
let CAT = null, CAT_LOADING = false;
const CATDEF = {q:"", sort:"ix", dec:"", gen:"", pl:"", min:0, f:"all", n:100};
if(!S.cat || typeof S.cat!=="object") S.cat = {...CATDEF};
// Un juego de casa marcado cuando estaba fuera del catálogo (id «casa-<n>») que ahora ya tiene ficha:
// la marca pasa a la ficha, para que no quede huérfana cuando el catálogo crece.
const hidsOf = id => MYHOG && MYHOG[id] ? [...new Set(MYHOG[id].map(e=>e.hid))] : null;
async function healCasa(){
  if (!ME || !MYHOG) return;
  for (const id of Object.keys(ST).filter(k=>k.startsWith("casa-"))){
    const hid = +id.slice(5); if (MYHOG[id]) continue;
    const to = Object.keys(MYHOG).find(k=>!k.startsWith("casa-") && MYHOG[k].some(e=>e.hid===hid));
    if (!to || ST[to]) continue;
    const m = ST[id], body = s => JSON.stringify({estado:s.estado||null, terminado:!!s.terminado, completo:!!s.completo, progreso:s.progreso||null});
    const gg = byId(to);
    try { await api("marks/"+encodeURIComponent(to), {method:"PUT", body:JSON.stringify({...JSON.parse(body(m)), t:gg&&gg.t, s:gg&&gg.bls, h:hidsOf(to)})});
          await api("marks/"+encodeURIComponent(id), {method:"PUT", body:body({})});
          ST[to] = m; delete ST[id]; } catch(e){ console.warn("No se pudo mover", id, e.message); }
  }
}
async function loadCat(){
  if (CAT || CAT_LOADING) return; CAT_LOADING = true;
  try { CAT = await getJSON("data/catalogo.json");
    if (HOGINFO && Array.isArray(HOGINFO.juegos)) { MYHOG = matchHogar(HOGINFO.juegos); await healCasa(); }
    if (ME && VIEW!=null && VIEW!==ME.id) await loadView(VIEW, false); }
  catch(e){ CAT = {games:[], error:String(e.message||e)}; }
  CAT_LOADING = false; render();
}
const catCover = g => g.cv ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${g.cv}.jpg` : (g.mcimg ? `https://www.metacritic.com/a/img/catalog${g.mcimg}` : "");
function catFilter(){
  const c = S.cat, q = normH(c.q);
  return CAT.games.filter(g=>{
    if (q && !normH(g.t).includes(q)) return false;
    if (c.dec && String(Math.floor((g.y||0)/10)*10) !== c.dec) return false;
    if (c.gen && !(g.gen||[]).includes(c.gen)) return false;
    if (c.pl && !(g.pl||[]).includes(c.pl)) return false;
    if (c.min && !((g.bln||0) >= c.min)) return false;
    const s = st(g.id);
    switch(c.f){ case "casa": return !!s.casa; case "nocasa": return !s.casa; case "term": return !!s.terminado;
      case "pend": return !!s.casa && !s.terminado; case "quiero": return s.estado==="quiero"; case "mp": return !!g.mp; }
    return true;
  }).sort((a,b)=> c.sort==="mc" ? (b.mc??-1)-(a.mc??-1) : c.sort==="bl" ? (b.bla??-1)-(a.bla??-1) : c.sort==="y" ? (b.y||0)-(a.y||0) || b.ix-a.ix : b.ix-a.ix);
}
function renderCat(){
  const out = $("catOut");
  if (!CAT){ out.innerHTML = `<p class="empty">Cargando catálogo…</p>`; loadCat(); return; }
  if (CAT.error){ out.innerHTML = `<p class="empty">No se pudo cargar el catálogo (${esc(CAT.error)}).</p>`; return; }
  const c = S.cat, opt = (v,l,cur)=>`<option value="${esc(v)}"${String(cur)===String(v)?" selected":""}>${esc(l)}</option>`;
  const decs = [...new Set(CAT.games.map(g=>Math.floor((g.y||0)/10)*10))].filter(Boolean).sort((a,b)=>b-a);
  const gens = Object.entries(CAT.games.flatMap(g=>g.gen||[]).reduce((m,x)=>(m[x]=(m[x]||0)+1,m),{})).sort((a,b)=>b[1]-a[1]).map(([x])=>x);
  const pls = Object.entries(CAT.games.flatMap(g=>g.pl||[]).reduce((m,x)=>(m[x]=(m[x]||0)+1,m),{})).sort((a,b)=>b[1]-a[1]).map(([x])=>x);
  $("catCtl").innerHTML = `
    <div class="ctl wide"><label for="catQ">Buscar</label><input id="catQ" type="search" value="${esc(c.q)}" placeholder="Título…" autocomplete="off"></div>
    <div class="ctl"><label for="catSort">Ordenar por</label><select id="catSort">${opt("ix","Índice (crítica + jugadores)",c.sort)}${opt("mc","Metacritic",c.sort)}${opt("bl","Backloggd (ajustado)",c.sort)}${opt("y","Más recientes",c.sort)}</select></div>
    <div class="ctl"><label for="catDec">Década</label><select id="catDec">${opt("","Todas",c.dec)}${decs.map(d=>opt(String(d),d+"s",c.dec)).join("")}</select></div>
    <div class="ctl"><label for="catGen">Género</label><select id="catGen">${opt("","Todos",c.gen)}${gens.map(x=>opt(x,x,c.gen)).join("")}</select></div>
    <div class="ctl"><label for="catPl">Plataforma</label><select id="catPl">${opt("","Todas",c.pl)}${pls.map(x=>opt(x,x,c.pl)).join("")}</select></div>
    <div class="ctl"><label for="catMin">Votos Backloggd</label><select id="catMin">${[0,500,1000,5000,20000].map(v=>opt(v, v?("≥ "+fmtN(v)):"Sin mínimo", c.min)).join("")}</select></div>
    <div class="ctl wide"><label>Mostrar</label><div class="chips" id="catF">${[["all","Todos"],["mp","Must play"],...(ME?[["casa","En casa"],["nocasa","No los tengo"],["pend","En casa sin terminar"],["term","Terminados"],["quiero","Quiero"]]:[])].map(([k,l])=>`<button class="chip" data-catf="${k}" aria-pressed="${c.f===k}">${l}</button>`).join("")}</div></div>`;
  const L = catFilter(), shown = L.slice(0, c.n);
  const row = (g,i) => { const sc = catCover(g);
    return `<div class="row crow" id="g-${g.id}">
      <div class="n">${i+1}</div>
      ${sc?`<img class="thumb" loading="lazy" src="${esc(sc)}" alt="Carátula de ${esc(g.t)}" referrerpolicy="no-referrer">`:`<div class="thumb">${esc((g.t||"?")[0])}</div>`}
      <div class="info"><div class="t">${g.bls?`<a href="https://backloggd.com/games/${g.bls}/" target="_blank" rel="noopener">${esc(g.t)}</a>`:esc(g.t)} <span class="muted" style="font-weight:400">${g.y||""}</span></div>
        <div class="meta">${g.mc!=null?`<span class="sc c" title="Metacritic · ${g.mcn||"?"} críticas">MC ${g.mc}</span>`:`<span class="sc na">MC —</span>`}${g.bl!=null?`<span class="sc p" title="Backloggd · ${fmtN(g.bln)} votos · ajustada ${fmtBL(g.bla)}">BL ${fmtBL(g.bl)} <span style="opacity:.75">· ${fmtN(g.bln)}</span></span>`:`<span class="sc na">BL —</span>`}${g.mp?`<span class="mp" title="Must play de Metacritic: 90 o más con 15 críticas o más">Must play</span>`:""}${g.goty?`<span class="mp" title="${esc(g.goty)}">★ GOTY</span>`:""}</div>
        ${g.pl&&g.pl.length?`<span class="plats">${esc(g.pl.slice(0,6).join(" · "))}</span>`:""}
        ${(g.gen||[]).length?`<div class="via">${esc(g.gen.slice(0,4).join(" · "))}</div>`:""}</div>
      <div class="right"><div class="idx">${g.ix.toFixed(1).replace(".",",")}</div><div class="bar"><i style="width:${Math.max(0,Math.min(100,g.ix))}%"></i></div>${ownBtns(g)}</div>
    </div>`; };
  out.innerHTML = `<p class="muted" style="margin:0">${fmtN(L.length)} juegos${L.length!==CAT.games.length?` de ${fmtN(CAT.games.length)}`:""} · datos de ${esc(CAT.meta?.updated||"—")}</p>
    <div class="rank">${shown.map(row).join("")}</div>
    ${L.length>shown.length?`<button class="chip" id="catMore" style="align-self:center">Ver ${Math.min(100,L.length-shown.length)} más</button>`:""}`;
}
document.addEventListener("input", e=>{ if(e.target.id==="catQ"){ S.cat={...S.cat, q:e.target.value, n:100}; clearTimeout(renderCat._t); renderCat._t=setTimeout(()=>{ const pos=e.target.selectionStart; render(); const q=$("catQ"); if(q){ q.focus(); q.setSelectionRange(pos,pos);} }, 250); } });
document.addEventListener("change", e=>{ const m={catSort:"sort",catDec:"dec",catGen:"gen",catPl:"pl",catMin:"min"}[e.target.id]; if(m){ S.cat={...S.cat,[m]: m==="min" ? +e.target.value : e.target.value, n:100}; render(); } });
document.addEventListener("click", e=>{ const t=e.target.closest("button"); if(!t) return; if(t.dataset.catf){ S.cat={...S.cat,f:t.dataset.catf,n:100}; render(); } else if(t.id==="catMore"){ S.cat={...S.cat,n:S.cat.n+100}; render(); } });

/* ---------- controles ---------- */
function syncControls(){
  $("years").addEventListener("change", e=>{ if(e.target.id==="ysel"){ S.year=+e.target.value; render(); } });
for (const k of ["wc","wp","wa","cc","cp"]) $(k).value=S[k];
  $("owc").textContent=S.wc; $("owp").textContent=S.wp; $("owa").textContent=S.wa; $("occ").textContent=S.cc; $("ocp").textContent=(+S.cp).toFixed(2).replace(".",",");
  document.querySelectorAll("#show .chip").forEach(b=>{ b.setAttribute("aria-pressed", b.dataset.f===S.f); if(["tengo","quiero","pend","terminado","completo","jugando"].includes(b.dataset.f)) b.hidden=!ME; });
  $("show").querySelector(".sep").hidden=!ME;
  $("plats").innerHTML = [...PLATS,"Otras"].map(p=>`<button class="chip" data-pl="${p}" aria-pressed="${S.pl.includes(p)}">${p}</button>`).join("") + (S.pl.length?`<button class="chip" data-pl="__clear">Quitar filtro</button>`:"");
  $("inc").innerHTML = [["remaster","Remakes y remasters"],["dlc","Expansiones"],["port","Ports y ediciones"]].map(([k,l])=>`<button class="chip" data-inc="${k}" aria-pressed="${!!S.inc[k]}">${l}</button>`).join("");
  $("plHint").textContent = S.pl.length ? "(cualquiera de las elegidas)" : "";
  const tabKey = S.tab==="rank" && S.year===2026 ? "y26" : S.tab;
  document.querySelectorAll(".tabs button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.tab===tabKey));
  ["rank","col","tga","cmp","cat"].forEach(t=>$("tab-"+t).hidden = t!==S.tab);
  $("years").hidden = !(S.tab==="rank" || S.tab==="tga");
  const ys = S.tab==="tga" ? HIST_YEARS : YEARS;
  const cur = S.tab==="tga" && !HIST_YEARS.includes(S.year) ? 2025 : S.year;
  const i=ys.indexOf(cur), dec=[...new Set(ys.map(y=>Math.floor(y/10)*10))];
  $("years").innerHTML = `<div class="ybtns">${ys.map(y=>`<button data-y="${y}" aria-pressed="${y===cur}">${y}</button>`).join("")}</div>
   <div class="ystep"><button data-y="${ys[Math.max(0,i-1)]}" aria-label="Año anterior" ${i<=0?"disabled":""}>‹</button>
   <select id="ysel" aria-label="Año">${dec.map(d=>`<optgroup label="${d}s">${ys.filter(y=>Math.floor(y/10)*10===d).reverse().map(y=>`<option value="${y}" ${y===cur?"selected":""}>${y}</option>`).join("")}</optgroup>`).reverse().join("")}</select>
   <button data-y="${ys[Math.min(ys.length-1,i+1)]}" aria-label="Año siguiente" ${i>=ys.length-1?"disabled":""}>›</button></div>`;
}
function render(){ store.set("goty-ui",S); syncControls(); if(S.tab==="rank") renderRank(); if(S.tab==="col") renderCol(); if(S.tab==="tga") renderTGA(); if(S.tab==="cmp") renderCmp(); if(S.tab==="cat") renderCat(); }

for (const k of ["wc","wp","wa","cc","cp"]) $(k).addEventListener("input", e=>{ S[k]=+e.target.value; render(); });
document.addEventListener("click", e=>{
  const t=e.target.closest("button"); if(!t) return;
  if (t.dataset.tab){ if(t.dataset.tab==="y26"){ S.tab="rank"; S.year=2026; } else { if(t.dataset.tab==="rank" && S.year===2026) S.year=2025; S.tab=t.dataset.tab; } render(); scrollTo({top:0}); }
  else if (t.dataset.y && (t.closest("#years")||t.classList.contains("goty"))){ S.year=+t.dataset.y; render(); }
  else if (t.dataset.f){ S.f=t.dataset.f; render(); }
  else if (t.dataset.inc){ S.inc={...S.inc,[t.dataset.inc]:!S.inc[t.dataset.inc]}; render(); }
  else if (t.dataset.pl){ const p=t.dataset.pl; S.pl = p==="__clear" ? [] : S.pl.includes(p) ? S.pl.filter(x=>x!==p) : [...S.pl,p]; render(); }
  else if (t.dataset.jump) jump(t.dataset.jump);
  else if (t.dataset.goto){ const g=byId(t.dataset.goto); if(g){ S.tab="rank"; S.year=g.y; S.f="all"; S.pl=[]; render(); jump(g.id); } }
  else if (t.dataset.own) toggleOwn(t.dataset.id, t.dataset.own);
  else if (t.dataset.fis) cycleFis(t.dataset.fis);
});
function jump(id){ if(S.f!=="all"||S.pl.length){S.f="all"; S.pl=[]; render();} const el=$("g-"+id); if(!el) return; el.scrollIntoView({block:"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}); el.classList.add("flash"); setTimeout(()=>el.classList.remove("flash"),1600); }
$("q").addEventListener("input", ()=>renderTGA());

const tip=$("tip");
$("scatter").addEventListener("mousemove", e=>{ const c=e.target.closest("circle"); if(!c){tip.hidden=true;return;} const g=byId(c.dataset.id); if(!g) return;
  tip.innerHTML=`<strong>${esc(g.t)}</strong><br>Metacritic ${g.mc} · Backloggd ${fmtBL(g.bl)} (${fmtN(g.bln)} votos)${hasAw(g)?`<br>${AWK.filter(([k])=>g.aw[k]).map(([k])=>(g.aw[k]==="won"?"★ ":"")+k).join(", ")}`:""}${g.pl?`<br>${g.pl.join(" · ")}`:""}`;
  tip.hidden=false; tip.style.left=Math.min(e.clientX+12, innerWidth-250)+"px"; tip.style.top=(e.clientY+12)+"px"; });
$("scatter").addEventListener("mouseleave", ()=>tip.hidden=true);
$("scatter").addEventListener("click", e=>{ const c=e.target.closest("circle"); if(c) jump(c.dataset.id); });

/* ---------- API (Cloudflare Pages Functions + D1) ---------- */
async function api(path, opt={}){
  const r = await fetch("/api/"+path, {credentials:"same-origin", headers:{"content-type":"application/json"}, ...opt});
  if (!r.ok){ let b={}; try{ b=await r.json(); }catch(e){} const err=new Error(path+" "+r.status); err.status=r.status; err.code=b.error; throw err; }
  return r.json();
}
const fillMarks = (dst, src) => { for(const k in dst) delete dst[k]; for(const [k,v] of Object.entries(src||{})) dst[k]={estado:v.estado||null, terminado:!!v.terminado, completo:!!v.completo, progreso:v.progreso||null}; };
async function loadState(){
  const d = await api("state");
  ME = d.me; USERS = d.users||[]; if (VIEW==null || !USERS.some(u=>u.id===VIEW)) VIEW = ME.id;
  fillMarks(ST, d.marks);
  HOGINFO = d.hogar || null; MYHOG = HOGINFO && Array.isArray(HOGINFO.juegos) ? matchHogar(HOGINFO.juegos) : null;
  for (const k in FIS) delete FIS[k]; Object.assign(FIS, d.fisica||{});
  if (VIEW!==ME.id) await loadView(VIEW, false);
  render();
  if (HOGINFO && !CAT) loadCat();   // el emparejado con Hogar necesita el catálogo completo, no solo los rankings
}
async function loadView(id, draw=true){
  VIEW = id;
  VHOG = null;
  if (id===ME.id) fillMarks(VST, {}); else { try { const d = await api("marks?u="+id); fillMarks(VST, d.marks);
    VHOG = d.hogar ? (d.hogar.id===(ME.hogar&&ME.hogar.id) ? MYHOG : matchHogar(d.hogar.juegos)) : null; } catch(e){ fillMarks(VST, {}); } }
  if (draw) render();
}
async function cycleFis(id){
  if(!ME) return; const g=byId(id); if(!g) return;
  const auto=g.fis||null, cur=fisOf(g);
  const next = cur==="si" ? "no" : cur==="no" ? null : "si";   // si -> solo digital -> sin dato -> si
  const prev=FIS[id];
  if (next===auto || next===null){ delete FIS[id]; } else FIS[id]=next;
  if (next===null && auto){ FIS[id]="none"; }
  render();
  try{ await api("fisica/"+encodeURIComponent(id), {method:"PUT", body:JSON.stringify({v:FIS[id]||null})}); }
  catch(e){ if(prev) FIS[id]=prev; else delete FIS[id]; render(); toast("No se pudo guardar"); }
}
async function toggleOwn(id, kind){
  if(!ME) return;
  if (kind==="tengo" && MYHOG) return;
  const prev = {...(ST[id]||{})}; const s = {...prev};
  if (kind==="tengo"||kind==="quiero") s.estado = s.estado===kind ? null : kind;
  if (kind==="terminado"){ s.terminado = !s.terminado; if(!s.terminado) s.completo=false; }
  if (kind==="completo"){ s.completo = !s.completo; if(s.completo) s.terminado=true; }
  if (kind==="jugando"||kind==="abandonado"){ s.progreso = s.progreso===kind ? null : kind; if(s.progreso){ s.terminado=false; s.completo=false; } }
  if (s.terminado) s.progreso = null;
  if (MYHOG && s.estado==="tengo") s.estado = null;
  const empty = !s.estado && !s.terminado && !s.completo && !s.progreso;
  if (empty) delete ST[id]; else ST[id]=s; render();
  const gg = byId(id);
  try { await api("marks/"+encodeURIComponent(id), {method:"PUT", body:JSON.stringify({estado:s.estado||null, terminado:!!s.terminado, completo:!!s.completo, progreso:s.progreso||null, t:gg&&gg.t, s:gg&&gg.bls, h:hidsOf(id)})}); }
  catch(err){ if(Object.keys(prev).length) ST[id]=prev; else delete ST[id]; render(); toast("No se pudo guardar"); }
}
function toast(msg){ const t=$("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>t.hidden=true, 3000); }
document.addEventListener("change", async e=>{
  if (e.target.id==="viewSel") loadView(+e.target.value);
  else if (e.target.id==="meName" || e.target.id==="meShared"){
    const name = $("meName").value.trim() || ME.name, shared = $("meShared").checked;
    try { ME = (await api("me", {method:"PUT", body:JSON.stringify({name, shared})})).me; const u=USERS.find(u=>u.id===ME.id); if(u) u.name=ME.name; render(); toast("Guardado"); }
    catch(err){ toast("No se pudo guardar"); }
  }
});
// Al volver a la pestaña solo se recarga si han pasado más de 5 minutos (en el móvil esto pasa constantemente).
let LAST_LOAD = Date.now();
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible" && ME && Date.now()-LAST_LOAD > 5*60*1000){ LAST_LOAD=Date.now(); loadState().catch(()=>{}); } });
$("boot").hidden = true;
render();
try { await loadState(); $("apiErr").hidden=true; } catch(e){ console.warn("Sin sesión:", e.message);
  const box=$("apiErr");
  box.textContent = e.code==="cuota" ? "Ahora mismo no puedo leer las colecciones: la base de datos de Cloudflare ha agotado la cuota gratuita de hoy. Vuelve a funcionar a las 2:00 (hora peninsular). Los rankings y el catálogo sí funcionan."
    : e.status>=500 ? "Ahora mismo no puedo leer las colecciones (error del servidor). Los rankings y el catálogo sí funcionan; prueba a recargar en un rato."
    : "";
  box.hidden = !box.textContent; }
})().catch(e => { document.getElementById("boot").textContent = "No se pudieron cargar los datos: " + e.message; });
