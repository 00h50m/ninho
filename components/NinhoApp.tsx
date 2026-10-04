'use client'
import { useEffect, useState, useCallback, useId, useRef, ReactNode } from 'react'
import { friendlyMessage, reportError } from '@/lib/errors'
import {
  addDaysToIsoDate,
  formatLongDateInSaoPaulo,
  formatShortDate as fmtDate,
  formatTimeInSaoPaulo,
  hourInSaoPaulo,
  todayInSaoPaulo as todayStr,
  weekStartInSaoPaulo as weekStartStr,
} from '@/lib/date'
import {
  applyTaskDistribution,
  createPet,
  createPuppyAccident,
  deactivateTask,
  insertTasks,
  loadNinhoSnapshot,
  loadWeekHistory,
  persistMeeting,
  persistTask,
  saveProfileName,
  saveWeeklySettings,
  setDogRoutineCompletion,
  setTaskCompletion,
  subscribeToHouseholdChanges,
  updateTaskAssignment,
} from '@/lib/ninho-api'
import { getLevel, LEVELS, XP_BY_WEIGHT as XPW } from '@/lib/xp'
import type { Dog, DogRoutine, Meeting, Names, PuppyAccident, Settings, Task, WeekHistory, Who } from '@/types/ninho'

const CAT:Record<string,string>={kitchen:'🍳 Cozinha',bathroom:'🚿 Banheiro',bedroom:'🛏 Quarto',laundry:'👕 Lavanderia',general:'🏠 Geral',dogs:'🐾 Cães',shopping:'🛒 Compras',finance:'💰 Finanças'}
const WPT:Record<string,string>={light:'Leve',medium:'Médio',heavy:'Pesado'}
const FPT:Record<string,string>={daily:'Diária',weekly:'Semanal',biweekly:'Quinzenal',monthly:'Mensal',once:'Pontual'}
const FEFF:Record<string,number>={daily:7,weekly:2,biweekly:1,monthly:0.5,once:1}
const ROLE:Record<Who,string>={g:'home office',s:'professora'}
const ENERGY:Record<string,{ic:string,l:string,short:string,s:string,cls:string}>={
  high:{ic:'🌿',l:'Alta energia',short:'Alta',s:'Lista completa ativa',cls:'green'},
  medium:{ic:'🌤',l:'Energia média',short:'Média',s:'Modo padrão',cls:'amber'},
  low:{ic:'🌧',l:'Baixa energia',short:'Baixa',s:'Foco no essencial',cls:'coral'},
}
const TABS:Array<[string,string,string]>=[['today','☀️','Hoje'],['tasks','📋','Tarefas'],['week','📅','Semana'],['pets','🐾','Cães'],['settings','⚙️','Ajustes']]
const SUGG:Record<string,Array<{t:string,w:string,f:string,cat:string,ess:boolean}>>={
  'Cozinha':[{t:'Louça diária',w:'light',f:'daily',cat:'kitchen',ess:true},{t:'Limpar bancada e fogão',w:'light',f:'daily',cat:'kitchen',ess:true},{t:'Lixo da cozinha',w:'light',f:'daily',cat:'kitchen',ess:true},{t:'Organizar geladeira',w:'medium',f:'weekly',cat:'kitchen',ess:false},{t:'Limpar microondas',w:'light',f:'weekly',cat:'kitchen',ess:false},{t:'Limpar geladeira por dentro',w:'medium',f:'monthly',cat:'kitchen',ess:false}],
  'Banheiro':[{t:'Limpar pia e espelho',w:'light',f:'weekly',cat:'bathroom',ess:false},{t:'Limpar vaso sanitário',w:'medium',f:'weekly',cat:'bathroom',ess:false},{t:'Limpar box / chuveiro',w:'medium',f:'weekly',cat:'bathroom',ess:false},{t:'Repor papel e sabonete',w:'light',f:'weekly',cat:'bathroom',ess:true}],
  'Casa geral':[{t:'Varrer / aspirar',w:'medium',f:'weekly',cat:'general',ess:false},{t:'Passar pano no chão',w:'medium',f:'weekly',cat:'general',ess:false},{t:'Reset da sala (noite)',w:'light',f:'daily',cat:'general',ess:true},{t:'Faxina geral',w:'heavy',f:'monthly',cat:'general',ess:false}],
  'Lavanderia':[{t:'Lavar roupa',w:'medium',f:'weekly',cat:'laundry',ess:false},{t:'Dobrar e guardar',w:'medium',f:'weekly',cat:'laundry',ess:false},{t:'Trocar roupa de cama',w:'medium',f:'weekly',cat:'laundry',ess:false}],
  'Cães':[{t:'Ração manhã',w:'light',f:'daily',cat:'dogs',ess:true},{t:'Ração noite',w:'light',f:'daily',cat:'dogs',ess:true},{t:'Água fresca',w:'light',f:'daily',cat:'dogs',ess:true},{t:'Passeio manhã',w:'medium',f:'daily',cat:'dogs',ess:true},{t:'Passeio tarde',w:'medium',f:'daily',cat:'dogs',ess:true},{t:'Limpeza área dos cães',w:'light',f:'daily',cat:'dogs',ess:true},{t:'Banho dos cães',w:'heavy',f:'biweekly',cat:'dogs',ess:false},{t:'Escovação',w:'light',f:'weekly',cat:'dogs',ess:false}],
  'Compras':[{t:'Mercado semanal',w:'medium',f:'weekly',cat:'shopping',ess:false},{t:'Repor ração dos cães',w:'light',f:'monthly',cat:'shopping',ess:true}],
}
const DR_DEF=[{t:'Ração manhã',f:'daily',time:'07:00'},{t:'Água fresca',f:'daily',time:null},{t:'Passeio manhã',f:'daily',time:'08:00'},{t:'Ração noite',f:'daily',time:'18:00'},{t:'Passeio tarde',f:'daily',time:'17:30'},{t:'Enriquecimento ambiental',f:'daily',time:null},{t:'Escovação',f:'weekly',time:null},{t:'Banho',f:'weekly',time:null}]
const DR_PUP=[{t:'Saída xixi manhã',f:'daily',time:'07:30'},{t:'Saída xixi tarde',f:'daily',time:'14:00'},{t:'Saída xixi noite',f:'daily',time:'21:00'},{t:'Treino básico',f:'daily',time:null},{t:'Socialização',f:'daily',time:null}]

function getChaosInfo(p:number){if(p<35)return{label:'Organizada ✦',color:'var(--green)'};if(p<65)return{label:'Atenção necessária',color:'var(--amb)'};return{label:'Casa em alerta!',color:'var(--cor)'}}
function firstName(n:string){return (n||'').split(' ')[0]}
function initials(n:string){return (n||'??').slice(0,2).toUpperCase()}
function wCls(w:string){return w==='light'?'l':w==='medium'?'m':'h'}
function hhmm(t:string|null){return t?t.slice(0,5):''}
function byCat(list:Task[]){const g:Record<string,Task[]>={};list.forEach(t=>{(g[t.category]=g[t.category]||[]).push(t)});return Object.entries(g)}
function belongsTo(t:Task,who:Who){return who==='g'?(!t.assigned_to||t.assigned_to==='g'):t.assigned_to==='s'}

