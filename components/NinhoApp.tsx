'use client'
import { useEffect, useState, useRef } from 'react'
import type { Accident, Dog, DogItem, DogRoutine, Energy, HistoryWeek, HItem, Meeting, Names, Task, Who } from '@/lib/types'
import { ACCIDENT_PLACES, CAT, DR_DEF, DR_PUP, ENERGY, FEFF, FPT, RFREQ, ROLE, SUGG, TABS, WPT } from '@/lib/constants'
import { addDays, fmtDate, greeting, hhmm, longDateLabel, timeOfInstant } from '@/lib/dates'
import { doneInPeriod, dueToday, lastDone, lastLabel, pausedToday, weekdaysLabel, WEEKDAY_SHORT } from '@/lib/frequency'
import { isFixed } from '@/lib/rotation'
import { whyLabel, type SplitMode } from '@/lib/split'
import * as casaApi from '@/lib/services/casa'
import { useCasa } from '@/hooks/useCasa'
import { ShoppingTab } from '@/components/casa/ShoppingTab'
import { MaintenanceForm, MaintenanceSection, MaintTemplatesSheet, MaintTodayCard, useMaintActions } from '@/components/casa/Maintenance'
import { shoppingCounts } from '@/lib/shopping'
import type { MaintenanceItem } from '@/lib/maintenance'
import { byTime, groupToday, isLate, planToday } from '@/lib/today'
import { LEVELS, XPW, getChaosInfo, getLevel, levelProgress, weekDots } from '@/lib/xp'
import { completedByLabel } from '@/lib/completions'
import { logError, toNinhoError, type NinhoError } from '@/lib/errors'
import * as api from '@/lib/services/ninho'
import { createPendingGuard } from '@/lib/pending'
import { canEarnOnTime, evaluate, newlyUnlocked, xpWithBonus, TIER_NAMES, type AchievementState } from '@/lib/gamification'
import { Scoreboard } from '@/components/gamification/Scoreboard'
import { StreaksCard } from '@/components/gamification/StreaksCard'
import { Achievements } from '@/components/gamification/Achievements'
import { BetModal } from '@/components/gamification/BetModal'
import { Ring } from '@/components/ui/Ring'
import { Sheet } from '@/components/ui/Sheet'
import { DeviceIdentityModal } from '@/components/DeviceIdentityModal'
import { NotificationsCard } from '@/components/NotificationsCard'
import { TelegramCard, fetchAiTips } from '@/components/TelegramCard'
import { useHomeClock } from '@/hooks/useHomeClock'
import { useDeviceIdentity } from '@/hooks/useDeviceIdentity'
import { useNinhoData } from '@/hooks/useNinhoData'

