// Beyond Horizons HUD — research tabs linked to the Beyond Horizons API (FastAPI backend)
// Shares localStorage keys with the Next.js app, so history is common when both run on the same domain.

import { chips } from './sources.js?v=30';
const REF_SRC = { 'OSD-720': 'osd720', 'GLDS-699': 'osd720', 'AINV00000008': 'lsda_osteo', 'NAG9-1024': 'nag9_1024', 'HRP-BEHAVIORAL-HEALTH': 'hrp_behav', 'HRP-RADIATION-CARCINOGENESIS': 'hrp_carcino', 'HRP-BONE-RISK': 'hrp_bone', 'HRP-MUSCLE-RISK': 'hrp_muscle', 'HRP-EVA-RISK': 'hrp_eva', 'HRP-BEH': 'hrp_behav' };
const refIds = ref => [...new Set(Object.entries(REF_SRC).filter(([k]) => (ref || '').includes(k)).map(([, v]) => v))];
const KEYS = {
  vitals: 'beyond-horizons:vitals-history',      // same key + record format as frontend/lib/vitalsStore.ts
  scans: 'beyond-horizons:scan-history',
  chat: 'beyond-horizons:assistant-chat',
  api: 'beyond-horizons:api-base',
};
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const pct = v => (v * 100).toFixed(0) + '%';
const ST_CLS = { normal: 'ok', attention: 'warn', alert: 'crit', low: 'ok', moderate: 'warn', high: 'crit', critical: 'crit' };
const ST_TXT = { normal: 'NORMAL', attention: 'ATTENTION', alert: 'ALERT' };