const CSS=`
:root{--bg:#0f0f0e;--sf:#181816;--sf2:#20201e;--sf3:#2a2a27;--bd:#272725;--bd2:#363634;--tx:#f2efe9;--mu:#bdbab3;--sub:#8a8882;--faint:#5e5d59;--green:#5dcaa5;--gbg:#0f2a1e;--gbdr:#1d5a3a;--gdk:#1D9E75;--amb:#ef9f27;--abg:#2a1a08;--abdr:#5a3a10;--cor:#e26a40;--cbg:#2a0e08;--cbdr:#5a2010;--pur:#a898f2;--pbg:#1a1040;--pbdr:#3a2880;--r:14px;--rs:10px;--safe-b:env(safe-area-inset-bottom,0px);--safe-t:env(safe-area-inset-top,0px)}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html{-webkit-text-size-adjust:100%}
body{background:var(--bg);color:var(--tx);font-family:'DM Sans',system-ui,sans-serif;font-size:14px;line-height:1.45;min-height:100vh;-webkit-font-smoothing:antialiased}
button,input,textarea{font-family:inherit;font-size:inherit;color:inherit}
button{cursor:pointer}
:focus-visible{outline:2px solid var(--green);outline-offset:2px}
.mono{font-family:'DM Mono',monospace}
@keyframes fu{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes su{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes pop{0%{transform:scale(1)}40%{transform:scale(1.18)}100%{transform:scale(1)}}

/* ── header & navegação ── */
.top{position:sticky;top:0;z-index:30;background:rgba(15,15,14,.88);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--bd);padding-top:var(--safe-t)}
.top-in{max-width:1200px;margin:0 auto;padding:10px 20px;display:flex;align-items:center;gap:16px;min-height:58px}
.logo{font-family:'DM Mono',monospace;font-size:18px;font-weight:500;letter-spacing:-.03em;background:none;border:none;padding:0}
.logo span{color:var(--green)}
.tnav{display:flex;gap:2px;margin-left:12px}
.tnb{padding:8px 14px;border:none;background:transparent;color:var(--sub);border-radius:999px;font-size:13px;font-weight:500;display:flex;gap:7px;align-items:center;transition:all .15s}
.tnb .ic{filter:grayscale(1);opacity:.6;transition:all .15s}
.tnb:hover{color:var(--tx);background:var(--sf2)}
.tnb.on{color:var(--tx);background:var(--sf3)}.tnb.on .ic{filter:none;opacity:1}
.status{margin-left:auto;display:flex;gap:6px;align-items:center}
.chip{font-size:12px;padding:5px 11px;border-radius:999px;border:1px solid var(--bd2);background:var(--sf2);color:var(--mu);display:inline-flex;align-items:center;gap:5px;white-space:nowrap;transition:border-color .15s}
button.chip:hover{border-color:var(--faint)}
.chip.green{background:var(--gbg);color:var(--green);border-color:var(--gbdr)}.chip.amber{background:var(--abg);color:var(--amb);border-color:var(--abdr)}.chip.coral{background:var(--cbg);color:var(--cor);border-color:var(--cbdr)}
.bnav{display:none}
.main{max-width:1200px;margin:0 auto;padding:22px 20px 110px}
.scr{animation:fu .18s ease}

/* ── títulos ── */
.sh{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap}
.sh h1,.sh h2{font-size:24px;font-weight:500;letter-spacing:-.025em;line-height:1.2}
.sh p{color:var(--sub);font-size:13px;margin-top:3px}
.sh p::first-letter{text-transform:uppercase}
.sh-a{display:flex;gap:8px;flex-wrap:wrap}
.slbl{font-size:11px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--sub);margin-bottom:10px;display:flex;align-items:center;gap:6px}
.slbl a,.slbl .lnk{margin-left:auto;text-transform:none;letter-spacing:0;color:var(--green);background:none;border:none;font-size:12px;font-weight:500}

/* ── botões ── */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 16px;border-radius:var(--rs);font-size:13px;font-weight:500;border:1px solid transparent;transition:all .15s;white-space:nowrap}
.btn:disabled{opacity:.35;cursor:not-allowed}
.btn-p{background:var(--gdk);color:#fff}.btn-p:not(:disabled):hover{background:#22b083}
.btn-s{background:var(--gbg);color:var(--green);border-color:var(--gbdr)}.btn-s:hover{border-color:var(--green)}
.btn-g{background:transparent;color:var(--mu);border-color:var(--bd2)}.btn-g:hover{color:var(--tx);border-color:var(--faint)}
.btn-pur{background:var(--pbg);color:var(--pur);border-color:var(--pbdr)}.btn-pur:hover{border-color:var(--pur)}
.btn-danger{background:transparent;color:var(--cor);border-color:var(--cbdr)}.btn-danger:hover{background:var(--cbg)}
.btn-w{width:100%}
.ib{width:34px;height:34px;border:none;background:transparent;color:var(--faint);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;transition:all .12s}
.ib:hover{background:var(--sf3);color:var(--tx)}.ib.danger:hover{background:var(--cbg);color:var(--cor)}

/* ── cards ── */
.card{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:16px}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}
.stat{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:14px 16px;min-width:0;text-align:left}
button.stat{transition:border-color .15s}button.stat:hover{border-color:var(--bd2)}
.stat-l{font-size:12px;color:var(--sub);font-weight:500;margin-bottom:6px}
.stat-v{font-size:26px;font-weight:400;letter-spacing:-.03em;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stat-txt{font-size:19px;white-space:normal;line-height:1.2;padding-top:4px;letter-spacing:-.01em}
.stat-v small{font-size:13px;color:var(--sub);margin-left:4px;letter-spacing:0}
.stat-s{font-size:12px;color:var(--sub);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar{background:var(--sf3);border-radius:99px;height:5px;overflow:hidden;margin-top:10px}
.barf{height:100%;border-radius:99px;transition:width .5s ease}
.week-dots{display:flex;gap:4px;margin-top:10px}
.wd{flex:1;height:5px;border-radius:99px;background:var(--sf3)}
.wd.on{background:var(--amb)}.wd.today{background:transparent;box-shadow:inset 0 0 0 1.5px var(--amb)}

.banner{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:var(--rs);margin-bottom:16px;font-size:13px;flex-wrap:wrap}
.banner.surv{background:var(--cbg);border:1px solid var(--cbdr);color:var(--cor)}
.banner.low{background:var(--abg);border:1px solid var(--abdr);color:var(--amb)}
.banner .lnk{margin-left:auto;background:none;border:none;color:inherit;font-size:12px;font-weight:500;text-decoration:underline;text-underline-offset:3px}

/* ── hoje ── */
.today{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 300px;gap:14px;align-items:start}
.side{display:flex;flex-direction:column;gap:14px}
.seg{display:none}
.ph{display:flex;align-items:center;gap:12px;margin-bottom:12px;padding-bottom:14px;border-bottom:1px solid var(--bd)}
.av{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;flex-shrink:0;font-family:'DM Mono',monospace}
.av-g{background:var(--gbg);color:var(--green)}.av-s{background:var(--pbg);color:var(--pur)}
.pname{font-size:16px;font-weight:500;line-height:1.25}.prole{font-size:12px;color:var(--sub)}
.ring{position:relative;width:46px;height:46px;margin-left:auto;flex-shrink:0}
.ring svg{transform:rotate(-90deg);display:block}
.ring span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:10.5px;color:var(--mu)}
.cdiv{font-size:11px;font-weight:500;color:var(--sub);letter-spacing:.04em;text-transform:uppercase;margin:12px 0 2px;display:flex;align-items:center;gap:8px}
.cdiv::after{content:'';flex:1;height:1px;background:var(--bd)}
.cdiv .n{font-family:'DM Mono',monospace;color:var(--faint);order:2}
.tr{display:flex;align-items:center;gap:10px;padding:7px 8px;margin:0 -8px;border-radius:var(--rs);min-height:50px;transition:background .12s}
.tr:hover{background:var(--sf2)}
.chk{width:24px;height:24px;flex-shrink:0;border-radius:8px;border:1.5px solid var(--bd2);background:transparent;display:flex;align-items:center;justify-content:center;color:transparent;font-size:13px;font-weight:700;transition:all .15s}
.chk:hover{border-color:var(--green);color:var(--faint)}
.chk.ess{border-color:var(--cor)}
.tr.done .chk,.chk.ok{background:var(--gdk);border-color:var(--gdk);color:#fff;animation:pop .25s ease}
.trb{flex:1;min-width:0;cursor:pointer;user-select:none}
.trt{font-size:14.5px;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.trm{display:flex;gap:8px;align-items:center;margin-top:2px;font-size:11.5px;color:var(--sub);flex-wrap:wrap}
.tr.done .trt{text-decoration:line-through;color:var(--sub)}.tr.done .xp{opacity:.5}
.tag-e{color:var(--cor);font-weight:500}
.tag-t{color:var(--amb);font-family:'DM Mono',monospace;font-size:11px}
.xp{font-family:'DM Mono',monospace;font-size:11px;padding:2px 7px;border-radius:6px;flex-shrink:0}
.xp-l{color:var(--green);background:var(--gbg)}.xp-m{color:var(--amb);background:var(--abg)}.xp-h{color:var(--cor);background:var(--cbg)}
.tr .ib{opacity:0}.tr:hover .ib,.tr .ib:focus-visible{opacity:1}
@media(hover:none){.tr .ib{opacity:1}}
.dtog{width:100%;display:flex;align-items:center;gap:8px;border:none;background:transparent;color:var(--sub);font-size:13px;padding:12px 0 6px;margin-top:8px;border-top:1px solid var(--bd)}
.dtog:hover{color:var(--tx)}
.alldone{text-align:center;padding:18px 8px 10px;color:var(--green);font-size:14px}
.alldone small{display:block;color:var(--sub);font-size:12px;margin-top:3px}
.empty{text-align:center;padding:30px 16px;color:var(--sub);font-size:13px}
.empty-icon{font-size:30px;display:block;margin-bottom:10px}
.empty .btn{margin-top:14px}
.dr{display:flex;align-items:center;gap:10px;padding:7px 0;min-height:44px;cursor:pointer;user-select:none}
.dr .chk{width:22px;height:22px;border-radius:7px}
.dr-t{flex:1;min-width:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dr.done .dr-t{color:var(--sub);text-decoration:line-through}
.dr-m{font-size:11px;color:var(--sub);font-family:'DM Mono',monospace;white-space:nowrap}
.acts{display:flex;flex-direction:column;gap:6px}
.act{display:flex;align-items:center;gap:12px;width:100%;padding:10px;border:1px solid transparent;background:transparent;border-radius:var(--rs);text-align:left;transition:all .12s}
.act:hover{background:var(--sf2);border-color:var(--bd)}
.act-ic{width:36px;height:36px;border-radius:10px;background:var(--sf2);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}
.act-t{font-size:14px;font-weight:500}.act-s{font-size:12px;color:var(--sub)}
.act .chev{margin-left:auto;color:var(--faint)}

/* ── tarefas ── */
.search{display:flex;align-items:center;gap:8px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--rs);padding:0 12px;margin-bottom:12px;transition:border-color .15s}
.search:focus-within{border-color:var(--gdk)}
.search input{flex:1;background:transparent;border:none;outline:none;padding:11px 0;font-size:14px;min-width:0}
.search .x{background:none;border:none;color:var(--sub);font-size:14px;padding:4px}
.fchips{display:flex;gap:6px;margin-bottom:18px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.fchips::-webkit-scrollbar{display:none}
.fc{padding:7px 13px;border-radius:999px;font-size:12.5px;border:1px solid var(--bd);background:transparent;color:var(--sub);transition:all .12s;white-space:nowrap;flex-shrink:0}
.fc:hover{color:var(--tx);border-color:var(--bd2)}
.fc.on{background:var(--tx);border-color:var(--tx);color:var(--bg);font-weight:500}
.tgrp{margin-bottom:18px}
.tlist{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,520px),1fr));gap:8px;margin-top:8px}
.tc{background:var(--sf);border:1px solid var(--bd);border-radius:var(--rs);padding:10px 8px 10px 14px;display:flex;align-items:center;gap:12px;transition:border-color .12s}
.tc:hover{border-color:var(--bd2)}
.wdot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.w-l{background:var(--green)}.w-m{background:var(--amb)}.w-h{background:var(--cor)}
.tc-info{flex:1;min-width:0;cursor:pointer}
.tc-title{font-size:14.5px;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tc-meta{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
.bdg{font-family:'DM Mono',monospace;font-size:10.5px;padding:2px 7px;border-radius:5px;white-space:nowrap}
.bdg-l{background:var(--gbg);color:var(--green)}.bdg-m{background:var(--abg);color:var(--amb)}.bdg-h{background:var(--cbg);color:var(--cor)}.bdg-n{background:var(--sf2);color:var(--sub)}.bdg-e{background:var(--cbg);color:#ff7b6b;border:1px solid var(--cbdr)}.bdg-t{background:var(--abg);color:var(--amb)}
.asg{display:flex;background:var(--sf2);border-radius:999px;padding:3px;gap:2px;flex-shrink:0}
.asg button{border:none;background:transparent;color:var(--sub);font-size:11.5px;padding:4px 10px;border-radius:999px;transition:all .12s;white-space:nowrap}
.asg button:hover{color:var(--tx)}
.asg .on-g{background:var(--gbg);color:var(--green)}.asg .on-s{background:var(--pbg);color:var(--pur)}.asg .on-r{background:var(--sf3);color:var(--tx)}

/* ── semana ── */
.wgrid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:14px;align-items:start}
.col{display:flex;flex-direction:column;gap:14px}
.balance{height:10px;background:var(--sf3);border-radius:99px;overflow:hidden;display:flex;margin:10px 0}
.opts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.opt{padding:12px 10px;border-radius:var(--rs);border:1px solid var(--bd);background:transparent;text-align:left;transition:all .12s}
.opt:hover{border-color:var(--bd2)}
.opt.on{background:var(--gbg);border-color:var(--gbdr)}
.opt-t{font-size:13px;font-weight:500}.opt-s{font-size:11.5px;color:var(--sub);margin-top:2px}
.opt.on .opt-t{color:var(--green)}
.row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--bd)}
.slbl+.row{border-top:none}
.row-t{font-size:14px}.row-s{font-size:12px;color:var(--sub)}
.switch{width:44px;height:26px;border-radius:99px;background:var(--sf3);border:none;position:relative;flex-shrink:0;margin-left:auto;transition:background .2s}
.switch::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:var(--mu);transition:all .2s}
.switch.on{background:var(--cor)}.switch.on::after{left:21px;background:#fff}
.hist{padding:12px 0;border-top:1px solid var(--bd)}
.slbl+.hist{border-top:none;padding-top:0}
.hist-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.hist-note{margin-top:8px;padding:9px 11px;background:var(--sf2);border-radius:8px;font-size:12.5px;color:var(--mu);line-height:1.5}

/* ── cães ── */
.dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:14px}
.dh{display:flex;align-items:center;gap:12px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--bd)}
.dav{width:46px;height:46px;border-radius:50%;background:var(--gbg);display:flex;align-items:center;justify-content:center;font-size:23px;flex-shrink:0}
.puppy{background:var(--abg);border:1px solid var(--abdr);border-radius:var(--r);padding:16px;margin-bottom:16px}
.pills{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}
.pill{padding:8px 13px;border-radius:999px;border:1px solid var(--abdr);background:rgba(0,0,0,.2);color:var(--amb);font-size:12.5px;transition:all .12s}
.pill:hover{border-color:var(--amb)}
.acc{display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(0,0,0,.2);border-radius:8px;margin-bottom:4px;font-size:13px;color:var(--mu)}

/* ── ajustes ── */
.narrow{max-width:680px}
.field-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--bd)}
.slbl+.field-row{border-top:none}
.field-row .fi{max-width:220px;margin-left:auto}
.legend{display:flex;flex-direction:column;gap:12px;font-size:13px;color:var(--mu);line-height:1.5}
.legend b{color:var(--tx);font-weight:500}
.lg{display:flex;gap:12px;align-items:flex-start}
.lg-k{flex-shrink:0;width:104px;display:flex;gap:4px;align-items:center;flex-wrap:wrap}

/* ── FAB / toast ── */
.fab{position:fixed;bottom:28px;right:28px;height:52px;padding:0 20px 0 16px;background:var(--gdk);border-radius:99px;display:flex;align-items:center;gap:8px;border:none;color:#fff;font-size:14px;font-weight:500;box-shadow:0 8px 28px rgba(29,158,117,.35);transition:transform .15s;z-index:25}
.fab span{font-size:22px;line-height:1;font-weight:300}
.fab:hover{transform:translateY(-2px)}
.toast{position:fixed;top:calc(14px + var(--safe-t));left:50%;transform:translateX(-50%);background:#132a20;border:1px solid var(--gbdr);border-radius:12px;padding:10px 12px 10px 16px;font-size:13px;color:var(--green);display:flex;align-items:center;gap:12px;z-index:100;max-width:calc(100vw - 32px);box-shadow:0 10px 30px rgba(0,0,0,.4);animation:fu .2s ease}
.toast.error{background:var(--cbg);border-color:var(--cbdr);color:var(--cor)}
.toast-m{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.toast button{background:none;border:none;color:var(--tx);font-weight:500;font-size:13px;padding:2px 6px;text-decoration:underline;text-underline-offset:3px;flex-shrink:0}

/* ── modais ── */
.mwrap{position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px;animation:fu .15s ease}
.modal{background:var(--sf);border-radius:18px;border:1px solid var(--bd);width:100%;max-width:500px;max-height:90vh;display:flex;flex-direction:column;animation:su .2s ease;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.modal-lg{max-width:600px}.modal-sm{max-width:400px}
.grab{display:none}
.mh{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--bd);flex-shrink:0}
.mht{font-size:16px;font-weight:500}
.mclose{background:var(--sf2);border:none;color:var(--mu);font-size:14px;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.mclose:hover{color:var(--tx)}
.mbody{overflow-y:auto;padding:18px 20px;flex:1;overscroll-behavior:contain}
.mfoot{padding:14px 20px calc(14px + var(--safe-b));border-top:1px solid var(--bd);flex-shrink:0;display:flex;gap:8px}
.mfoot .btn-p{flex:1}
.fl{font-size:12px;font-weight:500;color:var(--mu);display:block;margin:18px 0 8px}
.fl:first-child{margin-top:0}.fl .hint{font-weight:400;color:var(--sub)}
.fi,.fita{width:100%;background:var(--sf2);border:1px solid var(--bd2);border-radius:var(--rs);padding:11px 13px;font-size:14px;color:var(--tx);outline:none;transition:border-color .12s}
.fi:focus,.fita:focus{border-color:var(--gdk)}
.fita{resize:vertical;min-height:76px;line-height:1.5}
.btng{display:grid;gap:6px}.c2{grid-template-columns:1fr 1fr}.c3{grid-template-columns:1fr 1fr 1fr}
.sbtn{padding:10px 8px;border-radius:var(--rs);border:1px solid var(--bd);background:transparent;font-size:13px;color:var(--mu);transition:all .12s;text-align:center}
.sbtn:disabled,.asg button:disabled,.chk:disabled,.ib:disabled{opacity:.45;cursor:not-allowed}
.sbtn:hover{border-color:var(--bd2);color:var(--tx)}
.sbtn.on{background:var(--gbg);border-color:var(--gbdr);color:var(--green)}
.sbtn small{display:block;font-size:11.5px;color:var(--sub);margin-top:2px}
.stabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:12px}
.stabs::-webkit-scrollbar{display:none}
.li{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--rs);border:1px solid var(--bd);margin-bottom:6px;cursor:pointer;transition:all .12s;user-select:none}
.li:hover{border-color:var(--bd2)}
.li.on{background:var(--gbg);border-color:var(--gbdr)}
.li.off{opacity:.45;cursor:default}
.li .chk{width:20px;height:20px;border-radius:6px;font-size:11px}
.li-t{flex:1;min-width:0;font-size:13.5px;color:var(--mu)}.li.on .li-t{color:var(--green)}
.li-m{display:flex;gap:4px;flex-shrink:0;align-items:center}
.meet{padding-bottom:18px;margin-bottom:18px;border-bottom:1px solid var(--bd)}
.meet:last-child{border:none;margin:0;padding:0}
.meet .fl{margin-top:0}

/* ── responsivo ── */
@media(max-width:1100px){
  .today{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .side{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
  .tnb{padding:8px 11px}
}
@media(max-width:860px){
  .tnav{display:none}
  .top-in{padding:10px 16px;min-height:54px}
  .bnav{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;bottom:0;left:0;right:0;z-index:30;background:rgba(18,18,17,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--bd);padding:6px 6px calc(6px + var(--safe-b))}
  .bnb{border:none;background:transparent;color:var(--sub);display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 0 4px;font-size:11px;font-weight:500;border-radius:12px;transition:color .15s}
  .bnb .ic{font-size:20px;line-height:1;filter:grayscale(1);opacity:.55;transition:all .15s}
  .bnb.on{color:var(--tx)}.bnb.on .ic{filter:none;opacity:1;transform:translateY(-1px)}
  .main{padding:16px 16px calc(150px + var(--safe-b))}
  .fab{bottom:calc(78px + var(--safe-b));right:16px;height:52px;width:52px;padding:0;justify-content:center}
  .fab b{display:none}
  .chip-hide{display:none}
  .stats{grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
  .stat{padding:12px 14px}.stat-v{font-size:22px}.stat-txt{font-size:16px}
  .today{grid-template-columns:minmax(0,1fr);gap:12px}
  .side{display:flex}
  .seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:4px}
  .segb{border:none;background:transparent;padding:10px 8px;border-radius:9px;color:var(--sub);font-weight:500;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .15s;min-width:0}
  .segb.on{background:var(--sf3);color:var(--tx)}
  .segb .cnt{font-family:'DM Mono',monospace;font-size:11px;color:var(--faint)}
  .segb .d{width:8px;height:8px;border-radius:50%;flex-shrink:0}
  .pcard[data-hide="1"]{display:none}
  .wgrid{grid-template-columns:minmax(0,1fr);gap:12px}
  .col{gap:12px}
  .sh{margin-bottom:14px}.sh h1,.sh h2{font-size:22px}
  .tc{flex-wrap:wrap;row-gap:8px}
  .tc-info{flex:1 1 calc(100% - 70px)}
  .tc .asg{order:5;margin-left:20px}
  .mwrap{align-items:flex-end;padding:0}
  .modal,.modal-lg,.modal-sm{max-width:none;border-radius:20px 20px 0 0;max-height:92vh;border-bottom:none}
  .grab{display:block;width:38px;height:4px;border-radius:99px;background:var(--bd2);margin:8px auto 0;flex-shrink:0}
  .mh{padding:10px 18px 14px}
  .mbody{padding:16px 18px}
  .fi,.fita,.search input{font-size:16px}
}
@media(max-width:420px){
  .opts{grid-template-columns:1fr}
  .field-row{flex-wrap:wrap}.field-row .fi{max-width:none}
}
`