function firstName(n:string){return (n||'').split(' ')[0]}
function initials(n:string){return (n||'??').slice(0,2).toUpperCase()}
function wCls(w:string){return w==='light'?'l':w==='medium'?'m':'h'}
function byCat(list:Task[]){const g:Record<string,Task[]>={};list.forEach(t=>{(g[t.category]=g[t.category]||[]).push(t)});return Object.entries(g)}
function catIc(c:string){return (CAT[c]||'').split(' ')[0]}

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
.stat{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:14px 16px;min-width:0;text-align:left;overflow:hidden}
button.stat{transition:border-color .15s}button.stat:hover{border-color:var(--bd2)}
.stat-l{font-size:12px;color:var(--sub);font-weight:500;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stat-v{font-size:26px;font-weight:400;letter-spacing:-.03em;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stat-txt{font-size:19px;white-space:normal;line-height:1.2;padding-top:4px;letter-spacing:-.01em}
.stat-v small{font-size:13px;color:var(--sub);margin-left:4px;letter-spacing:0}
.stat-s{font-size:12px;color:var(--sub);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar{background:var(--sf3);border-radius:99px;height:5px;overflow:hidden;margin-top:10px}
.barf{height:100%;border-radius:99px;transition:width .5s ease}
.week-dots{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin-top:10px;width:100%;max-width:100%}
.wd{display:block;min-width:0;width:auto;height:5px;border-radius:99px;background:var(--bd2)}
.wd.on{background:var(--amb)}.wd.today{background:var(--abdr)}

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
.cdiv.late{color:var(--cor)}
.tag-t.late{color:var(--cor)}
.tag-next{color:var(--green);font-weight:500}
.tag-r{color:var(--pur)}
.tr.next{background:linear-gradient(90deg,rgba(29,158,117,.09),transparent 70%)}
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
.tr .ib.mob{display:none}
.sm-only{display:none}
.mini{width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:500;font-family:'DM Mono',monospace;flex-shrink:0}
.accb{font-size:11px;color:var(--amb);margin-left:6px}
.menu{display:flex;flex-direction:column;gap:6px}
.menu .btn{justify-content:flex-start;padding:13px 14px;font-size:14px}
.guide details{border-top:1px solid var(--bd);padding:2px 0}
.guide details:first-of-type{border-top:none}
.guide summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:10px;padding:12px 0;font-size:14px;font-weight:500}
.guide summary::-webkit-details-marker{display:none}
.guide summary::after{content:'▸';margin-left:auto;color:var(--faint);transition:transform .15s}
.guide details[open] summary::after{transform:rotate(90deg)}
.guide .gb{font-size:13px;color:var(--mu);line-height:1.6;padding:0 0 14px 30px}
.guide .gb p+p,.guide .gb p+ul,.guide .gb ul+p{margin-top:8px}
.guide .gb ul{padding-left:18px}.guide .gb li{margin:3px 0}
.guide .gb b{color:var(--tx);font-weight:500}
.dtog{width:100%;display:flex;align-items:center;gap:8px;border:none;background:transparent;color:var(--sub);font-size:13px;padding:12px 0 6px;margin-top:8px;border-top:1px solid var(--bd)}
.dtog:hover{color:var(--tx)}
.alldone{text-align:center;padding:18px 8px 10px;color:var(--green);font-size:14px}
.alldone small{display:block;color:var(--sub);font-size:12px;margin-top:3px}
.empty{text-align:center;padding:30px 16px;color:var(--sub);font-size:13px}
.empty-icon{font-size:30px;display:block;margin-bottom:10px}
.empty .btn{margin-top:14px}
.dr{display:flex;align-items:center;gap:10px;padding:5px 0;min-height:44px;user-select:none}
.dr .chk{width:22px;height:22px;border-radius:7px}
.dr .chk:disabled{cursor:default;animation:none}
.dr-t{flex:1;min-width:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
.dr.done .dr-t{color:var(--sub);text-decoration:line-through}
.dr.sat{opacity:.6}.dr.sat .dr-t{text-decoration:none;cursor:default}
.dr-m{font-size:11px;color:var(--sub);font-family:'DM Mono',monospace;white-space:nowrap}
.dr-m.late{color:var(--cor)}
.dr .ib{width:30px;height:30px;font-size:14px}
.dsum{display:flex;align-items:center;gap:12px;padding:10px;margin:0 -10px;width:calc(100% + 20px);border:none;background:transparent;border-radius:var(--rs);text-align:left;transition:background .12s}
.dsum:hover{background:var(--sf2)}
.dsum-h{display:flex;justify-content:space-between;align-items:baseline;font-size:14px}.dsum-h b{font-weight:500}.dsum-h .mono{font-size:11.5px;color:var(--sub)}
.dsum-s{display:block;font-size:12px;color:var(--sub);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsum-s .late{color:var(--cor)}
.addr{width:100%;margin-top:8px;border:1px dashed var(--bd2);background:transparent;color:var(--sub);border-radius:var(--rs);padding:9px;font-size:13px;transition:all .12s}
.addr:hover{color:var(--green);border-color:var(--gbdr)}
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
.qb{border:1px solid transparent;cursor:pointer;transition:all .12s}
.qb.bdg-n:hover{color:var(--tx);border-color:var(--bd2)}
.qb.bdg-n{border-style:dashed;border-color:var(--bd2);background:transparent}
.qtw{display:inline-flex;align-items:center;background:var(--abg);border-radius:5px;padding:0 2px 0 6px;height:20px}
.qtime{background:transparent;border:none;outline:none;color:var(--amb);font-family:'DM Mono',monospace;font-size:10.5px;width:62px;color-scheme:dark;padding:0}
.qtime::-webkit-calendar-picker-indicator{display:none}
.qx{background:none;border:none;color:var(--amb);opacity:.6;font-size:10px;padding:0 3px}.qx:hover{opacity:1}
.dupe{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;border-radius:var(--rs);background:var(--pbg);border:1px solid var(--pbdr);color:var(--pur);font-size:13px;margin-bottom:14px}
.dupe .btn{margin-left:auto;padding:7px 12px}
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
.mob-fab{display:none}
@media(max-width:860px){.mob-fab{display:flex}}
.fab span{font-size:22px;line-height:1;font-weight:300}
.fab:hover{transform:translateY(-2px)}
.toast{position:fixed;top:calc(14px + var(--safe-t));left:50%;transform:translateX(-50%);background:#132a20;border:1px solid var(--gbdr);border-radius:12px;padding:10px 12px 10px 16px;font-size:13px;color:var(--green);display:flex;align-items:center;gap:12px;z-index:100;max-width:calc(100vw - 32px);box-shadow:0 10px 30px rgba(0,0,0,.4);animation:fu .2s ease}
.toast-m{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.toast button{background:none;border:none;color:var(--tx);font-weight:500;font-size:13px;padding:2px 6px;text-decoration:underline;text-underline-offset:3px;flex-shrink:0}
/* ── gamificação ── */
.xp.bonus{box-shadow:inset 0 0 0 1px currentColor}
.sb{display:block;width:100%;text-align:left}
button.sb{transition:border-color .15s}button.sb:hover{border-color:var(--bd2)}
.sb .slbl .lnk{margin-left:auto}
.sb-row{display:flex;align-items:flex-end;gap:10px}
.sb-side{flex:1;min-width:0}
.sb-s{text-align:right}
.sb-name{font-size:13px;color:var(--mu);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-xp{line-height:1.1;margin-top:2px}.sb-xp b{font-size:28px;font-weight:400;letter-spacing:-.03em}.sb-xp small{font-size:12px;color:var(--sub);margin-left:4px}
.sb-g .sb-xp b{color:var(--green)}.sb-s .sb-xp b{color:var(--pur)}
.sb-side.lead .sb-name{color:var(--tx)}
.sb-vs{color:var(--faint);font-size:14px;padding-bottom:6px}
.sb-meta{font-size:11.5px;color:var(--sub);margin-top:2px}
.sb-bar{margin:10px 0 10px}
.sb-bet{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:var(--amb)}
.sb-bet .lnk{margin-left:auto;background:none;border:none;color:var(--green);font-size:12px;font-weight:500}
.sb-foot,.sb-prev{font-size:12px;color:var(--sub);margin-top:8px;line-height:1.5}
.sb-prev{padding-top:8px;border-top:1px solid var(--bd)}
.sb.compact .sb-xp b{font-size:22px}
.stk{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--bd)}
.slbl+.stk{border-top:none;padding-top:0}
.stk-ic{width:34px;height:34px;border-radius:10px;background:var(--sf2);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;filter:grayscale(.6)}
.stk-ic.hot{background:var(--abg);filter:none}
.stk-t{display:block;font-size:14px}.stk-s{display:block;font-size:12px;color:var(--sub)}
.stk-n{text-align:right;flex-shrink:0;white-space:nowrap}.stk-n b{font-size:22px;font-weight:400}.stk-n small{font-size:11.5px;color:var(--sub);margin-left:3px}
.stk-best{display:block;font-size:11px;color:var(--amb);font-family:'DM Mono',monospace}
.stk-note{font-size:12px;color:var(--sub);margin-top:10px;line-height:1.5}
.ach-who{display:inline-flex;margin-bottom:12px}
.ach-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr));gap:8px}
.ach{display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid var(--bd);border-radius:var(--rs);min-width:0}
.ach-ic{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;background:var(--sf2);filter:grayscale(1);opacity:.55}
.ach.t1 .ach-ic{filter:none;opacity:1;background:#3a2414;box-shadow:inset 0 0 0 2px #b0703c}
.ach.t2 .ach-ic{filter:none;opacity:1;background:#2a2d31;box-shadow:inset 0 0 0 2px #aeb6bf}
.ach.t3 .ach-ic{filter:none;opacity:1;background:#3a300c;box-shadow:inset 0 0 0 2px #e2b93b}
.ach-body{min-width:0;flex:1}
.ach-n{display:block;font-size:13px;font-weight:500;line-height:1.3}
.ach-tier{display:block;font-size:11px;color:var(--sub);font-family:'DM Mono',monospace;margin-top:1px}
.ach.t1 .ach-tier{color:#d08a50}.ach.t2 .ach-tier{color:#c9d1da}.ach.t3 .ach-tier{color:#e9c552}
.ach-bar{display:block;height:4px;border-radius:99px;background:var(--sf3);overflow:hidden;margin-top:6px}
.ach-bar span{display:block;height:100%;background:var(--amb);border-radius:99px}
.ach-s{display:block;font-size:11px;color:var(--sub);margin-top:4px}
.toast.err{background:#2a120b;border-color:var(--cbdr);color:#ffb59a;width:min(460px,calc(100vw - 32px))}
.toast-m{white-space:normal;flex:1 1 auto;min-width:0;line-height:1.4}
.toast .tx{text-decoration:none;color:var(--sub);padding:2px 4px}

/* ── estados: gravando, carregando, erro, autoria ── */
@keyframes spin{to{transform:rotate(360deg)}}
.chk.busy{opacity:.55;cursor:progress;animation:none;position:relative}
.chk.busy::after{content:'';position:absolute;inset:-4px;border-radius:10px;border:2px solid transparent;border-top-color:var(--green);animation:spin .8s linear infinite}
.chk:disabled{cursor:default}
.pill:disabled{opacity:.5;cursor:progress}
.tag-by{color:var(--sub)}
.you{font-size:10.5px;font-weight:500;color:var(--green);background:var(--gbg);border:1px solid var(--gbdr);border-radius:99px;padding:1px 7px;margin-left:8px;vertical-align:2px;font-family:'DM Mono',monospace}
.sbtn.who{display:flex;align-items:center;gap:12px;padding:12px 14px;text-align:left;font-size:15px;color:var(--tx)}
.sbtn.who small{font-size:12px}
.loadscr{display:flex;align-items:center;justify-content:center;gap:12px;padding:80px 16px;color:var(--sub);font-size:14px}
.spin{width:18px;height:18px;border-radius:50%;border:2px solid var(--bd2);border-top-color:var(--green);animation:spin .8s linear infinite}
.loaderr{max-width:440px;margin:60px auto;text-align:center}
.inline-err{font-size:13px;color:var(--cor);padding:8px 0}
.inline-err .lnk{background:none;border:none;color:var(--green);font-size:13px;text-decoration:underline;text-underline-offset:3px}
@media (prefers-reduced-motion:reduce){.chk.busy::after,.spin{animation:none}}

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

/* ── Fase 3: compras, manutenção, divisão ── */
.vseg{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:4px;margin-bottom:16px;max-width:520px}
.vseg .segb{border:none;background:transparent;padding:10px 8px;border-radius:9px;color:var(--sub);font-weight:500;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px;min-width:0}
.vseg .segb.on{background:var(--sf3);color:var(--tx)}
.segb .cnt.late{background:var(--cbg);color:var(--cor);border-radius:99px;padding:1px 7px;font-family:'DM Mono',monospace;font-size:11px}
.opts.c2{grid-template-columns:1fr 1fr}
.why{font-size:13px;color:var(--pur);background:var(--pbg);border:1px solid var(--pbdr);border-radius:var(--rs);padding:10px 12px;margin-bottom:12px}
.shop-add{display:flex;gap:8px;margin-bottom:8px;align-items:stretch}
.shop-add .fi{flex:1;min-width:0;margin:0}
.shop-add .shop-cat{flex:0 0 auto;width:auto;max-width:150px;padding-right:6px}
.shop-add .btn{font-size:20px;padding:0 18px}
.shop-hint{font-size:12px;color:var(--sub);margin:-2px 0 12px}
.shop-row .qb{border:none;cursor:pointer;flex-shrink:0}
.shop-row .ib.danger{display:flex;color:var(--sub)}
.shop-sum{margin:0;width:100%;padding:14px 16px;border:1px solid var(--bd)}
.mt-due{font-family:'DM Mono',monospace;font-size:11px;color:var(--sub)}
.mt-due.late{color:var(--cor)}.mt-due.today{color:var(--amb)}.mt-due.soon{color:var(--amb)}
.mt-row .mt-done{padding:7px 11px;font-size:12.5px;flex-shrink:0}
.mt-row .trb{cursor:pointer}
.mt-ago{width:auto;max-width:130px;margin:0;padding:6px 8px;font-size:12.5px}

/* ── Fase 4: rotina flexível ── */
.wdays{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.wday{padding:10px 0;border-radius:10px;border:1px solid var(--bd);background:transparent;color:var(--sub);font-size:13px;font-weight:500;text-transform:capitalize}
.wday.on{background:var(--gbg);border-color:var(--gbdr);color:var(--green)}
.paused{margin-top:10px;padding-top:10px;border-top:1px dashed var(--bd)}
.paused-h{font-size:12px;color:var(--sub);margin-bottom:4px}
.paused-r{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13.5px;min-width:0}
.paused-t{flex:1;min-width:0;color:var(--mu);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.paused-k{font-size:11.5px;color:var(--faint);font-family:'DM Mono',monospace;flex-shrink:0}
.paused-r .lnk{background:none;border:none;color:var(--green);font-size:12.5px;font-weight:500;flex-shrink:0}
.menu-s{display:block;margin-left:auto;font-size:11px;color:var(--faint);font-weight:400}

/* ── Fase 5: Telegram e IA ── */
.tg-code{font-size:12.5px;color:var(--sub);background:var(--sf2);border-radius:var(--rs);padding:10px 12px;margin:4px 0 8px;line-height:1.5}
.tg-code code{font-family:'DM Mono',monospace;color:var(--tx)}
.tg-code .lnk{background:none;border:none;color:var(--green);font-size:12.5px;font-weight:500}
.tg-code code{word-break:break-all}
.tg-act{margin-top:8px;display:flex;gap:8px}
.tg-person+.tg-person{border-top:1px solid var(--bd);margin-top:4px}
.aibox{margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid var(--bd)}
.ai-wait{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--sub);padding:10px 0}
.ai-tip{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.45;padding:8px 0;border-top:1px solid var(--bd)}
.ai-tip span{flex:1;min-width:0}
.ai-tip .lnk{background:none;border:none;color:var(--pur);font-size:12px;font-weight:500;flex-shrink:0;white-space:nowrap}

/* ── responsivo ── */
@media(max-width:1100px){
  .today{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .side{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}
  .tnb{padding:8px 11px}
}
@media(max-width:860px){
  .tnav{display:none}
  .top-in{padding:10px 16px;min-height:54px}
  .bnav{display:grid;grid-template-columns:repeat(6,1fr);position:fixed;bottom:0;left:0;right:0;z-index:30;background:rgba(18,18,17,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-top:1px solid var(--bd);padding:6px 6px calc(6px + var(--safe-b))}
  .bnb{border:none;background:transparent;color:var(--sub);display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 0 4px;font-size:11px;font-weight:500;border-radius:12px;transition:color .15s}
  .bnb .ic{font-size:20px;line-height:1;filter:grayscale(1);opacity:.55;transition:all .15s}
  .bnb.on{color:var(--tx)}.bnb.on .ic{filter:none;opacity:1;transform:translateY(-1px)}
  .main{padding:16px 16px calc(150px + var(--safe-b))}
  .fab{bottom:calc(78px + var(--safe-b));right:16px;height:52px;width:52px;padding:0;justify-content:center}
  .fab b{display:none}
  .lg-only{display:none}
  .ach-grid{grid-template-columns:1fr 1fr;gap:6px}
  .ach{flex-direction:column;gap:6px;padding:9px}
  .ach-ic{width:30px;height:30px;font-size:15px}
  .ach-s{font-size:10.5px}
  .trt{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .tr .ib.desk{display:none}.tr .ib.mob{display:flex}
  .card{padding:14px}
  .desk-only{display:none}
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
  .tc{padding:10px 10px 10px 12px;gap:10px}
  .tc .ib.danger{display:none}
  .asg button{padding:5px 9px}
  .sm-only{display:inline}
  .mwrap{align-items:flex-end;padding:0}
  .modal,.modal-lg,.modal-sm{max-width:none;border-radius:20px 20px 0 0;max-height:92vh;border-bottom:none}
  .grab{display:block;width:38px;height:4px;border-radius:99px;background:var(--bd2);margin:8px auto 0;flex-shrink:0}
  .mh{padding:10px 18px 14px}
  .mbody{padding:16px 18px}
  .fi,.fita,.search input{font-size:16px}
}
@media(max-width:420px){
  .opts{grid-template-columns:1fr}
  .opts.c2{grid-template-columns:1fr 1fr}
  .shop-add .shop-cat{max-width:110px}
  .bnb{font-size:10.5px}
  .field-row{flex-wrap:wrap}.field-row .fi{max-width:none}
}
`

// ── PEÇAS DE UI (fora do componente principal para não remontar a cada render) ──
// Horário editável direto na lista de Tarefas
function QuickTime({value,onSave}:{value:string,onSave:(v:string)=>void}){
  const[edit,setEdit]=useState(false)
  const[v,setV]=useState(value)
  useEffect(()=>{setV(value)},[value])
  const commit=()=>{setEdit(false);if(v!==value)onSave(v)}
  if(!edit&&!value)return <button className="bdg bdg-n qb" onClick={e=>{e.stopPropagation();setEdit(true)}} title="Definir horário">+ horário</button>
  return(
    <span className="qtw" onClick={e=>e.stopPropagation()}>
      <input type="time" className="qtime" value={v} autoFocus={edit} onChange={e=>setV(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur();if(e.key==='Escape'){setV(value);setEdit(false)}}} aria-label="Horário"/>
      {v&&<button className="qx" onMouseDown={e=>e.preventDefault()} onClick={()=>{setV('');setEdit(false);onSave('')}} title="Tirar horário" aria-label="Tirar horário">✕</button>}
    </span>
  )
}

function TaskFormModal({task,names,saving,onClose,onSave,onDelete}:{task:Task|null,names:Names,saving:boolean,onClose:()=>void,onSave:(d:any,id?:string)=>void,onDelete:(id:string)=>void}){
  const t=task
  const editing=!!t?.id
  const[title,setTitle]=useState(t?.title||'')
  const[cat,setCat]=useState(t?.category||'general')
  const[weight,setWeight]=useState<'light'|'medium'|'heavy'>(t?.weight||'medium')
  const[freq,setFreq]=useState(t?.frequency||'weekly')
  const[assign,setAssign]=useState(t?.assigned_to||'')
  const[time,setTime]=useState(hhmm(t?.scheduled_time||null))
  const[ess,setEss]=useState(t?.essential||false)
  const[days,setDays]=useState<number[]>(t?.weekdays||[])
  const[due,setDue]=useState(t?.due_date||'')
  const usesDays=['daily','weekly','biweekly'].includes(freq)
  const toggleDay=(d:number)=>setDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d])
  const handle=()=>{if(!title.trim()||saving)return
    const wd=usesDays&&days.length&&days.length<7?[...days].sort():null
    const extra:any={}
    // Só envia as colunas novas quando usadas (o app funciona mesmo antes da migration 008)
    if(wd||t?.weekdays)extra.weekdays=wd
    if((freq==='once'&&due)||t?.due_date)extra.due_date=freq==='once'&&due?due:null
    onSave({title:title.trim(),category:cat,weight,frequency:freq,assigned_to:assign||null,scheduled_time:time||null,essential:ess,...extra},editing?t!.id:undefined)}
  return(
    <Sheet title={editing?'Editar tarefa':'Nova tarefa'} onClose={onClose} footer={<>
      {editing&&<button className="btn btn-danger" disabled={saving} onClick={()=>onDelete(t!.id)}>Remover</button>}
      <button className="btn btn-p" disabled={!title.trim()||saving} onClick={handle}>{saving?'Salvando…':editing?'Salvar alterações':'Criar tarefa'}</button>
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
      {usesDays&&<>
        <label className="fl">Dias da semana <span className="hint">({freq==='daily'?'só nesses dias':'aparece a partir do primeiro dia escolhido'}; nenhum = qualquer dia)</span></label>
        <div className="wdays" role="group" aria-label="Dias da semana">
          {[1,2,3,4,5,6,0].map(d=><button key={d} type="button" className={`wday ${days.includes(d)?'on':''}`} aria-pressed={days.includes(d)} onClick={()=>toggleDay(d)}>{WEEKDAY_SHORT[d]}</button>)}
        </div>
      </>}
      {freq==='once'&&<>
        <label className="fl">Data <span className="hint">(opcional · aparece em Hoje a partir dela)</span></label>
        <input type="date" className="fi" value={due} onChange={e=>setDue(e.target.value)} style={{maxWidth:200}}/>
      </>}
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
        {busy?'Salvando…':sel.length===0?'Selecione tarefas':`Adicionar ${sel.length} tarefa${sel.length!==1?'s':''}`}
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

function PetModal({saving,onClose,onSave}:{saving:boolean,onClose:()=>void,onSave:(d:any,r:any[])=>void}){
  const[pname,setPname]=useState('')
  const[breed,setBreed]=useState('')
  const[isPuppy,setIsPuppy]=useState(false)
  const[sel,setSel]=useState<string[]>(DR_DEF.map(r=>r.t))
  const allR=[...DR_DEF,...(isPuppy?DR_PUP:[])]
  const toggle=(t:string)=>setSel(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t])
  function pickPuppy(v:boolean){setIsPuppy(v);if(v)setSel(p=>Array.from(new Set([...p,...DR_PUP.map(r=>r.t)])))}
  const handle=()=>{if(!pname.trim()||saving)return;onSave({name:pname.trim(),breed:breed.trim()||null,is_puppy:isPuppy},allR.filter(r=>sel.includes(r.t)).map(r=>({title:r.t,frequency:r.f,scheduled_time:r.time})))}
  return(
    <Sheet title="Cadastrar pet" onClose={onClose} footer={<button className="btn btn-p" disabled={!pname.trim()||saving} onClick={handle}>{saving?'Salvando…':'Adicionar pet'}</button>}>
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

function DogModal({dog,saving,onClose,onSave,onDelete}:{dog:Dog,saving:boolean,onClose:()=>void,onSave:(id:string,d:any)=>void,onDelete:(d:Dog)=>void}){
  const[pname,setPname]=useState(dog.name)
  const[breed,setBreed]=useState(dog.breed||'')
  const[isPuppy,setIsPuppy]=useState(dog.is_puppy)
  const handle=()=>{if(!pname.trim()||saving)return;onSave(dog.id,{name:pname.trim(),breed:breed.trim()||null,is_puppy:isPuppy})}
  return(
    <Sheet title={`Editar ${dog.name}`} onClose={onClose} footer={<>
      <button className="btn btn-danger" disabled={saving} onClick={()=>onDelete(dog)}>Remover</button>
      <button className="btn btn-p" disabled={!pname.trim()||saving} onClick={handle}>{saving?'Salvando…':'Salvar alterações'}</button>
    </>}>
      <label className="fl">Nome</label><input className="fi" value={pname} onChange={e=>setPname(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handle()}}/>
      <label className="fl">Raça <span className="hint">(opcional)</span></label><input className="fi" value={breed} onChange={e=>setBreed(e.target.value)} placeholder="Ex: Golden Retriever, SRD..."/>
      <label className="fl">Fase</label>
      <div className="btng c2"><button className={`sbtn ${!isPuppy?'on':''}`} onClick={()=>setIsPuppy(false)}>🐕 Adulto</button><button className={`sbtn ${isPuppy?'on':''}`} onClick={()=>setIsPuppy(true)}>🐶 Filhote<small>Ativa o registro de acidentes</small></button></div>
    </Sheet>
  )
}

function RoutineModal({routine,dogName,saving,onClose,onSave,onDelete}:{routine:DogRoutine|null,dogName:string,saving:boolean,onClose:()=>void,onSave:(d:any,id?:string)=>void,onDelete:(r:DogRoutine)=>void}){
  const[title,setTitle]=useState(routine?.title||'')
  const[freq,setFreq]=useState(routine?.frequency||'daily')
  const[time,setTime]=useState(hhmm(routine?.scheduled_time||null))
  const handle=()=>{if(!title.trim()||saving)return;onSave({title:title.trim(),frequency:freq,scheduled_time:time||null},routine?.id)}
  return(
    <Sheet size="sm" title={routine?`Editar rotina · ${dogName}`:`Nova rotina · ${dogName}`} onClose={onClose} footer={<>
      {routine&&<button className="btn btn-danger" disabled={saving} onClick={()=>onDelete(routine)}>Remover</button>}
      <button className="btn btn-p" disabled={!title.trim()||saving} onClick={handle}>{saving?'Salvando…':routine?'Salvar':'Criar rotina'}</button>
    </>}>
      <label className="fl">Nome</label>
      <input className="fi" value={title} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handle()}} placeholder="Ex: Remédio de verme" autoFocus={!routine}/>
      <label className="fl">Frequência</label>
      <div className="btng c2">{RFREQ.map(([k,v])=><button key={k} className={`sbtn ${freq===k?'on':''}`} onClick={()=>setFreq(k)}>{v}</button>)}</div>
      <label className="fl">Horário <span className="hint">(opcional)</span></label>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <input type="time" className="fi" value={time} onChange={e=>setTime(e.target.value)} style={{maxWidth:180}}/>
        {time&&<button className="btn btn-g" onClick={()=>setTime('')}>Sem horário</button>}
      </div>
    </Sheet>
  )
}

function EnergyModal({energy,onClose,onPick}:{energy:string,onClose:()=>void,onPick:(e:'high'|'medium'|'low')=>void}){
  return(
    <Sheet size="sm" title="Energia da semana" onClose={onClose}>
      <div style={{fontSize:13,color:'var(--sub)',marginBottom:14}}>Como vocês chegam nessa semana?</div>
      <div className="btng" style={{gap:8}}>
        {(['high','medium','low'] as const).map(v=>(
          <button key={v} className={`sbtn ${energy===v?'on':''}`} style={{padding:14,textAlign:'left',fontSize:14}} onClick={()=>onPick(v)}>
            {ENERGY[v].ic} {ENERGY[v].l}<small>{ENERGY[v].s}</small>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function MeetingModal({householdId,names,weekStart,saving,onClose,onSave}:{householdId:string,names:Names,weekStart:string,saving:boolean,onClose:()=>void,onSave:(m:Meeting)=>void}){
  const[form,setForm]=useState<Meeting>({what_worked:'',what_overloaded:'',adjustments:'',priorities:'',mood_g:'ok',mood_s:'ok',wins:'',next_mode:'normal',reward:''})
  const[ai,setAi]=useState<{state:'idle'|'busy'|'ok'|'err',tips?:string[],error?:string}>({state:'idle'})
  async function askAi(){setAi({state:'busy'});const r=await fetchAiTips(householdId);setAi(r.tips?{state:'ok',tips:r.tips}:{state:'err',error:r.error})}
  const useTip=(t:string)=>setForm(p=>({...p,adjustments:p.adjustments?`${p.adjustments}\n${t}`:t}))
  const set=(k:keyof Meeting,v:string)=>setForm(p=>({...p,[k]:v}))
  const moods=[['😌 Bem','ok'],['😐 Ok','mid'],['😔 Difícil','hard']]
  const modes=[['🌿 Normal','normal'],['⚡ Boss Mode','boss'],['🛡 Sobrevivência','survival']]
  const area=(n:string,k:keyof Meeting,label:string,ph:string)=>(
    <div className="meet"><label className="fl">{n} — {label}</label><textarea className="fita" value={form[k]} onChange={e=>set(k,e.target.value)} placeholder={ph}/></div>
  )
  return(
    <Sheet size="lg" title="📋 Reunião semanal" onClose={onClose} footer={<button className="btn btn-p" disabled={saving} onClick={()=>onSave(form)}>{saving?'Salvando…':'Salvar reunião'}</button>}>
      <div style={{fontSize:13,color:'var(--sub)',marginBottom:14}}>Semana de {fmtDate(weekStart)} · 15 minutos · sem cobranças</div>
      <div className="aibox">
        {ai.state==='idle'&&<button className="btn btn-pur btn-w" onClick={askAi}>✦ Sugestões da IA para a semana</button>}
        {ai.state==='busy'&&<div className="ai-wait" role="status"><span className="spin" aria-hidden="true"/>A IA está lendo a semana de vocês…</div>}
        {ai.state==='err'&&<div className="inline-err">{ai.error} <button className="lnk" onClick={askAi}>Tentar de novo</button></div>}
        {ai.state==='ok'&&<>
          <div className="slbl">✦ Sugestões da IA</div>
          {ai.tips!.map((t,i)=><div key={i} className="ai-tip"><span>{t}</span><button className="lnk" onClick={()=>useTip(t)} title="Copiar para o ajuste da semana">+ usar</button></div>)}
          <div className="row-s" style={{marginTop:6}}>Sugestões, não regras. “+ usar” copia para o item 03.</div>
        </>}
      </div>
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
type ToastState={kind:'ok'|'err',msg:string,undo?:()=>void,retry?:()=>void}

export interface Account { who:Who, email:string, onSignOut:()=>void }

export default function NinhoApp({householdId,account}:{householdId:string,account?:Account}){
  const [tab,setTabState]=useState('today')
  const [modal,setModal]=useState<string|null>(null)
  const [modalData,setModalData]=useState<any>(null)
  const [saving,setSaving]=useState(false)
  const [toast,setToast]=useState<ToastState|null>(null)
  const [taskFilter,setTaskFilter]=useState('all')
  const [query,setQuery]=useState('')
  const [historyData,setHistoryData]=useState<HistoryWeek[]|null>(null)
  const [historyError,setHistoryError]=useState(false)
  const [person,setPerson]=useState<Who>('g')
  const [showDone,setShowDone]=useState<Record<Who,boolean>>({g:false,s:false})
  const [showAllToday,setShowAllToday]=useState(false)
  // Itens com gravação em andamento (bloqueia clique duplo; o banco também é idempotente)
  const [pending,setPending]=useState<Set<string>>(new Set())
  const guard=useRef(createPendingGuard(setPending)).current
  const toastTimer=useRef<any>(null)
  const toastRef=useRef<ToastState|null>(null)

  const {now,today,nowHM,hour,weekStart,todayIndex}=useHomeClock()
  const device=useDeviceIdentity()
  // Com login, quem fez = a conta; sem login (versão antiga), a escolha do aparelho
  const me=account?.who??device.who
  const data=useNinhoData(householdId,today,weekStart,e=>showError(e))
  const {tasks,setTasks,dogs,setDogs,settings,setSettings,xp,setXp,streak,names,setNames,accidents,setAccidents,game}=data
  const casa=useCasa(householdId,today)
  const [taskView,setTaskView]=useState<'tasks'|'maint'>('tasks')
  const maintActions=useMaintActions({today,me,requireMe:()=>requireMe(),setItems:casa.setMaint,reload:casa.reloadMaintenance,onXp:()=>refreshStats(),toast:(m,u)=>showToast(m,u),fail:(e,r)=>showError(e,r)})

  // Nova conquista de quem usa o aparelho: avisa quando sobe de nível nesta sessão
  const lastAch=useRef<{who:Who,list:AchievementState[]}|null>(null)
  useEffect(()=>{
    if(!me||data.status!=='ready')return
    const now=evaluate(game.stats[me])
    if(lastAch.current?.who===me){
      const up=newlyUnlocked(lastAch.current.list,now)[0]
      // não cobre o "Desfazer" que acabou de aparecer
      if(up)setTimeout(()=>showToast(`🏅 Nova conquista: ${up.def.name} (${TIER_NAMES[up.tier-1]})`),toastRef.current?.undo?4600:0)
    }
    lastAch.current={who:me,list:now}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[game.stats,me,data.status])

  // Preferências locais: aba e coluna visualizada no celular.
  // A coluna visualizada NÃO muda quem está usando o aparelho.
  useEffect(()=>{
    // O app sempre abre em Hoje (a aba anterior não é mais restaurada)
    try{localStorage.removeItem('ninho.tab')}catch{}
  },[])
  useEffect(()=>{
    if(!device.ready)return
    let saved:string|null=null
    try{saved=localStorage.getItem('ninho.person')}catch{}
    if(saved==='g'||saved==='s')setPerson(saved)
    else if(me)setPerson(me)
  },[device.ready,me])
  function setTab(t:string){setTabState(t);window.scrollTo({top:0})}
  function pickPerson(w:Who){setPerson(w);try{localStorage.setItem('ninho.person',w)}catch{}}

  // Histórico da semana (só na aba Semana; recarrega quando alguém salva uma reunião)
  const loadHistory=async()=>{
    setHistoryError(false)
    try{setHistoryData(await api.loadHistory(householdId,[0,1,2,3].map(i=>addDays(weekStart,-7*i))))}
    catch(e){logError('histórico',e);setHistoryError(true)}
  }
  useEffect(()=>{if(tab==='week')loadHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tab,weekStart,data.meetingTick,householdId])

  // ── TOASTS ────────────────────────────────────────────
  toastRef.current=toast
  function showToast(msg:string,undo?:()=>void){setToast({kind:'ok',msg,undo});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),undo?4500:2600)}
  function showError(e:NinhoError,retry?:()=>void){
    const r=e.retryable?retry:undefined
    setToast({kind:'err',msg:e.userMessage,retry:r})
    clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),r?8000:6000)
  }
  function closeModal(){setModal(null);setModalData(null)}
  function openModal(m:string,d?:any){setModal(m);setModalData(d??null)}

  // ── AUXILIARES ────────────────────────────────────────
  function requireMe():Who|null{if(!me){openModal('device');return null}return me}
  async function withPending(keys:string[],fn:()=>Promise<void>){await guard.run(keys,fn)}
  const isPending=(k:string)=>pending.has(k)
  function patchTask(id:string,patch:Partial<Task>){setTasks(ts=>ts.map(x=>x.id===id?{...x,...patch}:x))}
  function patchRoutines(patches:Map<string,Partial<DogRoutine>>){setDogs(ds=>ds.map(d=>({...d,routines:d.routines.map(r=>patches.has(r.id)?{...r,...patches.get(r.id)}:r)})))}
  const refreshStats=()=>{data.refreshStats().catch(e=>logError('atualizar XP',e))}

  // ── CONCLUSÕES (transacionais no banco) ───────────────
  async function toggleTask(t:Task){
    const by=requireMe();if(!by)return
    const was=!!t.completed_today
    const before:Partial<Task>={completed_today:t.completed_today,completed_by_today:t.completed_by_today,completion_id:t.completion_id}
    const delta=was?-XPW[t.weight]:xpWithBonus(XPW[t.weight],canEarnOnTime(t,nowHM))
    await withPending(['task:'+t.id],async()=>{
      // Atualização otimista: o check responde na hora e volta atrás se o banco recusar
      patchTask(t.id,{completed_today:!was,completed_by_today:was?null:by})
      setXp(v=>v+delta)
      try{
        if(was){
          await api.uncompleteTask(t.id,today)
          patchTask(t.id,{completion_id:null})
          showToast(`Desmarcada · ${t.title}`)
        }else{
          const r=await api.completeTask(t.id,today,by)
          patchTask(t.id,{completed_by_today:r.completed_by??null,completion_id:r.completion_id})
          data.rememberCompletion(r.completion_id,'task',t.id,today)
          const done={...t,completed_today:true,completed_by_today:r.completed_by,completion_id:r.completion_id}
          if(r.created)showToast(`+${r.xp} XP${r.on_time?' ⚡ no horário':''} · ${t.title}`,()=>{setToast(null);toggleTask(done)})
          else showToast(`Já estava concluída por ${completedByLabel(r.completed_by,names)}`)
        }
      }catch(e){
        patchTask(t.id,before);setXp(v=>v-delta)
        showError(toNinhoError(e,'concluir tarefa'),()=>toggleTask(t))
      }finally{refreshStats()}
    })
  }

  // Marca (done=true) ou desmarca várias rotinas de uma vez — ex.: "Ração manhã" de todos os cães
  async function markDogs(rs:DogRoutine[],done:boolean,label?:string){
    const by=requireMe();if(!by)return
    const list=rs.filter(r=>!!r.completed_today!==done)
    if(!list.length)return
    const ids=list.map(r=>r.id)
    const before=new Map(list.map(r=>[r.id,{completed_today:r.completed_today,completed_by_today:r.completed_by_today,completion_id:r.completion_id}]))
    await withPending(ids.map(id=>'dog:'+id),async()=>{
      patchRoutines(new Map(ids.map(id=>[id,{completed_today:done,completed_by_today:done?by:null}])))
      setXp(v=>v+(done?ids.length:-ids.length))
      try{
        if(done){
          const r=await api.completeDogRoutines(ids,today,by)
          patchRoutines(new Map(r.completions.map(c=>[c.routine_id,{completed_by_today:c.completed_by??null,completion_id:c.completion_id}])))
          r.completions.forEach(c=>data.rememberCompletion(c.completion_id,'dog',c.routine_id,today))
          const doneList=list.map(x=>({...x,completed_today:true}))
          if(r.created>0)showToast(`+${r.xp_added} XP${r.on_time?' ⚡ no horário':''} · ${label||list[0].title}`,()=>{setToast(null);markDogs(doneList,false)})
          else showToast('Já estava concluída')
        }else{
          await api.uncompleteDogRoutines(ids,today)
          patchRoutines(new Map(ids.map(id=>[id,{completion_id:null}])))
          showToast(`Desmarcada · ${label||list[0].title}`)
        }
      }catch(e){
        patchRoutines(before);setXp(v=>v-(done?ids.length:-ids.length))
        showError(toNinhoError(e,'concluir rotina'),()=>markDogs(rs,done,label))
      }finally{refreshStats()}
    })
  }
  function completeDog(r:DogRoutine){markDogs([r],!r.completed_today)}
  function toggleDogItem(it:DogItem){markDogs(it.parts.map(p=>p.r),!it.completed_today,it.title)}

  // ── TAREFAS ───────────────────────────────────────────
  // Alteração otimista de campos da tarefa, com rollback se o banco recusar
  async function updateTaskFields(id:string,patch:Partial<Task>):Promise<boolean>{
    const prev=tasks.find(t=>t.id===id);if(!prev)return false
    const back:Partial<Task>={};(Object.keys(patch) as Array<keyof Task>).forEach(k=>{(back as any)[k]=prev[k]})
    let ok=false
    await withPending(['edit:'+id],async()=>{
      patchTask(id,patch)
      try{await api.updateTask(id,patch);ok=true}
      catch(e){patchTask(id,back);showError(toNinhoError(e,'atualizar tarefa'),()=>updateTaskFields(id,patch))}
    })
    return ok
  }
  function quickUpdate(id:string,patch:Partial<Task>){updateTaskFields(id,patch)}
  function assignTask(id:string,to:string|null){updateTaskFields(id,{assigned_to:to})}

  async function swapTask(t:Task){
    const n:Who=plan.ownerOfTask(t)==='g'?'s':'g'
    const prev=t.assigned_to
    if(await updateTaskFields(t.id,{assigned_to:n}))
      showToast(`Passada para ${firstName(names[n])}${isFixed(t)?'':' (sai do rodízio)'}`,()=>{setToast(null);assignTask(t.id,prev)})
  }

  // ── PULAR / DEIXAR PARA AMANHÃ ────────────────────────
  const SKIP_LABEL:Record<string,string>={daily:'Pular hoje',weekly:'Pular esta semana',biweekly:'Pular esta quinzena',monthly:'Pular este mês'}
  async function pauseTask(t:Task,kind:'snooze'|'skip'){
    const by=requireMe();if(!by)return
    // Pontual: "amanhã" muda a data dela
    if(t.frequency==='once'&&kind==='snooze'){
      const prev=t.due_date??null
      if(await updateTaskFields(t.id,{due_date:addDays(today,1)}))showToast(`Para amanhã · ${t.title}`,()=>{setToast(null);updateTaskFields(t.id,{due_date:prev})})
      return
    }
    const before=t.skip??null
    await withPending(['task:'+t.id],async()=>{
      patchTask(t.id,{skip:{id:'tmp',date:today,kind,by}})
      try{
        const r=await api.skipTask(householdId,t.id,today,kind,by)
        const skip={id:r.id,date:r.date,kind:r.kind,by}
        patchTask(t.id,{skip})
        showToast(kind==='skip'?`${SKIP_LABEL[t.frequency]||'Pulada'} · ${t.title}`:`Fica para amanhã · ${t.title}`,()=>{setToast(null);unpauseTask({...t,skip})})
      }catch(e){patchTask(t.id,{skip:before});showError(toNinhoError(e,kind==='skip'?'pular tarefa':'adiar tarefa'),()=>pauseTask(t,kind))}
    })
  }
  async function unpauseTask(t:Task){
    const s=t.skip;if(!s||s.id==='tmp')return
    await withPending(['task:'+t.id],async()=>{
      patchTask(t.id,{skip:null})
      try{await api.unskipTask(s.id);showToast(`De volta · ${t.title}`)}
      catch(e){patchTask(t.id,{skip:s});showError(toNinhoError(e,'desfazer pausa'),()=>unpauseTask({...t,skip:s}))}
    })
  }

  async function archiveTasks(list:Task[]){
    if(!confirm(`Arquivar ${list.length} tarefa${list.length!==1?'s':''} de cães? As rotinas da aba Cães continuam.`))return
    const ids=list.map(t=>t.id)
    await withPending(['archive'],async()=>{
      setTasks(p=>p.filter(x=>!ids.includes(x.id)))
      try{
        await api.updateTasks(ids,{active:false})
        showToast(`${list.length} tarefas arquivadas`,async()=>{
          setToast(null)
          try{await api.updateTasks(ids,{active:true});await data.reloadTasks();showToast('Tarefas de volta')}
          catch(e){showError(toNinhoError(e,'desfazer arquivamento'))}
        })
      }catch(e){
        setTasks(p=>[...p,...list.filter(t=>!p.some(x=>x.id===t.id))])
        showError(toNinhoError(e,'arquivar tarefas'),()=>archiveTasks(list))
      }
    })
  }

  // Operações de formulário: o modal só fecha se o banco aceitou
  async function save(context:string,fn:()=>Promise<void>,okMsg:string){
    if(saving)return
    setSaving(true)
    try{await fn();closeModal();showToast(okMsg)}
    catch(e){showError(toNinhoError(e,context))}
    finally{setSaving(false)}
  }

  function deleteTask(id:string){
    if(!confirm('Remover essa tarefa?'))return
    save('remover tarefa',async()=>{await api.updateTask(id,{active:false});setTasks(ts=>ts.filter(t=>t.id!==id))},'Tarefa removida')
  }

  function saveTask(d:any,editId?:string){
    save(editId?'atualizar tarefa':'criar tarefa',async()=>{
      if(editId){await api.updateTask(editId,d);patchTask(editId,d)}
      else{await api.insertTasks(householdId,[d]);await data.reloadTasks()}
    },editId?'Tarefa atualizada!':`"${d.title}" criada!`)
  }

  async function addSuggestions(sel:any[]){
    const existing=new Set(tasks.map(t=>t.title))
    const toAdd=sel.filter(s=>!existing.has(s.t)).map(s=>({title:s.t,category:s.cat,weight:s.w,frequency:s.f,assigned_to:null,scheduled_time:null,essential:s.ess}))
    if(!toAdd.length){closeModal();return}
    try{
      await api.insertTasks(householdId,toAdd as any)
      await data.reloadTasks()
      closeModal();showToast(`${toAdd.length} tarefa${toAdd.length!==1?'s':''} adicionada${toAdd.length!==1?'s':''}!`)
    }catch(e){showError(toNinhoError(e,'adicionar sugestões'))}
  }

  // ── CÃES ──────────────────────────────────────────────
  function savePet(d:any,routines:any[]){
    save('cadastrar pet',async()=>{
      try{await api.insertDog(householdId,d,routines)}finally{await data.reloadDogs().catch(()=>{})}
    },`${d.name} cadastrado(a)!`)
  }
  function updateDog(id:string,d:any){
    save('atualizar pet',async()=>{await api.updateDog(id,d);setDogs(p=>p.map(x=>x.id===id?{...x,...d}:x))},'Pet atualizado!')
  }
  function removeDog(d:Dog){
    if(!confirm(`Remover ${d.name} e as rotinas dele(a)?`))return
    save('remover pet',async()=>{await api.updateDog(d.id,{active:false});setDogs(p=>p.filter(x=>x.id!==d.id))},`${d.name} removido(a)`)
  }
  function saveRoutine(dogId:string,d:any,id?:string){
    save(id?'atualizar rotina':'criar rotina',async()=>{await api.upsertRoutine(householdId,dogId,d,id);await data.reloadDogs()},id?'Rotina atualizada!':'Rotina criada!')
  }
  function removeRoutine(r:DogRoutine){
    if(!confirm(`Remover a rotina "${r.title}"?`))return
    save('remover rotina',async()=>{await api.setRoutineActive(r.id,false);await data.reloadDogs()},'Rotina removida')
  }
  async function addAccident(dogId:string,location:string){
    await withPending(['acc:'+dogId],async()=>{
      try{const row=await api.insertAccident(householdId,dogId,location,today);setAccidents(a=>[row,...a.filter(x=>x.id!==row.id)]);showToast('Acidente registrado')}
      catch(e){showError(toNinhoError(e,'registrar acidente'),()=>addAccident(dogId,location))}
    })
  }

  // ── SEMANA, NOMES, REUNIÃO ────────────────────────────
  async function saveSettings(next:{energy:Energy,survival:boolean},okMsg:string){
    const prev=settings
    await withPending(['settings'],async()=>{
      setSettings(next)
      try{await api.saveWeeklySettings(householdId,weekStart,next);showToast(okMsg)}
      catch(e){setSettings(prev);showError(toNinhoError(e,'salvar ajustes da semana'),()=>saveSettings(next,okMsg))}
    })
  }
  function toggleSurvival(){const ns=!settings.survival;saveSettings({...settings,survival:ns},ns?'Modo sobrevivência ativado':'Modo normal ativado')}
  function setEnergy(e:Energy){closeModal();saveSettings({...settings,energy:e},'Energia atualizada!')}

  async function updateName(role:Who,val:string){
    const v=val.trim()
    if(!v||v===names[role])return
    const prev=names[role]
    setNames(n=>({...n,[role]:v}))
    try{await api.updateName(householdId,role,v);showToast('Nome atualizado!')}
    catch(e){setNames(n=>({...n,[role]:prev}));showError(toNinhoError(e,'atualizar nome'),()=>updateName(role,v))}
  }

  function saveBet(bet:string){
    save('salvar aposta',async()=>{await api.saveBet(householdId,weekStart,bet);setSettings(p=>({...p,bet}))},'Aposta da semana salva!')
  }

  function saveMeeting(m:Meeting){
    save('salvar reunião',async()=>{await api.saveMeeting(householdId,weekStart,m);if(tab==='week')await loadHistory()},'Reunião salva!')
  }

  // ── CASA: divisão, compras, manutenção ───────────────
  async function saveSplit(mode:SplitMode){
    if(mode===casa.split)return
    const prev=casa.split
    casa.setSplit(mode)
    await withPending(['split'],async()=>{
      try{await casaApi.saveSplitMode(householdId,mode);showToast(mode==='smart'?'Divisão inteligente ativada':'Rodízio fixo ativado')}
      catch(e){casa.setSplit(prev);showError(toNinhoError(e,'salvar modo de divisão'),()=>saveSplit(mode))}
    })
  }
  function saveMaint(d:casaApi.MaintenanceInput,id?:string){
    save(id?'atualizar manutenção':'criar manutenção',async()=>{await casaApi.saveMaintenance(householdId,d,id);await casa.reloadMaintenance()},id?'Manutenção atualizada!':`"${d.title}" criada!`)
  }
  function removeMaint(it:MaintenanceItem){
    if(!confirm(`Remover "${it.title}"? O histórico fica guardado.`))return
    save('remover manutenção',async()=>{await casaApi.archiveMaintenance(it.id);casa.setMaint(l=>l.filter(x=>x.id!==it.id))},'Manutenção removida')
  }
  function addMaintTemplates(rows:casaApi.MaintenanceInput[]){
    save('criar manutenções',async()=>{await casaApi.insertMaintenanceMany(householdId,rows);await casa.reloadMaintenance()},`${rows.length} manutenç${rows.length===1?'ão adicionada':'ões adicionadas'}!`)
  }
  // Compra finalizada: oferece marcar a tarefa de mercado pendente
  function onShoppingFinished(count:number){
    if(!count)return
    const t=tasks.find(x=>x.category==='shopping'&&!x.completed_today&&dueToday(x,today)&&/mercado|compra|feira/i.test(x.title))
    if(t&&confirm(`Marcar "${t.title}" como feita? (+${XPW[t.weight]} XP)`))toggleTask(t)
  }

  async function autoDistribute(){
    const active=homeTasks.filter(t=>t.frequency!=='once')
    if(!active.length){showToast('Adicione tarefas primeiro');return}
    if(!confirm('Distribuir define uma responsável fixa para cada tarefa (e tira todas do rodízio). Continuar?'))return
    let gS=0,sS=0
    const updates:Array<{id:string,assigned_to:Who}>=[]
    const assign=(t:Task,who:Who)=>{updates.push({id:t.id,assigned_to:who});const w=XPW[t.weight]*(FEFF[t.frequency]||1);if(who==='g')gS+=w;else sS+=w}
    active.filter(t=>t.essential&&t.category==='dogs').sort((a,b)=>(a.scheduled_time||'').localeCompare(b.scheduled_time||'')).forEach((t,i)=>assign(t,i%2===0?'g':'s'))
    active.filter(t=>t.weight==='heavy'&&!(t.essential&&t.category==='dogs')).forEach(t=>assign(t,gS<=sS?'g':'s'))
    active.filter(t=>t.frequency==='daily'&&!t.essential&&t.weight!=='heavy').forEach(t=>assign(t,gS*0.85<=sS?'g':'s'))
    active.filter(t=>!updates.find(u=>u.id===t.id)).forEach(t=>assign(t,gS<=sS?'g':'s'))
    await withPending(['distribute'],async()=>{
      try{
        await api.updateTasks(updates.filter(u=>u.assigned_to==='g').map(u=>u.id),{assigned_to:'g'})
        await api.updateTasks(updates.filter(u=>u.assigned_to==='s').map(u=>u.id),{assigned_to:'s'})
        const m=new Map(updates.map(u=>[u.id,u.assigned_to]))
        setTasks(ts=>ts.map(t=>m.has(t.id)?{...t,assigned_to:m.get(t.id)!}:t))
        showToast(`Distribuído — ${firstName(names.g)}: ${Math.round(gS)}pts · ${firstName(names.s)}: ${Math.round(sS)}pts`)
      }catch(e){
        showError(toNinhoError(e,'distribuir tarefas'),autoDistribute)
        data.reloadTasks().catch(()=>{})
      }
    })
  }

  // ── DERIVED ───────────────────────────────────────────
  const focusMode=settings.survival||settings.energy==='low'
  // Mesma conta usada pela notificação da manhã (lib/today.ts)
  const plan=planToday(tasks,dogs,today,{focus:focusMode&&!showAllToday,split:casa.split})
  const {dogTasks,homeTasks,dueList,todayTasks,dogItems,ownerOfItem,ownerOfTask,ownerOfRoutine}=plan
  const hItems:HItem[]=plan.items
  const hiddenCount=dueList.length-todayTasks.length
  const xpOfItem=(i:HItem)=>i.task?XPW[i.task.weight]:i.dog!.parts.length
  const allToday=[...dueList.map(t=>!!t.completed_today),...dogItems.map(d=>d.completed_today)]
  const doneToday=allToday.filter(Boolean).length
  const dayPct=allToday.length?Math.round(doneToday/allToday.length*100):0
  const dailyTasks=homeTasks.filter(t=>t.frequency==='daily')
  const chaos=dailyTasks.length?Math.max(0,Math.round(100-(dailyTasks.filter(t=>t.completed_today).length/dailyTasks.length)*100)):0
  const ci=getChaosInfo(chaos)
  const lv=getLevel(xp)
  const xpPct=levelProgress(xp)
  const puppies=dogs.filter(d=>d.is_puppy)
  const dogDaily=dogs.flatMap(d=>d.routines.filter(r=>dueToday(r,today)).map(r=>({r,dog:d})))
  const dogDone=dogDaily.filter(x=>x.r.completed_today).length
  const en=ENERGY[settings.energy]||ENERGY.medium
  const hello=greeting(hour)
  const dateLabel=longDateLabel(now)
  const countFor=(w:Who)=>{const all=hItems.filter(i=>ownerOfItem(i)===w);return{all:all.length,done:all.filter(i=>i.completed_today).length}}

  // ── RENDER HELPERS ────────────────────────────────────
  const taskRow=(t:Task,o:{actions?:boolean,next?:boolean}={})=>{
    const actions=o.actions!==false
    const other:Who=ownerOfTask(t)==='g'?'s':'g'
    const late=isLate(t,nowHM)
    return(
      <div key={t.id} className={`tr ${t.completed_today?'done':''} ${o.next?'next':''}`}>
        <button className={`chk ${t.essential?'ess':''} ${isPending('task:'+t.id)?'busy':''}`} onClick={()=>toggleTask(t)} disabled={isPending('task:'+t.id)} aria-busy={isPending('task:'+t.id)} aria-label={t.completed_today?`Desmarcar ${t.title}`:`Concluir ${t.title}`}>✓</button>
        <div className="trb" onClick={()=>toggleTask(t)}>
          <div className="trt">{t.title}</div>
          <div className="trm">
            <span title={CAT[t.category]}>{catIc(t.category)}</span>
            {o.next&&<span className="tag-next">▸ próxima</span>}
            {t.essential&&!t.completed_today&&<span className="tag-e" title="Essencial">●<span className="lg-only"> essencial</span></span>}
            {t.scheduled_time&&<span className={`tag-t ${late?'late':''}`}>⏰ {hhmm(t.scheduled_time)}</span>}
            {t.frequency!=='daily'&&<span><span className="lg-only">{FPT[t.frequency]}{!t.completed_today&&t.frequency!=='once'&&' · '}</span>{!t.completed_today&&t.frequency!=='once'&&lastLabel(t.prev_done||null,today)}</span>}
            {!isFixed(t)&&<span className="tag-r" title="Rodízio: alterna entre vocês">↻<span className="lg-only"> rodízio</span></span>}
            {t.completed_today&&<span className="tag-by" title="Quem concluiu">✓ {completedByLabel(t.completed_by_today,names)}</span>}
          </div>
        </div>
        {canEarnOnTime(t,nowHM)
          ?<span className={`xp xp-${wCls(t.weight)} bonus`} title={`Até ${hhmm(t.scheduled_time)}: XP ×1,5`}>+{xpWithBonus(XPW[t.weight],true)}⚡</span>
          :<span className={`xp xp-${wCls(t.weight)}`} title={WPT[t.weight]}>+{XPW[t.weight]}</span>}
        {actions&&<button className="ib desk" onClick={()=>swapTask(t)} title={`Passar para ${firstName(names[other])}`} aria-label={`Passar para ${firstName(names[other])}`}>⇄</button>}
        {actions&&<button className="ib desk" onClick={()=>openModal('task',t)} title="Editar" aria-label="Editar">✎</button>}
        {actions&&!t.completed_today&&<button className="ib desk" onClick={()=>openModal('taskmenu',t)} title="Pular ou deixar para amanhã" aria-label={`Mais opções de ${t.title}`}>⏭</button>}
        {actions&&<button className="ib mob" onClick={()=>openModal('taskmenu',t)} aria-label={`Opções de ${t.title}`}>⋯</button>}
      </div>
    )
  }

  const dogItemRow=(it:DogItem,o:{next?:boolean}={})=>{
    const late=isLate(it,nowHM)
    const multi=it.parts.length>1
    const busy=it.parts.some(p=>isPending('dog:'+p.r.id))
    const by=Array.from(new Set(it.parts.filter(p=>p.r.completed_today).map(p=>completedByLabel(p.r.completed_by_today,names)))).join(' e ')
    return(
      <div key={'dog:'+it.key} className={`tr ${it.completed_today?'done':''} ${o.next?'next':''}`}>
        <button className={`chk ${busy?'busy':''}`} disabled={busy} aria-busy={busy} onClick={()=>toggleDogItem(it)} aria-label={it.completed_today?`Desmarcar ${it.title}`:`Concluir ${it.title}`}>✓</button>
        <div className="trb" onClick={()=>toggleDogItem(it)}>
          <div className="trt">{it.title}</div>
          <div className="trm">
            <span>🐾 {it.parts.map(p=>p.dog.name+(multi&&p.r.completed_today&&!it.completed_today?' ✓':'')).join(', ')}</span>
            {o.next&&<span className="tag-next">▸ próxima</span>}
            {it.scheduled_time&&<span className={`tag-t ${late?'late':''}`}>⏰ {hhmm(it.scheduled_time)}</span>}
            {it.frequency!=='daily'&&<span className="lg-only">{FPT[it.frequency]||it.frequency}</span>}
            <span className="tag-r" title="Rotinas dos cães alternam entre vocês">↻<span className="lg-only"> rodízio</span></span>
            {it.completed_today&&<span className="tag-by" title="Quem concluiu">✓ {by}</span>}
          </div>
        </div>
        {canEarnOnTime(it,nowHM)
          ?<span className="xp xp-l bonus" title={`Até ${hhmm(it.scheduled_time)}: XP ×1,5`}>+{xpWithBonus(1,true)*it.parts.length}⚡</span>
          :<span className="xp xp-l">+{it.parts.length}</span>}
      </div>
    )
  }
  const itemRow=(i:HItem,o:{actions?:boolean,next?:boolean}={})=>i.task?taskRow(i.task,o):dogItemRow(i.dog!,o)

  const personCard=(who:Who)=>{
    const all=hItems.filter(i=>ownerOfItem(i)===who)
    const pend=all.filter(i=>!i.completed_today)
    const done=all.filter(i=>i.completed_today)
    const pct=all.length?Math.round(done.length/all.length*100):0
    const doneXP=done.reduce((s,i)=>s+xpOfItem(i),0)
    const essLeft=pend.filter(i=>i.essential).length
    return(
      <section key={who} className="card pcard" data-hide={person!==who?'1':'0'}>
        <div className="ph">
          <div className={`av av-${who}`}>{initials(names[who])}</div>
          <div style={{minWidth:0}}>
            <div className="pname">{names[who]}{me===who&&<span className="you" title="Quem está usando este aparelho">você</span>}</div>
            <div className="prole">{ROLE[who]}{essLeft>0&&<> · <span style={{color:'var(--cor)'}}>{essLeft} essencia{essLeft>1?'is':'l'}</span></>}</div>
          </div>
          <Ring pct={pct} color={who==='g'?'var(--green)':'var(--pur)'} label={`${done.length}/${all.length}`}/>
        </div>
        {all.length===0?(homeTasks.some(t=>ownerOfTask(t)===who)||dogs.length>0?(
          <div className="alldone">🎉 Nada pendente para hoje<small>As tarefas do período já estão em dia</small></div>
        ):(
          <div className="empty"><span className="empty-icon">📋</span>{who==='g'?'Nenhuma tarefa ainda':'Nenhuma tarefa atribuída'}
            <div><button className="btn btn-s" onClick={()=>openModal('sugg')}>✦ Ver sugestões</button></div>
          </div>
        )):<>
          {pend.length===0&&<div className="alldone">🎉 Tudo feito por hoje!<small>+{doneXP} XP conquistados</small></div>}
          {(()=>{
            const groups=groupToday(pend,nowHM,today)
            const nextId=groups.find(g=>['morning','afternoon','night'].includes(g.k))?.items[0]?.id
            return groups.map(g=>(
              <div key={g.k}>
                <div className={`cdiv ${g.k==='late'?'late':''}`}>{g.label}<span className="n">{g.items.length}</span></div>
                {g.items.map(i=>itemRow(i,{next:i.id===nextId}))}
              </div>
            ))
          })()}
          {done.length>0&&<>
            <button className="dtog" onClick={()=>setShowDone(p=>({...p,[who]:!p[who]}))} aria-expanded={showDone[who]}>
              <span style={{width:12}}>{showDone[who]?'▾':'▸'}</span>Concluídas ({done.length})
              <span className="mono" style={{marginLeft:'auto',color:'var(--green)',fontSize:12}}>+{doneXP} XP</span>
            </button>
            {showDone[who]&&done.map(i=>itemRow(i,{actions:false}))}
          </>}
          {(()=>{const paused=homeTasks.filter(t=>pausedToday(t,today)&&ownerOfTask(t)===who);return paused.length>0&&<div className="paused">
            <div className="paused-h">⏸ Puladas ou para amanhã ({paused.length})</div>
            {paused.map(t=><div key={t.id} className="paused-r">
              <span className="paused-t">{t.title}</span>
              <span className="paused-k">{t.skip!.kind==='snooze'?'amanhã':t.frequency==='daily'?'pulada hoje':'pulada no período'}</span>
              <button className="lnk" disabled={isPending('task:'+t.id)} onClick={()=>unpauseTask(t)}>↺ Voltar</button>
            </div>)}
          </div>})()}
        </>}
      </section>
    )
  }

  const dogRow=(r:DogRoutine,o:{dogName?:string,dog?:Dog}={})=>{
    // "sat" = já feita neste período (ex.: banho semanal feito na segunda)
    const sat=!r.completed_today&&doneInPeriod(r,today)
    const late=isLate(r,nowHM)
    const busy=isPending('dog:'+r.id)
    return(
      <div key={r.id} className={`dr ${r.completed_today||sat?'done':''} ${sat?'sat':''}`}>
        <button className={`chk ${r.completed_today||sat?'ok':''} ${busy?'busy':''}`} disabled={sat||busy} aria-busy={busy} onClick={()=>completeDog(r)} aria-label={r.completed_today?`Desmarcar ${r.title}`:`Concluir ${r.title}`}>✓</button>
        <span className="dr-t" onClick={()=>!sat&&completeDog(r)}>{r.title}</span>
        {o.dogName&&<span className="dr-m">{o.dogName}</span>}
        {r.completed_today&&<span className="dr-m" title="Quem concluiu">{completedByLabel(r.completed_by_today,names)}</span>}
        {sat?<span className="dr-m">✓ {lastLabel(r.prev_done||null,today)}</span>
          :r.frequency!=='daily'&&<span className="bdg bdg-n">{FPT[r.frequency]||r.frequency}</span>}
        {r.scheduled_time&&<span className={`dr-m ${late?'late':''}`}>{hhmm(r.scheduled_time)}</span>}
        {!sat&&!r.completed_today&&(()=>{const w=ownerOfRoutine(r);return <span className={`mini av-${w}`} title={`Vez de ${firstName(names[w])}`}>{names[w].slice(0,1).toUpperCase()}</span>})()}
        {o.dog&&<button className="ib" onClick={()=>openModal('routine',{dog:o.dog,routine:r})} title="Editar rotina" aria-label={`Editar ${r.title}`}>✎</button>}
      </div>
    )
  }

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
    if(taskFilter==='notime'&&t.scheduled_time)return false
    if(CAT[taskFilter]&&t.category!==taskFilter)return false
    if(q&&!t.title.toLowerCase().includes(q))return false
    return true
  })
  const usedCats=Object.keys(CAT).filter(k=>tasks.some(t=>t.category===k))

  // ── SEMANA: equilíbrio ────────────────────────────────
  const act=homeTasks.filter(t=>t.frequency!=='once')
  const allRoutines=dogs.flatMap(d=>d.routines)
  const dogLoad=allRoutines.reduce((s,r)=>s+(FEFF[r.frequency]||1),0)
  // Rodízio (e rotinas dos cães) conta metade para cada uma
  const loadOf=(_w:Who)=>act.reduce((s,t)=>{const v=XPW[t.weight]*(FEFF[t.frequency]||1);return s+(isFixed(t)?(t.assigned_to===_w?v:0):v/2)},0)+dogLoad/2
  const rotCount=act.filter(t=>!isFixed(t)).length
  const gS=loadOf('g'),sS=loadOf('s'),tot=gS+sS
  const gP=tot>0?Math.round((gS/tot)*100):50
  const balanced=Math.abs(gS-sS)<=3
  const maxHist=Math.max(1,...(historyData||[]).map(w=>w.completions))

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
        {data.status==='loading'&&<div className="loadscr" role="status" aria-live="polite"><span className="spin" aria-hidden="true"/>Carregando a casa…</div>}
        {data.status==='error'&&<div className="card loaderr" role="alert">
          <div style={{fontSize:16,fontWeight:500,marginBottom:6}}>Não foi possível carregar o Ninho</div>
          <div style={{fontSize:13,color:'var(--sub)',marginBottom:14}}>{data.loadError?.userMessage}</div>
          <button className="btn btn-p" onClick={()=>data.loadAll()}>Tentar novamente</button>
        </div>}
        {data.status==='ready'&&data.offline&&<div className="banner low" role="status">📴 <span>Sem internet. Mostrando os dados de {timeOfInstant(data.offline.savedAt)}. Marcar e editar voltam quando a conexão voltar.</span>
          <button className="lnk" onClick={()=>data.loadAll()}>Tentar agora</button></div>}
        {data.status==='ready'&&<>
        {/* ── HOJE ── */}
        {tab==='today'&&<div className="scr">
          <div className="sh">
            <div><h1>{hello} 👋</h1><p>{dateLabel}</p></div>
            <div className="sh-a desk-only"><button className="btn btn-p" onClick={()=>openModal('task',null)}>+ Nova tarefa</button></div>
          </div>

          <div className="stats">
            <div className="stat">
              <div className="stat-l">Hoje</div>
              <div className="stat-v">{dayPct}%<small>{doneToday}/{allToday.length}</small></div>
              <div className="bar"><div className="barf" style={{width:dayPct+'%',background:'var(--gdk)'}}/></div>
            </div>
            <div className="stat">
              <div className="stat-l">Casa</div>
              <div className="stat-v stat-txt" style={{color:ci.color}}>{ci.label}</div>
              <div className="bar"><div className="barf" style={{width:chaos+'%',background:ci.color}}/></div>
            </div>
            <button className="stat" onClick={()=>setTab('week')}>
              <div className="stat-l">Nível {lv.l}<span className="lg-only"> · {lv.n}</span></div>
              <div className="stat-v">{xp}<small>/ {lv.max} XP</small></div>
              <div className="bar"><div className="barf" style={{width:xpPct+'%',background:'var(--pur)'}}/></div>
            </button>
            <div className="stat">
              <div className="stat-l">Sequência{game.streaks.house_best>0&&<span className="lg-only"> · recorde {game.streaks.house_best}</span>}</div>
              <div className="stat-v">🔥 {streak}<small>dia{streak!==1?'s':''}</small></div>
              <div className="week-dots">{weekDots(todayIndex,streak,doneToday>0).map((c,i)=><div key={i} className={`wd ${c}`}/>)}</div>
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
                ):dogs.map(dog=>{
                  // Resumo: as rotinas em si já estão na lista de quem é a vez
                  const due=dog.routines.filter(r=>dueToday(r,today))
                  const dn=due.filter(r=>r.completed_today).length
                  const nxt=due.filter(r=>!r.completed_today).sort(byTime)[0]
                  const acc=dog.is_puppy?accidents.filter(a=>a.dog_id===dog.id&&a.date===today).length:0
                  return(
                    <button key={dog.id} className="dsum" onClick={()=>setTab('pets')}>
                      <span className="dav" style={{width:36,height:36,fontSize:18}}>{dog.is_puppy?'🐶':'🐕'}</span>
                      <span style={{flex:1,minWidth:0}}>
                        <span className="dsum-h"><span><b>{dog.name}</b>{dog.is_puppy&&<span className="accb" title="Acidentes hoje">💧 {acc}</span>}</span><span className="mono">{dn}/{due.length}</span></span>
                        <span className="bar" style={{marginTop:6,display:'block'}}><span className="barf" style={{display:'block',width:(due.length?dn/due.length*100:100)+'%',background:'var(--gdk)'}}/></span>
                        <span className="dsum-s">{nxt?<>Próxima: {nxt.title}{nxt.scheduled_time&&<span className={isLate(nxt,nowHM)?'late':''}> · {hhmm(nxt.scheduled_time)}</span>}</>:due.length?'✓ Tudo feito hoje':'Sem rotinas hoje'}</span>
                      </span>
                    </button>
                  )
                })}
                {dogs.length>0&&<div style={{fontSize:11.5,color:'var(--sub)',marginTop:8}}>As rotinas aparecem na lista de quem é a vez ↻</div>}
              </div>
              <MaintTodayCard items={casa.maint} today={today} names={names} actions={maintActions} onOpen={()=>{setTaskView('maint');setTab('tasks')}}/>
              {(()=>{const sc=shoppingCounts(casa.shop);return casa.shopState==='ready'&&sc.toBuy>0&&(
                <button className="card dsum shop-sum" onClick={()=>setTab('shop')}>
                  <span className="dav" style={{width:36,height:36,fontSize:18}}>🛒</span>
                  <span style={{flex:1,minWidth:0,textAlign:'left'}}><b>{sc.toBuy} ite{sc.toBuy===1?'m':'ns'} na lista de compras</b>
                    <span className="dsum-s">{casa.shop.filter(i=>!i.checked_at).slice(0,4).map(i=>i.title).join(', ')}{sc.toBuy>4?'…':''}</span></span>
                  <span className="chev">›</span>
                </button>)})()}
              <Scoreboard compact scores={game.scores} lastWeek={game.lastWeek} lastWeekBet={game.lastWeekBet} bet={settings.bet} names={names} me={me} onOpen={()=>setTab('week')}/>
              <div className="card">
                <div className="slbl">Atalhos</div>
                <div className="acts">
                  {actionBtn('✦','Distribuir tarefas','Equilibra a carga entre vocês',autoDistribute,'var(--pbg)')}
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
          <div className="seg vseg" role="tablist">
            <button role="tab" aria-selected={taskView==='tasks'} className={`segb ${taskView==='tasks'?'on':''}`} onClick={()=>setTaskView('tasks')}>📋 Rotina da casa</button>
            <button role="tab" aria-selected={taskView==='maint'} className={`segb ${taskView==='maint'?'on':''}`} onClick={()=>setTaskView('maint')}>🔧 Manutenção{casa.maint.filter(i=>i.next_due<=today).length>0&&<span className="cnt late">{casa.maint.filter(i=>i.next_due<=today).length}</span>}</button>
          </div>
          {taskView==='maint'?<>
            <div className="sh"><div><h2>Manutenção</h2><p>De tempos em tempos: casa, cães, carro e saúde</p></div></div>
            <MaintenanceSection items={casa.maint} log={casa.maintLog} today={today} names={names} state={casa.maintState} error={casa.maintError} actions={maintActions}
              onReload={()=>{casa.reloadMaintenance()}} onNew={()=>openModal('maint',null)} onEdit={it=>openModal('maint',it)} onTemplates={()=>openModal('mainttpl')}/>
          </>:<>
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
          {dogTasks.length>0&&<div className="dupe">
            <span>🐾 {dogTasks.length} tarefa{dogTasks.length!==1?'s':''} de cães repete{dogTasks.length===1?'':'m'} as rotinas da aba Cães — por isso não aparece{dogTasks.length===1?'':'m'} em Hoje.</span>
            <button className="btn btn-pur" onClick={()=>archiveTasks(dogTasks)}>Arquivar</button>
          </div>}
          <div className="fchips">
            {[['all',`Todas · ${tasks.length}`],['essential','🔴 Essenciais'],['g',firstName(names.g)],['s',firstName(names.s)],['r','Rodízio'],['notime','⏰ Sem horário'],...usedCats.map(k=>[k,CAT[k]])].map(([k,v])=>(
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
                        <button className={`bdg qb ${t.essential?'bdg-e':'bdg-n'}`} onClick={e=>{e.stopPropagation();quickUpdate(t.id,{essential:!t.essential})}} title={t.essential?'Tirar de essencial':'Marcar como essencial'} aria-pressed={t.essential}>{t.essential?'● essencial':'○ essencial'}</button>
                        <QuickTime value={hhmm(t.scheduled_time)} onSave={v=>quickUpdate(t.id,{scheduled_time:v||null})}/>
                        {weekdaysLabel(t.weekdays)&&t.frequency!=='monthly'&&t.frequency!=='once'&&<span className="bdg bdg-t" title="Dias da semana">📆 {weekdaysLabel(t.weekdays)}</span>}
                        {t.frequency==='once'&&t.due_date&&<span className={`bdg ${t.due_date<today?'bdg-h':'bdg-t'}`} title="Data">📆 {fmtDate(t.due_date)}</span>}
                        {pausedToday(t,today)&&<span className="bdg bdg-n">⏸ {t.skip!.kind==='snooze'?'amanhã':'pulada'}</span>}
                        <span className={`bdg bdg-${wCls(t.weight)}`} title={`Esforço ${WPT[t.weight].toLowerCase()} · +${XPW[t.weight]} XP`}>+{XPW[t.weight]}</span>
                        {!isFixed(t)&&<span className="bdg" style={{background:'var(--pbg)',color:'var(--pur)'}}>↻ {firstName(names[ownerOfTask(t)])}</span>}
                        {t.frequency==='daily'?null:doneInPeriod(t,today)
                          ?<span className="bdg bdg-l">✓ {FPT[t.frequency]} · {lastLabel(lastDone(t,today),today)}</span>
                          :<span className="bdg bdg-n">{FPT[t.frequency]}{t.frequency!=='once'&&` · ${lastLabel(t.prev_done||null,today)}`}</span>}
                      </div>
                    </div>
                    <div className="asg" role="group" aria-label="Responsável">
                      <button className={t.assigned_to==='g'?'on-g':''} onClick={()=>assignTask(t.id,'g')} title={firstName(names.g)}><span className="lg-only">{firstName(names.g)}</span><span className="sm-only">{names.g.slice(0,1).toUpperCase()}</span></button>
                      <button className={t.assigned_to==='s'?'on-s':''} onClick={()=>assignTask(t.id,'s')} title={firstName(names.s)}><span className="lg-only">{firstName(names.s)}</span><span className="sm-only">{names.s.slice(0,1).toUpperCase()}</span></button>
                      <button className={!t.assigned_to?'on-r':''} onClick={()=>assignTask(t.id,null)} title="Rodízio">↻</button>
                    </div>
                    <button className="ib danger" onClick={()=>deleteTask(t.id)} title="Remover" aria-label="Remover">✕</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          </>}
        </div>}

        {/* ── COMPRAS ── */}
        {tab==='shop'&&<ShoppingTab householdId={householdId} me={me} names={names} items={casa.shop} history={casa.shopHistory} state={casa.shopState} error={casa.shopError}
          setItems={casa.setShop} onReload={casa.reloadShopping} requireMe={requireMe} toast={(m,u)=>showToast(m,u)} fail={(e,r)=>showError(e,r)} onFinished={onShoppingFinished}/>}

        {/* ── SEMANA ── */}
        {tab==='week'&&<div className="scr">
          <div className="sh">
            <div><h2>Semana</h2><p>Semana de {fmtDate(weekStart)} · {en.l.toLowerCase()}</p></div>
            <div className="sh-a"><button className="btn btn-g" onClick={()=>openModal('meeting')}>📋 Reunião semanal</button></div>
          </div>
          <div className="wgrid" style={{marginBottom:14}}>
            <div className="col">
              <Scoreboard scores={game.scores} lastWeek={game.lastWeek} lastWeekBet={game.lastWeekBet} bet={settings.bet} names={names} me={me} onEditBet={()=>openModal('bet')}/>
              <StreaksCard streaks={game.streaks} names={names} me={me}/>
            </div>
            <div className="col">
              <Achievements stats={game.stats} names={names} me={me}/>
            </div>
          </div>
          <div className="wgrid">
            <div className="col">
              <div className="card">
                <div className="slbl">Divisão da carga</div>
                <div className="opts c2" style={{marginBottom:14}}>
                  <button className={`opt ${casa.split==='smart'?'on':''}`} onClick={()=>saveSplit('smart')} disabled={isPending('split')}>
                    <div className="opt-t">✦ Inteligente</div><div className="opt-s">Quem fez por último passa a vez, equilibrando a semana</div>
                  </button>
                  <button className={`opt ${casa.split==='rotation'?'on':''}`} onClick={()=>saveSplit('rotation')} disabled={isPending('split')}>
                    <div className="opt-t">↻ Rodízio fixo</div><div className="opt-s">Alterna sempre na mesma ordem</div>
                  </button>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}>
                  <span style={{fontSize:14,fontWeight:500}}><span style={{color:'var(--green)'}}>●</span> {firstName(names.g)} <span style={{color:'var(--sub)',fontWeight:400}}>{gP}%</span></span>
                  <span style={{fontSize:12,color:balanced?'var(--green)':'var(--amb)'}}>{balanced?'✓ Equilibrado':`⚠ ${Math.round(Math.abs(gS-sS))} pts de diferença`}</span>
                  <span style={{fontSize:14,fontWeight:500}}><span style={{color:'var(--sub)',fontWeight:400}}>{100-gP}%</span> {firstName(names.s)} <span style={{color:'var(--pur)'}}>●</span></span>
                </div>
                <div className="balance"><div style={{width:gP+'%',background:'var(--gdk)',transition:'width .4s'}}/><div style={{flex:1,background:'var(--pur)'}}/></div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--sub)',marginBottom:14}}>
                  <span><b style={{color:'var(--tx)',fontWeight:500}}>{Math.round(gS)}</b> pts · {act.filter(t=>t.assigned_to==='g').length} fixas</span>
                  <span><b style={{color:'var(--tx)',fontWeight:500}}>{Math.round(sS)}</b> pts · {act.filter(t=>t.assigned_to==='s').length} fixas</span>
                </div>
                {(rotCount>0||allRoutines.length>0)&&<div style={{fontSize:12,color:'var(--sub)',marginTop:-6,marginBottom:14}}><span className="tag-r">↻ {[rotCount>0&&`${rotCount} tarefa${rotCount!==1?'s':''}`,allRoutines.length>0&&`${allRoutines.length} rotina${allRoutines.length!==1?'s':''} dos cães`].filter(Boolean).join(' + ')} sem dona fixa</span> — {casa.split==='smart'?'divididas pela divisão inteligente':'alternam a cada dia, semana ou mês'}, metade da carga para cada</div>}
                <button className="btn btn-pur btn-w" onClick={autoDistribute}>✦ Distribuir automaticamente</button>
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
                <div style={{fontSize:12,color:'var(--sub)',marginTop:8}}>{lv.l<LEVELS.length?`Faltam ${lv.max-xp} XP para ${LEVELS[lv.l].n}`:'Nível máximo 🏆'}</div>
              </div>
              <div className="card">
                <div className="slbl">Últimas 4 semanas</div>
                {historyError?<div className="inline-err">Não foi possível carregar o histórico. <button className="lnk" onClick={loadHistory}>Tentar novamente</button></div>
                :!historyData?<div style={{fontSize:13,color:'var(--sub)',padding:'8px 0'}}>Carregando...</div>:
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
                  {ACCIDENT_PLACES.map(loc=>(
                    <button key={loc} className="pill" disabled={isPending('acc:'+pup.id)} onClick={()=>addAccident(pup.id,loc)}>+ {loc}</button>
                  ))}
                </div>
                {accidents.filter(a=>a.dog_id===pup.id).slice(0,5).map((a:Accident)=>(
                  <div key={a.id} className="acc">
                    <span>💧</span><span>{a.location}</span>
                    <span className="mono" style={{marginLeft:'auto',fontSize:11,color:'var(--sub)'}}>
                      {a.date!==today&&fmtDate(a.date)+' · '}{timeOfInstant(a.occurred_at)}
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
                      <div style={{minWidth:0,flex:1}}><div className="pname">{dog.name}</div><div className="prole">{dog.breed||'Raça não informada'} · {dog.is_puppy?'Filhote':'Adulto'}</div></div>
                      {daily.length>0&&<Ring pct={Math.round(dDone/daily.length*100)} color="var(--green)" label={`${dDone}/${daily.length}`}/>}
                      <button className="ib" onClick={()=>openModal('dog',dog)} title={`Editar ${dog.name}`} aria-label={`Editar ${dog.name}`}>✎</button>
                    </div>
                    {dog.routines.length===0&&<div style={{fontSize:13,color:'var(--sub)',padding:'4px 0'}}>Nenhuma rotina ainda</div>}
                    {daily.length>0&&<><div className="slbl">Rotina diária</div>{daily.map(r=>dogRow(r,{dog}))}</>}
                    {periodic.length>0&&<>
                      <div className="slbl" style={{marginTop:14}}>Periódicas</div>
                      {periodic.map(r=>dogRow(r,{dog}))}
                    </>}
                    <button className="addr" onClick={()=>openModal('routine',{dog,routine:null})}>+ Nova rotina</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>}

        {/* ── AJUSTES ── */}
        {tab==='settings'&&<div className="scr narrow">
          <div className="sh"><div><h2>Ajustes</h2><p>Integrantes e guia de uso</p></div></div>
          <div className="card" style={{marginBottom:14}}>
            <div className="slbl">{account?'Sua conta':'Este aparelho'}</div>
            {account?<div className="field-row">
              <div className={`av av-${account.who}`}>{initials(names[account.who])}</div>
              <div style={{minWidth:0}}>
                <div className="row-t">{firstName(names[account.who])}</div>
                <div className="row-s" style={{overflow:'hidden',textOverflow:'ellipsis'}}>{account.email} · registra quem concluiu cada tarefa</div>
              </div>
              <button className="btn btn-g" style={{marginLeft:'auto'}} onClick={()=>{if(confirm('Sair da conta neste aparelho?'))account.onSignOut()}}>Sair</button>
            </div>:<div className="field-row">
              {me&&<div className={`av av-${me}`}>{initials(names[me])}</div>}
              <div style={{minWidth:0}}>
                <div className="row-t">{me?`Usado por ${firstName(names[me])}`:'Ninguém escolhido ainda'}</div>
                <div className="row-s">Registra quem concluiu cada tarefa. Fica salvo só neste aparelho; não é login.</div>
                {!device.persisted&&<div className="row-s" style={{color:'var(--amb)'}}>Este navegador não deixou salvar a escolha; ela vale até fechar o app.</div>}
              </div>
              <button className="btn btn-g" style={{marginLeft:'auto'}} onClick={()=>openModal('device')}>Trocar</button>
            </div>}
          </div>
          <NotificationsCard householdId={householdId} me={me} names={names} onToast={m=>showToast(m)}
            onError={m=>{setToast({kind:'err',msg:m});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),6000)}}
            onNeedIdentity={()=>openModal('device')}/>
          <TelegramCard householdId={householdId} me={me} names={names} onToast={m=>showToast(m)}
            onError={m=>{setToast({kind:'err',msg:m});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),6000)}}
            onNeedIdentity={()=>openModal('device')}/>
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
          <div className="card guide">
            <div className="slbl">Guia do Ninho</div>
            <details open><summary>☀️ Hoje</summary><div className="gb">
              <p>A tela do dia. Cada uma tem sua coluna (no celular, troque pelo seletor no topo) com o anel de progresso e só o que está pendente <b>hoje</b>.</p>
              <ul>
                <li><b>Grupos por horário:</b> ⚠ Atrasadas (diárias com horário que já passou), 🌅 Manhã, ☀️ Tarde, 🌙 Noite, a qualquer hora e, por fim, as do período (até o fim da semana, quinzena ou mês) e as pontuais.</li>
                <li><b>▸ próxima</b> destaca a próxima tarefa com horário.</li>
                <li>Toque na tarefa para concluir. Aparece <b>+XP · Desfazer</b> por alguns segundos. As concluídas ficam recolhidas no fim da coluna, com <b>quem concluiu</b> (conclusões anteriores a esta versão aparecem como “não identificado”).</li>
                <li><b>Sua conta</b> (e-mail e senha) diz quem está usando o celular; é isso que fica registrado ao concluir. Ver a coluna da outra pessoa não muda isso. Se o banco recusar uma alteração, o app desfaz na tela e mostra o aviso com “Tentar novamente”.</li>
                <li>No computador, <b>⇄</b> passa para a outra e <b>✎</b> edita. No celular, tudo isso fica no <b>⋯</b>.</li>
                <li>Indicadores do topo: % do dia, estado da <b>Casa</b> (quanto das diárias ainda falta: organizada, atenção ou alerta), nível/XP e sequência.</li>
              </ul>
            </div></details>
            <details><summary>📋 Tarefas</summary><div className="gb">
              <p>A lista completa, agrupada por cômodo, com busca e filtros (essenciais, por pessoa, rodízio, sem horário e por cômodo).</p>
              <ul>
                <li><b>Ajuste rápido:</b> toque em “○ essencial” para ligar/desligar e em “+ horário” para definir a hora — sem abrir o formulário.</li>
                <li><b>Responsável:</b> escolha {firstName(names.g)}, {firstName(names.s)} ou ↻ rodízio direto no card.</li>
                <li>Toque no nome para editar tudo (cômodo, esforço, frequência, horário) ou remover.</li>
                <li><b>✦ Sugestões:</b> listas prontas por cômodo; selecione várias ou toque em ✎ para ajustar antes de criar.</li>
              </ul>
            </div></details>
            <details><summary>📅 Frequência</summary><div className="gb">
              <ul>
                <li><b>Diária:</b> volta todo dia.</li>
                <li><b>Semanal:</b> aparece até ser feita; depois some até a próxima segunda.</li>
                <li><b>Quinzenal:</b> uma vez a cada duas semanas (blocos fixos de 2 semanas).</li>
                <li><b>Mensal:</b> uma vez por mês do calendário.</li>
                <li><b>Pontual:</b> feita uma vez, some de vez.</li>
              </ul>
              <p>Cada tarefa mostra quando foi feita pela última vez (“há 9 dias”, “nunca feita”). Só dá para desmarcar o que foi feito hoje.</p>
              <ul>
                <li><b>📆 Dias da semana</b> (no formulário da tarefa): a diária aparece só nesses dias (ex.: lixo seg, qua e sex). A semanal ou quinzenal aparece a partir do primeiro dia escolhido (ex.: faxina a partir de sábado).</li>
                <li><b>Pontual com data:</b> aparece em Hoje a partir da data e fica em ⚠ Atrasadas se passar.</li>
                <li><b>⤼ Pular</b> (no ⋯ da tarefa, ou ⏭ no computador): resolve o dia, a semana ou o mês sem XP e <b>sem quebrar a sequência</b>. <b>⏭ Deixar para amanhã:</b> some só hoje. As puladas ficam no fim da coluna com “↺ Voltar”.</li>
              </ul>
            </div></details>
            <details><summary>↻ Divisão das tarefas</summary><div className="gb">
              <p>Tarefas sem responsável fixa (↻) são divididas entre vocês. Escolha o jeito em <b>Semana › Divisão da carga</b>:</p>
              <ul>
                <li><b>✦ Inteligente</b> (padrão): <b>quem fez por último passa a vez</b>. Se uma cobriu a outra, a vez se ajusta sozinha. Se uma já está com bem mais carga (o que é fixo dela + o que fez na semana), a próxima vai para a outra. Diárias são decididas a cada dia; semanais, quinzenais e mensais uma vez por período, para não trocarem de dona no meio da semana.</li>
                <li><b>↻ Rodízio fixo:</b> alterna sempre na mesma ordem (a cada dia, semana ou mês).</li>
              </ul>
              <p>No celular, toque em <b>⋯</b> numa tarefa para ver <b>por que é a vez de quem</b>. A conta é a mesma nos dois celulares e no bom dia.</p>
              <p>Usar ⇄ numa tarefa de rodízio fixa ela com a outra pessoa (dá para desfazer).</p>
              <p>Em <b>Semana › Divisão da carga</b> vocês veem os pontos de cada uma (esforço × frequência; rodízio conta metade para cada). <b>✦ Distribuir automaticamente</b> reparte tudo de forma equilibrada — atenção: ele define responsável fixo para todas e tira do rodízio.</p>
            </div></details>
            <details><summary>🛒 Compras</summary><div className="gb">
              <ul>
                <li>Lista compartilhada <b>ao vivo</b>: o que uma adiciona ou risca aparece na hora no celular da outra.</li>
                <li>Digite com a quantidade (“2 kg arroz”, “leite 3”) e a categoria é escolhida sozinha (dá para trocar). A lista fica na ordem dos corredores do mercado.</li>
                <li>Item repetido não duplica; se estava riscado, volta para a lista.</li>
                <li>No mercado, toque para riscar. <b>Finalizar compra</b> tira os riscados (com Desfazer) e oferece marcar a tarefa “Mercado semanal”.</li>
                <li><b>Comprar de novo:</b> os itens mais comprados nos últimos meses, a um toque.</li>
              </ul>
            </div></details>
            <details><summary>🔧 Manutenção</summary><div className="gb">
              <ul>
                <li>Em <b>Tarefas › Manutenção</b>: coisas de tempos em tempos (filtro do ar, vermífugo, vacina, revisão do carro). Use <b>✦ Modelos prontos</b> para começar.</li>
                <li>Ao marcar <b>✓ Feita</b> (+3 XP), a próxima data é calculada sozinha. Dá para desfazer.</li>
                <li>Aparece em <b>Hoje</b> quando falta pouco (3 dias) ou está atrasada, e no <b>bom dia</b> no dia em que vence.</li>
              </ul>
            </div></details>
            <details><summary>🐾 Cães</summary><div className="gb">
              <ul>
                <li>Cada cão tem suas <b>rotinas</b> (diárias, semanais, quinzenais ou mensais, com horário opcional). Use ✎ no cão para editar nome, raça e fase, e ✎ na rotina para mudar ou remover. “+ Nova rotina” adiciona.</li>
                <li>Em Hoje, a mesma rotina de cães diferentes (ex.: Ração manhã) vira <b>um item só</b>: um toque marca para todos. Elas entram no rodízio e aparecem na lista de quem é a vez; a bolinha com a inicial na aba Cães mostra de quem é.</li>
                <li><b>Modo filhote:</b> registre acidentes por cômodo e acompanhe o dia.</li>
                <li>Tarefas da categoria Cães repetem as rotinas e por isso não aparecem em Hoje; dá para arquivá-las pelo aviso em Tarefas.</li>
              </ul>
            </div></details>
            <details><summary>📲 App e notificações</summary><div className="gb">
              <ul>
                <li><b>Instalar:</b> no Android, “Instalar” em Ajustes (ou menu ⋮ → Instalar app). No iPhone, Safari → Compartilhar → Adicionar à Tela de Início. O Ninho vira um ícone e abre como app.</li>
                <li><b>Sem internet:</b> o app abre com os últimos dados que carregou neste aparelho. Marcar e editar voltam quando a conexão voltar.</li>
                <li><b>☀️ Bom dia</b> (por volta das 7h): o que é seu hoje — fixo ou pela vez do rodízio — e o que vale ⚡ no horário.</li>
                <li><b>🏆 Resumo de domingo</b> (por volta das 19h): placar, quem paga a aposta, sequência e o que ficou para trás.</li>
                <li>Cada aparelho ativa as próprias notificações em Ajustes, e elas seguem “Este aparelho”. No iPhone, só com o app instalado (iOS 16.4+).</li>
              </ul>
            </div></details>
            <details><summary>💬 Telegram e ✦ IA</summary><div className="gb">
              <ul>
                <li><b>Telegram:</b> em Ajustes › Telegram: <b>Conectar</b> liga o seu; <b>Gerar convite</b> cria um link para mandar à outra pelo WhatsApp. O bom dia e o resumo de domingo chegam lá também.</li>
                <li><b>Menu fixo</b> no Telegram: 📋 Hoje, 🛒 Compras, ➕ Adicionar à lista, ✦ Dicas e ❓ Ajuda. Ao tocar no ✓ de uma tarefa, o botão some na hora e o resultado aparece no topo da lista.</li>
                <li>Comandos: <b>/hoje</b> (o que é seu, com botões ✓ para concluir), <b>/feito louça</b>, <b>/compras</b> (ver a lista), <b>/compras leite, 2 kg arroz</b> ou <b>+leite</b> (adicionar), <b>/dicas</b> e <b>/sair</b>.</li>
                <li><b>✦ IA:</b> na Reunião semanal (e no /dicas), a IA lê a semana (placar, quem fez o quê, puladas, o que pesou na reunião passada) e sugere de 3 a 5 ajustes. São sugestões, não regras. Limite de 6 pedidos por dia. O resumo da semana é enviado à Anthropic para gerar as sugestões.</li>
              </ul>
            </div></details>
            <details><summary>🌤 Energia e modo sobrevivência</summary><div className="gb">
              <p>Escolham a <b>energia da semana</b> (alta, média ou baixa). Em energia baixa ou no <b>🛡 modo sobrevivência</b>, Hoje mostra só as essenciais e as rotinas dos cães, com o botão “Mostrar todas”. Vale para a semana atual.</p>
            </div></details>
            <details><summary>📋 Reunião semanal</summary><div className="gb">
              <p>15 minutos, sem cobranças: o que funcionou, o que pesou, ajuste, prioridades, como cada uma chega, vitórias, modo da próxima semana e recompensa. Fica no histórico em Semana.</p>
            </div></details>
            <details><summary>🏆 XP, níveis e sequência</summary><div className="gb">
              <ul>
                <li>Cada tarefa vale pelo esforço: <span className="xp xp-l">+1</span> leve, <span className="xp xp-m">+2</span> médio, <span className="xp xp-h">+3</span> pesado. Rotina de cão vale +1 por cão. O nível é do casal.</li>
                <li><b>⚡ Bônus no horário:</b> diária com horário feita até o horário vale ×1,5 (leve 2, média 3, pesada 5). Feita atrasada no mesmo dia vale o normal: ninguém perde pontos. O ⚡ aparece no XP enquanto ainda dá tempo.</li>
                <li><b>🏆 Placar da semana:</b> o XP de cada uma de segunda a domingo, com a aposta simbólica (troque em Semana). Conta pelo aparelho identificado de quem concluiu.</li>
                <li><b>🔥 Sequências:</b> casa ativa (algo feito no dia), casa em dia (todas as essenciais diárias feitas) e a de cada uma, com recordes. A de hoje só entra depois do primeiro check; ninguém perde a sequência no meio do dia.</li>
                <li><b>🏅 Conquistas:</b> bronze, prata e ouro por cômodo, cães, pontualidade, madrugada, tarefas pesadas, faxina relâmpago (várias tarefas em 1 hora) e recorde de sequência.</li>
                <li>Níveis: {LEVELS.map(l=>`${l.n} (${l.min})`).join(' · ')}.</li>
              </ul>
            </div></details>
            <details><summary>🔣 Símbolos</summary><div className="gb">
              <ul>
                <li><span className="tag-e">● essencial</span> — não pode falhar; caixinha laranja; aparece mesmo no modo sobrevivência.</li>
                <li><span className="tag-t">⏰ 08:00</span> horário · <span className="tag-t late">⏰ 07:00</span> atrasada.</li>
                <li><span className="tag-r">↻</span> rodízio · <span className="tag-next">▸ próxima</span> próxima com horário.</li>
                <li>Bolinha <span style={{color:'var(--green)'}}>●</span> leve, <span style={{color:'var(--amb)'}}>●</span> média, <span style={{color:'var(--cor)'}}>●</span> pesada (na lista de Tarefas).</li>
              </ul>
              <p>Tudo sincroniza na hora entre os celulares de vocês.</p>
            </div></details>
          </div>
        </div>}
        </>}
      </main>

      {/* NAV MOBILE */}
      <nav className="bnav">
        {TABS.map(([k,ic,l])=><button key={k} className={`bnb ${tab===k?'on':''}`} onClick={()=>setTab(k)} aria-current={tab===k?'page':undefined}><span className="ic">{ic}</span>{l}</button>)}
      </nav>

      {data.status==='ready'&&(tab==='today'||tab==='tasks')&&(tab==='tasks'&&taskView==='maint'
        ?<button className="fab mob-fab" onClick={()=>openModal('maint',null)} aria-label="Nova manutenção"><span>+</span><b>Nova manutenção</b></button>
        :<button className="fab mob-fab" onClick={()=>openModal('task',null)} aria-label="Nova tarefa"><span>+</span><b>Nova tarefa</b></button>)}

      {toast&&<div className={`toast ${toast.kind==='err'?'err':''}`} role={toast.kind==='err'?'alert':'status'}>
        <span className="toast-m">{toast.msg}</span>
        {toast.undo&&<button onClick={toast.undo}>Desfazer</button>}
        {toast.retry&&<button onClick={()=>{const r=toast.retry!;setToast(null);r()}}>Tentar novamente</button>}
        {toast.kind==='err'&&<button className="tx" onClick={()=>setToast(null)} aria-label="Fechar aviso">✕</button>}
      </div>}
      {modal==='task'&&<TaskFormModal task={modalData} names={names} saving={saving} onClose={closeModal} onSave={saveTask} onDelete={deleteTask}/>}
      {modal==='sugg'&&<SuggModal tasks={tasks} onClose={closeModal} onAdd={addSuggestions} onCustomize={s=>openModal('task',{title:s.t,category:s.cat,weight:s.w,frequency:s.f,essential:s.ess,assigned_to:null,scheduled_time:null,active:true,id:null})}/>}
      {modal==='pet'&&<PetModal saving={saving} onClose={closeModal} onSave={savePet}/>}
      {modal==='taskmenu'&&(()=>{const t:Task=modalData;const other:Who=ownerOfTask(t)==='g'?'s':'g';const why=whyLabel(plan.whyOf(t.id),names,today);return(
        <Sheet size="sm" title={t.title} onClose={closeModal}>
          {why&&<div className="why">↻ {why}</div>}
          <div className="menu">
            <button className="btn btn-s" onClick={()=>{closeModal();toggleTask(t)}}>{t.completed_today?'↺ Desmarcar':'✓ Concluir'}</button>
            {!t.completed_today&&t.frequency!=='daily'&&<button className="btn btn-g" onClick={()=>{closeModal();pauseTask(t,'snooze')}}>⏭ Deixar para amanhã</button>}
            {!t.completed_today&&SKIP_LABEL[t.frequency]&&<button className="btn btn-g" onClick={()=>{closeModal();pauseTask(t,'skip')}}>⤼ {SKIP_LABEL[t.frequency]}<small className="menu-s">sem XP · não quebra a sequência</small></button>}
            <button className="btn btn-g" onClick={()=>{closeModal();swapTask(t)}}>⇄ Passar para {firstName(names[other])}</button>
            <button className="btn btn-g" onClick={()=>openModal('task',t)}>✎ Editar tarefa</button>
          </div>
        </Sheet>
      )})()}
      {modal==='dog'&&<DogModal dog={modalData} saving={saving} onClose={closeModal} onSave={updateDog} onDelete={removeDog}/>}
      {modal==='routine'&&<RoutineModal routine={modalData.routine} dogName={modalData.dog.name} saving={saving} onClose={closeModal} onSave={(d,id)=>saveRoutine(modalData.dog.id,d,id)} onDelete={removeRoutine}/>}
      {modal==='energy'&&<EnergyModal energy={settings.energy} onClose={closeModal} onPick={setEnergy}/>}
      {device.ready&&!account&&(!me||modal==='device')&&<DeviceIdentityModal names={names} current={me} required={!me}
        onPick={w=>{device.setWho(w);if(modal==='device')closeModal();showToast(`Este aparelho agora é da ${firstName(names[w])}`)}}
        onClose={closeModal}/>}
      {modal==='bet'&&<BetModal current={settings.bet} saving={saving} onClose={closeModal} onSave={saveBet}/>}
      {modal==='maint'&&<MaintenanceForm item={modalData} today={today} names={names} saving={saving} onClose={closeModal} onSave={saveMaint} onDelete={removeMaint}/>}
      {modal==='mainttpl'&&<MaintTemplatesSheet existing={casa.maint} today={today} saving={saving} onClose={closeModal} onAdd={addMaintTemplates}/>}
      {modal==='meeting'&&<MeetingModal householdId={householdId} names={names} weekStart={weekStart} saving={saving} onClose={closeModal} onSave={saveMeeting}/>}
    </>
  )
}