/* ---------------- API link ---------------- */
function resolveApi() {
  const q = new URLSearchParams(location.search).get('api');
  if (q !== null) { const v = q.replace(/\/+$/, ''); try { v ? localStorage.setItem(KEYS.api, v) : localStorage.removeItem(KEYS.api); } catch { /* ignore */ } if (v) return v; }
  try { const s = localStorage.getItem(KEYS.api); if (s) return s; } catch { /* ignore */ }
  return (window.BH_CONFIG?.apiBase || '').replace(/\/+$/, '');
}
const API = resolveApi();
let linkState = 'idle';
function setLink(s, txt) {
  linkState = s;
  const el = $('#hdLink'); if (!el) return;
  el.className = 'link-pill ' + s;
  el.querySelector('b').textContent = txt;
}
async function api(path, body) {
  if (!API) throw new Error('No data link configured. Set apiBase in config.js (or open the page with ?api=https://your-backend).');
  let r;
  try {
    r = await fetch(API + path, body === undefined ? { cache: 'no-store' } : { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    if (linkState !== 'on') setLink('snap', 'SNAPSHOT');
    throw new Error(`Could not reach the Beyond Horizons API (${API}). If it is hosted on a free tier it may be waking up — try again in ~30 s.`);
  }
  if (!r.ok) {
    let d = null; try { d = (await r.json()).detail; } catch { /* ignore */ }
    if (Array.isArray(d)) d = d.map(x => x.msg || JSON.stringify(x)).join('; ');
    throw new Error(typeof d === 'string' && d ? d : `${r.status} ${r.statusText}`);
  }
  setLink('on', 'ONLINE');
  return r.json();
}
/* ---------- offline snapshot: real outputs of the Beyond Horizons API, used when the live link is unavailable ---------- */
let snapP = null;
const getSnap = () => (snapP ||= fetch('data/snapshot.json?v=30').then(r => { if (!r.ok) throw new Error('snapshot missing'); return r.json(); }));
const SNAP_NOTE = '<div class="snap-note">OFFLINE SNAPSHOT · real outputs of the Beyond Horizons API (deterministic Ares-180 seed), shown because the live data link is unavailable.</div>';
async function apiOr(path, body, pick) {
  try { return { data: await api(path, body), snap: false }; }
  catch (e) {
    const sn = await getSnap().catch(() => null);
    const d = sn && pick(sn);
    if (!d) throw e;
    if (linkState !== 'on') setLink('snap', 'SNAPSHOT');
    return { data: d, snap: true, err: e };
  }
}
async function checkLink() {
  if (!API) { setLink('snap', 'SNAPSHOT'); return; }
  setLink('wait', 'CONNECTING…');
  const slow = setTimeout(() => linkState === 'wait' && setLink('wait', 'WAKING UP…'), 4000);
  try { const r = await fetch(API + '/health', { cache: 'no-store' }); r.ok ? setLink('on', 'ONLINE') : setLink('snap', 'SNAPSHOT'); }
  catch { setLink('snap', 'SNAPSHOT'); }
  clearTimeout(slow);
}
function errBox(el, e, retry) {
  el.innerHTML = `<div class="api-err"><b>DATA LINK ERROR</b><p>${esc(e.message)}</p>${retry ? '<button class="hud-btn retry">RETRY</button>' : ''}</div>`;
  if (retry) el.querySelector('.retry').onclick = retry;
}
const loading = (el, t = 'LOADING FROM DATA LINK…') => { el.innerHTML = `<div class="api-wait"><i></i>${t}</div>`; };

/* ---------------- local fallback (same rules as backend/app/domain/vitals_reference.py) ---------------- */
function localEvaluate(e) {
  const rng = (id, label, cat, v, unit, nl, nh, al, ah, ref) => {
    let status = 'normal', note = `${v} ${unit} is within the ${ref} resting range.`;
    if (v < al || v > ah) { status = 'alert'; note = `${v} ${unit} is outside the ${ref} resting range and well beyond the usual attention margin.`; }
    else if (v < nl || v > nh) { status = 'attention'; note = `${v} ${unit} is just outside the ${ref} resting range -- worth watching, not yet urgent.`; }
    return { metric_id: id, label, category: cat, value: v, unit, status, reference_range: ref, note, recommendations: [] };
  };
  const well = (id, label, cat, v, unit, low, ref, ok, bad) => ({ metric_id: id, label, category: cat, value: v, unit, status: v >= low ? 'normal' : 'attention', reference_range: ref, note: v >= low ? ok : bad, recommendations: [] });
  const m = [
    rng('heart_rate', 'Heart rate', 'cardiac', e.heart_rate_bpm, 'bpm', 60, 100, 50, 110, '60-100 bpm'),
    { metric_id: 'heart_rhythm', label: 'Heart rhythm', category: 'cardiac', value: e.heart_rhythm === 'regular' ? 1 : 0, unit: '', status: e.heart_rhythm === 'regular' ? 'normal' : 'attention', reference_range: 'self-reported (no ECG sensor available)', note: e.heart_rhythm === 'regular' ? 'Reported as regular.' : 'Reported as irregular -- no ECG sensor, so this only records that you noticed it.', recommendations: [] },
    rng('spo2', 'Blood oxygen (SpO2)', 'respiratory', e.spo2_percent, '%', 95, 100, 90, 100, '95-100%'),
    rng('respiratory_rate', 'Respiratory rate', 'respiratory', e.respiratory_rate_bpm, 'breaths/min', 12, 20, 10, 24, '12-20 breaths/min'),
    rng('body_temp', 'Body temperature', 'temperature', e.body_temp_c, '°C', 36.1, 37.2, 35.5, 38.0, '36.1-37.2°C'),
    well('sleep', 'Sleep duration', 'sleep_fatigue', e.sleep_hours, 'h', 7, '7-9 h (CDC adult recommendation)', `${e.sleep_hours} h meets the general adult recommendation (7-9 h).`, `${e.sleep_hours} h is below the general adult recommendation (7-9 h).`),
    well('sleep_quality', 'Sleep quality', 'sleep_fatigue', e.sleep_quality, '/5', 3, 'self-reported, 3/5 or higher', `Self-rated sleep quality ${e.sleep_quality}/5 is reasonable.`, `Self-rated sleep quality ${e.sleep_quality}/5 is low.`),
    { metric_id: 'stress', label: 'Stress level', category: 'sleep_fatigue', value: e.stress_level, unit: '/10', status: e.stress_level <= 3 ? 'normal' : 'attention', reference_range: 'self-reported, lower is better', note: e.stress_level <= 3 ? `Self-reported stress ${e.stress_level}/10 is on the lower end.` : `Self-reported stress ${e.stress_level}/10 is elevated.`, recommendations: [] },
    well('activity', 'Physical activity', 'activity_muscle', e.activity_minutes, 'min', 20, '~20+ min/day (WHO weekly guidance averaged daily)', `${e.activity_minutes} min meets the rough daily WHO average.`, `${e.activity_minutes} min is below the rough daily WHO average.`),
    well('hydration', 'Hydration', 'hydration_other', e.hydration_level, '/10', 6, 'self-reported, 6/10 or higher', `Self-estimated hydration ${e.hydration_level}/10 looks adequate.`, `Self-estimated hydration ${e.hydration_level}/10 is on the low side.`),
  ];
  const rank = { normal: 0, attention: 1, alert: 2 };
  const overall = m.reduce((a, x) => rank[x.status] > rank[a] ? x.status : a, 'normal');
  const bad = m.filter(x => x.status !== 'normal');
  return { overall_status: overall, metrics: m, insights: bad.length ? bad.map(x => x.note) : ['All monitored indicators are within expected resting ranges for this entry.'],
    reference_source: 'CLINICAL-VITALS-REFERENCE (evaluated in-browser, data link offline)', limitations: ['General adult resting reference ranges, not spaceflight-specific thresholds.', 'Not medical advice.'], local: true };
}

/* ---------------- MY VITALS ---------------- */
const FIELDS = [
  ['heart_rate_bpm', 'Heart rate', 'bpm', 72, 20, 250, 1],
  ['spo2_percent', 'SpO₂', '%', 98, 50, 100, 0.1],
  ['body_temp_c', 'Body temperature', '°C', 36.7, 30, 43, 0.1],
  ['respiratory_rate_bpm', 'Respiratory rate', 'br/min', 16, 4, 60, 1],
  ['sleep_hours', 'Sleep (last 24 h)', 'h', 7.5, 0, 24, 0.5],
  ['sleep_quality', 'Sleep quality', '1–5', 4, 1, 5, 1],
  ['stress_level', 'Stress', '0–10', 3, 0, 10, 1],
  ['activity_minutes', 'Activity', 'min', 30, 0, 600, 5],
  ['hydration_level', 'Hydration', '0–10', 7, 0, 10, 1],
  ['body_mass_kg', 'Body mass (optional)', 'kg', '', 20, 250, 0.1],
];
let lastEval = null, lastEntry = null;
function buildVitalsForm() {
  $('#vForm').innerHTML = FIELDS.map(([k, l, u, d, mn, mx, st]) =>
    `<label class="fld"><span>${l} <em>${u}</em></span><input type="number" name="${k}" value="${d}" min="${mn}" max="${mx}" step="${st}"></label>`).join('') +
    `<label class="fld"><span>Heart rhythm <em>self-reported</em></span><select name="heart_rhythm"><option value="regular">Regular</option><option value="irregular">Irregular</option></select></label>`;
  $('#vEval').onclick = () => evaluateForm(false);
  $('#vSave').onclick = () => evaluateForm(true);
}
function readForm() {
  const f = $('#vForm'), e = {};
  for (const [k, , , , mn, mx] of FIELDS) {
    const raw = f.querySelector(`[name="${k}"]`).value;
    if (raw === '' && k === 'body_mass_kg') { e[k] = null; continue; }
    const v = Number(raw);
    if (!Number.isFinite(v) || v < mn || v > mx) throw new Error(`${k.replace(/_/g, ' ')} must be between ${mn} and ${mx}.`);
    e[k] = ['sleep_quality', 'stress_level', 'hydration_level'].includes(k) ? Math.round(v) : v;
  }
  e.heart_rhythm = f.querySelector('[name="heart_rhythm"]').value;
  return e;
}
async function evaluateForm(save) {
  const out = $('#vResult');
  let entry; try { entry = readForm(); } catch (e) { errBox(out, e); return; }
  loading(out, 'EVALUATING…');
  let ev;
  try { ev = await api('/api/v1/vitals/evaluate', entry); }
  catch (e) { ev = localEvaluate(entry); ev.linkError = e.message; }
  lastEval = ev; lastEntry = entry;
  renderEval(ev);
  if (save) {
    const rec = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, recorded_at: new Date().toISOString(), entry, evaluation: ev };
    const h = lsGet(KEYS.vitals, []); h.push(rec); h.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    lsSet(KEYS.vitals, h.slice(-180));
    window.dispatchEvent(new CustomEvent('beyond-horizons:vitals-changed'));
    renderHistory(); renderVTrend();
  }
  if ($('#vToHud').checked) ctx.applySelfVitals(entry, ev);
}
function renderEval(ev) {
  const c = ST_CLS[ev.overall_status];
  $('#vResult').innerHTML = `
    <div class="v-overall ${c}"><span>OVERALL</span><b>${ST_TXT[ev.overall_status]}</b>${ev.local ? '<em>evaluated in-browser · data link offline</em>' : '<em>evaluated by Beyond Horizons API</em>'}</div>
    <div class="v-metrics">${ev.metrics.map(m => `<div class="vm ${ST_CLS[m.status]}"><label>${esc(m.label)}</label><b>${m.metric_id === 'heart_rhythm' ? (m.value ? 'Regular' : 'Irregular') : esc(m.value) + ' <small>' + esc(m.unit) + '</small>'}</b><span>${ST_TXT[m.status]}</span><small class="ref">${esc(m.reference_range)}</small></div>`).join('')}</div>
    <h4>INSIGHTS</h4><ul class="v-ins">${ev.insights.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
    ${ev.metrics.some(m => m.recommendations?.length) ? `<h4>SUGGESTED ACTIONS</h4><ul class="v-ins">${ev.metrics.flatMap(m => (m.recommendations || []).map(r => `<li><b class="${ST_CLS[m.status]}">${esc(m.label)}:</b> ${esc(r)}</li>`)).join('')}</ul>` : ''}
    <p class="note">${esc(ev.reference_source)} — general adult resting ranges, not spaceflight-specific; not medical advice.</p>`;
}
function renderHistory() {
  const h = lsGet(KEYS.vitals, []);
  $('#vHistCount').textContent = h.length;
  $('#vHist').innerHTML = h.length ? `<table><tr><th>DATE</th><th>STATUS</th><th>HR</th><th>SpO₂</th><th>TEMP</th><th></th></tr>${h.slice().reverse().map(r => {
    const e = r.entry, s = r.evaluation?.overall_status || 'normal';
    return `<tr data-id="${esc(r.id)}"><td>${new Date(r.recorded_at).toLocaleString()}</td><td class="${ST_CLS[s]}">${ST_TXT[s]}</td><td>${e.heart_rate_bpm}</td><td>${e.spo2_percent}</td><td>${e.body_temp_c}</td><td><button class="mini-btn hud" title="Show on hologram">◉</button><button class="mini-btn del" title="Delete">✕</button></td></tr>`;
  }).join('')}</table>` : '<p class="note">No entries yet. Evaluate and save your first reading.</p>';
  $$('#vHist tr[data-id]').forEach(tr => {
    const rec = () => lsGet(KEYS.vitals, []).find(r => r.id === tr.dataset.id);
    tr.querySelector('.del').onclick = () => { lsSet(KEYS.vitals, lsGet(KEYS.vitals, []).filter(r => r.id !== tr.dataset.id)); renderHistory(); renderVTrend(); };
    tr.querySelector('.hud').onclick = () => { const r = rec(); if (r) { ctx.applySelfVitals(r.entry, r.evaluation); ctx.goTab('overview'); } };
  });
  const scans = lsGet(KEYS.scans, []);
  $('#scanLog').innerHTML = scans.length ? scans.slice().reverse().slice(0, 40).map(s =>
    `<div class="slog ${s.level}"><span>${new Date(s.at).toLocaleString()}</span><b>${esc(s.scenario)}</b><em>${s.level === 'ok' ? 'STABLE' : s.level === 'warn' ? 'WARNING' : 'CRITICAL'}</em><small>HR ${s.v.hr} · SpO₂ ${s.v.spo2}% · ${s.v.temp}°C</small></div>`).join('') : '<p class="note">Completed body scans are logged here automatically.</p>';
}
const TREND_METRICS = { heart_rate_bpm: ['Heart rate', 'bpm', [60, 100]], spo2_percent: ['SpO₂', '%', [95, 100]], body_temp_c: ['Body temperature', '°C', [36.1, 37.2]], respiratory_rate_bpm: ['Respiratory rate', 'br/min', [12, 20]], sleep_hours: ['Sleep', 'h', [7, 9]] };
function renderVTrend() {
  const cv = $('#vTrend'), k = $('#vTrendSel').value, [, unit, ok] = TREND_METRICS[k];
  const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
  cv.width = Math.max(10, r.width * dpr); cv.height = Math.max(10, r.height * dpr);
  const g = cv.getContext('2d'), W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
  const pts = lsGet(KEYS.vitals, []).map(x => x.entry[k]).filter(v => typeof v === 'number');
  g.font = `${14 * dpr}px Rajdhani`; g.fillStyle = '#7ea6c8';
  if (pts.length < 2) { g.fillText(pts.length ? 'Save one more reading to draw a trend.' : 'No saved readings yet.', 20 * dpr, H / 2); return; }
  const lo = Math.min(ok[0], ...pts) * 0.98, hi = Math.max(ok[1], ...pts) * 1.02, Y = v => H - 20 * dpr - (v - lo) / (hi - lo) * (H - 40 * dpr), X = i => 40 * dpr + i / (pts.length - 1) * (W - 60 * dpr);
  g.fillStyle = 'rgba(45,255,138,0.07)'; g.fillRect(40 * dpr, Y(ok[1]), W - 60 * dpr, Y(ok[0]) - Y(ok[1]));
  g.fillStyle = '#7ea6c8'; g.fillText(`${hi.toFixed(1)} ${unit}`, 4 * dpr, 16 * dpr); g.fillText(lo.toFixed(1), 4 * dpr, H - 6 * dpr);
  g.beginPath(); pts.forEach((v, i) => i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)));
  g.strokeStyle = '#39c6ff'; g.lineWidth = 2.5 * dpr; g.shadowColor = '#39c6ff'; g.shadowBlur = 8; g.stroke(); g.shadowBlur = 0;
  pts.forEach((v, i) => { g.fillStyle = v < ok[0] || v > ok[1] ? '#ffb020' : '#fff'; g.beginPath(); g.arc(X(i), Y(v), 3.5 * dpr, 0, 7); g.fill(); });
}
function exportHistory() {
  const data = { exported_at: new Date().toISOString(), vitals: lsGet(KEYS.vitals, []), scans: lsGet(KEYS.scans, []), chat: lsGet(KEYS.chat, []) };
  const text = JSON.stringify(data, null, 1);
  const done = () => toast('History copied to clipboard — paste it into Import on the other site.');
  try {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = 'beyond-horizons-history.json'; a.click(); toast('History file downloaded.');
  } catch { navigator.clipboard?.writeText(text).then(done).catch(() => {}); }
}
function importHistory() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    try {
      const d = JSON.parse(await inp.files[0].text());
      const merge = (key, list) => { if (!Array.isArray(list)) return 0; const cur = lsGet(key, []); const ids = new Set(cur.map(x => x.id || x.at)); const add = list.filter(x => !ids.has(x.id || x.at)); lsSet(key, cur.concat(add).sort((a, b) => String(a.recorded_at || a.at).localeCompare(String(b.recorded_at || b.at)))); return add.length; };
      const n = merge(KEYS.vitals, Array.isArray(d) ? d : d.vitals) + merge(KEYS.scans, d.scans);
      if (Array.isArray(d.chat) && !lsGet(KEYS.chat, []).length) lsSet(KEYS.chat, d.chat);
      renderHistory(); renderVTrend(); toast(`Imported ${n} new records.`);
    } catch (e) { toast('Import failed: ' + e.message); }
  };
  inp.click();
}
function toast(t) {
  let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 3500);
}