// ── PEÇAS DE UI (fora do componente principal para não remontar a cada render) ──
function Ring({pct,color,label}:{pct:number,color:string,label:string}){
  const s=46,r=19,c=2*Math.PI*r
  return(
    <div className="ring" aria-label={`${pct}% concluído`}>
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <circle cx={s/2} cy={s/2} r={r} fill="none" stroke="var(--sf3)" strokeWidth="4"/>
        <circle cx={s/2} cy={s/2} r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-pct/100)} style={{transition:'stroke-dashoffset .5s ease'}}/>
      </svg>
      <span>{label}</span>
    </div>
  )
}

function Sheet({title,onClose,children,footer,size}:{title:ReactNode,onClose:()=>void,children:ReactNode,footer?:ReactNode,size?:'sm'|'lg'}){
  const closeRef=useRef(onClose)
  const dialogRef=useRef<HTMLDivElement>(null)
  const titleId=useId()
  closeRef.current=onClose
  useEffect(()=>{
    const previousFocus=document.activeElement as HTMLElement|null
    const focusable=()=>Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')||[])
    const h=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){closeRef.current();return}
      if(e.key!=='Tab')return
      const items=focusable();if(items.length===0){e.preventDefault();return}
      const first=items[0],last=items[items.length-1]
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    }
    window.addEventListener('keydown',h)
    const prev=document.body.style.overflow;document.body.style.overflow='hidden'
    const frame=requestAnimationFrame(()=>{
      const preferred=dialogRef.current?.querySelector<HTMLElement>('[autofocus]')
      ;(preferred||focusable()[0]||dialogRef.current)?.focus()
    })
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',h);document.body.style.overflow=prev;previousFocus?.focus()}
  },[])
  return(
    <div className="mwrap" onClick={onClose}>
      <div ref={dialogRef} className={`modal ${size?'modal-'+size:''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onClick={e=>e.stopPropagation()}>
        <div className="grab"/>
        <div className="mh"><span className="mht" id={titleId}>{title}</span><button className="mclose" onClick={onClose} aria-label="Fechar">✕</button></div>
        <div className="mbody">{children}</div>
        {footer&&<div className="mfoot">{footer}</div>}
      </div>
    </div>
  )
}

function TaskFormModal({task,names,onClose,onSave,onDelete,busy=false}:{task:Task|null,names:Names,onClose:()=>void,onSave:(d:any,id?:string)=>void,onDelete:(id:string)=>void,busy?:boolean}){
  const t=task
  const editing=!!t?.id
  const[title,setTitle]=useState(t?.title||'')
  const[cat,setCat]=useState(t?.category||'general')
  const[weight,setWeight]=useState<'light'|'medium'|'heavy'>(t?.weight||'medium')
  const[freq,setFreq]=useState(t?.frequency||'weekly')
  const[assign,setAssign]=useState(t?.assigned_to||'')
  const[time,setTime]=useState(hhmm(t?.scheduled_time||null))
  const[ess,setEss]=useState(t?.essential||false)
  const handle=()=>{if(!title.trim())return;onSave({title:title.trim(),category:cat,weight,frequency:freq,assigned_to:assign||null,scheduled_time:time||null,essential:ess},editing?t!.id:undefined)}
  return(
    <Sheet title={editing?'Editar tarefa':'Nova tarefa'} onClose={onClose} footer={<>
      {editing&&<button className="btn btn-danger" disabled={busy} onClick={()=>onDelete(t!.id)}>Remover</button>}
      <button className="btn btn-p" disabled={!title.trim()||busy} onClick={handle}>{busy?'Salvando...':editing?'Salvar alterações':'Criar tarefa'}</button>
    </>}>
      <label className="fl">Nome</label>
      <input className="fi" value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handle()}} placeholder="Ex: Limpar bancada" autoFocus/>
      <label className="fl">Responsável</label>
      <div className="btng c3">
        <button className={`sbtn ${assign==='g'?'on':''}`} onClick={()=>setAssign('g')}>{firstName(names.g)}</button>
        <button className={`sbtn ${assign==='s'?'on':''}`} onClick={()=>setAssign('s')}>{firstName(names.s)}</button>
        <button className={`sbtn ${!assign?'on':''}`} onClick={()=>setAssign('')}>Rodízio</button>
      </div>
      <label className="fl">Categoria</label>
      <div className="btng c2">{Object.entries(CAT).map(([k,v])=><button key={k} className={`sbtn ${cat===k?'on':''}`} onClick={()=>setCat(k)}>{v}</button>)}</div>
      <label className="fl">Esforço</label>
      <div className="btng c3">
        {(['light','medium','heavy'] as const).map(w=><button key={w} className={`sbtn ${weight===w?'on':''}`} onClick={()=>setWeight(w)}>{w==='light'?'🟢':w==='medium'?'🟡':'🔴'} {WPT[w]}<small>+{XPW[w]} XP</small></button>)}
      </div>
      <label className="fl">Frequência</label>
      <div className="btng c3">{Object.entries(FPT).map(([k,v])=><button key={k} className={`sbtn ${freq===k?'on':''}`} onClick={()=>setFreq(k)}>{v}</button>)}</div>
      <label className="fl">Horário <span className="hint">(opcional)</span></label>
      <input type="time" className="fi" value={time} onChange={e=>setTime(e.target.value)} style={{maxWidth:180}}/>
      <label className="fl">Prioridade</label>
      <div className="btng c2">
        <button className={`sbtn ${!ess?'on':''}`} style={{textAlign:'left',padding:'11px 13px'}} onClick={()=>setEss(false)}>Regular<small>Pode ser adiada</small></button>
        <button className={`sbtn ${ess?'on':''}`} style={{textAlign:'left',padding:'11px 13px'}} onClick={()=>setEss(true)}>🔴 Essencial<small>Não pode falhar</small></button>
      </div>
    </Sheet>
  )
}

function SuggModal({tasks,onClose,onAdd,onCustomize}:{tasks:Task[],onClose:()=>void,onAdd:(sel:any[])=>Promise<void>,onCustomize:(s:any)=>void}){
  const cats=Object.keys(SUGG)
  const[curTab,setCurTab]=useState(cats[0])
  const[sel,setSel]=useState<any[]>([])
  const[busy,setBusy]=useState(false)
  const existing=new Set(tasks.map(t=>t.title))
  const keyOf=(s:any)=>curTab+'::'+s.t
  function toggle(s:any){const key=keyOf(s);setSel(p=>p.find(x=>x.key===key)?p.filter(x=>x.key!==key):[...p,{...s,key}])}
  function selectAll(){const toAdd=SUGG[curTab].filter(s=>!existing.has(s.t)&&!sel.find(x=>x.key===keyOf(s)));setSel(p=>[...p,...toAdd.map(s=>({...s,key:keyOf(s)}))])}
  return(
    <Sheet size="lg" title="Sugestões de tarefas" onClose={onClose} footer={
      <button className="btn btn-p" disabled={sel.length===0||busy} onClick={async()=>{setBusy(true);try{await onAdd(sel)}finally{setBusy(false)}}}>
        {busy?'Adicionando...':sel.length===0?'Selecione tarefas':`Adicionar ${sel.length} tarefa${sel.length!==1?'s':''}`}
      </button>
    }>
      <div className="stabs">{cats.map(c=>{
        const n=sel.filter(x=>x.key.startsWith(c+'::')).length
        return <button key={c} className={`fc ${curTab===c?'on':''}`} onClick={()=>setCurTab(c)}>{c}{n>0&&` · ${n}`}</button>
      })}</div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <span style={{fontSize:12,color:'var(--sub)'}}>Toque para selecionar · ✎ para ajustar antes</span>
        <button onClick={selectAll} style={{fontSize:12.5,fontWeight:500,color:'var(--green)',background:'none',border:'none'}}>Selecionar todas</button>
      </div>
      {SUGG[curTab].map(s=>{
        const on=!!sel.find(x=>x.key===keyOf(s));const added=existing.has(s.t)
        return(
          <div key={s.t} className={`li ${on?'on':''} ${added?'off':''}`} onClick={()=>!added&&toggle(s)}>
            <span className={`chk ${on||added?'ok':''}`}>✓</span>
            <span className="li-t">{s.t}</span>
            <div className="li-m">
              {added?<span className="bdg bdg-n">já existe</span>:<>
                {s.ess&&<span className="bdg bdg-e">essencial</span>}
                <span className={`bdg bdg-${wCls(s.w)}`}>{WPT[s.w]}</span>
                <span className="bdg bdg-n">{FPT[s.f]}</span>
                <button className="ib" style={{width:28,height:28}} title="Ajustar antes de criar" onClick={e=>{e.stopPropagation();onCustomize(s)}}>✎</button>
              </>}
            </div>
          </div>
        )
      })}
    </Sheet>
  )
}

function PetModal({onClose,onSave,busy=false}:{onClose:()=>void,onSave:(d:any,r:any[])=>void,busy?:boolean}){
  const[pname,setPname]=useState('')
  const[breed,setBreed]=useState('')
  const[isPuppy,setIsPuppy]=useState(false)
  const[sel,setSel]=useState<string[]>(DR_DEF.map(r=>r.t))
  const allR=[...DR_DEF,...(isPuppy?DR_PUP:[])]
  const toggle=(t:string)=>setSel(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t])
  function pickPuppy(v:boolean){setIsPuppy(v);if(v)setSel(p=>Array.from(new Set([...p,...DR_PUP.map(r=>r.t)])))}
  const handle=()=>{if(!pname.trim())return;onSave({name:pname.trim(),breed:breed.trim()||null,is_puppy:isPuppy},allR.filter(r=>sel.includes(r.t)).map(r=>({title:r.t,frequency:r.f,scheduled_time:r.time})))}
  return(
    <Sheet title="Cadastrar pet" onClose={onClose} footer={<button className="btn btn-p" disabled={!pname.trim()||busy} onClick={handle}>{busy?'Salvando...':'Adicionar pet'}</button>}>
      <label className="fl">Nome</label><input className="fi" value={pname} onChange={e=>setPname(e.target.value)} placeholder="Ex: Luna, Bob..." autoFocus/>
      <label className="fl">Raça <span className="hint">(opcional)</span></label><input className="fi" value={breed} onChange={e=>setBreed(e.target.value)} placeholder="Ex: Golden Retriever, SRD..."/>
      <label className="fl">Fase</label>
      <div className="btng c2"><button className={`sbtn ${!isPuppy?'on':''}`} onClick={()=>pickPuppy(false)}>🐕 Adulto</button><button className={`sbtn ${isPuppy?'on':''}`} onClick={()=>pickPuppy(true)}>🐶 Filhote</button></div>
      <label className="fl">Rotinas <span className="hint">({allR.filter(r=>sel.includes(r.t)).length} selecionadas)</span></label>
      {allR.map(r=>{const on=sel.includes(r.t);return(
        <div key={r.t} className={`li ${on?'on':''}`} onClick={()=>toggle(r.t)}>
          <span className={`chk ${on?'ok':''}`}>✓</span>
          <span className="li-t">{r.t}</span>
          <div className="li-m">{r.time&&<span className="bdg bdg-t">{r.time}</span>}<span className="bdg bdg-n">{r.f==='daily'?'diária':'semanal'}</span></div>
        </div>
      )})}
    </Sheet>
  )
}

function EnergyModal({energy,onClose,onPick,busy=false}:{energy:string,onClose:()=>void,onPick:(e:'high'|'medium'|'low')=>void,busy?:boolean}){
  return(
    <Sheet size="sm" title="Energia da semana" onClose={onClose}>
      <div style={{fontSize:13,color:'var(--sub)',marginBottom:14}}>Como vocês chegam nessa semana?</div>
      <div className="btng" style={{gap:8}}>
        {(['high','medium','low'] as const).map(v=>(
          <button key={v} disabled={busy} className={`sbtn ${energy===v?'on':''}`} style={{padding:14,textAlign:'left',fontSize:14}} onClick={()=>onPick(v)}>
            {ENERGY[v].ic} {ENERGY[v].l}<small>{ENERGY[v].s}</small>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function MeetingModal({names,weekStart,onClose,onSave,busy=false}:{names:Names,weekStart:string,onClose:()=>void,onSave:(m:Meeting)=>void,busy?:boolean}){
  const[form,setForm]=useState<Meeting>({what_worked:'',what_overloaded:'',adjustments:'',priorities:'',mood_g:'ok',mood_s:'ok',wins:'',next_mode:'normal',reward:''})
  const set=(k:keyof Meeting,v:string)=>setForm(p=>({...p,[k]:v}))
  const moods=[['😌 Bem','ok'],['😐 Ok','mid'],['😔 Difícil','hard']]
  const modes=[['🌿 Normal','normal'],['⚡ Boss Mode','boss'],['🛡 Sobrevivência','survival']]
  const area=(n:string,k:keyof Meeting,label:string,ph:string)=>(
    <div className="meet"><label className="fl">{n} — {label}</label><textarea className="fita" value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={ph}/></div>
  )
  return(
    <Sheet size="lg" title="📋 Reunião semanal" onClose={onClose} footer={<button className="btn btn-p" disabled={busy} onClick={()=>onSave(form)}>{busy?'Salvando...':'Salvar reunião'}</button>}>
      <div style={{fontSize:13,color:'var(--sub)',marginBottom:18}}>Semana de {fmtDate(weekStart)} · 15 minutos · sem cobranças</div>
      {area('01','what_worked','O que funcionou essa semana?','Tarefas que rolaram bem, hábitos que mantiveram...')}
      {area('02','what_overloaded','O que sobrecarregou?','O que pesou demais, o que ficou acumulando...')}
      {area('03','adjustments','Ajuste para próxima semana','Uma mudança pequena e concreta...')}
      {area('04','priorities','Prioridades da semana','3 coisas mais importantes...')}
      <div className="meet">
        <label className="fl">05 — Como cada uma chega?</label>
        {(['g','s'] as Who[]).map(w=>(
          <div key={w} style={{marginBottom:w==='g'?12:0}}>
            <div style={{fontSize:12.5,color:'var(--sub)',marginBottom:6}}>{names[w]}</div>
            <div className="btng c3">{moods.map(([l,v])=><button key={v} className={`sbtn ${form[w==='g'?'mood_g':'mood_s']===v?'on':''}`} onClick={()=>set(w==='g'?'mood_g':'mood_s',v)}>{l}</button>)}</div>
          </div>
        ))}
      </div>
      {area('06','wins','Pequenas vitórias 🎉','Qualquer coisa que valha celebrar...')}
      <div className="meet">
        <label className="fl">07 — Modo da próxima semana</label>
        <div className="btng c3">{modes.map(([l,v])=><button key={v} className={`sbtn ${form.next_mode===v?'on':''}`} onClick={()=>set('next_mode',v)}>{l}</button>)}</div>
      </div>
      <div className="meet">
        <label className="fl">08 — Recompensa do casal <span className="hint">(se merecer)</span></label>
        <input className="fi" value={form.reward} onChange={e=>set('reward',e.target.value)} placeholder="Ex: jantar fora, noite de filme, delivery..."/>
      </div>
    </Sheet>
  )
}

// ── APP ─────────────────────────────────────────────────
export default function NinhoApp({householdId}:{householdId:string}){
  const [tab,setTabState]=useState('today')
  const [tasks,setTasks]=useState<Task[]>([])
  const [dogs,setDogs]=useState<Dog[]>([])
  const [settings,setSettings]=useState<Settings>({energy:'medium',survival:false})
  const [xp,setXp]=useState(0)
  const [streak,setStreak]=useState(0)
  const [names,setNames]=useState<Names>({g:'Giovanna',s:'Sabrina'})
  const [modal,setModal]=useState<string|null>(null)
  const [modalData,setModalData]=useState<any>(null)
  const [toast,setToast]=useState<{msg:string,undo?:()=>void,actionLabel?:string,tone?:'success'|'error'}|null>(null)
  const [taskFilter,setTaskFilter]=useState('all')
  const [query,setQuery]=useState('')
  const [historyData,setHistoryData]=useState<WeekHistory[]>([])
  const [accidents,setAccidents]=useState<PuppyAccident[]>([])
  const [person,setPerson]=useState<Who>('g')
  const [showDone,setShowDone]=useState<Record<Who,boolean>>({g:false,s:false})
  const [showAllToday,setShowAllToday]=useState(false)
  const [loading,setLoading]=useState(true)
  const [hasLoaded,setHasLoaded]=useState(false)
  const [loadError,setLoadError]=useState<string|null>(null)
  const [busyKeys,setBusyKeys]=useState<Set<string>>(()=>new Set())
  const toastTimer=useRef<any>(null)
  const busyRef=useRef<Set<string>>(new Set())
  const today=todayStr()
  const weekStart=weekStartStr()
  const dow=new Date(`${today}T12:00:00.000Z`).getUTCDay()
  const dowI=dow===0?6:dow-1

  // Preferências locais (aba e pessoa no celular)
  useEffect(()=>{
    try{
      const t=localStorage.getItem('ninho.tab');if(t&&TABS.some(x=>x[0]===t))setTabState(t)
      const p=localStorage.getItem('ninho.person');if(p==='g'||p==='s')setPerson(p)
    }catch{}
  },[])
  function setTab(t:string){setTabState(t);try{localStorage.setItem('ninho.tab',t)}catch{};window.scrollTo({top:0})}
  function pickPerson(w:Who){setPerson(w);try{localStorage.setItem('ninho.person',w)}catch{}}

  // ── LOAD ──────────────────────────────────────────────
  const loadAll=useCallback(async(options?:{silent?:boolean})=>{
    if(!options?.silent)setLoading(true)
    setLoadError(null)
    try{
      const snapshot=await loadNinhoSnapshot(householdId,today,weekStart)
      setTasks(snapshot.tasks)
      setDogs(snapshot.dogs)
      setSettings(snapshot.settings)
      setXp(snapshot.xp)
      setStreak(snapshot.streak)
      setAccidents(snapshot.accidents)
      setNames(snapshot.names)
      setHasLoaded(true)
    }catch(caught){
      reportError('carregar Ninho',caught)
      setLoadError(friendlyMessage(caught))
    }finally{
      if(!options?.silent)setLoading(false)
    }
  },[householdId,today,weekStart])

  const loadHistory=useCallback(async()=>{
    try{
      const weeks=Array.from({length:4},(_,index)=>addDaysToIsoDate(weekStart,-index*7))
      setHistoryData(await loadWeekHistory(householdId,weeks))
    }catch(caught){
      reportError('carregar histórico semanal',caught)
      setLoadError(friendlyMessage(caught))
    }
  },[householdId,weekStart])

  useEffect(()=>{void loadAll()},[loadAll])
  useEffect(()=>{if(tab==='week')void loadHistory()},[tab,loadHistory])

  // Realtime
  useEffect(()=>subscribeToHouseholdChanges(
    householdId,
    ()=>{void loadAll({silent:true})},
    error=>reportError('realtime',error),
  ),[householdId,loadAll])

  function showToast(msg:string,undo?:()=>void,actionLabel='Desfazer',tone:'success'|'error'='success'){
    setToast({msg,undo,actionLabel,tone})
    clearTimeout(toastTimer.current)
    toastTimer.current=setTimeout(()=>setToast(null),undo?5500:3000)
  }
  function setActionBusy(key:string,busy:boolean){
    if(busy)busyRef.current.add(key);else busyRef.current.delete(key)
    setBusyKeys(new Set(busyRef.current))
  }
  function isBusy(key:string){return busyKeys.has(key)}
  async function performAction(key:string,action:()=>Promise<void>,retry?:()=>void){
    if(busyRef.current.has(key))return false
    setActionBusy(key,true)
    try{
      await action()
      return true
    }catch(caught){
      reportError(key,caught)
      showToast(friendlyMessage(caught),retry,'Tentar novamente','error')
      return false
    }finally{
      setActionBusy(key,false)
    }
  }
  function closeModal(){setModal(null);setModalData(null)}
  function openModal(m:string,d?:any){setModal(m);setModalData(d??null)}

  if(!hasLoaded&&loading)return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#8a8882',fontFamily:"'DM Mono', monospace",fontSize:13}}>
      carregando o Ninho...
    </div>
  )

  if(!hasLoaded&&loadError)return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24,color:'#f2efe9'}}>
      <div style={{maxWidth:380,textAlign:'center'}}>
        <div style={{fontSize:16,marginBottom:8}}>Não foi possível carregar o Ninho</div>
        <div style={{fontSize:13,color:'#8a8882',marginBottom:18}}>{loadError}</div>
        <button onClick={()=>{void loadAll()}} style={{padding:'10px 18px',border:0,borderRadius:10,background:'#1D9E75',color:'#fff',fontWeight:500}}>Tentar novamente</button>
      </div>
    </div>
  )

  // ── ACTIONS ───────────────────────────────────────────
  async function toggleTask(t:Task){
    const key=`task:${t.id}`
    if(busyRef.current.has(key))return
    const was=!!t.completed_today
    setTasks(p=>p.map(x=>x.id===t.id?{...x,completed_today:!was}:x))
    setXp(v=>v+(was?-XPW[t.weight]:XPW[t.weight]))
    const ok=await performAction(key,async()=>{
      await setTaskCompletion({
        householdId,
        taskId:t.id,
        date:today,
        completed:!was,
        completedBy:t.assigned_to==='g'||t.assigned_to==='s'?t.assigned_to:person,
      })
    },()=>{void toggleTask(t)})
    if(!ok){
      setTasks(p=>p.map(x=>x.id===t.id?{...x,completed_today:was}:x))
      setXp(v=>v+(was?XPW[t.weight]:-XPW[t.weight]))
      return
    }
    if(!was)showToast(`+${XPW[t.weight]} XP · ${t.title}`,()=>{setToast(null);void toggleTask({...t,completed_today:true})})
    await loadAll({silent:true})
  }

  async function completeDog(r:DogRoutine){
    const key=`dog:${r.id}`
    if(busyRef.current.has(key))return
    const was=!!r.completed_today
    setDogs(p=>p.map(d=>({...d,routines:d.routines.map(x=>x.id===r.id?{...x,completed_today:!was}:x)})))
    setXp(v=>v+(was?-1:1))
    const ok=await performAction(key,async()=>{
      await setDogRoutineCompletion({householdId,routineId:r.id,date:today,completed:!was,completedBy:person})
    },()=>{void completeDog(r)})
    if(!ok){
      setDogs(p=>p.map(d=>({...d,routines:d.routines.map(x=>x.id===r.id?{...x,completed_today:was}:x)})))
      setXp(v=>v+(was?1:-1))
      return
    }
    if(!was)showToast(`+1 XP · ${r.title}`,()=>{setToast(null);void completeDog({...r,completed_today:true})})
    await loadAll({silent:true})
  }

  async function swapTask(t:Task){
    const n=t.assigned_to==='s'?'g':'s'
    const previous=t.assigned_to
    setTasks(p=>p.map(x=>x.id===t.id?{...x,assigned_to:n}:x))
    const ok=await performAction(`assign:${t.id}`,async()=>updateTaskAssignment(householdId,t.id,n),()=>{void swapTask(t)})
    if(!ok){setTasks(p=>p.map(x=>x.id===t.id?{...x,assigned_to:previous}:x));return}
    showToast(`Passada para ${firstName(names[n])}`)
    await loadAll({silent:true})
  }

  async function assignTask(id:string,to:string|null){
    const previous=tasks.find(task=>task.id===id)?.assigned_to??null
    setTasks(p=>p.map(x=>x.id===id?{...x,assigned_to:to}:x))
    const ok=await performAction(`assign:${id}`,async()=>updateTaskAssignment(householdId,id,to),()=>{void assignTask(id,to)})
    if(!ok){setTasks(p=>p.map(x=>x.id===id?{...x,assigned_to:previous}:x));return}
    await loadAll({silent:true})
  }

  async function deleteTask(id:string){
    if(!confirm('Remover essa tarefa?'))return
    const ok=await performAction(`delete-task:${id}`,async()=>deactivateTask(householdId,id),()=>{void deleteTask(id)})
    if(!ok)return
    showToast('Tarefa removida');closeModal();await loadAll({silent:true})
  }

  async function saveTask(data:any,editId?:string){
    const key=editId?`save-task:${editId}`:'save-task:new'
    const ok=await performAction(key,async()=>persistTask(householdId,data,editId),()=>{void saveTask(data,editId)})
    if(!ok)return
    showToast(editId?'Tarefa atualizada!':`"${data.title}" criada!`)
    closeModal();await loadAll({silent:true})
  }

  async function addSuggestions(sel:any[]){
    const existing=new Set(tasks.map(t=>t.title))
    const toAdd=sel.filter(s=>!existing.has(s.t)).map(s=>({household_id:householdId,title:s.t,category:s.cat,weight:s.w,frequency:s.f,assigned_to:null,scheduled_time:null,essential:s.ess,active:true}))
    const ok=await performAction('add-suggestions',async()=>insertTasks(householdId,toAdd),()=>{void addSuggestions(sel)})
    if(!ok)return
    if(toAdd.length>0)showToast(`${toAdd.length} tarefa${toAdd.length!==1?'s':''} adicionada${toAdd.length!==1?'s':''}!`)
    closeModal();await loadAll({silent:true})
  }

  async function savePet(data:any,routines:any[]){
    const ok=await performAction('save-pet',async()=>createPet(householdId,data,routines),()=>{void savePet(data,routines)})
    if(!ok)return
    showToast(`${data.name} cadastrado(a)!`);closeModal();await loadAll({silent:true})
  }

  async function toggleSurvival(){
    const ns=!settings.survival
    setSettings(p=>({...p,survival:ns}))
    const ok=await performAction('weekly-settings',async()=>saveWeeklySettings(householdId,weekStart,{energy:settings.energy,survival:ns}),()=>{void toggleSurvival()})
    if(!ok){setSettings(p=>({...p,survival:!ns}));return}
    showToast(ns?'Modo sobrevivência ativado':'Modo normal ativado')
  }

  async function setEnergy(e:'high'|'medium'|'low'){
    const previous=settings.energy
    setSettings(p=>({...p,energy:e}))
    const ok=await performAction('weekly-settings',async()=>saveWeeklySettings(householdId,weekStart,{energy:e,survival:settings.survival}),()=>{void setEnergy(e)})
    if(!ok){setSettings(p=>({...p,energy:previous}));return}
    closeModal();showToast('Energia atualizada!')
  }

  async function updateName(role:Who,val:string){
    if(!val.trim()||val.trim()===names[role])return
    const previous=names[role]
    const displayName=val.trim()
    setNames(n=>({...n,[role]:displayName}))
    const ok=await performAction(`name:${role}`,async()=>saveProfileName(householdId,role,displayName),()=>{void updateName(role,displayName)})
    if(!ok){setNames(n=>({...n,[role]:previous}));return}
    showToast('Nome atualizado!')
  }

  async function saveMeeting(data:Meeting){
    const ok=await performAction('save-meeting',async()=>persistMeeting(householdId,weekStart,data),()=>{void saveMeeting(data)})
    if(!ok)return
    showToast('Reunião salva!');closeModal()
    if(tab==='week')await loadHistory()
  }

  async function addAccident(dogId:string,location:string){
    const ok=await performAction(`accident:${dogId}:${location}`,async()=>createPuppyAccident(householdId,dogId,location,today),()=>{void addAccident(dogId,location)})
    if(!ok)return
    showToast('Acidente registrado');await loadAll({silent:true})
  }

  async function autoDistribute(){
    const active=tasks.filter(t=>t.frequency!=='once')
    if(!active.length){showToast('Adicione tarefas primeiro');return}
    let gS=0,sS=0
    const updates:Array<{id:string,assigned_to:string}>=[]
    const assign=(t:Task,who:Who)=>{updates.push({id:t.id,assigned_to:who});const w=XPW[t.weight]*(FEFF[t.frequency]||1);if(who==='g')gS+=w;else sS+=w}
    active.filter(t=>t.essential&&t.category==='dogs').sort((a,b)=>(a.scheduled_time||'').localeCompare(b.scheduled_time||'')).forEach((t,i)=>assign(t,i%2===0?'g':'s'))
    active.filter(t=>t.weight==='heavy'&&!(t.essential&&t.category==='dogs')).forEach(t=>assign(t,gS<=sS?'g':'s'))
    active.filter(t=>t.frequency==='daily'&&!t.essential&&t.weight!=='heavy').forEach(t=>assign(t,gS*0.85<=sS?'g':'s'))
    active.filter(t=>!updates.find(u=>u.id===t.id)).forEach(t=>assign(t,gS<=sS?'g':'s'))
    const ok=await performAction('auto-distribute',async()=>applyTaskDistribution(householdId,updates as Array<{id:string,assigned_to:Who}>),()=>{void autoDistribute()})
    if(!ok)return
    showToast(`Distribuído — ${firstName(names.g)}: ${Math.round(gS)}pts · ${firstName(names.s)}: ${Math.round(sS)}pts`)
    await loadAll({silent:true})
  }

  // ── DERIVED ───────────────────────────────────────────
  const focusMode=settings.survival||settings.energy==='low'
  const todayTasks=focusMode&&!showAllToday?tasks.filter(t=>t.essential):tasks
  const hiddenCount=tasks.length-todayTasks.length
  const doneToday=tasks.filter(t=>t.completed_today).length
  const dayPct=tasks.length?Math.round(doneToday/tasks.length*100):0
  const dailyTasks=tasks.filter(t=>t.frequency==='daily')
  const chaos=dailyTasks.length?Math.max(0,Math.round(100-(dailyTasks.filter(t=>t.completed_today).length/dailyTasks.length)*100)):0
  const ci=getChaosInfo(chaos)
  const lv=getLevel(xp)
  const nextLevel=LEVELS.find(level=>level.min>xp)
  const xpPct=Math.min(100,Math.round(((xp-lv.min)/(lv.max-lv.min))*100))
  const puppies=dogs.filter(d=>d.is_puppy)
  const dogDaily=dogs.flatMap(d=>d.routines.filter(r=>r.frequency==='daily').map(r=>({r,dog:d})))
  const dogDone=dogDaily.filter(x=>x.r.completed_today).length
  const en=ENERGY[settings.energy]||ENERGY.medium
  const h=hourInSaoPaulo()
  const hello=h<5?'Boa noite':h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'
  const dateLabel=formatLongDateInSaoPaulo()
  const countFor=(w:Who)=>{const all=todayTasks.filter(t=>belongsTo(t,w));return{all:all.length,done:all.filter(t=>t.completed_today).length}}

  // ── RENDER HELPERS ────────────────────────────────────
  const taskRow=(t:Task,actions=true)=>{
    const other:Who=t.assigned_to==='s'?'g':'s'
    const hasMeta=t.essential||t.scheduled_time||t.frequency!=='daily'
    const completionBusy=isBusy(`task:${t.id}`)
    const assignmentBusy=isBusy(`assign:${t.id}`)
    return(
      <div key={t.id} className={`tr ${t.completed_today?'done':''}`}>
        <button disabled={completionBusy} className={`chk ${t.essential?'ess':''}`} onClick={()=>toggleTask(t)} aria-label={t.completed_today?`Desmarcar ${t.title}`:`Concluir ${t.title}`}>✓</button>
        <div className="trb" onClick={()=>{if(!completionBusy)void toggleTask(t)}} aria-disabled={completionBusy}>
          <div className="trt">{t.title}</div>
          {hasMeta&&<div className="trm">
            {t.essential&&!t.completed_today&&<span className="tag-e">● essencial</span>}
            {t.scheduled_time&&<span className="tag-t">⏰ {hhmm(t.scheduled_time)}</span>}
            {t.frequency!=='daily'&&<span>{FPT[t.frequency]}</span>}
          </div>}
        </div>
        <span className={`xp xp-${wCls(t.weight)}`} title={WPT[t.weight]}>+{XPW[t.weight]}</span>
        {actions&&<button disabled={assignmentBusy} className="ib" onClick={()=>swapTask(t)} title={`Passar para ${firstName(names[other])}`} aria-label={`Passar para ${firstName(names[other])}`}>⇄</button>}
        {actions&&<button className="ib" onClick={()=>openModal('task',t)} title="Editar" aria-label="Editar">✎</button>}
      </div>
    )
  }

  const personCard=(who:Who)=>{
    const all=todayTasks.filter(t=>belongsTo(t,who))
    const pend=all.filter(t=>!t.completed_today)
    const done=all.filter(t=>t.completed_today)
    const pct=all.length?Math.round(done.length/all.length*100):0
    const doneXP=done.reduce((s,t)=>s+XPW[t.weight],0)
    const essLeft=pend.filter(t=>t.essential).length
    return(
      <section key={who} className="card pcard" data-hide={person!==who?'1':'0'}>
        <div className="ph">
          <div className={`av av-${who}`}>{initials(names[who])}</div>
          <div style={{minWidth:0}}>
            <div className="pname">{names[who]}</div>
            <div className="prole">{ROLE[who]}{essLeft>0&&<> · <span style={{color:'var(--cor)'}}>{essLeft} essencia{essLeft>1?'is':'l'}</span></>}</div>
          </div>
          <Ring pct={pct} color={who==='g'?'var(--green)':'var(--pur)'} label={`${done.length}/${all.length}`}/>
        </div>
        {all.length===0?(
          <div className="empty"><span className="empty-icon">📋</span>{who==='g'?'Nenhuma tarefa ainda':'Nenhuma tarefa atribuída'}
            <div><button className="btn btn-s" onClick={()=>openModal('sugg')}>✦ Ver sugestões</button></div>
          </div>
        ):<>
          {pend.length===0&&<div className="alldone">🎉 Tudo feito por hoje!<small>+{doneXP} XP conquistados</small></div>}
          {byCat(pend).map(([cat,list])=>(
            <div key={cat}>
              <div className="cdiv">{CAT[cat]||cat}</div>
              {list.map(t=>taskRow(t))}
            </div>
          ))}
          {done.length>0&&<>
            <button className="dtog" onClick={()=>setShowDone(p=>({...p,[who]:!p[who]}))} aria-expanded={showDone[who]}>
              <span style={{width:12}}>{showDone[who]?'▾':'▸'}</span>Concluídas ({done.length})
              <span className="mono" style={{marginLeft:'auto',color:'var(--green)',fontSize:12}}>+{doneXP} XP</span>
            </button>
            {showDone[who]&&done.map(t=>taskRow(t,false))}
          </>}
        </>}
      </section>
    )
  }

  const dogRow=(r:DogRoutine,dogName?:string)=>{
    const busy=isBusy(`dog:${r.id}`)
    return(
    <div key={r.id} className={`dr ${r.completed_today?'done':''}`} role="button" tabIndex={0} aria-disabled={busy} onKeyDown={event=>{if((event.key==='Enter'||event.key===' ')&&!busy)void completeDog(r)}} onClick={()=>{if(!busy)void completeDog(r)}}>
      <span className={`chk ${r.completed_today?'ok':''}`}>✓</span>
      <span className="dr-t">{r.title}</span>
      {dogName&&<span className="dr-m">{dogName}</span>}
      {r.scheduled_time&&<span className="dr-m">{hhmm(r.scheduled_time)}</span>}
    </div>
  )}

  const actionBtn=(ic:string,t:string,s:string,onClick:()=>void,tint?:string)=>(
    <button className="act" onClick={onClick}>
      <span className="act-ic" style={tint?{background:tint}:undefined}>{ic}</span>
      <span style={{minWidth:0}}><div className="act-t">{t}</div><div className="act-s">{s}</div></span>
      <span className="chev">›</span>
    </button>
  )

  // ── TAREFAS: filtros ──────────────────────────────────
  const q=query.trim().toLowerCase()
  const filtered=tasks.filter(t=>{
    if(taskFilter==='essential'&&!t.essential)return false
    if(taskFilter==='g'&&t.assigned_to!=='g')return false
    if(taskFilter==='s'&&t.assigned_to!=='s')return false
    if(taskFilter==='r'&&t.assigned_to)return false
    if(CAT[taskFilter]&&t.category!==taskFilter)return false
    if(q&&!t.title.toLowerCase().includes(q))return false
    return true
  })
  const usedCats=Object.keys(CAT).filter(k=>tasks.some(t=>t.category===k))

  // ── SEMANA: equilíbrio ────────────────────────────────
  const act=tasks.filter(t=>t.frequency!=='once')
  const loadOf=(w:Who)=>act.filter(t=>belongsTo(t,w)).reduce((s,t)=>s+XPW[t.weight]*(FEFF[t.frequency]||1),0)
  const gS=loadOf('g'),sS=loadOf('s'),tot=gS+sS
  const gP=tot>0?Math.round((gS/tot)*100):50
  const balanced=Math.abs(gS-sS)<=3
  const maxHist=Math.max(1,...historyData.map(w=>w.completions))

  return(
    <>
      <style>{CSS}</style>

      {/* HEADER */}
      <header className="top">
        <div className="top-in">
          <button className="logo" onClick={()=>setTab('today')}>Ni<span>nho</span></button>
          <nav className="tnav">
            {TABS.map(([k,ic,l])=><button key={k} className={`tnb ${tab===k?'on':''}`} onClick={()=>setTab(k)}><span className="ic">{ic}</span>{l}</button>)}
          </nav>
          <div className="status">
            <button className={`chip ${en.cls}`} onClick={()=>openModal('energy')} title="Energia da semana">{en.ic} <span className="chip-hide">{en.short}</span></button>
            {settings.survival&&<button className="chip coral" onClick={toggleSurvival} title="Modo sobrevivência ativo">🛡</button>}
            <span className="chip chip-hide">Nv{lv.l} · {xp} XP</span>
            <span className="chip amber" title={`${streak} dias seguidos`}>🔥 {streak}</span>
          </div>
        </div>
      </header>

      <main className="main">
        {loadError&&hasLoaded&&(
          <div className="banner surv">
            <span>{loadError}</span>
            <button className="lnk" onClick={()=>{void loadAll()}}>Tentar novamente</button>
          </div>
        )}
        {/* ── HOJE ── */}
        {tab==='today'&&<div className="scr">
          <div className="sh">
            <div><h1>{hello} 👋</h1><p>{dateLabel}</p></div>
          </div>

          <div className="stats">
            <div className="stat">
              <div className="stat-l">Hoje</div>
              <div className="stat-v">{dayPct}%<small>{doneToday}/{tasks.length}</small></div>
              <div className="bar"><div className="barf" style={{width:dayPct+'%',background:'var(--gdk)'}}/></div>
            </div>
            <div className="stat">
              <div className="stat-l">Casa</div>
              <div className="stat-v stat-txt" style={{color:ci.color}}>{ci.label}</div>
              <div className="bar"><div className="barf" style={{width:chaos+'%',background:ci.color}}/></div>
            </div>
            <button className="stat" onClick={()=>setTab('week')}>
              <div className="stat-l">Nível {lv.l} · {lv.n}</div>
              <div className="stat-v">{xp}<small>/ {lv.max} XP</small></div>
              <div className="bar"><div className="barf" style={{width:xpPct+'%',background:'var(--pur)'}}/></div>
            </button>
            <div className="stat">
              <div className="stat-l">Sequência</div>
              <div className="stat-v">🔥 {streak}<small>dia{streak!==1?'s':''}</small></div>
              <div className="week-dots">{[0,1,2,3,4,5,6].map(i=><div key={i} className={`wd ${i===dowI?(doneToday>0?'on':'today'):(i<dowI&&dowI-i<=streak-(doneToday>0?1:0))?'on':''}`}/>)}</div>
            </div>
          </div>

          {settings.survival?(
            <div className="banner surv">🛡 <span>Modo sobrevivência — {showAllToday?'mostrando todas as tarefas':`só essenciais${hiddenCount>0?` · ${hiddenCount} ocultas`:''}`}</span>
              <button className="lnk" onClick={()=>setShowAllToday(v=>!v)}>{showAllToday?'Só essenciais':'Mostrar todas'}</button>
              <button className="lnk" style={{marginLeft:0}} onClick={toggleSurvival}>Desativar</button>
            </div>
          ):settings.energy==='low'&&(
            <div className="banner low">🌧 <span>Semana de baixa energia — {showAllToday?'mostrando todas':`foco no essencial${hiddenCount>0?` · ${hiddenCount} ocultas`:''}`}</span>
              <button className="lnk" onClick={()=>setShowAllToday(v=>!v)}>{showAllToday?'Só essenciais':'Mostrar todas'}</button>
            </div>
          )}

          <div className="today">
            <div className="seg" style={{gridColumn:'1/-1'}}>
              {(['g','s'] as Who[]).map(w=>{const c=countFor(w);return(
                <button key={w} className={`segb ${person===w?'on':''}`} onClick={()=>pickPerson(w)}>
                  <span className="d" style={{background:w==='g'?'var(--green)':'var(--pur)'}}/>{firstName(names[w])}<span className="cnt">{c.done}/{c.all}</span>
                </button>
              )})}
            </div>
            {personCard('g')}
            {personCard('s')}
            <aside className="side">
              <div className="card">
                <div className="slbl">🐾 Cães hoje {dogDaily.length>0&&<span className="mono" style={{color:'var(--faint)'}}>{dogDone}/{dogDaily.length}</span>}<button className="lnk" onClick={()=>setTab('pets')}>Ver →</button></div>
                {dogs.length===0?(
                  <div className="empty" style={{padding:'12px 0'}}>Nenhum pet ainda<div><button className="btn btn-s" onClick={()=>openModal('pet')}>+ Cadastrar pet</button></div></div>
                ):dogDaily.length===0?<div style={{fontSize:13,color:'var(--sub)'}}>Sem rotinas diárias</div>
                :dogDaily.map(({r,dog})=>dogRow(r,dogs.length>1?dog.name:undefined))}
              </div>
              <div className="card">
                <div className="slbl">Atalhos</div>
                <div className="acts">
                  {actionBtn('✦','Distribuir tarefas',isBusy('auto-distribute')?'Distribuindo...':'Equilibra a carga entre vocês',()=>{void autoDistribute()},'var(--pbg)')}
                  {actionBtn(en.ic,'Energia da semana',en.l,()=>openModal('energy'))}
                  {actionBtn('🛡',settings.survival?'Sair do modo sobrevivência':'Modo sobrevivência',settings.survival?'Ativo · só essenciais':'Só o essencial por um tempo',toggleSurvival,settings.survival?'var(--cbg)':undefined)}
                  {actionBtn('📋','Reunião semanal','15 minutos, sem cobranças',()=>openModal('meeting'))}
                </div>
              </div>
            </aside>
          </div>
        </div>}

        {/* ── TAREFAS ── */}
        {tab==='tasks'&&<div className="scr">
          <div className="sh">
            <div><h2>Tarefas</h2><p>{tasks.length} ativa{tasks.length!==1?'s':''} · toque numa tarefa para editar</p></div>
            <div className="sh-a">
              <button className="btn btn-s" onClick={()=>openModal('sugg')}>✦ Sugestões</button>
              <button className="btn btn-p" onClick={()=>openModal('task',null)}>+ Nova tarefa</button>
            </div>
          </div>
          <div className="search">
            <span style={{color:'var(--sub)'}}>⌕</span>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar tarefa..." aria-label="Buscar tarefa"/>
            {query&&<button className="x" onClick={()=>setQuery('')} aria-label="Limpar busca">✕</button>}
          </div>
          <div className="fchips">
            {[['all',`Todas · ${tasks.length}`],['essential','🔴 Essenciais'],['g',firstName(names.g)],['s',firstName(names.s)],['r','Rodízio'],...usedCats.map(k=>[k,CAT[k]])].map(([k,v])=>(
              <button key={k} className={`fc ${taskFilter===k?'on':''}`} onClick={()=>setTaskFilter(k)}>{v}</button>
            ))}
          </div>
          {tasks.length===0?(
            <div className="card empty"><span className="empty-icon">📋</span>Nenhuma tarefa cadastrada ainda<div><button className="btn btn-p" onClick={()=>openModal('sugg')}>✦ Começar com sugestões</button></div></div>
          ):filtered.length===0?(
            <div className="empty"><span className="empty-icon">🔍</span>Nada encontrado com esse filtro<div><button className="btn btn-g" onClick={()=>{setTaskFilter('all');setQuery('')}}>Limpar filtros</button></div></div>
          ):byCat(filtered).map(([cat,list])=>(
            <div key={cat} className="tgrp">
              <div className="cdiv">{CAT[cat]||cat}<span className="n">{list.length}</span></div>
              <div className="tlist">
                {list.map(t=>(
                  <div key={t.id} className="tc">
                    <span className={`wdot w-${wCls(t.weight)}`} title={WPT[t.weight]}/>
                    <div className="tc-info" onClick={()=>openModal('task',t)}>
                      <div className="tc-title">{t.title}</div>
                      <div className="tc-meta">
                        {t.essential&&<span className="bdg bdg-e">essencial</span>}
                        <span className={`bdg bdg-${wCls(t.weight)}`}>{WPT[t.weight]} +{XPW[t.weight]}</span>
                        <span className="bdg bdg-n">{FPT[t.frequency]}</span>
                        {t.scheduled_time&&<span className="bdg bdg-t">⏰ {hhmm(t.scheduled_time)}</span>}
                      </div>
                    </div>
                    <div className="asg" role="group" aria-label="Responsável">
                      <button disabled={isBusy(`assign:${t.id}`)} className={t.assigned_to==='g'?'on-g':''} onClick={()=>assignTask(t.id,'g')}>{firstName(names.g)}</button>
                      <button disabled={isBusy(`assign:${t.id}`)} className={t.assigned_to==='s'?'on-s':''} onClick={()=>assignTask(t.id,'s')}>{firstName(names.s)}</button>
                      <button disabled={isBusy(`assign:${t.id}`)} className={!t.assigned_to?'on-r':''} onClick={()=>assignTask(t.id,null)} title="Rodízio">↻</button>
                    </div>
                    <button disabled={isBusy(`delete-task:${t.id}`)} className="ib danger" onClick={()=>deleteTask(t.id)} title="Remover" aria-label="Remover">✕</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>}

        {/* ── SEMANA ── */}
        {tab==='week'&&<div className="scr">
          <div className="sh">
            <div><h2>Semana</h2><p>Semana de {fmtDate(weekStart)} · {en.l.toLowerCase()}</p></div>
            <div className="sh-a"><button className="btn btn-g" onClick={()=>openModal('meeting')}>📋 Reunião semanal</button></div>
          </div>
          <div className="wgrid">
            <div className="col">
              <div className="card">
                <div className="slbl">Divisão da carga</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}>
                  <span style={{fontSize:14,fontWeight:500}}><span style={{color:'var(--green)'}}>●</span> {firstName(names.g)} <span style={{color:'var(--sub)',fontWeight:400}}>{gP}%</span></span>
                  <span style={{fontSize:12,color:balanced?'var(--green)':'var(--amb)'}}>{balanced?'✓ Equilibrado':`⚠ ${Math.round(Math.abs(gS-sS))} pts de diferença`}</span>
                  <span style={{fontSize:14,fontWeight:500}}><span style={{color:'var(--sub)',fontWeight:400}}>{100-gP}%</span> {firstName(names.s)} <span style={{color:'var(--pur)'}}>●</span></span>
                </div>
                <div className="balance"><div style={{width:gP+'%',background:'var(--gdk)',transition:'width .4s'}}/><div style={{flex:1,background:'var(--pur)'}}/></div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--sub)',marginBottom:14}}>
                  <span><b style={{color:'var(--tx)',fontWeight:500}}>{Math.round(gS)}</b> pts · {act.filter(t=>belongsTo(t,'g')).length} tarefas</span>
                  <span><b style={{color:'var(--tx)',fontWeight:500}}>{Math.round(sS)}</b> pts · {act.filter(t=>belongsTo(t,'s')).length} tarefas</span>
                </div>
                <button className="btn btn-pur btn-w" disabled={isBusy('auto-distribute')} onClick={autoDistribute}>{isBusy('auto-distribute')?'Distribuindo...':'✦ Distribuir automaticamente'}</button>
                <div style={{fontSize:12,color:'var(--sub)',marginTop:8,textAlign:'center'}}>Ou ajuste uma a uma em <button onClick={()=>setTab('tasks')} style={{background:'none',border:'none',color:'var(--green)',fontSize:12}}>Tarefas →</button></div>
              </div>
              <div className="card">
                <div className="slbl">Energia da semana</div>
                <div className="opts">
                  {(['high','medium','low'] as const).map(v=>(
                    <button key={v} className={`opt ${settings.energy===v?'on':''}`} onClick={()=>setEnergy(v)}>
                      <div className="opt-t">{ENERGY[v].ic} {ENERGY[v].short}</div><div className="opt-s">{ENERGY[v].s}</div>
                    </button>
                  ))}
                </div>
                <div className="row" style={{marginTop:14,borderTop:'1px solid var(--bd)'}}>
                  <div><div className="row-t">🛡 Modo sobrevivência</div><div className="row-s">Mostra só as tarefas essenciais em Hoje</div></div>
                  <button className={`switch ${settings.survival?'on':''}`} onClick={toggleSurvival} role="switch" aria-checked={settings.survival} aria-label="Modo sobrevivência"/>
                </div>
              </div>
            </div>
            <div className="col">
              <div className="card">
                <div className="slbl">Nível do casal</div>
                <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                  <span style={{fontSize:32,fontWeight:300,letterSpacing:'-.03em'}}>{xp}</span><span style={{color:'var(--sub)',fontSize:13}}>XP · Nv{lv.l} {lv.n}</span>
                </div>
                <div className="bar"><div className="barf" style={{width:xpPct+'%',background:'var(--pur)'}}/></div>
                <div style={{fontSize:12,color:'var(--sub)',marginTop:8}}>{nextLevel?`Faltam ${nextLevel.min-xp} XP para ${nextLevel.n}`:'Nível máximo 🏆'}</div>
              </div>
              <div className="card">
                <div className="slbl">Últimas 4 semanas</div>
                {historyData.length===0?<div style={{fontSize:13,color:'var(--sub)',padding:'8px 0'}}>Carregando...</div>:
                  historyData.map((w,i)=>(
                    <div key={w.week} className="hist">
                      <div className="hist-h">
                        <span style={{fontSize:14,fontWeight:500}}>{i===0?'Esta semana':'Semana de '+fmtDate(w.week)}</span>
                        <span style={{fontSize:12,color:'var(--sub)'}}>{w.meeting&&<span className="bdg bdg-l" style={{marginRight:6}}>reunião ✓</span>}<span className="mono">{w.completions}</span> feitas</span>
                      </div>
                      <div className="bar" style={{marginTop:8}}><div className="barf" style={{width:(w.completions/maxHist*100)+'%',background:i===0?'var(--gdk)':'var(--faint)'}}/></div>
                      {w.meeting&&(w.meeting.wins||w.meeting.what_worked)&&(
                        <div className="hist-note">
                          {w.meeting.wins&&<div>🎉 {w.meeting.wins}</div>}
                          {w.meeting.what_worked&&<div>✓ {w.meeting.what_worked}</div>}
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>}

        {/* ── CÃES ── */}
        {tab==='pets'&&<div className="scr">
          <div className="sh">
            <div><h2>Cães</h2><p>{dogs.length} pet{dogs.length!==1?'s':''}{dogDaily.length>0&&` · ${dogDone}/${dogDaily.length} rotinas hoje`}</p></div>
            <div className="sh-a"><button className="btn btn-s" onClick={()=>openModal('pet')}>+ Adicionar pet</button></div>
          </div>
          {puppies.map(pup=>{
            const todayAcc=accidents.filter(a=>a.dog_id===pup.id&&a.date===today).length
            return(
              <div key={pup.id} className="puppy">
                <div className="slbl" style={{color:'var(--amb)'}}>🐶 Modo filhote · {pup.name}</div>
                <div style={{fontSize:15,fontWeight:500}}>{todayAcc===0?'Nenhum acidente hoje 🎉':`${todayAcc} acidente${todayAcc>1?'s':''} hoje`}</div>
                <div className="pills">
                  {['Sala','Quarto','Cozinha','Banheiro','Corredor'].map(loc=>(
                    <button key={loc} className="pill" onClick={()=>addAccident(pup.id,loc)}>+ {loc}</button>
                  ))}
                </div>
                {accidents.filter(a=>a.dog_id===pup.id).slice(0,5).map((a:any)=>(
                  <div key={a.id} className="acc">
                    <span>💧</span><span>{a.location}</span>
                    <span className="mono" style={{marginLeft:'auto',fontSize:11,color:'var(--sub)'}}>
                      {a.date!==today&&fmtDate(a.date)+' · '}{formatTimeInSaoPaulo(a.occurred_at)}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
          {dogs.length===0?(
            <div className="card empty"><span className="empty-icon">🐾</span>Nenhum pet cadastrado<div><button className="btn btn-p" onClick={()=>openModal('pet')}>Cadastrar pet</button></div></div>
          ):(
            <div className="dgrid">
              {dogs.map(dog=>{
                const daily=dog.routines.filter(r=>r.frequency==='daily')
                const periodic=dog.routines.filter(r=>r.frequency!=='daily')
                const dDone=daily.filter(r=>r.completed_today).length
                return(
                  <div key={dog.id} className="card">
                    <div className="dh">
                      <div className="dav">{dog.is_puppy?'🐶':'🐕'}</div>
                      <div style={{minWidth:0}}><div className="pname">{dog.name}</div><div className="prole">{dog.breed||'Raça não informada'} · {dog.is_puppy?'Filhote':'Adulto'}</div></div>
                      <Ring pct={daily.length?Math.round(dDone/daily.length*100):0} color="var(--green)" label={`${dDone}/${daily.length}`}/>
                    </div>
                    {daily.length>0&&<><div className="slbl">Rotina diária</div>{daily.map(r=>dogRow(r))}</>}
                    {periodic.length>0&&<>
                      <div className="slbl" style={{marginTop:14}}>Periódicas</div>
                      {periodic.map(r=>(
                        <div key={r.id} className="dr" style={{cursor:'default'}}>
                          <span className="dr-t" style={{color:'var(--mu)'}}>{r.title}</span>
                          <span className="bdg bdg-n">{FPT[r.frequency]||r.frequency}</span>
                        </div>
                      ))}
                    </>}
                  </div>
                )
              })}
            </div>
          )}
        </div>}

        {/* ── AJUSTES ── */}
        {tab==='settings'&&<div className="scr narrow">
          <div className="sh"><div><h2>Ajustes</h2><p>Integrantes e como o Ninho funciona</p></div></div>
          <div className="card" style={{marginBottom:14}}>
            <div className="slbl">Integrantes</div>
            {(['g','s'] as Who[]).map(w=>(
              <div key={w} className="field-row">
                <div className={`av av-${w}`}>{initials(names[w])}</div>
                <div><div className="row-t">{firstName(names[w])}</div><div className="row-s">{ROLE[w]}</div></div>
                <input className="fi" key={names[w]} defaultValue={names[w]} onBlur={e=>updateName(w,e.target.value)} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}} aria-label={`Nome de ${ROLE[w]}`}/>
              </div>
            ))}
          </div>
          <div className="card" style={{marginBottom:14}}>
            <div className="slbl">Resumo</div>
            <div className="row"><span className="row-t">Tarefas ativas</span><span className="mono" style={{marginLeft:'auto',color:'var(--sub)'}}>{tasks.length}</span></div>
            <div className="row"><span className="row-t">Pets</span><span className="mono" style={{marginLeft:'auto',color:'var(--sub)'}}>{dogs.length}</span></div>
            <div className="row"><span className="row-t">XP total</span><span className="mono" style={{marginLeft:'auto',color:'var(--sub)'}}>{xp} · Nv{lv.l}</span></div>
            <div className="row"><span className="row-t">Sequência</span><span className="mono" style={{marginLeft:'auto',color:'var(--sub)'}}>🔥 {streak} dias</span></div>
          </div>
          <div className="card">
            <div className="slbl">Como funciona</div>
            <div className="legend">
              <div className="lg"><span className="lg-k"><span className="xp xp-l">+1</span> <span className="xp xp-m">+2</span> <span className="xp xp-h">+3</span></span><span><b>Esforço</b> — leve, médio e pesado. O XP acumula para o casal.</span></div>
              <div className="lg"><span className="lg-k"><span className="tag-e">● essencial</span></span><span><b>Essencial</b> — não pode falhar. Fica em destaque e aparece mesmo no modo sobrevivência.</span></div>
              <div className="lg"><span className="lg-k"><span className="tag-t">⏰ 08:00</span></span><span><b>Horário</b> — tarefas com hora marcada.</span></div>
              <div className="lg"><span className="lg-k">🔥</span><span><b>Sequência</b> — dias seguidos com pelo menos uma tarefa concluída.</span></div>
              <div className="lg"><span className="lg-k">🏠</span><span><b>Casa</b> — mede quantas tarefas diárias ainda estão pendentes hoje.</span></div>
              <div className="lg"><span className="lg-k">⇄</span><span><b>Trocar</b> — passa a tarefa para a outra pessoa.</span></div>
            </div>
          </div>
        </div>}
      </main>

      {/* NAV MOBILE */}
      <nav className="bnav">
        {TABS.map(([k,ic,l])=><button key={k} className={`bnb ${tab===k?'on':''}`} onClick={()=>setTab(k)} aria-current={tab===k?'page':undefined}><span className="ic">{ic}</span>{l}</button>)}
      </nav>

      {(tab==='today'||tab==='tasks')&&<button className="fab" onClick={()=>openModal('task',null)} aria-label="Nova tarefa"><span>+</span><b>Nova tarefa</b></button>}

      {toast&&<div className={`toast ${toast.tone==='error'?'error':''}`} role={toast.tone==='error'?'alert':'status'}><span className="toast-m">{toast.msg}</span>{toast.undo&&<button onClick={toast.undo}>{toast.actionLabel||'Desfazer'}</button>}</div>}
      {modal==='task'&&<TaskFormModal task={modalData} names={names} onClose={closeModal} onSave={saveTask} onDelete={deleteTask} busy={isBusy(modalData?.id?`save-task:${modalData.id}`:'save-task:new')||isBusy(`delete-task:${modalData?.id}`)}/>}
      {modal==='sugg'&&<SuggModal tasks={tasks} onClose={closeModal} onAdd={addSuggestions} onCustomize={s=>openModal('task',{title:s.t,category:s.cat,weight:s.w,frequency:s.f,essential:s.ess,assigned_to:null,scheduled_time:null,active:true,id:null})}/>}
      {modal==='pet'&&<PetModal onClose={closeModal} onSave={savePet} busy={isBusy('save-pet')}/>}
      {modal==='energy'&&<EnergyModal energy={settings.energy} onClose={closeModal} onPick={setEnergy} busy={isBusy('weekly-settings')}/>}
      {modal==='meeting'&&<MeetingModal names={names} weekStart={weekStart} onClose={closeModal} onSave={saveMeeting} busy={isBusy('save-meeting')}/>}
    </>
  )
}
