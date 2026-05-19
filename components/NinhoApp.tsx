'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ── TYPES ──────────────────────────────────────────────
interface Task {
  id: string; title: string; category: string; weight: 'light'|'medium'|'heavy'
  frequency: string; assigned_to: string|null; scheduled_time: string|null
  essential: boolean; active: boolean; completed_today?: boolean
}
interface Dog {
  id: string; name: string; breed: string|null; is_puppy: boolean
  routines: DogRoutine[]
}
interface DogRoutine {
  id: string; title: string; frequency: string; scheduled_time: string|null
  completed_today?: boolean
}
interface Settings { energy: 'high'|'medium'|'low'; survival: boolean }

// ── CONSTANTS ─────────────────────────────────────────
const CAT: Record<string,string> = {kitchen:'🍳 Cozinha',bathroom:'🚿 Banheiro',bedroom:'🛏 Quarto',laundry:'👕 Lavanderia',general:'🏠 Geral',dogs:'🐾 Cães',shopping:'🛒 Compras',finance:'💰 Finanças'}
const WPT: Record<string,string> = {light:'Leve',medium:'Médio',heavy:'Pesado'}
const FPT: Record<string,string> = {daily:'Diária',weekly:'Semanal',biweekly:'Quinzenal',monthly:'Mensal',once:'Pontual'}
const XPW: Record<string,number> = {light:1,medium:2,heavy:3}
const FEFF: Record<string,number> = {daily:7,weekly:2,biweekly:1,monthly:0.5,once:1}
const LEVELS = [
  {l:1,n:'Nest Builders',min:0,max:100},
  {l:2,n:'Nest Keepers',min:100,max:300},
  {l:3,n:'Home Runners',min:300,max:600},
  {l:4,n:'Domestic Legends',min:600,max:1000},
  {l:5,n:'Ninho Masters',min:1000,max:9999},
]
const SUGG: Record<string, Array<{t:string,w:string,f:string,cat:string,ess:boolean}>> = {
  'Cozinha':[
    {t:'Louça diária',w:'light',f:'daily',cat:'kitchen',ess:true},
    {t:'Limpar bancada e fogão',w:'light',f:'daily',cat:'kitchen',ess:true},
    {t:'Lixo da cozinha',w:'light',f:'daily',cat:'kitchen',ess:true},
    {t:'Organizar geladeira',w:'medium',f:'weekly',cat:'kitchen',ess:false},
    {t:'Limpar microondas',w:'light',f:'weekly',cat:'kitchen',ess:false},
    {t:'Limpar geladeira por dentro',w:'medium',f:'monthly',cat:'kitchen',ess:false},
    {t:'Verificar validades',w:'light',f:'monthly',cat:'kitchen',ess:false},
  ],
  'Banheiro':[
    {t:'Limpar pia e espelho',w:'light',f:'weekly',cat:'bathroom',ess:false},
    {t:'Limpar vaso sanitário',w:'medium',f:'weekly',cat:'bathroom',ess:false},
    {t:'Limpar box / chuveiro',w:'medium',f:'weekly',cat:'bathroom',ess:false},
    {t:'Repor papel e sabonete',w:'light',f:'weekly',cat:'bathroom',ess:true},
  ],
  'Casa geral':[
    {t:'Varrer / aspirar',w:'medium',f:'weekly',cat:'general',ess:false},
    {t:'Passar pano no chão',w:'medium',f:'weekly',cat:'general',ess:false},
    {t:'Reset da sala (noite)',w:'light',f:'daily',cat:'general',ess:true},
    {t:'Faxina geral',w:'heavy',f:'monthly',cat:'general',ess:false},
  ],
  'Lavanderia':[
    {t:'Lavar roupa',w:'medium',f:'weekly',cat:'laundry',ess:false},
    {t:'Dobrar e guardar',w:'medium',f:'weekly',cat:'laundry',ess:false},
    {t:'Trocar roupa de cama',w:'medium',f:'weekly',cat:'laundry',ess:false},
  ],
  'Cães':[
    {t:'Ração manhã',w:'light',f:'daily',cat:'dogs',ess:true},
    {t:'Ração noite',w:'light',f:'daily',cat:'dogs',ess:true},
    {t:'Água fresca',w:'light',f:'daily',cat:'dogs',ess:true},
    {t:'Passeio manhã',w:'medium',f:'daily',cat:'dogs',ess:true},
    {t:'Passeio tarde',w:'medium',f:'daily',cat:'dogs',ess:true},
    {t:'Limpeza área dos cães',w:'light',f:'daily',cat:'dogs',ess:true},
    {t:'Banho',w:'heavy',f:'biweekly',cat:'dogs',ess:false},
    {t:'Escovação',w:'light',f:'weekly',cat:'dogs',ess:false},
  ],
  'Compras':[
    {t:'Mercado semanal',w:'medium',f:'weekly',cat:'shopping',ess:false},
    {t:'Repor ração dos cães',w:'light',f:'monthly',cat:'shopping',ess:true},
  ],
}
const DR_DEF = [
  {t:'Ração manhã',f:'daily',time:'07:00'},
  {t:'Água fresca',f:'daily',time:null},
  {t:'Passeio manhã',f:'daily',time:'08:00'},
  {t:'Ração noite',f:'daily',time:'18:00'},
  {t:'Passeio tarde',f:'daily',time:'17:30'},
  {t:'Enriquecimento ambiental',f:'daily',time:null},
  {t:'Escovação',f:'weekly',time:null},
  {t:'Banho',f:'weekly',time:null},
]
const DR_PUP = [
  {t:'Saída xixi manhã',f:'daily',time:'07:30'},
  {t:'Saída xixi tarde',f:'daily',time:'14:00'},
  {t:'Saída xixi noite',f:'daily',time:'21:00'},
  {t:'Treino básico',f:'daily',time:null},
  {t:'Socialização',f:'daily',time:null},
]

function getLevel(xp: number) {
  return [...LEVELS].reverse().find(l => xp >= l.min) || LEVELS[0]
}
function getChaosInfo(pct: number) {
  if (pct < 35) return { label: 'Organizada ✦', color: '#1D9E75', cls: 'ok' }
  if (pct < 65) return { label: 'Atenção necessária', color: '#ef9f27', cls: 'warn' }
  return { label: 'Casa em alerta!', color: '#d85a30', cls: 'bad' }
}
function todayStr() { return new Date().toISOString().split('T')[0] }
function weekStart() {
  const d = new Date(); const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff); return d.toISOString().split('T')[0]
}