/* ---------------- CREW RISK (simulation engine) ---------------- */
const CREW_COL = ['#39c6ff', '#2dff8a', '#ffb020', '#c78bff'];
let simData = null, catalog = null;
async function loadCrewControls() {
  try {
    catalog = (await apiOr('/api/v1/countermeasures/catalog', undefined, sn => sn.catalog)).data;
    $('#cmList').innerHTML = catalog.map(c => `<label class="chk"><input type="checkbox" value="${esc(c.id)}"><span><b>${esc(c.name)}</b><small>${esc(c.target_risk.replace(/_/g, ' '))}</small></span></label>`).join('');
  } catch (e) { $('#cmList').innerHTML = `<p class="note">${esc(e.message)}</p>`; }
}
/* crew customization: names + baseline traits (sent as crew_overrides) and scripted events (active_event_ids) */
const CREW_KEY = 'beyond-horizons:crew-custom', EVT_KEY = 'beyond-horizons:crew-events';
const TRAITS = [['radiation_sensitivity', 'Radiation sensitivity', 'higher = more affected by radiation'], ['bone_loss_susceptibility', 'Bone-loss susceptibility', 'higher = loses bone faster'], ['sleep_resilience', 'Sleep resilience', 'higher = copes better with little sleep'], ['muscle_recovery', 'Muscle recovery', 'higher = recovers faster'], ['cognitive_resilience', 'Cognitive resilience', 'higher = keeps focus under load'], ['inflammatory_baseline', 'Inflammatory baseline', 'higher = more inflammation at rest']];
let missionSeed = null;
async function getSeed() { if (!missionSeed) missionSeed = (await apiOr('/api/v1/missions/ares-180', undefined, sn => sn.mission)).data; return missionSeed; }
const YOU_KEY = 'beyond-horizons:crew-you';
export function crewYou() { return { on: true, seat: 'atlas', ...lsGet(YOU_KEY, {}) }; }
const myName = () => String(window.BH?.astronaut?.() || 'You');
// saved custom crew, plus "you" taking one crew seat with your own name
export function crewCustom() {
  const cc = { ...lsGet(CREW_KEY, {}) }, y = crewYou();
  if (y.on) cc[y.seat] = { ...(cc[y.seat] || {}), display_name: myName(), you: true };
  return cc;
}
export function applyCrewCustom(profiles) {
  const cc = crewCustom();
  return (profiles || []).map(p => { const c = cc[p.id]; return c ? { ...p, display_name: c.display_name || p.display_name, you: !!c.you, baseline: { ...p.baseline, ...(c.baseline || {}) } } : p; });
}
// traits changed (needs the live engine); names alone are applied in the browser
function crewIsDefault() { return !Object.values(lsGet(CREW_KEY, {})).some(c => c.baseline && Object.keys(c.baseline).length); }
function applyCrewNames(d) {
  if (!d) return d; const cc = crewCustom();
  d.trajectories.forEach(t => { const c = cc[t.crew_id]; if (c?.display_name) t.display_name = c.display_name; t.you = !!c?.you; });
  (d.crew_profiles || []).forEach(p => { const c = cc[p.id]; if (c?.display_name) p.display_name = c.display_name; });
  return d;
}
async function renderEvents() {
  const seed = await getSeed().catch(() => null), saved = lsGet(EVT_KEY, null);
  const evs = seed?.events || [];
  $('#evList').innerHTML = evs.map(e => `<label class="chk"><input type="checkbox" value="${esc(e.id)}" ${!saved || saved.includes(e.id) ? 'checked' : ''}><span><b>${esc(e.description)}</b><small>day ${e.day_start}${e.day_end && e.day_end !== e.day_start ? '–' + e.day_end : ''}</small></span></label>`).join('') || '<p class="note">Events unavailable.</p>';
  $$('#evList input').forEach(i => i.onchange = () => lsSet(EVT_KEY, $$('#evList input').filter(x => x.checked).map(x => x.value)));
}
async function openCrewEditor() {
  const seed = await getSeed().catch(() => null); if (!seed) { toast('Crew data unavailable.'); return; }
  const cc = crewCustom(), y = crewYou();
  $('#crewEdYou').innerHTML = `<label class="chk"><input type="checkbox" id="ceYouOn" ${y.on ? 'checked' : ''}><span><b>Put me in the crew — ${esc(myName())}</b><small>you take one crew seat and see your own risk (your name comes from ASTRONAUT in the header)</small></span></label>
    <label class="fld ced-seat"><span>Seat</span><select id="ceYouSeat" class="hud-sel">${seed.crew_profiles.map(p => `<option value="${esc(p.id)}" ${p.id === y.seat ? 'selected' : ''}>${esc(p.role)} (instead of ${esc(p.display_name)})</option>`).join('')}</select></label>`;
  const syncYou = () => { const on = $('#ceYouOn').checked, seat = $('#ceYouSeat').value;
    $$('#crewEdBody .ced').forEach(el => { const inp = el.querySelector('.ced-name'), me = on && el.dataset.id === seat; inp.disabled = me; el.classList.toggle('me', me); if (me) inp.value = myName(); else if (inp.dataset.orig) inp.value = inp.dataset.orig; }); };
  setTimeout(() => { $('#ceYouOn').onchange = syncYou; $('#ceYouSeat').onchange = syncYou; syncYou(); });
  $('#crewEdBody').innerHTML = seed.crew_profiles.map((p, i) => {
    const c = cc[p.id] || {}, b = { ...p.baseline, ...(c.baseline || {}) };
    return `<div class="ced" data-id="${esc(p.id)}" style="--c:${CREW_COL[i % 4]}"><div class="ced-h"><input class="ced-name" maxlength="40" value="${esc(c.you ? (lsGet(CREW_KEY, {})[p.id]?.display_name || p.display_name) : (c.display_name || p.display_name))}" data-orig="${esc(lsGet(CREW_KEY, {})[p.id]?.display_name || p.display_name)}"><span>${esc(p.role)}</span></div>
      ${TRAITS.map(([k, l, h]) => `<label class="ced-t" title="${h}"><span>${l}</span><input type="range" min="0" max="1" step="0.01" data-k="${k}" value="${b[k]}"><b>${(+b[k]).toFixed(2)}</b></label>`).join('')}</div>`;
  }).join('');
  $$('#crewEdBody input[type=range]').forEach(r => r.oninput = () => { r.nextElementSibling.textContent = (+r.value).toFixed(2); });
  $('#crewEdModal').classList.remove('hidden');
}
async function saveCrewEditor() {
  const seed = await getSeed(), out = {};
  lsSet(YOU_KEY, { on: $('#ceYouOn').checked, seat: $('#ceYouSeat').value });
  $$('#crewEdBody .ced').forEach(el => {
    const p = seed.crew_profiles.find(x => x.id === el.dataset.id), inp = el.querySelector('.ced-name'), name = (inp.disabled ? inp.dataset.orig : inp.value).trim(), base = {};
    el.querySelectorAll('input[type=range]').forEach(r => { const v = +(+r.value).toFixed(2); if (Math.abs(v - p.baseline[r.dataset.k]) > 0.001) base[r.dataset.k] = v; });
    if ((name && name !== p.display_name) || Object.keys(base).length) out[p.id] = { ...(name && name !== p.display_name ? { display_name: name } : {}), baseline: base };
  });
  lsSet(CREW_KEY, out); $('#crewEdModal').classList.add('hidden');
  window.dispatchEvent(new CustomEvent('beyond-horizons:crew-changed'));
  loaded.eva = 0;
  runCrewSim();
}
async function runCrewSim() {
  const out = $('#crewChartWrap'); loading($('#crewCards'), 'RUNNING SIMULATION ENGINE…');
  const body = { mission_id: 'ares-180', countermeasures: (catalog || []).filter(c => $(`#cmList input[value="${c.id}"]`)?.checked) };
  const dest = $('#simDest').value, dur = +$('#simDur').value, delay = +$('#simDelay').value;
  body.mission_overrides = { destination: dest, duration_days: dur, communication_delay_minutes: delay };
  const cc = crewCustom(); body.crew_overrides = Object.entries(cc).map(([id, c]) => ({ id, display_name: c.display_name, ...(c.baseline && Object.keys(c.baseline).length ? { baseline: c.baseline } : {}) }));
  const evIn = $$('#evList input'), evOn = evIn.filter(x => x.checked).map(x => x.value);
  if (evIn.length && evOn.length !== evIn.length) body.active_event_ids = evOn;
  try {
    const isDefault = dest === 'mars_transit' && dur === 180 && delay === 22 && crewIsDefault() && !body.active_event_ids;
    const key = body.countermeasures.map(c => c.id).sort().join('|');
    const r = await apiOr('/api/v1/simulations/run', body, sn => sn.sims[key]);
    simData = applyCrewNames(r.snap ? JSON.parse(JSON.stringify(r.data)) : r.data);
    $('#crewErr').innerHTML = r.snap ? SNAP_NOTE + (isDefault ? '' : '<div class="snap-note warn">Your crew traits, events, destination or duration run on the live simulation engine (data link). It is offline right now, so this shows the default Ares-180 traits with your countermeasures (names are yours).</div>') : '';
    drawCrewChart(); renderCrewCards(); drawBands();
  } catch (e) { errBox($('#crewErr'), e, runCrewSim); $('#crewCards').innerHTML = ''; }
  out.dataset.ready = '1';
}
function canvasCtx(cv) {
  const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
  cv.width = Math.max(10, r.width * dpr); cv.height = Math.max(10, r.height * dpr);
  return [cv.getContext('2d'), cv.width, cv.height, dpr];
}
function drawCrewChart() {
  if (!simData) return;
  const [g, W, H, d] = canvasCtx($('#crewChart')); g.clearRect(0, 0, W, H);
  const L = 50 * d, R = 20 * d, T = 20 * d, B = 36 * d, days = simData.mission.duration_days;
  const X = day => L + (day - 1) / Math.max(1, days - 1) * (W - L - R), Y = v => T + (1 - v) * (H - T - B);
  const bands = [[0, 0.3, 'rgba(45,255,138,0.05)'], [0.3, 0.55, 'rgba(255,176,32,0.05)'], [0.55, 0.75, 'rgba(255,120,40,0.07)'], [0.75, 1, 'rgba(255,59,78,0.08)']];
  bands.forEach(([a, b, c]) => { g.fillStyle = c; g.fillRect(L, Y(b), W - L - R, Y(a) - Y(b)); });
  g.font = `${13 * d}px Rajdhani`; g.fillStyle = '#7ea6c8'; g.strokeStyle = 'rgba(57,198,255,0.12)'; g.lineWidth = 1;
  for (let v = 0; v <= 1.001; v += 0.25) { g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(W - R, Y(v)); g.stroke(); g.fillText(v.toFixed(2), 8 * d, Y(v) + 4 * d); }
  for (let day = 0; day <= days; day += Math.ceil(days / 6 / 10) * 10 || 30) { g.fillText('D' + Math.max(1, day), X(Math.max(1, day)) - 10 * d, H - 12 * d); }
  const md = window.BH?.mission?.();
  if (md && md.key === 'mars' && md.day >= 1 && md.day <= days) { g.strokeStyle = 'rgba(255,255,255,0.55)'; g.setLineDash([6 * d, 5 * d]); g.beginPath(); g.moveTo(X(md.day), T); g.lineTo(X(md.day), H - B); g.stroke(); g.setLineDash([]); g.fillStyle = '#e8f4ff'; g.fillText('MISSION DAY ' + md.day, Math.min(X(md.day) + 6 * d, W - 130 * d), T + 14 * d); }
  g.fillStyle = 'rgba(255,176,32,0.9)'; if (EVA_DAY <= days) { g.fillRect(X(EVA_DAY) - 1 * d, T, 2 * d, H - T - B); g.fillText('EVA', X(EVA_DAY) + 4 * d, H - B - 6 * d); }
  simData.trajectories.forEach((t, i) => {
    g.beginPath(); t.risk_results.forEach((r, j) => { const x = X(r.day), y = Y(r.scores.operational_risk); j ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.strokeStyle = CREW_COL[i % 4]; g.lineWidth = 2.4 * d; g.shadowColor = CREW_COL[i % 4]; g.shadowBlur = 6; g.stroke(); g.shadowBlur = 0;
    t.vulnerability_windows.forEach(w => { g.fillStyle = w.severity === 'critical' ? 'rgba(255,59,78,0.5)' : 'rgba(255,176,32,0.45)'; g.fillRect(X(w.day_start), H - B + 4 * d + i * 5 * d, Math.max(2, X(w.day_end) - X(w.day_start)), 4 * d); });
  });
  $('#crewLegend').innerHTML = simData.trajectories.map((t, i) => `<span><i style="background:${CREW_COL[i % 4]}"></i>${esc(t.display_name)}${t.you ? ' (you)' : ''}</span>`).join('') + '<span class="note-inline">bars under the axis = vulnerability windows</span>';
}
function drawBands() {
  if (!simData) return;
  const order = ['low', 'moderate', 'high', 'critical'], col = { low: '#2dff8a', moderate: '#ffd25a', high: '#ff8a3a', critical: '#ff3b4e' };
  $('#crewBands').innerHTML = simData.trajectories.map(t => {
    const c = simData.band_day_counts[t.crew_id] || {}, tot = order.reduce((a, k) => a + (c[k] || 0), 0) || 1;
    return `<div class="bandrow"><label>${esc(t.display_name)}</label><div class="stack">${order.map(k => c[k] ? `<i style="width:${c[k] / tot * 100}%;background:${col[k]}" title="${k}: ${c[k]} days"></i>` : '').join('')}</div><small>${order.map(k => `${k[0].toUpperCase()}:${c[k] || 0}`).join(' ')}</small></div>`;
  }).join('') + `<div class="band-key">${order.map(k => `<span><i style="background:${col[k]}"></i>${k}</span>`).join('')}</div>`;
}
function renderCrewCards() {
  const prof = Object.fromEntries((simData.crew_profiles || []).map(p => [p.id, p]));
  $('#crewCards').innerHTML = simData.trajectories.map((t, i) => {
    const p = prof[t.crew_id] || {}, peak = t.risk_results.reduce((a, r) => r.scores.operational_risk > a.scores.operational_risk ? r : a, t.risk_results[0]);
    return `<div class="crew${t.you ? ' me' : ''}" style="--c:${CREW_COL[i % 4]}"><h3>${esc(t.display_name)}${t.you ? ' <span class="you-tag">YOU</span>' : ''} <small>${esc(p.role || '')}</small></h3>
      <p>${esc(p.primary_vulnerability || '')}</p>
      <div class="kv"><span>Peak operational risk</span><b class="${ST_CLS[peak.band]}">${pct(peak.scores.operational_risk)} · D${peak.day}</b></div>
      <div class="kv"><span>Top drivers</span><b>${peak.top_drivers.slice(0, 2).map(x => esc(x.name)).join(', ')}</b></div>
      <div class="kv"><span>Vulnerability windows</span><b>${t.vulnerability_windows.map(w => `D${w.day_start}–${w.day_end}`).join(', ') || 'none'}</b></div></div>`;
  }).join('') + `<p class="note">${esc(simData.disclaimer)} Synthetic crew profiles.</p>`;
}

/* ---------------- EVA DECISION + DEBATE ---------------- */
/* EVA ↔ Mission / Crew Risk / Overview scenario link */
const EVA_DAY = 145;
async function crewNames() { try { const s = await getSeed(); return Object.fromEntries(applyCrewCustom(s.crew_profiles).map(p => [p.id, p.display_name])); } catch { return {}; } }
const nameIn = (txt, names) => Object.entries(names).reduce((t, [id, n]) => t.replace(new RegExp(`\\b${id}\\b`, 'gi'), n), txt);
async function renderEvaLink() {
  const box = $('#evaLink'); if (!box || !window.BH) return;
  const m = window.BH.mission(), sc = window.BH.scenario(), names = await crewNames();
  const ares = m.key === 'mars';
  const when = !ares ? `The EVA belongs to the <b>Ares-180</b> Mars mission. The MISSION tab is on another profile.`
    : m.day < 143 ? `Mission day <b>${m.day}</b>: the spacewalk is in <b>${EVA_DAY - m.day} days</b>. Nothing has gone wrong yet.`
    : m.day < EVA_DAY ? `Mission day <b>${m.day}</b>: the <b class="crit">solar storm</b> has hit and the exercise machine is broken. Spacewalk in <b>${EVA_DAY - m.day} day(s)</b>: decide now.`
    : m.day === EVA_DAY ? `Mission day <b>${m.day}</b>: <b class="warn">the spacewalk is TODAY</b>.`
    : `Mission day <b>${m.day}</b>: the spacewalk day (145) has passed. Below is what each option would have meant.`;
  let crew = '';
  if (simData && simData.mission?.duration_days >= EVA_DAY) {
    crew = simData.trajectories.map(t => { const r = t.risk_results.find(x => x.day === EVA_DAY); const v = r?.scores.operational_risk ?? 0;
      return `<span class="el-crew"><i class="${v > 0.55 ? 'crit' : v > 0.35 ? 'warn' : 'ok'}"></i>${esc(t.display_name || names[t.crew_id] || t.crew_id)} <b>${pct(v)}</b></span>`; }).join('');
    crew = `<div class="el-row"><label>Operational risk on day 145 (your Crew Risk run)</label><div>${crew}</div></div>`;
  } else crew = `<div class="el-row"><label>Crew on day 145</label><div class="note">Run <b>CREW RISK</b> to see each crew member's risk on the EVA day.</div></div>`;
  const go = sc.level === 'crit' ? ['crit', 'NO-GO'] : sc.level === 'warn' ? ['warn', 'CAUTION'] : ['ok', 'GO'];
  box.innerHTML = `<div class="evalink">
    <h3>MISSION LINK <span class="tag-sim">SIMULATED</span></h3>
    <p class="el-when">${when}</p>
    ${crew}
    <div class="el-row"><label>Your astronaut right now (Overview scan)</label><div><b class="${go[0]}">${esc(sc.name)}</b> → EVA readiness <b class="${go[0]}">${go[1]}</b>${sc.level !== 'ok' ? ' · a crew member with active alerts should not go outside' : ''}</div></div>
    <div class="el-btns"><button class="hud-btn" id="elDay">${ares ? 'SEE DAY 145 IN MISSION' : 'SWITCH MISSION TO ARES-180, DAY 145'}</button><button class="hud-btn" id="elCrew">OPEN CREW RISK</button></div>
  </div>`;
  $('#elDay').onclick = () => window.BH.goDay(EVA_DAY, 'mars');
  $('#elCrew').onclick = () => window.BH.goTab('crew');
}
addEventListener('beyond-horizons:mission-day', () => { if ($('#view-eva')?.classList.contains('active')) renderEvaLink(); });
async function loadEva() {
  const a = $('#evaAlts'), b = $('#debate');
  loading(a); loading(b);
  renderEvaLink();
  const names = await crewNames();
  try {
    const rc = await apiOr('/api/v1/counterfactual/compare', { mission_id: 'ares-180' }, sn => sn.counterfactual); const cf = rc.data;
    const best = cf.alternatives.reduce((x, y) => y.eva_completion_probability > x.eva_completion_probability ? y : x);
    const bar = (l, v, bad) => `<div class="mbar"><label>${l}<b>${pct(v)}</b></label><div class="bar"><i class="${bad ? (v > 0.55 ? 'crit' : v > 0.35 ? 'warn' : '') : ''}" style="width:${v * 100}%"></i></div></div>`;
    a.innerHTML = cf.alternatives.map(x => `<div class="alt ${x === best ? 'best' : ''}"><h3><span>${x.alternative}</span>${esc(x.description.split(':')[0])}</h3><p>${esc(nameIn(x.description.split(':').slice(1).join(':').trim(), names))}</p>
      <div class="kv"><span>EVA crew · day</span><b>${esc(names[x.eva_crew_id] || x.eva_crew_id)} · D${x.eva_day}</b></div>
      ${bar('EVA completion probability', x.eva_completion_probability)}${bar('Peak operational risk', x.peak_operational_risk, 1)}${bar('Peak cognitive risk', x.peak_cognitive_risk, 1)}${bar('Peak musculoskeletal risk', x.peak_musculoskeletal_risk, 1)}${bar('Mean uncertainty', x.mean_uncertainty, 1)}
      <small>Drivers: ${x.top_drivers.map(esc).join(', ')}</small></div>`).join('') + `<p class="note">${esc(cf.language_note)}</p>`;
    if (rc.snap) a.insertAdjacentHTML('afterbegin', SNAP_NOTE);
  } catch (e) { errBox(a, e, loadEva); }
  try {
    const rd = await apiOr('/api/v1/debate/ares-180', undefined, sn => sn.debate); const d = rd.data;
    const ROLE = { mission_commander: 'MISSION COMMANDER', flight_surgeon: 'FLIGHT SURGEON', science_officer: 'SCIENCE OFFICER', skeptic: 'SKEPTIC' };
    b.innerHTML = `<p class="deb-day">Decision point: EVA on day ${d.day} · alternatives ${d.alternatives.join(' / ')}</p>` + d.recommendations.map(r => `<div class="role ${r.role}"><h3>${ROLE[r.role] || esc(r.role)}<span class="rec">${r.recommendation ? 'RECOMMENDS ' + r.recommendation : 'NO VOTE'}</span></h3>
      <p>${esc(nameIn(r.justification, names))}</p>${r.confidence != null ? `<small>Confidence ${pct(r.confidence)}${r.utility != null ? ' · utility ' + r.utility.toFixed(3) : ''}</small>` : ''}
      ${r.limitations?.length ? `<details><summary>Limitations</summary><ul>${r.limitations.map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>` : ''}</div>`).join('') +
      (d.disagreement_summary ? `<p class="note">${esc(d.disagreement_summary)}</p>` : '') + `<p class="note">${esc(d.disclaimer)}</p>`;
    if (rd.snap) b.insertAdjacentHTML('afterbegin', SNAP_NOTE);
  } catch (e) { errBox(b, e, loadEva); }
}

/* ---------------- RESEARCH: evidence graph + navigator ---------------- */
const LV_COL = { supported_evidence: '#2dff8a', data_supported_association: '#39c6ff', exploratory_hypothesis: '#ffb020', synthetic_parameter: '#c78bff' };
const LV_TXT = { supported_evidence: 'Supported evidence', data_supported_association: 'Data-supported association', exploratory_hypothesis: 'Exploratory hypothesis', synthetic_parameter: 'Synthetic parameter' };
let graph = null, gLayout = null, gHover = null;
async function loadResearch() {
  loading($('#rankings')); $('#egDetail').innerHTML = '<p class="note">Click a node or a link in the graph to see its evidence, source and limitations.</p>';
  try {
    const rg = await apiOr('/api/v1/evidence/graph', undefined, sn => sn.graph); graph = rg.data;
    $('#egErr').innerHTML = rg.snap ? SNAP_NOTE : '';
    layoutGraph(); drawGraph();
    const cnt = k => gLayout.edges.filter(e => e.evidence_level === k).length;
    $('#egLegend').innerHTML = `<span><b>${gLayout.nodes.length} factors · ${gLayout.edges.length} links</b></span>` + Object.keys(LV_COL).filter(k => cnt(k)).map(k => `<span><i style="background:${LV_COL[k]}"></i>${LV_TXT[k]} (${cnt(k)})</span>`).join('');
  } catch (e) { errBox($('#egErr'), e, loadResearch); }
  try {
    const rr = await apiOr('/api/v1/research-navigator/rankings', undefined, sn => sn.rankings); const r = rr.data;
    const mx = Math.max(...r.proposals.map(p => p.priority));
    $('#rankings').innerHTML = `<p class="formula">${esc(r.priority_formula)}</p>` + r.proposals.map((p, i) => `<div class="prop"><h3><span>#${i + 1}</span>${esc(p.title)}<b>${p.priority.toFixed(3)}</b></h3><div class="bar"><i style="width:${p.priority / mx * 100}%"></i></div>
      <p>${esc(p.gap_description)}</p><small>impact ${p.mission_impact} · uncertainty ${p.uncertainty} · info gain ${p.expected_information_gain} · cost ${p.relative_cost}</small>
      ${p.limitations?.length ? `<details><summary>Limitations</summary><ul>${p.limitations.map(l => `<li>${esc(l)}</li>`).join('')}</ul></details>` : ''}</div>`).join('') + `<p class="note">${esc(r.language_note)}</p>`;
    if (rr.snap) $('#rankings').insertAdjacentHTML('afterbegin', SNAP_NOTE);
  } catch (e) { errBox($('#rankings'), e, loadResearch); }
}
function layoutGraph() {
  const nodes = graph.elements.nodes.map(n => n.data), edges = graph.elements.edges.map(e => e.data);
  // layered layout: column = longest path from a source node; rows ordered to reduce crossings
  const depth = Object.fromEntries(nodes.map(n => [n.id, 0]));
  for (let it = 0; it < nodes.length; it++) edges.forEach(e => { depth[e.target] = Math.max(depth[e.target], depth[e.source] + 1); });
  const cols = {}; nodes.forEach(n => (cols[depth[n.id]] ||= []).push(n));
  const keys = Object.keys(cols).map(Number).sort((a, b) => a - b), nc = keys.length, row = {};
  keys.forEach(c => cols[c].forEach((n, i) => { row[n.id] = i / Math.max(1, cols[c].length - 1); }));
  for (let pass = 0; pass < 4; pass++) keys.forEach(c => {
    cols[c].forEach(n => { const nb = edges.filter(e => e.target === n.id || e.source === n.id).map(e => row[e.target === n.id ? e.source : e.target]); n._bc = nb.length ? nb.reduce((a, b) => a + b) / nb.length : row[n.id]; });
    cols[c].sort((a, b) => a._bc - b._bc).forEach((n, i) => { row[n.id] = i / Math.max(1, cols[c].length - 1); });
  });
  const pos = {};
  keys.forEach((c, ci) => cols[c].forEach((n, i) => { pos[n.id] = { x: (ci + 0.5) / nc, y: (i + 0.5) / cols[c].length }; }));
  gLayout = { nodes, edges, pos, nc };
}
function wrapLabel(g, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur); return lines;
}
function drawGraph() {
  if (!gLayout) return;
  const cv = $('#egCanvas'), [g, W, H, d] = canvasCtx(cv); g.clearRect(0, 0, W, H);
  const padX = 12 * d, colW = (W - 2 * padX) / gLayout.nc;
  const P = id => ({ x: padX + gLayout.pos[id].x * (W - 2 * padX), y: 24 * d + gLayout.pos[id].y * (H - 48 * d) });
  gLayout.screen = { P, d };
  let fs = 15; g.font = `600 ${fs * d}px Rajdhani`;
  const maxW = colW - 26 * d, lh = 16 * d;
  gLayout.nodes.forEach(n => {
    const lines = wrapLabel(g, n.label, maxW - 16 * d), w = Math.min(maxW, Math.max(...lines.map(l => g.measureText(l).width)) + 18 * d), h = lines.length * lh + 10 * d, p = P(n.id);
    n._lines = lines; n._box = { x: p.x - w / 2, y: p.y - h / 2, w, h };
  });
  gLayout.edges.forEach(e => {
    const A = gLayout.nodes.find(n => n.id === e.source)._box, B = gLayout.nodes.find(n => n.id === e.target)._box;
    const a = { x: A.x + A.w, y: A.y + A.h / 2 }, b = { x: B.x - 2 * d, y: B.y + B.h / 2 };
    const hot = gHover && (gHover.id === e.id || gHover.id === e.source || gHover.id === e.target);
    g.strokeStyle = LV_COL[e.evidence_level] || '#888'; g.globalAlpha = gHover && !hot ? 0.2 : 0.9;
    g.lineWidth = (1 + e.weight * 3) * d; g.setLineDash(e.evidence_level === 'exploratory_hypothesis' || e.evidence_level === 'synthetic_parameter' ? [6 * d, 5 * d] : []);
    const mx = (a.x + b.x) / 2;
    g.beginPath(); g.moveTo(a.x, a.y); g.bezierCurveTo(mx, a.y, mx, b.y, b.x - 8 * d, b.y); g.stroke();
    g.setLineDash([]); g.fillStyle = g.strokeStyle;
    g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - 10 * d, b.y - 5 * d); g.lineTo(b.x - 10 * d, b.y + 5 * d); g.fill();
    e._a = a; e._b = b;
  });
  g.globalAlpha = 1; g.textAlign = 'center';
  gLayout.nodes.forEach(n => {
    const b = n._box, hot = gHover && gHover.id === n.id;
    g.fillStyle = hot ? 'rgba(57,198,255,0.45)' : 'rgba(6,26,56,0.95)'; g.strokeStyle = '#39c6ff'; g.lineWidth = 1.5 * d;
    g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 5 * d); g.fill(); g.stroke();
    g.fillStyle = '#eaf6ff'; n._lines.forEach((l, i) => g.fillText(l, b.x + b.w / 2, b.y + 5 * d + lh * (i + 0.78)));
  });
}
function graphHit(ev) {
  if (!gLayout?.screen) return null;
  const cv = $('#egCanvas'), r = cv.getBoundingClientRect(), d = gLayout.screen.d;
  const x = (ev.clientX - r.left) / r.width * cv.width, y = (ev.clientY - r.top) / r.height * cv.height;
  for (const n of gLayout.nodes) { const b = n._box; if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return { type: 'node', id: n.id, n }; }
  let best = null, bd = 12 * d;
  for (const e of gLayout.edges) {
    const a = e._a || gLayout.screen.P(e.source), b = e._b || gLayout.screen.P(e.target);
    for (let t = 0; t <= 1; t += 0.05) { const mx = (a.x + b.x) / 2, u = 1 - t;
      const px = u * u * u * a.x + 3 * u * u * t * mx + 3 * u * t * t * mx + t * t * t * b.x, py = u * u * u * a.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t * t * t * b.y;
      const dd = Math.hypot(px - x, py - y); if (dd < bd) { bd = dd; best = { type: 'edge', id: e.id, e }; } }
  }
  return best;
}
function showGraphDetail(hit) {
  const el = $('#egDetail'); if (!hit) return;
  const lab = id => gLayout.nodes.find(n => n.id === id)?.label || id;
  if (hit.type === 'node') {
    const n = hit.n, links = gLayout.edges.filter(e => e.source === n.id || e.target === n.id);
    el.innerHTML = `<h3>${esc(n.label)} <small>${esc(n.category)}</small></h3><p>${esc(n.description)}</p><h4>LINKS</h4><ul>${links.map(e => `<li><b style="color:${LV_COL[e.evidence_level]}">${LV_TXT[e.evidence_level]}</b> — ${esc(lab(e.source))} → ${esc(lab(e.target))}</li>`).join('')}</ul>${(() => { const ids = [...new Set(links.flatMap(e => refIds(e.evidence_reference)))]; return ids.length ? `<h4>NASA SOURCES</h4><div class="srcrow">${chips(ids)}</div>` : ''; })()}`;
  } else {
    const e = hit.e;
    el.innerHTML = `<h3>${esc(lab(e.source))} → ${esc(lab(e.target))}</h3><p><b style="color:${LV_COL[e.evidence_level]}">${LV_TXT[e.evidence_level]}</b> · ${esc(e.relation)} · weight ${e.weight} · uncertainty ${e.uncertainty}</p><p class="ref">Source: ${esc(e.evidence_reference)}</p>${refIds(e.evidence_reference).length ? `<div class="srcrow">${chips(refIds(e.evidence_reference))}</div>` : ''}${e.limitations?.length ? `<h4>LIMITATIONS</h4><ul>${e.limitations.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}`;
  }
}

/* ---------------- GENETICS: real gene-expression table ---------------- */
async function loadGenes() {
  const el = $('#realGenes'); loading(el);
  try {
    const rgn = await apiOr('/api/v1/evidence/gene-expression', undefined, sn => sn.genes); const g = rgn.data;
    const lg = v => Math.log10(1 + Math.max(0, v || 0)), mx = Math.max(...g.records.map(r => lg(r.fold_change_9gy_vs_control)));
    el.innerHTML = `<div class="osd-card"><b>NASA OSDR · OSD-720 / GLDS-699</b> <button class="src" data-src="osd720">dataset</button> <button class="src" data-src="twins">NASA Twins Study</button><p>Mouse left-ventricle transcriptome (RNA-seq, n = 60) after NSRL simulated galactic cosmic rays or gamma radiation — a NASA Human Research Program dataset linking space radiation to lasting cardiac gene-expression changes. Ground-based simulated radiation, not spaceflight.</p></div>
      <p class="cite">${esc(g.study_citation)} <button class="src" data-src="nag9_1024">NAG9-1024</button></p><p class="meta">${esc(g.organism)} · ${esc(g.tissue)} · ${esc(g.radiation_condition)} · ${esc(g.timepoint)}</p>
      <table class="gtab"><tr><th>GENE</th><th>CATEGORY</th><th>CONTROL</th><th>9 Gy</th><th>9 Gy + VIT A</th><th>FOLD CHANGE (9 Gy, log bar)</th><th>VIT A REDUCED</th></tr>
      ${g.records.map(r => `<tr><td><b>${esc(r.gene_symbol)}</b><small>${esc(r.accession)}</small></td><td>${esc(r.category.replace(/_/g, ' '))}</td><td>${r.control.toLocaleString()}</td><td>${r.dose_9gy.toLocaleString()}</td><td>${r.dose_9gy_plus_vitamin_a.toLocaleString()}</td>
        <td><div class="fc"><i style="width:${lg(r.fold_change_9gy_vs_control) / mx * 100}%"></i><b>${r.fold_change_9gy_vs_control ?? '—'}×</b></div></td><td class="${r.vitamin_a_reduced_the_9gy_effect ? 'ok' : ''}">${r.vitamin_a_reduced_the_9gy_effect ? 'YES' : 'NO'}</td></tr>`).join('')}</table>
      <p class="note">${esc(g.evidence_reference)} — ${g.limitations.map(esc).join(' ')}</p>`;
    if (rgn.snap) el.insertAdjacentHTML('afterbegin', SNAP_NOTE);
  } catch (e) { errBox(el, e, loadGenes); }
}

/* ---------------- AI ASSISTANT ---------------- */
let chat = lsGet(KEYS.chat, []);
let aiStatus = null;
function vitalsSummary() {
  const h = lsGet(KEYS.vitals, []), r = h[h.length - 1];
  const lines = [];
  if (r) {
    lines.push(`Recorded ${new Date(r.recorded_at).toLocaleString()}. Overall status: ${r.evaluation.overall_status}.`);
    r.evaluation.metrics.forEach(m => lines.push(`- ${m.label}: ${m.metric_id === 'heart_rhythm' ? (m.value ? 'regular' : 'irregular') : m.value + (m.unit ? ' ' + m.unit : '')} (${m.status})`));
    if (r.entry.body_mass_kg) lines.push(`- Body mass: ${r.entry.body_mass_kg}kg`);
  }
  lines.push(`HUD monitor (simulated scenario "${ctx.hudSummary().scenario}"): ${ctx.hudSummary().text}`);
  return lines.join('\n').slice(0, 1990);
}
function renderChat() {
  const box = $('#chatLog');
  box.innerHTML = chat.length ? chat.map(t => `<div class="msg ${t.role}"><b>${t.role === 'user' ? 'YOU' : 'BEYOND AI'}</b><p>${esc(t.content).replace(/\n/g, '<br>')}</p></div>`).join('')
    : `<div class="msg assistant"><b>BEYOND AI</b><p>Ask about the crew's health, the current scan, your own saved vitals or the evidence behind any risk. Answers are grounded only in this platform's data.</p></div>`;
  box.scrollTop = box.scrollHeight;
}
async function openChat(prefill) {
  $('#chatModal').classList.remove('hidden'); renderChat();
  if (prefill) { $('#chatIn').value = prefill; }
  $('#chatIn').focus();
  if (!aiStatus) {
    try { aiStatus = await api('/api/v1/assistant/status'); } catch (e) { aiStatus = { configured: false, notice: API ? 'The data link is offline right now (a free-tier backend can take ~30 s to wake up). Try again shortly.' : 'Beyond AI runs on the live data link, which is not connected on this copy of the HUD. Open the HUD inside the full platform (3D Health HUD) to chat.' }; }
    $('#chatState').innerHTML = aiStatus.configured ? `<span class="ok">● ONLINE</span> ${esc(aiStatus.model || '')}` : `<span class="warn">● OFFLINE</span> ${esc(aiStatus.notice || '')}`;
  }
}
async function sendChat() {
  const inp = $('#chatIn'), msg = inp.value.trim(); if (!msg) return;
  inp.value = ''; const history = chat.slice(-12);
  chat.push({ role: 'user', content: msg }); renderChat();
  $('#chatLog').insertAdjacentHTML('beforeend', '<div class="msg assistant pending"><b>BEYOND AI</b><p>…</p></div>');
  try {
    const r = await api('/api/v1/assistant/ask', { message: msg, history, vitals_summary: vitalsSummary() });
    chat.push({ role: 'assistant', content: r.answer });
  } catch (e) { chat.push({ role: 'assistant', content: '⚠ ' + (API ? e.message : 'Beyond AI is not connected on this copy of the HUD (no data link). Your message is saved; open the HUD inside the full platform to get an answer.') }); }
  chat = chat.slice(-60); lsSet(KEYS.chat, chat); renderChat();
}

/* ---------------- wiring ---------------- */
let ctx;
const loaded = {};
export function onTab(name) {
  if (name === 'myvitals') { renderHistory(); requestAnimationFrame(renderVTrend); }
  if (name === 'crew' && !loaded.crew) { loaded.crew = 1; Promise.all([loadCrewControls(), renderEvents()]).then(runCrewSim); }
  else if (name === 'crew') requestAnimationFrame(() => { drawCrewChart(); });
  if (name === 'eva' && !loaded.eva) { loaded.eva = 1; loadEva(); }
  else if (name === 'eva') renderEvaLink();
  if (name === 'research') { if (!loaded.research) { loaded.research = 1; loadResearch(); } else requestAnimationFrame(drawGraph); }
  if (name === 'genetics' && !loaded.genes) { loaded.genes = 1; loadGenes(); }
}
export function logScan(rec) {
  const s = lsGet(KEYS.scans, []); s.push({ ...rec, at: new Date().toISOString() }); lsSet(KEYS.scans, s.slice(-200));
}
export function initResearch(c) {
  ctx = c;
  buildVitalsForm(); renderHistory();
  $('#vTrendSel').innerHTML = Object.entries(TREND_METRICS).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('');
  $('#vTrendSel').onchange = renderVTrend;
  $('#vExport').onclick = exportHistory; $('#vImport').onclick = importHistory;
  $('#runSim').onclick = runCrewSim;
  $('#editCrew').onclick = openCrewEditor;
  $('#crewEdSave').onclick = saveCrewEditor;
  $('#crewEdReset').onclick = () => { lsSet(CREW_KEY, {}); lsSet(YOU_KEY, {}); openCrewEditor(); window.dispatchEvent(new CustomEvent('beyond-horizons:crew-changed')); };
  $('#crewEdModal').addEventListener('click', e => { if (e.target.id === 'crewEdModal') e.target.classList.add('hidden'); });
  const cv = $('#egCanvas');
  cv.onmousemove = e => { const h = graphHit(e); const id = h?.id || null; if (id !== gHover?.id) { gHover = h; drawGraph(); } cv.style.cursor = h ? 'pointer' : 'default'; };
  cv.onclick = e => showGraphDetail(graphHit(e));
  $('#aiOpen').onclick = () => openChat();
  $('#aiAsk').onclick = () => openChat(`Explain the current scan result (${ctx.hudSummary().scenario}) and what the crew should do next.`);
  $('#chatSend').onclick = sendChat;
  $('#chatIn').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } };
  $('#chatClear').onclick = () => { chat = []; lsSet(KEYS.chat, chat); renderChat(); };
  $('#chatX').onclick = () => $('#chatModal').classList.add('hidden');
  $('#chatModal').onclick = e => { if (e.target.id === 'chatModal') $('#chatModal').classList.add('hidden'); };
  addEventListener('storage', e => { if (e.key === KEYS.vitals || e.key === KEYS.scans) renderHistory(); });
  addEventListener('resize', () => { drawCrewChart(); drawGraph(); renderVTrend(); });
  checkLink();
  // if the person already saved vitals (here or in the main app on the same domain), offer them to the HUD
  const h = lsGet(KEYS.vitals, []);
  if (h.length) ctx.registerSelfVitals(h[h.length - 1].entry, h[h.length - 1].evaluation);
}

/* shared data for the gene simulator */
export async function getGenesData() { return (await apiOr('/api/v1/evidence/gene-expression', undefined, sn => sn.genes)).data; }
export async function getMissionData() { const d = await getSeed(); return { ...d, crew_profiles: applyCrewCustom(d.crew_profiles) }; }
addEventListener('beyond-horizons:mission-day', () => { if ($('#view-crew')?.classList.contains('active')) drawCrewChart(); });

addEventListener('beyond-horizons:name-changed', () => {
  if (simData) { applyCrewNames(simData); drawCrewChart(); renderCrewCards(); drawBands(); }
  loaded.eva = 0; if ($('#view-eva')?.classList.contains('active')) { loaded.eva = 1; loadEva(); }
  window.dispatchEvent(new CustomEvent('beyond-horizons:crew-changed'));
});