// ── STYLES ─────────────────────────────────────────────
const S = `
:root{--bg:#111110;--sf:#1c1c1a;--sf2:#252523;--bd:#2e2e2c;--bd2:#3a3a38;--tx:#f0ede8;--mu:#a0a09a;--sub:#666;--faint:#3d3d3b;--green:#5dcaa5;--gbg:#0f2a1e;--gbdr:#1d5a3a;--gdk:#1D9E75;--amb:#ef9f27;--abg:#2a1a08;--abdr:#5a3a10;--cor:#d85a30;--cbg:#2a0e08;--cbdr:#5a2010;--pur:#9f8fee;--pbg:#1a1040;--pbdr:#3a2880;--warm:#c4a882;--r:10px;--rs:7px}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{background:var(--bg);color:var(--tx);font-family:'DM Sans',system-ui,sans-serif;min-height:100vh}
button,input{font-family:inherit}
.app{max-width:1140px;margin:0 auto;padding-bottom:80px}
.topbar{background:var(--sf);border-bottom:.5px solid var(--bd);padding:11px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:30}
.logo{font-family:'DM Mono',monospace;font-size:15px;font-weight:500;letter-spacing:-.02em}
.logo span{color:var(--green)}
.chips{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.chip{font-size:10px;padding:3px 10px;border-radius:20px;border:.5px solid var(--bd2);color:var(--mu);cursor:pointer;white-space:nowrap;background:var(--sf2);transition:all .12s}
.chip.green{background:var(--gbg);color:var(--green);border-color:var(--gbdr)}
.chip.amber{background:var(--abg);color:var(--amb);border-color:var(--abdr)}
.chip.coral{background:var(--cbg);color:var(--cor);border-color:var(--cbdr)}
.nav{background:var(--sf);border-bottom:.5px solid var(--bd);display:flex;padding:0 20px;overflow-x:auto}
.nb{flex:1;min-width:60px;padding:10px 4px;font-size:11px;font-weight:500;border:none;background:transparent;color:var(--sub);cursor:pointer;border-bottom:2px solid transparent;display:flex;align-items:center;justify-content:center;gap:4px;transition:all .12s;white-space:nowrap}
.nb.on{color:var(--tx);border-bottom-color:var(--warm)}
.scr{display:none;padding:16px 20px;animation:fu .14s ease}
.scr.on{display:block}
@keyframes fu{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
@keyframes su{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.gdash{display:grid;grid-template-columns:1fr 1fr 196px;gap:12px}
.card{background:var(--sf);border:.5px solid var(--bd);border-radius:var(--r);padding:14px}
.cteal{background:var(--gbg);border:.5px solid var(--gbdr);border-radius:var(--r);padding:14px;cursor:pointer}
.csurf{background:var(--sf2);border-radius:var(--rs);padding:10px}
.slbl{font-family:'DM Mono',monospace;font-size:9px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin-bottom:8px}
.slbl.teal{color:#2d8a5a}
.ph{display:flex;align-items:center;gap:9px;margin-bottom:12px;padding-bottom:10px;border-bottom:.5px solid var(--bd)}
.av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;flex-shrink:0;font-family:'DM Mono',monospace}
.av-g{background:var(--gbg);color:var(--green)}
.av-s{background:var(--pbg);color:var(--pur)}
.pname{font-size:13px;font-weight:500}
.prole{font-size:10px;color:var(--sub);margin-top:1px}
.pprog{margin-left:auto;font-size:11px;font-family:'DM Mono',monospace}
.tr{display:flex;align-items:center;gap:7px;padding:6px 7px;border-radius:var(--rs);cursor:pointer;transition:background .1s}
.tr:hover{background:var(--sf2)}
.tr.done{opacity:.26}
.tr.done .trn{text-decoration:line-through;color:var(--sub)}
.trchk{width:16px;height:16px;min-width:16px;border:1.5px solid var(--bd2);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;transition:all .15s}
.trchk.ok{background:var(--gdk);border-color:var(--gdk);color:#fff}
.trn{flex:1;font-size:12px;color:var(--mu)}
.eddot{width:5px;height:5px;border-radius:50%;background:var(--cor);flex-shrink:0}
.trdot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.dot-l{background:var(--green)}.dot-m{background:var(--amb)}.dot-h{background:var(--cor)}
.trxp{font-family:'DM Mono',monospace;font-size:9px;padding:1px 5px;border-radius:3px;color:var(--faint);background:var(--sf2);white-space:nowrap}
.trxp.ok{color:var(--green);background:var(--gbg)}
.trtime{font-family:'DM Mono',monospace;font-size:9px;color:var(--amb);background:var(--abg);padding:1px 6px;border-radius:3px}
.trswap{font-size:12px;color:var(--faint);padding:2px 4px;border-radius:3px;cursor:pointer;border:none;background:transparent;line-height:1;transition:color .1s}
.trswap:hover{color:var(--amb)}
.ebtn{background:none;border:none;color:var(--faint);cursor:pointer;padding:2px 4px;font-size:12px;line-height:1;opacity:0;transition:opacity .15s}
.tr:hover .ebtn{opacity:1}
.cdiv{display:flex;align-items:center;gap:7px;margin:10px 0 3px}
.cdiv-l{font-family:'DM Mono',monospace;font-size:9px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);white-space:nowrap}
.cdiv-line{flex:1;height:.5px;background:var(--bd)}
.sdiv{display:flex;align-items:center;gap:7px;margin:12px 0 4px}
.sdiv-line{flex:1;height:.5px;background:var(--bd)}
.sdiv-l{font-family:'DM Mono',monospace;font-size:9px;color:var(--faint);letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.bar{background:var(--sf2);border-radius:3px;height:4px;overflow:hidden;margin-top:6px}
.barf{height:100%;border-radius:3px;transition:width .4s ease}
.streak-row{display:flex;gap:3px;margin-top:6px}
.sd{flex:1;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-size:8px;font-weight:500;border:.5px solid var(--bd);color:var(--faint)}
.sd.on{background:var(--amb);border-color:var(--amb);color:#1a0e00}
.sd.today{border:2px solid var(--amb);color:var(--amb)}
.legend{background:var(--sf2);border-radius:var(--rs);padding:10px 12px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center}
.li{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--mu)}
.ldot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.sbar{display:flex;align-items:center;gap:12px;padding:8px 12px;background:var(--sf2);border-radius:var(--rs);margin-bottom:10px;flex-wrap:wrap}
.sbi{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--mu)}
.sbv{font-family:'DM Mono',monospace;font-weight:500;color:var(--tx)}
.sbdiv{width:1px;height:14px;background:var(--bd)}
.fab{position:fixed;bottom:24px;right:24px;width:48px;height:48px;background:var(--gdk);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;color:#fff;font-size:24px;box-shadow:0 4px 20px rgba(29,158,117,.4);transition:transform .12s;z-index:40}
.fab:hover{transform:scale(1.06)}
.mwrap{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;z-index:50;padding:10px}
@media(min-width:560px){.mwrap{align-items:center}}
.modal{background:var(--sf);border-radius:var(--r);border:.5px solid var(--bd);width:100%;max-width:480px;max-height:92vh;display:flex;flex-direction:column;animation:su .18s ease}
.modal-lg{max-width:560px}
.mh{display:flex;align-items:center;justify-content:space-between;padding:15px 17px;border-bottom:.5px solid var(--bd);flex-shrink:0}
.mht{font-size:14px;font-weight:500}
.mclose{background:none;border:none;color:var(--sub);font-size:20px;cursor:pointer;line-height:1;padding:0}
.mbody{overflow-y:auto;padding:15px 17px;flex:1}
.mfoot{padding:12px 17px;border-top:.5px solid var(--bd);flex-shrink:0;display:flex;gap:8px}
.fl{font-family:'DM Mono',monospace;font-size:9px;font-weight:500;letter-spacing:.09em;text-transform:uppercase;color:var(--sub);display:block;margin-bottom:6px;margin-top:14px}
.fl:first-child{margin-top:0}
.fl .hint{font-weight:400;color:var(--faint);text-transform:none;letter-spacing:0;font-family:'DM Sans',sans-serif;font-size:10px}
.fi{width:100%;background:var(--sf2);border:.5px solid var(--bd2);border-radius:var(--rs);padding:10px 12px;font-size:13px;color:var(--tx);outline:none;transition:border-color .12s}
.fi:focus{border-color:var(--gdk)}
.btng{display:grid;gap:6px}
.c2{grid-template-columns:1fr 1fr}
.c3{grid-template-columns:1fr 1fr 1fr}
.sbtn{padding:9px 6px;border-radius:var(--rs);border:.5px solid var(--bd);background:transparent;font-size:11px;color:var(--sub);cursor:pointer;transition:all .12s;text-align:center}
.sbtn.on{background:var(--gbg);border-color:var(--gbdr);color:var(--green)}
.btn-p{flex:1;padding:11px;background:var(--gdk);color:#fff;border:none;border-radius:var(--rs);font-size:13px;font-weight:500;cursor:pointer;transition:opacity .12s}
.btn-p:disabled{opacity:.35;cursor:not-allowed}
.btn-g{padding:10px 14px;background:transparent;color:var(--mu);border:.5px solid var(--bd);border-radius:var(--rs);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .12s}
.btn-g:hover{border-color:var(--bd2);color:var(--tx)}
.btn-g.surv{border-color:var(--cbdr);color:var(--cor);background:var(--cbg)}
.btn-g.surv-off{border-color:var(--gbdr);color:var(--green);background:var(--gbg)}
.bdg{font-family:'DM Mono',monospace;font-size:9px;padding:1px 6px;border-radius:3px}
.bdg-l{background:var(--gbg);color:var(--green)}
.bdg-m{background:var(--abg);color:var(--amb)}
.bdg-h{background:var(--cbg);color:var(--cor)}
.bdg-n{background:var(--sf2);color:var(--sub)}
.bdg-e{background:#1a0808;color:#ff6b6b;border:.5px solid #5a1010}
.stabs{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px}
.stab{padding:5px 12px;border-radius:20px;font-size:11px;border:.5px solid var(--bd);background:transparent;color:var(--sub);cursor:pointer;transition:all .12s}
.stab.on{background:var(--gdk);border-color:var(--gdk);color:#fff}
.si{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:var(--rs);border:.5px solid var(--bd);cursor:pointer;transition:all .12s;background:transparent}
.si.on{background:var(--gbg);border-color:var(--gbdr)}
.si-chk{width:15px;height:15px;min-width:15px;border:1.5px solid var(--bd2);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0;transition:all .12s}
.si-chk.ok{background:var(--gdk);border-color:var(--gdk);color:#fff}
.si-name{flex:1;font-size:12px;color:var(--mu)}
.si.on .si-name{color:var(--green)}
.pri{display:flex;align-items:center;gap:9px;padding:8px 11px;border-radius:var(--rs);border:.5px solid var(--bd);margin-bottom:4px;cursor:pointer;transition:all .12s}
.pri.on{background:var(--gbg);border-color:var(--gbdr)}
.prchk{width:14px;height:14px;min-width:14px;border:1.5px solid var(--bd2);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:8px;transition:all .12s}
.prchk.ok{background:var(--gdk);border-color:var(--gdk);color:#fff}
.pr-name{flex:1;font-size:12px;color:var(--mu)}
.pri.on .pr-name{color:var(--green)}
.wt{display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:var(--rs);border:.5px solid var(--bd);margin-bottom:6px;background:var(--sf);flex-wrap:wrap}
.wt-name{flex:1;font-size:12px;color:var(--mu);min-width:100px}
.wt-assign{display:flex;gap:4px}
.wa{padding:3px 9px;border-radius:20px;font-size:10px;border:.5px solid var(--bd);background:transparent;color:var(--sub);cursor:pointer;transition:all .12s}
.wa.g-on{background:var(--gbg);border-color:var(--gbdr);color:var(--green)}
.wa.s-on{background:var(--pbg);border-color:var(--pbdr);color:var(--pur)}
.surv-banner{background:var(--cbg);border:.5px solid var(--cbdr);border-radius:var(--rs);padding:9px 13px;display:flex;align-items:center;gap:9px;font-size:11px;color:var(--cor);margin-bottom:12px}
.xp-big{font-size:28px;font-weight:300;letter-spacing:-.02em;line-height:1}
.xp-sub{font-size:11px;color:var(--sub);margin:3px 0 10px}
.chaos{font-size:14px;font-weight:500;margin-bottom:2px}
.srow{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:.5px solid var(--bd)}
.srow:last-child{border-bottom:none}
.srow-l{font-size:13px;color:var(--mu)}
.srow-v{font-size:12px;color:var(--sub);cursor:pointer}
.sedit{background:var(--sf2);border:.5px solid var(--bd2);border-radius:var(--rs);padding:6px 10px;font-size:12px;color:var(--tx);outline:none;width:160px}
.sedit:focus{border-color:var(--gdk)}
.empty{text-align:center;padding:32px 16px;color:var(--sub)}
.empty-icon{font-size:28px;display:block;margin-bottom:10px}
.empty-btn{margin-top:12px;padding:8px 18px;background:var(--gdk);color:#fff;border:none;border-radius:var(--rs);font-size:12px;cursor:pointer}
.toast{position:fixed;top:14px;left:50%;transform:translateX(-50%);background:var(--gbg);border:.5px solid var(--gbdr);border-radius:var(--rs);padding:9px 18px;font-size:12px;color:var(--green);display:flex;align-items:center;gap:8px;z-index:100;white-space:nowrap;font-family:'DM Mono',monospace;pointer-events:none;transition:opacity .3s}
.gwbtn{width:100%;padding:11px;background:var(--pbg);border:.5px solid var(--pbdr);border-radius:var(--rs);color:var(--pur);font-size:12px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;margin-bottom:14px;transition:all .12s}
.gwbtn:hover{background:#221460}
.tcf{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.tcfb{padding:4px 10px;border-radius:20px;font-size:11px;border:.5px solid var(--bd);background:transparent;color:var(--sub);cursor:pointer;transition:all .12s}
.tcfb.on{background:var(--gbg);border-color:var(--gbdr);color:var(--green)}
.tc{background:var(--sf);border:.5px solid var(--bd);border-radius:var(--rs);padding:12px 14px;margin-bottom:6px;display:flex;align-items:center;gap:10px;transition:border-color .12s}
.tc:hover{border-color:var(--bd2)}
.tc-info{flex:1;min-width:0}
.tc-title{font-size:13px;color:var(--tx);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tc-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.tc-actions{display:flex;gap:6px;flex-shrink:0}
.tc-btn{background:none;border:none;cursor:pointer;padding:5px 8px;border-radius:var(--rs);font-size:12px;color:var(--sub);transition:all .12s}
.tc-btn:hover{background:var(--sf2);color:var(--tx)}
.tc-btn.danger:hover{color:var(--cor);background:var(--cbg)}
.btn-danger{padding:10px 14px;background:transparent;border:.5px solid var(--cbdr);border-radius:var(--rs);color:var(--cor);font-size:12px;cursor:pointer}
@media(max-width:1024px){.gdash{grid-template-columns:1fr 1fr}.gdash .sbar-col{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}}
@media(max-width:900px){.gdash{grid-template-columns:1fr 1fr}}
@media(max-width:767px){.gdash{grid-template-columns:1fr}.g2{grid-template-columns:1fr}.g3{grid-template-columns:1fr 1fr}.scr{padding:12px 14px}.chip{font-size:9px;padding:2px 7px}}
@media(max-width:700px){.gdash{grid-template-columns:1fr}}
@media(max-width:480px){.g3{grid-template-columns:1fr}.c3{grid-template-columns:1fr 1fr}}
`

// ── MAIN COMPONENT ─────────────────────────────────────
export default function NinhoApp({ householdId }: { householdId: string }) {
  const [tab, setTab] = useState<string>('pass')
  const [tasks, setTasks] = useState<Task[]>([])
  const [dogs, setDogs] = useState<Dog[]>([])
  const [settings, setSettings] = useState<Settings>({ energy: 'medium', survival: false })
  const [xp, setXp] = useState(0)
  const [modal, setModal] = useState<string | null>(null)
  const [modalData, setModalData] = useState<any>(null)
  const [toast, setToast] = useState('')
  const [taskFilter, setTaskFilter] = useState('all')
  const [suggTab, setSuggTab] = useState(Object.keys(SUGG)[0])
  const [suggSel, setSuggSel] = useState<any[]>([])
  const [petRoutinesSel, setPetRoutinesSel] = useState<string[]>([])
  const toastTimer = useRef<any>(null)

  const today = todayStr()
  const dow = new Date().getDay()
  const dowI = dow === 0 ? 6 : dow - 1

  // ── LOAD DATA ──────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const [{ data: tData }, { data: dData }, { data: wsData }, { data: compData }, { data: dcData }] = await Promise.all([
      supabase.from('tasks').select('*').eq('household_id', householdId).eq('active', true).order('created_at'),
      supabase.from('dogs').select('*, dog_routines(*)').eq('household_id', householdId).eq('active', true),
      supabase.from('weekly_settings').select('*').eq('household_id', householdId).eq('week_start', weekStart()).single(),
      supabase.from('task_completions').select('task_id').eq('household_id', householdId).eq('date', today),
      supabase.from('dog_completions').select('routine_id').eq('date', today),
    ])

    const completedTaskIds = new Set((compData || []).map((c: any) => c.task_id))
    const completedDogIds = new Set((dcData || []).map((c: any) => c.routine_id))

    setTasks((tData || []).map((t: any) => ({ ...t, completed_today: completedTaskIds.has(t.id) })))
    setDogs((dData || []).map((d: any) => ({
      ...d,
      routines: (d.dog_routines || []).map((r: any) => ({ ...r, completed_today: completedDogIds.has(r.id) }))
    })))
    if (wsData) setSettings({ energy: wsData.energy, survival: wsData.survival })

    const totalXP = (tData || []).filter((t: any) => completedTaskIds.has(t.id)).reduce((s: number, t: any) => s + XPW[t.weight], 0)
    setXp(totalXP)
  }, [householdId, today])

  useEffect(() => { loadAll() }, [loadAll])

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('ninho-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dog_completions' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dogs' }, loadAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadAll])

  function showToast(msg: string) {
    setToast(msg); clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }

  // ── TASK ACTIONS ────────────────────────────────────────
  async function toggleTask(t: Task) {
    if (t.completed_today) {
      await supabase.from('task_completions').delete().eq('task_id', t.id).eq('date', today)
    } else {
      await supabase.from('task_completions').insert({ task_id: t.id, household_id: householdId, date: today })
      showToast(`+${XPW[t.weight]} XP · ${t.title}`)
    }
    loadAll()
  }

  async function completeDog(r: DogRoutine) {
    if (r.completed_today) {
      await supabase.from('dog_completions').delete().eq('routine_id', r.id).eq('date', today)
    } else {
      await supabase.from('dog_completions').insert({ routine_id: r.id, date: today })
      showToast(`+1 XP · ${r.title}`)
    }
    loadAll()
  }

  async function swapTask(t: Task) {
    const newOwner = t.assigned_to === 's' ? 'g' : 's'
    await supabase.from('tasks').update({ assigned_to: newOwner }).eq('id', t.id)
    showToast(`Transferido para ${newOwner === 'g' ? names.g : names.s}`)
    loadAll()
  }

  async function assignTask(id: string, to: string) {
    await supabase.from('tasks').update({ assigned_to: to }).eq('id', id)
    showToast(`Atribuído para ${to === 'g' ? names.g : names.s}`)
    loadAll()
  }

  async function deleteTask(id: string) {
    if (!confirm('Remover essa tarefa?')) return
    await supabase.from('tasks').update({ active: false }).eq('id', id)
    showToast('Tarefa removida'); loadAll()
  }

  async function saveTask(data: any, editId?: string) {
    if (editId) {
      await supabase.from('tasks').update(data).eq('id', editId)
      showToast('Tarefa atualizada!')
    } else {
      await supabase.from('tasks').insert({ ...data, household_id: householdId, active: true })
      showToast(`"${data.title}" criada!`)
    }
    closeModal(); loadAll()
  }

  async function savePet(data: any, routines: any[]) {
    const { data: dog } = await supabase.from('dogs').insert({ ...data, household_id: householdId, active: true }).select().single()
    if (dog) {
      await supabase.from('dog_routines').insert(routines.map(r => ({ ...r, dog_id: dog.id, household_id: householdId, active: true })))
    }
    showToast(`${data.name} cadastrado(a)!`); closeModal(); loadAll()
  }

  async function addSuggestions() {
    const existing = new Set(tasks.map(t => t.title))
    const toAdd = suggSel.filter(s => !existing.has(s.t)).map(s => ({
      household_id: householdId, title: s.t, category: s.cat, weight: s.w,
      frequency: s.f, assigned_to: null, scheduled_time: null, essential: s.ess, active: true
    }))
    if (toAdd.length > 0) {
      await supabase.from('tasks').insert(toAdd)
      showToast(`${toAdd.length} tarefa${toAdd.length !== 1 ? 's' : ''} adicionada${toAdd.length !== 1 ? 's' : ''}!`)
    }
    setSuggSel([]); closeModal(); loadAll()
  }

  async function toggleSurvival() {
    const ns = !settings.survival
    await supabase.from('weekly_settings').upsert({ household_id: householdId, week_start: weekStart(), energy: settings.energy, survival: ns }, { onConflict: 'household_id,week_start' })
    setSettings(p => ({ ...p, survival: ns }))
    showToast(ns ? 'Modo sobrevivência ativado' : 'Modo normal ativado')
  }

  async function setEnergy(e: 'high' | 'medium' | 'low') {
    await supabase.from('weekly_settings').upsert({ household_id: householdId, week_start: weekStart(), energy: e, survival: settings.survival }, { onConflict: 'household_id,week_start' })
    setSettings(p => ({ ...p, energy: e })); showToast('Energia atualizada!'); closeModal()
  }

  // ── NAMES (em settings no banco, por enquanto local) ──
  const [names, setNames] = useState<{g:string,s:string}>({ g: 'Giovanna', s: 'Sabrina' })
  // Carregar nomes do localStorage para persistência simples
  useEffect(() => {
    try {
      const n = localStorage.getItem('ninho_names')
      if (n) setNames(JSON.parse(n))
    } catch {}
  }, [])
  function updateName(key: 'g' | 's', val: string) {
    if (!val.trim()) return
    const n = { ...names, [key]: val.trim() }
    setNames(n); try { localStorage.setItem('ninho_names', JSON.stringify(n)) } catch {}
    showToast('Nome atualizado!')
  }

  // ── AUTO DISTRIBUTE ────────────────────────────────────
  async function autoDistribute() {
    const active = tasks.filter(t => t.frequency !== 'once')
    if (!active.length) { showToast('Adicione tarefas primeiro'); return }
    let gS = 0, sS = 0
    const updates: Array<{id: string, assigned_to: string}> = []
    const assign = (t: Task, who: 'g'|'s') => { updates.push({ id: t.id, assigned_to: who }); const w = XPW[t.weight] * (FEFF[t.frequency] || 1); if (who === 'g') gS += w; else sS += w }
    active.filter(t => t.essential && t.category === 'dogs').sort((a,b) => (a.scheduled_time||'').localeCompare(b.scheduled_time||'')).forEach((t,i) => assign(t, i%2===0?'g':'s'))
    active.filter(t => t.weight === 'heavy' && !(t.essential && t.category === 'dogs')).forEach(t => assign(t, gS <= sS ? 'g' : 's'))
    active.filter(t => t.frequency === 'daily' && !t.essential && t.weight !== 'heavy').forEach(t => assign(t, gS * 0.85 <= sS ? 'g' : 's'))
    active.filter(t => !updates.find(u => u.id === t.id)).forEach(t => assign(t, gS <= sS ? 'g' : 's'))
    await Promise.all(updates.map(u => supabase.from('tasks').update({ assigned_to: u.assigned_to }).eq('id', u.id)))
    showToast(`Distribuído — ${names.g}: ${Math.round(gS)} pts · ${names.s}: ${Math.round(sS)} pts`)
    loadAll()
  }

  // ── DERIVED ────────────────────────────────────────────
  const myTasks = tasks.filter(t => !t.assigned_to || t.assigned_to === 'g')
  const saTasks = tasks.filter(t => t.assigned_to === 's')
  const myPend = myTasks.filter(t => !t.completed_today).sort((a,b) => (b.essential?1:0)-(a.essential?1:0))
  const myDone = myTasks.filter(t => t.completed_today)
  const saPend = saTasks.filter(t => !t.completed_today).sort((a,b) => (b.essential?1:0)-(a.essential?1:0))
  const saDone = saTasks.filter(t => t.completed_today)
  const dailyTasks = tasks.filter(t => t.frequency === 'daily')
  const chaos = dailyTasks.length ? Math.max(0, Math.round(100 - (dailyTasks.filter(t => t.completed_today).length / dailyTasks.length) * 100)) : 0
  const ci = getChaosInfo(chaos)
  const lv = getLevel(xp)
  const xpPct = Math.min(100, Math.round(((xp - lv.min) / (lv.max - lv.min)) * 100))

  function closeModal() { setModal(null); setModalData(null) }
  function openModal(m: string, d?: any) { setModal(m); setModalData(d) }

  // ── RENDER HELPERS ─────────────────────────────────────
  function Legend() {
    return (
      <div className="legend">
        <span className="li"><span className="ldot" style={{background:'var(--green)'}}></span>Leve +1 XP</span>
        <span className="li"><span className="ldot" style={{background:'var(--amb)'}}></span>Médio +2 XP</span>
        <span className="li"><span className="ldot" style={{background:'var(--cor)'}}></span>Pesado +3 XP</span>
        <span className="li"><span className="bdg bdg-e" style={{fontSize:9}}>essencial</span>Não pode falhar</span>
        <span className="li"><span className="trtime">⏰ 08:00</span>Horário definido</span>
      </div>
    )
  }

  function TaskRow({ t, showSwap = false, showEdit = false }: { t: Task, showSwap?: boolean, showEdit?: boolean }) {
    const otherKey = t.assigned_to === 'g' ? 's' : 'g'
    return (
      <div className={`tr ${t.completed_today ? 'done' : ''}`}>
        <div className={`trchk ${t.completed_today ? 'ok' : ''}`} onClick={() => toggleTask(t)}>{t.completed_today ? '✓' : ''}</div>
        {t.essential && !t.completed_today && <span className="eddot" title="Essencial"></span>}
        <span className="trn" onClick={() => toggleTask(t)}>{t.title}</span>
        {t.scheduled_time && <span className="trtime">⏰ {t.scheduled_time}</span>}
        <div className={`trdot dot-${t.weight[0]}`}></div>
        {showSwap || showEdit ? <span className={`trxp ${t.completed_today ? 'ok' : ''}`}>+{XPW[t.weight]}</span> : null}
        {showSwap && !t.completed_today && <button className="trswap" onClick={() => swapTask(t)} title={`Trocar para ${otherKey === 'g' ? names.g : names.s}`}>⇄</button>}
        {showEdit && <button className="ebtn" onClick={() => openModal('task', t)} title="Editar">✎</button>}
      </div>
    )
  }

  function PersonCol({ ts, pend, done, personKey, role, avCls }: any) {
    function byCat(list: Task[]) {
      const g: Record<string, Task[]> = {}
      list.forEach(t => { if (!g[t.category]) g[t.category] = []; g[t.category].push(t) })
      return g
    }
    const doneXP = done.reduce((s: number, t: Task) => s + XPW[t.weight], 0)
    return (
      <div className="card" style={{overflow:'auto',maxHeight:'min(560px,65vh)'}}>
        <div className="ph">
          <div className={`av ${avCls}`}>{(names[personKey as 'g'|'s']||'??').slice(0,2).toUpperCase()}</div>
          <div><div className="pname">{names[personKey as 'g'|'s']||personKey}</div><div className="prole">{role}</div></div>
          <div className="pprog"><span style={{color:'var(--green)',fontWeight:500}}>{done.length}</span><span style={{color:'var(--faint)'}}> / {ts.length}</span></div>
        </div>
        {ts.length === 0 ? (
          <div className="empty" style={{padding:'14px 0'}}>
            <span className="empty-icon">📋</span>
            <div style={{marginBottom:10}}>Sem tarefas</div>
            <button className="empty-btn" onClick={() => openModal('sugg')}>Sugestões</button>
          </div>
        ) : (
          <>
            <div className="sbar">
              <div className="sbi">✓ <span className="sbv">{done.length}</span> feitas</div>
              <div className="sbdiv"></div>
              <div className="sbi">◻ <span className="sbv">{pend.length}</span> pendentes</div>
              <div className="sbdiv"></div>
              <div className="sbi">XP <span className="sbv">+{doneXP}</span></div>
              {pend.filter((t: Task) => t.essential).length > 0 && <>
                <div className="sbdiv"></div>
                <div className="sbi" style={{color:'var(--cor)'}}>🔴 <span style={{fontWeight:500}}>{pend.filter((t:Task)=>t.essential).length}</span> essencial</div>
              </>}
            </div>
            {Object.entries(byCat(pend)).map(([cat, list]) => (
              <div key={cat}>
                <div className="cdiv"><span className="cdiv-l">{CAT[cat]||cat}</span><div className="cdiv-line"></div></div>
                {(list as Task[]).map(t => <TaskRow key={t.id} t={t} showSwap showEdit />)}
              </div>
            ))}
            {done.length > 0 && <>
              <div className="sdiv"><div className="sdiv-line"></div><span className="sdiv-l">concluídas — +{doneXP} XP</span><div className="sdiv-line"></div></div>
              {Object.entries(byCat(done)).map(([cat, list]) => (
                <div key={cat}>
                  <div className="cdiv"><span className="cdiv-l">{CAT[cat]||cat}</span><div className="cdiv-line"></div></div>
                  {(list as Task[]).map(t => <TaskRow key={t.id} t={t} />)}
                </div>
              ))}
            </>}
          </>
        )}
      </div>
    )
  }

  function Sidebar() {
    const myXP = myDone.reduce((s,t) => s+XPW[t.weight], 0)
    const saXP = saDone.reduce((s,t) => s+XPW[t.weight], 0)
    const streakDays = ['S','T','Q','Q','S','S','D']
    return (
      <div className="sbar-col" style={{display:'flex',flexDirection:'column',gap:10}}>
        <div className="card">
          <div className="slbl">XP do casal</div>
          <div className="xp-big">{xp}</div>
          <div className="xp-sub">/ {lv.max} · {lv.n}</div>
          <div className="bar" style={{marginBottom:10}}><div className="barf" style={{width:xpPct+'%',background:'var(--gdk)'}}></div></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
            <div className="csurf" style={{textAlign:'center'}}><div style={{fontSize:10,color:'var(--sub)',marginBottom:3}}>{names.g}</div><div style={{fontSize:14,fontWeight:500}}>{myXP}</div></div>
            <div className="csurf" style={{textAlign:'center'}}><div style={{fontSize:10,color:'var(--sub)',marginBottom:3}}>{names.s}</div><div style={{fontSize:14,fontWeight:500}}>{saXP}</div></div>
          </div>
        </div>
        <div className="card">
          <div className="slbl">Casa</div>
          <div className="chaos" style={{color:ci.color}}>{ci.label}</div>
          <div style={{fontSize:11,color:'var(--sub)',margin:'2px 0 8px'}}>Caos: {chaos}%</div>
          <div className="bar"><div className="barf" style={{width:chaos+'%',background:ci.color}}></div></div>
        </div>
        <div className="cteal" onClick={() => setTab('pets')}>
          <div className="slbl teal">🐾 Cães</div>
          {dogs.length === 0 ? <div style={{fontSize:11,color:'var(--green)',opacity:.7}}>Cadastrar pet →</div> :
            dogs.map(d => d.routines.filter(r => r.frequency === 'daily').slice(0,4).map(r => (
              <div key={r.id} onClick={e => { e.stopPropagation(); completeDog(r) }} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 0',cursor:'pointer'}}>
                <div style={{width:12,height:12,borderRadius:3,border:`1.5px solid ${r.completed_today?'var(--gdk)':'#2d5a42'}`,background:r.completed_today?'var(--gdk)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,color:'#fff',flexShrink:0}}>{r.completed_today?'✓':''}</div>
                <span style={{fontSize:10,color:'var(--green)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.title}</span>
                <span style={{fontSize:9,color:'#2d8a5a'}}>{d.name}</span>
              </div>
            )))
          }
        </div>
        <div className="card">
          <div className="slbl">Streak</div>
          <div className="streak-row">{streakDays.map((d,i) => <div key={i} className={`sd ${i<dowI?'on':i===dowI?'today':''}`}>{d}</div>)}</div>
        </div>
        <button className="btn-g" style={{width:'100%'}} onClick={() => openModal('energy')}>⚡ Energia da semana</button>
        <button className={`btn-g ${settings.survival?'surv-off':'surv'}`} style={{width:'100%'}} onClick={toggleSurvival}>🛡 {settings.survival?'Desativar':'Ativar'} modo sobrevivência</button>
      </div>
    )
  }

  // ── MODAL: TASK FORM ───────────────────────────────────
  function TaskFormModal() {
    const t = modalData as Task | null
    const [title, setTitle] = useState(t?.title || '')
    const [cat, setCat] = useState(t?.category || 'general')
    const [weight, setWeight] = useState(t?.weight || 'medium')
    const [freq, setFreq] = useState(t?.frequency || 'weekly')
    const [assign, setAssign] = useState(t?.assigned_to || '')
    const [time, setTime] = useState(t?.scheduled_time || '')
    const [ess, setEss] = useState(t?.essential || false)

    const handle = () => {
      if (!title.trim()) return
      const data = { title: title.trim(), category: cat, weight, frequency: freq, assigned_to: assign || null, scheduled_time: time || null, essential: ess }
      saveTask(data, t?.id)
    }

    return (
      <div className="mwrap" onClick={closeModal}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="mh"><span className="mht">{t ? 'Editar tarefa' : 'Nova tarefa'}</span><button className="mclose" onClick={closeModal}>✕</button></div>
          <div className="mbody">
            <label className="fl">Nome da tarefa</label>
            <input className="fi" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Limpar bancada da cozinha" autoFocus />
            <label className="fl">Categoria</label>
            <div className="btng c2">{Object.entries(CAT).map(([k,v]) => <button key={k} className={`sbtn ${cat===k?'on':''}`} onClick={() => setCat(k)}>{v}</button>)}</div>
            <label className="fl">Peso / esforço</label>
            <div className="btng c3">
              {(['light','medium','heavy'] as const).map(w => <button key={w} className={`sbtn ${weight===w?'on':''}`} onClick={() => setWeight(w)}>{w==='light'?'🟢 Leve +1':w==='medium'?'🟡 Médio +2':'🔴 Pesado +3'}</button>)}
            </div>
            <label className="fl">Frequência</label>
            <div className="btng c3">
              {Object.entries(FPT).map(([k,v]) => <button key={k} className={`sbtn ${freq===k?'on':''}`} onClick={() => setFreq(k)}>{v}</button>)}
            </div>
            <label className="fl">Responsável</label>
            <div className="btng c3">
              <button className={`sbtn ${!assign?'on':''}`} onClick={() => setAssign('')}>Rodízio</button>
              <button className={`sbtn ${assign==='g'?'on':''}`} onClick={() => setAssign('g')}>{(names.g||'Giovanna').split(' ')[0]}</button>
              <button className={`sbtn ${assign==='s'?'on':''}`} onClick={() => setAssign('s')}>{(names.s||'Sabrina').split(' ')[0]}</button>
            </div>
            <label className="fl">Horário <span className="hint">(opcional)</span></label>
            <input type="time" className="fi" value={time} onChange={e => setTime(e.target.value)} style={{width:160}} />
            <label className="fl">Classificação</label>
            <div className="btng c2">
              <button className={`sbtn ${!ess?'on':''}`} style={{textAlign:'left',padding:'10px 12px'}} onClick={() => setEss(false)}><div style={{fontSize:12}}>🟡 Regular</div><div style={{fontSize:10,color:'var(--sub)',marginTop:2}}>Pode ser adiada</div></button>
              <button className={`sbtn ${ess?'on':''}`} style={{textAlign:'left',padding:'10px 12px'}} onClick={() => setEss(true)}><div style={{fontSize:12}}>🔴 Essencial</div><div style={{fontSize:10,color:'var(--sub)',marginTop:2}}>Não pode falhar</div></button>
            </div>
          </div>
          <div className="mfoot">
            {t && <button className="btn-danger" onClick={() => { deleteTask(t.id); closeModal() }}>Remover</button>}
            <button className="btn-p" disabled={!title.trim()} onClick={handle}>{t ? 'Salvar' : 'Criar tarefa'}</button>
          </div>
        </div>
      </div>
    )
  }

  // ── MODAL: SUGESTÕES ───────────────────────────────────
  function SuggModal() {
    const cats = Object.keys(SUGG)
    const [curTab, setCurTab] = useState(cats[0])
    const [sel, setSel] = useState<any[]>([])
    const existingTitles = new Set(tasks.map(t => t.title))

    function toggle(s: any) {
      const key = curTab+'::'+s.t
      setSel(prev => prev.find(x => x.key===key) ? prev.filter(x => x.key!==key) : [...prev, {...s, key}])
    }
    function selectAll() {
      const toAdd = SUGG[curTab].filter(s => !existingTitles.has(s.t) && !sel.find(x => x.key===curTab+'::'+s.t))
      setSel(prev => [...prev, ...toAdd.map(s => ({...s, key:curTab+'::'+s.t}))])
    }

    return (
      <div className="mwrap" onClick={closeModal}>
        <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
          <div className="mh"><span className="mht">Tarefas & Sugestões</span><button className="mclose" onClick={closeModal}>✕</button></div>
          <div className="mbody">
            {tasks.length > 0 && <>
              <div style={{fontSize:12,fontWeight:500,color:'var(--tx)',marginBottom:8}}>Suas tarefas ({tasks.length})</div>
              {tasks.slice(0,6).map(t => (
                <div key={t.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:'var(--rs)',border:'.5px solid var(--bd)',marginBottom:5,background:'var(--sf)'}}>
                  {t.essential ? <span style={{fontSize:11,flexShrink:0}}>🔴</span> : <div className={`trdot dot-${t.weight[0]}`}></div>}
                  <span style={{flex:1,fontSize:12,color:'var(--tx)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</span>
                  <span style={{fontSize:10,color:'var(--sub)',whiteSpace:'nowrap'}}>{FPT[t.frequency]}</span>
                  {t.scheduled_time && <span className="trtime">⏰ {t.scheduled_time}</span>}
                  <button onClick={() => { closeModal(); openModal('task', t) }} style={{background:'none',border:'none',cursor:'pointer',color:'var(--mu)',fontSize:12,padding:'2px 6px'}} title="Editar">✎</button>
                  <button onClick={() => deleteTask(t.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--cor)',fontSize:12,padding:'2px 6px'}} title="Remover">✕</button>
                </div>
              ))}
              {tasks.length > 6 && <button onClick={() => { closeModal(); setTab('tasks') }} style={{width:'100%',padding:7,border:'.5px dashed var(--bd)',borderRadius:'var(--rs)',background:'transparent',fontSize:11,color:'var(--sub)',cursor:'pointer'}}>+{tasks.length-6} tarefas · ver todas →</button>}
              <div style={{height:.5,background:'var(--bd)',margin:'14px 0'}}></div>
            </>}
            <div style={{fontSize:12,fontWeight:500,color:'var(--tx)',marginBottom:8}}>Adicionar sugestões de rotina</div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div className="stabs" style={{marginBottom:0}}>{cats.map(c => <button key={c} className={`stab ${curTab===c?'on':''}`} onClick={() => setCurTab(c)}>{c}</button>)}</div>
              <button onClick={selectAll} style={{fontSize:11,color:'var(--green)',background:'none',border:'none',cursor:'pointer',whiteSpace:'nowrap'}}>Selecionar tudo</button>
            </div>
            {SUGG[curTab].map((s, idx) => {
              const key = curTab+'::'+s.t
              const on = !!sel.find(x => x.key===key)
              const added = existingTitles.has(s.t)
              return (
                <div key={s.t} style={{display:'flex',alignItems:'stretch',gap:0,marginBottom:5}}>
                  <div className={`si ${on?'on':''}`} style={{flex:1,marginBottom:0,borderRadius:'var(--rs) 0 0 var(--rs)',borderRight:'none',opacity:added?.4:1,cursor:added?'default':'pointer'}}
                    onClick={() => !added && toggle(s)}>
                    <div className={`si-chk ${on||added?'ok':''}`} style={added?{background:'#333',borderColor:'#555'}:{}}>{on||added?'✓':''}</div>
                    <span className="si-name">{s.t}</span>
                    <div style={{display:'flex',gap:4,alignItems:'center',flexShrink:0}}>
                      {added && <span className="bdg bdg-n">adicionada</span>}
                      {s.ess && !added && <span className="bdg bdg-e">essencial</span>}
                      <span className={`bdg ${s.w==='light'?'bdg-l':s.w==='medium'?'bdg-m':'bdg-h'}`}>{WPT[s.w]}</span>
                      <span className="bdg bdg-n">{FPT[s.f]}</span>
                    </div>
                  </div>
                  <button onClick={() => openModal('task', { title:s.t, category:s.cat, weight:s.w, frequency:s.f, essential:s.ess, assigned_to:null, scheduled_time:null, active:true, id:null })}
                    style={{padding:'0 12px',background:'var(--sf2)',border:'.5px solid var(--bd)',borderRadius:'0 var(--rs) var(--rs) 0',color:'var(--mu)',fontSize:13,cursor:'pointer',flexShrink:0}}
                    title="Ajustar e adicionar">✎</button>
                </div>
              )
            })}
            <div style={{marginTop:10,textAlign:'center',fontSize:11,color:'var(--sub)'}}>{sel.length} selecionada{sel.length!==1?'s':''}</div>
          </div>
          <div className="mfoot">
            <button className="btn-g" onClick={() => { closeModal(); setTab('tasks') }}>Ver todas as tarefas</button>
            <button className="btn-p" disabled={sel.length===0} onClick={async () => {
              const existing2 = new Set(tasks.map(t => t.title))
              const toAdd = sel.filter(s => !existing2.has(s.t)).map(s => ({ household_id: householdId, title:s.t, category:s.cat, weight:s.w, frequency:s.f, assigned_to:null, scheduled_time:null, essential:s.ess, active:true }))
              if (toAdd.length > 0) { await supabase.from('tasks').insert(toAdd); showToast(`${toAdd.length} tarefa${toAdd.length!==1?'s':''} adicionada${toAdd.length!==1?'s':''}!`) }
              setSel([]); closeModal(); loadAll()
            }}>Adicionar selecionadas</button>
          </div>
        </div>
      </div>
    )
  }

  // ── MODAL: PET ─────────────────────────────────────────
  function PetModal() {
    const [pname, setPname] = useState('')
    const [breed, setBreed] = useState('')
    const [isPuppy, setIsPuppy] = useState(false)
    const [sel, setSel] = useState<string[]>(DR_DEF.map(r => r.t))
    const allR = [...DR_DEF, ...(isPuppy ? DR_PUP : [])]
    const toggle = (t: string) => setSel(p => p.includes(t) ? p.filter(x => x!==t) : [...p, t])
    const handle = () => {
      if (!pname.trim()) return
      const routines = allR.filter(r => sel.includes(r.t)).map(r => ({ title: r.t, frequency: r.f, scheduled_time: r.time }))
      savePet({ name: pname.trim(), breed: breed.trim() || null, is_puppy: isPuppy }, routines)
    }
    return (
      <div className="mwrap" onClick={closeModal}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="mh"><span className="mht">Cadastrar pet</span><button className="mclose" onClick={closeModal}>✕</button></div>
          <div className="mbody">
            <label className="fl">Nome do pet</label>
            <input className="fi" value={pname} onChange={e => setPname(e.target.value)} placeholder="Ex: Luna, Bob..." autoFocus />
            <label className="fl">Raça <span className="hint">(opcional)</span></label>
            <input className="fi" value={breed} onChange={e => setBreed(e.target.value)} placeholder="Ex: Golden Retriever, SRD..." />
            <label className="fl">Perfil</label>
            <div className="btng c2">
              <button className={`sbtn ${!isPuppy?'on':''}`} onClick={() => setIsPuppy(false)}>🐕 Adulto</button>
              <button className={`sbtn ${isPuppy?'on':''}`} onClick={() => setIsPuppy(true)}>🐶 Filhote</button>
            </div>
            <label className="fl">Rotinas — marque as que quer ativar</label>
            {allR.map(r => (
              <div key={r.t} className={`pri ${sel.includes(r.t)?'on':''}`} onClick={() => toggle(r.t)}>
                <div className={`prchk ${sel.includes(r.t)?'ok':''}`}>{sel.includes(r.t)?'✓':''}</div>
                <span className="pr-name">{r.t}</span>
                {r.time && <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'var(--sub)'}}>{r.time}</span>}
                <span className="bdg bdg-n">{r.f==='daily'?'diária':'semanal'}</span>
              </div>
            ))}
          </div>
          <div className="mfoot"><button className="btn-p" disabled={!pname.trim()} onClick={handle}>Adicionar pet</button></div>
        </div>
      </div>
    )
  }

  // ── MODAL: ENERGY ──────────────────────────────────────
  function EnergyModal() {
    return (
      <div className="mwrap" onClick={closeModal}>
        <div className="modal" style={{maxWidth:360}} onClick={e => e.stopPropagation()}>
          <div className="mh"><span className="mht">Energia da semana</span><button className="mclose" onClick={closeModal}>✕</button></div>
          <div className="mbody">
            <div style={{fontSize:12,color:'var(--sub)',marginBottom:14}}>O sistema adapta as expectativas da semana.</div>
            <div className="btng" style={{gap:8}}>
              {[['high','🌿 Alta energia','Lista completa ativa'],['medium','🌤 Energia média','Modo padrão'],['low','🌧 Baixa energia','Foco no essencial']] .map(([v,l,s]) => (
                <button key={v} className={`sbtn ${settings.energy===v?'on':''}`} style={{padding:13,textAlign:'left'}} onClick={() => setEnergy(v as any)}>
                  <div style={{fontSize:13,marginBottom:2}}>{l}</div>
                  <div style={{fontSize:10,color:'var(--sub)'}}>{s}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── RENDER SCREENS ─────────────────────────────────────
  const filtered = (() => {
    const all = tasks
    if (taskFilter === 'essential') return all.filter(t => t.essential)
    if (taskFilter === 'g') return all.filter(t => !t.assigned_to || t.assigned_to === 'g')
    if (taskFilter === 's') return all.filter(t => t.assigned_to === 's')
    if (CAT[taskFilter]) return all.filter(t => t.category === taskFilter)
    return all
  })()

  return (
    <>
      <style>{S}</style>
      <div className="app">
        {/* TOPBAR */}
        <div className="topbar">
          <span className="logo">Ni<span>nho</span></span>
          <div className="chips">
            <span className={`chip ${settings.energy==='high'?'green':settings.energy==='medium'?'amber':'coral'}`} onClick={() => openModal('energy')}>
              {settings.energy==='high'?'🌿 Alta':settings.energy==='medium'?'🌤 Média':'🌧 Baixa'}
            </span>
            <span className="chip amber">Nível {lv.l} · {lv.n}</span>
            <span className="chip" style={{cursor:'default'}}>🔥 0 dias</span>
            <span className="chip" onClick={() => setTab('settings')} style={{fontSize:13,padding:'3px 8px'}}>⚙</span>
          </div>
        </div>

        {/* NAV */}
        <div className="nav">
          {[['pass','⊞ Passagem'],['expanded','≡ Expandido'],['tasks','✎ Tarefas'],['pets','🐾 Cães'],['week','📅 Semana'],['settings','⚙ Config']].map(([k,l]) => (
            <button key={k} className={`nb ${tab===k?'on':''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {/* SURVIVAL BANNER */}
        {settings.survival && (
          <div style={{padding:'0 20px',marginTop:8}}>
            <div className="surv-banner">🛡 Modo sobrevivência ativo — foco no essencial
              <button onClick={toggleSurvival} style={{marginLeft:'auto',background:'none',border:'none',color:'var(--cor)',fontSize:11,textDecoration:'underline',cursor:'pointer'}}>desativar</button>
            </div>
          </div>
        )}

        {/* PASSAGEM */}
        <div className={`scr ${tab==='pass'?'on':''}`}>
          <Legend />
          <div className="g2" style={{marginBottom:12}}>
            {/* card Giovanna */}
            <div className="card">
              <div className="ph">
                <div className="av av-g">{(names.g||'GI').slice(0,2).toUpperCase()}</div>
                <div><div className="pname">{names.g}</div><div className="prole">home office</div></div>
                <div className="pprog"><span style={{color:'var(--green)',fontWeight:500}}>{myDone.length}</span><span style={{color:'var(--faint)'}}>/{myTasks.length}</span></div>
              </div>
              {myTasks.length === 0 ? <div className="empty" style={{padding:'12px 0'}}><span className="empty-icon">📋</span><div style={{marginBottom:10}}>Nenhuma tarefa</div><button className="empty-btn" onClick={() => openModal('sugg')}>Ver sugestões</button></div> :
                <>
                  {myPend.filter((_,i)=>i<5).map(t => <TaskRow key={t.id} t={t} />)}
                  {myDone.filter((_,i)=>i<2).length>0 && <><div className="sdiv" style={{margin:'8px 0 3px'}}><div className="sdiv-line"></div><span className="sdiv-l">feitas</span><div className="sdiv-line"></div></div>{myDone.filter((_,i)=>i<2).map(t => <TaskRow key={t.id} t={t} />)}</>}
                  {myPend.length>5 && <button onClick={() => setTab('expanded')} style={{width:'100%',marginTop:8,padding:6,border:'.5px dashed var(--bd)',borderRadius:'var(--rs)',background:'transparent',fontSize:11,color:'var(--sub)',cursor:'pointer'}}>+{myPend.length-5} tarefas · ver tudo</button>}
                </>
              }
            </div>
            {/* card Sabrina */}
            <div className="card">
              <div className="ph">
                <div className="av av-s">{(names.s||'SA').slice(0,2).toUpperCase()}</div>
                <div><div className="pname">{names.s}</div><div className="prole">professora</div></div>
                <div className="pprog"><span style={{color:'var(--green)',fontWeight:500}}>{saDone.length}</span><span style={{color:'var(--faint)'}}>/{saTasks.length}</span></div>
              </div>
              {saTasks.length === 0 ? <div className="empty" style={{padding:'12px 0'}}><span className="empty-icon">📋</span><div style={{marginBottom:10}}>Sem tarefas atribuídas</div></div> :
                <>
                  {saPend.filter((_,i)=>i<5).map(t => <TaskRow key={t.id} t={t} />)}
                  {saDone.filter((_,i)=>i<2).length>0 && <><div className="sdiv" style={{margin:'8px 0 3px'}}><div className="sdiv-line"></div><span className="sdiv-l">feitas</span><div className="sdiv-line"></div></div>{saDone.filter((_,i)=>i<2).map(t => <TaskRow key={t.id} t={t} />)}</>}
                  {saPend.length>5 && <button onClick={() => setTab('expanded')} style={{width:'100%',marginTop:8,padding:6,border:'.5px dashed var(--bd)',borderRadius:'var(--rs)',background:'transparent',fontSize:11,color:'var(--sub)',cursor:'pointer'}}>+{saPend.length-5} · ver tudo</button>}
                </>
              }
            </div>
          </div>
          <div className="g3">
            <div className="card">
              <div className="slbl">XP do casal</div>
              <div className="xp-big">{xp}</div>
              <div className="xp-sub">/ {lv.max} · Nível {lv.l}</div>
              <div className="bar"><div className="barf" style={{width:xpPct+'%',background:'var(--gdk)'}}></div></div>
            </div>
            <div className="card">
              <div className="slbl">Casa</div>
              <div className="chaos" style={{color:ci.color}}>{ci.label}</div>
              <div style={{fontSize:11,color:'var(--sub)',margin:'2px 0 8px'}}>Caos: {chaos}%</div>
              <div className="bar"><div className="barf" style={{width:chaos+'%',background:ci.color}}></div></div>
            </div>
            <div className="cteal" onClick={() => setTab('pets')}>
              <div className="slbl teal">🐾 Cães</div>
              {dogs.length === 0 ? <div style={{fontSize:12,color:'var(--green)',opacity:.7}}>Toque para cadastrar →</div> :
                dogs.flatMap(d => d.routines.filter(r=>r.frequency==='daily').slice(0,3).map(r => (
                  <div key={r.id} onClick={e=>{e.stopPropagation();completeDog(r)}} style={{display:'flex',alignItems:'center',gap:7,padding:'4px 0',cursor:'pointer'}}>
                    <div style={{width:13,height:13,borderRadius:3,border:`1.5px solid ${r.completed_today?'var(--gdk)':'#2d5a42'}`,background:r.completed_today?'var(--gdk)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'#fff',flexShrink:0}}>{r.completed_today?'✓':''}</div>
                    <span style={{fontSize:11,color:'var(--green)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.title}</span>
                  </div>
                )))
              }
            </div>
          </div>
        </div>

        {/* EXPANDIDO */}
        <div className={`scr ${tab==='expanded'?'on':''}`}>
          <Legend />
          <button className="gwbtn" onClick={autoDistribute}>✦ Gerar tarefas da semana</button>
          <div className="gdash">
            <PersonCol ts={myTasks} pend={myPend} done={myDone} personKey="g" role="home office" avCls="av-g" />
            <PersonCol ts={saTasks} pend={saPend} done={saDone} personKey="s" role="professora" avCls="av-s" />
            <Sidebar />
          </div>
        </div>

        {/* TAREFAS */}
        <div className={`scr ${tab==='tasks'?'on':''}`}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6,flexWrap:'wrap',gap:8}}>
            <div><span style={{fontSize:15,fontWeight:500}}>Gerenciar tarefas</span><div style={{fontSize:11,color:'var(--sub)',marginTop:2}}>Toque em ✎ para editar · ✕ para remover</div></div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={() => openModal('sugg')} style={{padding:'8px 14px',borderRadius:'var(--rs)',fontSize:12,cursor:'pointer',border:'.5px solid var(--gbdr)',background:'var(--gbg)',color:'var(--green)'}}>+ Sugestões</button>
              <button onClick={() => openModal('task', null)} style={{padding:'8px 14px',borderRadius:'var(--rs)',fontSize:12,cursor:'pointer',border:'.5px solid var(--gdk)',background:'var(--gdk)',color:'#fff'}}>+ Nova tarefa</button>
            </div>
          </div>
          <div className="tcf">
            {[['all',`Todas (${tasks.length})`],['essential',`🔴 Essenciais (${tasks.filter(t=>t.essential).length})`],['g',(names.g||'Giovanna').split(' ')[0]],['s',(names.s||'Sabrina').split(' ')[0]],...Object.entries(CAT).map(([k,v])=>[k,v])].map(([k,v]) => (
              <button key={k} className={`tcfb ${taskFilter===k?'on':''}`} onClick={() => setTaskFilter(k)}>{v}</button>
            ))}
          </div>
          {filtered.length === 0 ? <div className="empty"><span className="empty-icon">📋</span><div style={{marginBottom:10}}>Nenhuma tarefa nesse filtro</div><button className="empty-btn" onClick={() => openModal('sugg')}>Ver sugestões</button></div> :
            filtered.map(t => (
              <div key={t.id} className="tc">
                {t.essential ? <span style={{fontSize:14,flexShrink:0}}>🔴</span> : <div className={`trdot dot-${t.weight[0]}`} style={{width:8,height:8,flexShrink:0}}></div>}
                <div className="tc-info">
                  <div className="tc-title">{t.title}</div>
                  <div className="tc-meta">
                    <span className="bdg bdg-n">{CAT[t.category]||t.category}</span>
                    <span className={`bdg ${t.weight==='light'?'bdg-l':t.weight==='medium'?'bdg-m':'bdg-h'}`}>{WPT[t.weight]} +{XPW[t.weight]}</span>
                    <span className="bdg bdg-n">{FPT[t.frequency]}</span>
                    <span className="bdg" style={{background:!t.assigned_to?'var(--sf2)':t.assigned_to==='g'?'var(--gbg)':'var(--pbg)',color:!t.assigned_to?'var(--sub)':t.assigned_to==='g'?'var(--green)':'var(--pur)'}}>{!t.assigned_to?'Rodízio':t.assigned_to==='g'?(names.g||'Giovanna').split(' ')[0]:(names.s||'Sabrina').split(' ')[0]}</span>
                    {t.scheduled_time && <span className="trtime">⏰ {t.scheduled_time}</span>}
                    {t.essential && <span className="bdg bdg-e">essencial</span>}
                  </div>
                </div>
                <div className="tc-actions">
                  <button className="tc-btn" onClick={() => openModal('task', t)}>✎ Editar</button>
                  <button className="tc-btn danger" onClick={() => deleteTask(t.id)}>✕</button>
                </div>
              </div>
            ))
          }
        </div>

        {/* CÃES */}
        <div className={`scr ${tab==='pets'?'on':''}`}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <span style={{fontSize:15,fontWeight:500}}>{dogs.length} pet{dogs.length!==1?'s':''}</span>
            <button onClick={() => openModal('pet')} style={{background:'var(--gbg)',border:'.5px solid var(--gbdr)',borderRadius:'var(--rs)',padding:'7px 14px',fontSize:12,color:'var(--green)',cursor:'pointer'}}>+ Adicionar pet</button>
          </div>
          {dogs.length === 0 ? <div className="empty"><span className="empty-icon">🐾</span><div style={{marginBottom:10}}>Nenhum pet cadastrado</div><button className="empty-btn" onClick={() => openModal('pet')}>Cadastrar pet</button></div> :
            dogs.map(dog => (
              <div key={dog.id} className="card" style={{marginBottom:12}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12,paddingBottom:10,borderBottom:'.5px solid var(--bd)'}}>
                  <div style={{width:40,height:40,borderRadius:'50%',background:'var(--gbg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{dog.is_puppy?'🐶':'🐕'}</div>
                  <div><div style={{fontSize:15,fontWeight:500}}>{dog.name}</div><div style={{fontSize:11,color:'var(--sub)'}}>{dog.breed||'Raça não informada'} · {dog.is_puppy?'Filhote':'Adulto'}</div></div>
                  <span style={{marginLeft:'auto',fontSize:11,color:'var(--sub)',fontFamily:"'DM Mono',monospace"}}>{dog.routines.filter(r=>r.completed_today).length}/{dog.routines.length} hoje</span>
                </div>
                <div className="slbl">Rotinas diárias</div>
                {dog.routines.filter(r => r.frequency === 'daily').map(r => (
                  <div key={r.id} onClick={() => completeDog(r)} style={{display:'flex',alignItems:'center',gap:9,padding:'9px 10px',borderRadius:'var(--rs)',border:`.5px solid ${r.completed_today?'var(--gbdr)':'var(--bd)'}`,marginBottom:5,cursor:'pointer',background:r.completed_today?'var(--gbg)':'transparent',transition:'all .12s'}}>
                    <div style={{width:15,height:15,borderRadius:3,border:`1.5px solid ${r.completed_today?'var(--gdk)':'var(--bd2)'}`,background:r.completed_today?'var(--gdk)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff',flexShrink:0}}>{r.completed_today?'✓':''}</div>
                    <span style={{flex:1,fontSize:12,color:r.completed_today?'var(--green)':'var(--mu)'}}>{r.title}</span>
                    {r.scheduled_time && <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:'var(--sub)'}}>{r.scheduled_time}</span>}
                  </div>
                ))}
                {dog.routines.filter(r=>r.frequency!=='daily').length > 0 && <>
                  <div className="slbl" style={{marginTop:10}}>Periódicas</div>
                  {dog.routines.filter(r=>r.frequency!=='daily').map(r => (
                    <div key={r.id} style={{display:'flex',alignItems:'center',gap:9,padding:'8px 10px',borderRadius:'var(--rs)',border:'.5px solid var(--bd)',marginBottom:5}}>
                      <span style={{flex:1,fontSize:12,color:'var(--mu)'}}>{r.title}</span>
                      <span className="bdg bdg-n">{FPT[r.frequency]||r.frequency}</span>
                    </div>
                  ))}
                </>}
              </div>
            ))
          }
        </div>

        {/* SEMANA */}
        <div className={`scr ${tab==='week'?'on':''}`}>
          <div style={{fontSize:15,fontWeight:500,marginBottom:4}}>Distribuição semanal</div>
          <div style={{fontSize:12,color:'var(--sub)',marginBottom:14}}>Atribua manualmente ou use a distribuição automática para equilibrar o esforço.</div>
          {(() => {
            const act = tasks.filter(t => t.frequency !== 'once')
            const gS = act.filter(t=>!t.assigned_to||t.assigned_to==='g').reduce((s,t)=>s+XPW[t.weight]*(FEFF[t.frequency]||1),0)
            const sS = act.filter(t=>t.assigned_to==='s').reduce((s,t)=>s+XPW[t.weight]*(FEFF[t.frequency]||1),0)
            const tot = gS + sS; const gP = tot>0?Math.round((gS/tot)*100):50; const sP = 100-gP
            const bal = Math.abs(gS-sS) <= 3
            return (
              <div style={{background:'var(--sf)',border:'.5px solid var(--bd)',borderRadius:'var(--r)',padding:14,marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                  <span style={{fontSize:12,fontWeight:500}}>{names.g} <span style={{color:'var(--sub)',fontWeight:400}}>{gP}%</span></span>
                  <span style={{fontSize:11,color:bal?'var(--green)':'var(--amb)'}}>{bal?'✓ Equilibrado':'⚠ Diferença: '+Math.round(Math.abs(gS-sS))+' pts'}</span>
                  <span style={{fontSize:12,fontWeight:500}}>{names.s} <span style={{color:'var(--sub)',fontWeight:400}}>{sP}%</span></span>
                </div>
                <div style={{height:8,background:'var(--sf2)',borderRadius:4,overflow:'hidden',display:'flex',marginBottom:8}}>
                  <div style={{width:gP+'%',background:'var(--gdk)',transition:'width .4s'}}></div>
                  <div style={{flex:1,background:'var(--pur)'}}></div>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--sub)'}}>
                  <span><span style={{color:'var(--tx)',fontWeight:500}}>{Math.round(gS)}</span> pts · {act.filter(t=>!t.assigned_to||t.assigned_to==='g').length} tarefas</span>
                  <span><span style={{color:'var(--tx)',fontWeight:500}}>{Math.round(sS)}</span> pts · {act.filter(t=>t.assigned_to==='s').length} tarefas</span>
                </div>
              </div>
            )
          })()}
          <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
            <button className="gwbtn" style={{flex:1,marginBottom:0}} onClick={autoDistribute}>✦ Distribuir automaticamente</button>
            <button onClick={() => openModal('sugg')} style={{padding:'10px 14px',borderRadius:'var(--rs)',fontSize:12,cursor:'pointer',border:'.5px solid var(--gbdr)',background:'var(--gbg)',color:'var(--green)'}}>+ Sugestões</button>
            <button onClick={() => openModal('task', null)} style={{padding:'10px 14px',borderRadius:'var(--rs)',fontSize:12,cursor:'pointer',border:'.5px solid var(--bd)',background:'var(--sf2)',color:'var(--mu)'}}>+ Nova</button>
          </div>
          <div className="slbl">{tasks.length} tarefa{tasks.length!==1?'s':''} ativa{tasks.length!==1?'s':''}</div>
          {tasks.length === 0 ? <div className="empty"><span className="empty-icon">📋</span><div style={{marginBottom:10}}>Nenhuma tarefa</div><button className="empty-btn" onClick={() => openModal('sugg')}>Ver sugestões</button></div> :
            tasks.sort((a,b)=>{const oA=(a.essential?0:1)*10+(a.weight==='heavy'?0:a.weight==='medium'?1:2);const oB=(b.essential?0:1)*10+(b.weight==='heavy'?0:b.weight==='medium'?1:2);return oA-oB}).map(t => (
              <div key={t.id} className="wt">
                {t.essential?<span style={{fontSize:13,flexShrink:0}}>🔴</span>:<div className={`trdot dot-${t.weight[0]}`}></div>}
                <div style={{flex:1,minWidth:0}}>
                  <div className="wt-name" style={{marginBottom:3}}>{t.title}</div>
                  <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                    <span className="bdg bdg-n">{FPT[t.frequency]}</span>
                    <span className={`bdg ${t.weight==='light'?'bdg-l':t.weight==='medium'?'bdg-m':'bdg-h'}`}>+{XPW[t.weight]}</span>
                    {t.scheduled_time && <span className="trtime">⏰ {t.scheduled_time}</span>}
                    {t.essential && <span className="bdg bdg-e">essencial</span>}
                  </div>
                </div>
                <div className="wt-assign">
                  <button className={`wa ${(!t.assigned_to||t.assigned_to==='g')?'g-on':''}`} onClick={() => assignTask(t.id,'g')}>{(names.g||'Giovanna').split(' ')[0]}</button>
                  <button className={`wa ${t.assigned_to==='s'?'s-on':''}`} onClick={() => assignTask(t.id,'s')}>{(names.s||'Sabrina').split(' ')[0]}</button>
                </div>
                <button className="tc-btn" onClick={() => openModal('task', t)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--sub)',padding:'4px 6px',fontSize:13}}>✎</button>
              </div>
            ))
          }
        </div>

        {/* CONFIG */}
        <div className={`scr ${tab==='settings'?'on':''}`}>
          <div style={{fontSize:16,fontWeight:500,marginBottom:16}}>Configurações</div>
          <div className="card" style={{marginBottom:12}}>
            <div className="slbl">Integrantes</div>
            <div className="srow"><span className="srow-l">Giovanna (home office)</span><input className="sedit" defaultValue={names.g} onBlur={e => updateName('g', e.target.value)} /></div>
            <div className="srow"><span className="srow-l">Sabrina (professora)</span><input className="sedit" defaultValue={names.s} onBlur={e => updateName('s', e.target.value)} /></div>
          </div>
          <div className="card" style={{marginBottom:12}}>
            <div className="slbl">Sistema</div>
            <div className="srow"><span className="srow-l">Energia da semana</span><span className="srow-v" onClick={() => openModal('energy')}>{settings.energy==='high'?'🌿 Alta':settings.energy==='medium'?'🌤 Média':'🌧 Baixa'} ›</span></div>
            <div className="srow"><span className="srow-l">Modo sobrevivência</span><span className="srow-v" onClick={toggleSurvival}>{settings.survival?'Ativo ✓':'Inativo'} ›</span></div>
            <div className="srow"><span className="srow-l">XP total</span><span className="srow-v">{xp} XP</span></div>
            <div className="srow"><span className="srow-l">Tarefas ativas</span><span className="srow-v">{tasks.length}</span></div>
            <div className="srow"><span className="srow-l">Pets</span><span className="srow-v">{dogs.length}</span></div>
          </div>
          <div className="card">
            <div className="slbl">Guia de indicadores</div>
            <Legend />
            <div style={{fontSize:12,color:'var(--mu)',lineHeight:1.8,marginTop:8}}>
              <b style={{color:'var(--tx)'}}>Barra de caos</b> — sobe quando tarefas diárias ficam pendentes, cai quando são concluídas.<br />
              <b style={{color:'var(--tx)'}}>XP</b> — acumula com cada tarefa feita. Leve +1, Médio +2, Pesado +3.<br />
              <b style={{color:'var(--tx)'}}>Essencial 🔴</b> — não pode falhar. Aparece primeiro na lista.<br />
              <b style={{color:'var(--tx)'}}>Modo sobrevivência</b> — semana difícil. Sem cobranças, foco no essencial.
            </div>
          </div>
        </div>

        {/* FAB */}
        <button className="fab" onClick={() => openModal('task', null)} title="Nova tarefa">+</button>
      </div>

      {/* TOAST */}
      {toast && <div className="toast">{toast}</div>}

      {/* MODALS */}
      {modal === 'task' && <TaskFormModal />}
      {modal === 'sugg' && <SuggModal />}
      {modal === 'pet' && <PetModal />}
      {modal === 'energy' && <EnergyModal />}
    </>
  )
}
