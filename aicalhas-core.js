/* =====================================================================
   AiCalhas — núcleo da demonstração interativa
   ---------------------------------------------------------------------
   JavaScript puro, sem frameworks, sem backend e sem internet.
   Responsável por: login demonstrativo, troca de perfis, menus,
   telas, formulários, modais, avisos, relatórios, histórico (logs)
   e reinício da demonstração. Cada cenário (cenario-N.js) informa
   apenas seus dados fictícios, telas e ações.
   Os dados ficam na memória do navegador (sessionStorage), por aba.
   ===================================================================== */
(function () {
  'use strict';

  const AiC = (window.AiC = {});
  const S = { cfg: null, st: null, ui: null, key: '', formExtra: {}, formCalc: null, pendingOk: null, catalogs: {} };

  /* ------------------------------------------------------------------
     Utilidades gerais
     ------------------------------------------------------------------ */
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pad = (n) => String(n).padStart(2, '0');
  const D = (v) => (v instanceof Date ? v : new Date(v));
  AiC.esc = esc;
  AiC.clone = clone;

  /** Data relativa a hoje (deslocamento em dias e horário "HH:MM"), em ISO.
      Para o dia de hoje, o horário é ancorado ao momento atual (referência 13:30),
      para que prazos e sequências façam sentido em qualquer horário da apresentação. */
  AiC.d = function (offsetDays, hm) {
    if (!offsetDays && hm) {
      const p0 = String(hm).split(':');
      const delta = (+p0[0] * 60 + (+p0[1] || 0)) - 810;
      let t0 = new Date(Date.now() + delta * 6e4);
      // Compromissos futuros que cairiam fora do horário comercial vão para o dia seguinte
      if (delta > 0 && (t0.getHours() >= 19 || t0.getHours() < 7 || t0.getDate() !== new Date().getDate())) {
        t0 = new Date(); t0.setDate(t0.getDate() + 1); t0.setHours(+p0[0] || 9, +p0[1] || 0, 0, 0);
      }
      t0.setSeconds(0, 0);
      return t0.toISOString();
    }
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + (offsetDays || 0));
    const p = String(hm || '09:00').split(':');
    t.setHours(+p[0] || 0, +p[1] || 0, 0, 0);
    return t.toISOString();
  };
  AiC.now = () => new Date().toISOString();
  AiC.fd = (v) => (v ? pad(D(v).getDate()) + '/' + pad(D(v).getMonth() + 1) + '/' + D(v).getFullYear() : '—');
  AiC.fds = (v) => (v ? pad(D(v).getDate()) + '/' + pad(D(v).getMonth() + 1) : '—');
  AiC.ft = (v) => (v ? pad(D(v).getHours()) + ':' + pad(D(v).getMinutes()) : '');
  AiC.fdt = (v) => (v ? AiC.fd(v) + ' ' + AiC.ft(v) : '—');
  AiC.fdtn = (v) => '<span class="nowrap">' + AiC.fdt(v) + '</span>';
  const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  AiC.dayDiff = (v) => {
    const a = new Date(); a.setHours(0, 0, 0, 0);
    const b = new Date(D(v).getTime()); b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / 864e5);
  };
  AiC.when = (v, withTime) => {
    if (!v) return '—';
    const dd = AiC.dayDiff(v);
    const t = withTime === false ? '' : ' ' + AiC.ft(v);
    if (dd === 0) return 'Hoje' + t;
    if (dd === 1) return 'Amanhã' + t;
    if (dd === -1) return 'Ontem' + t;
    return WD[D(v).getDay()] + ', ' + AiC.fds(v) + t;
  };
  AiC.ago = (v) => {
    const m = Math.round((Date.now() - D(v)) / 6e4);
    if (m < 1) return 'agora';
    if (m < 60) return 'há ' + m + ' min';
    const h = Math.round(m / 60);
    if (h < 24) return 'há ' + h + ' h';
    const d = Math.round(h / 24);
    return 'há ' + d + (d === 1 ? ' dia' : ' dias');
  };
  AiC.hoursSince = (v) => (Date.now() - D(v)) / 36e5;
  AiC.money = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  AiC.kmoney = (n) => (Math.abs(n) >= 1000 ? 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : AiC.money(n));
  AiC.num = (n, dec) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  AiC.pct = (a, b) => (b ? Math.round((a / b) * 100) : 0) + '%';
  AiC.sum = (arr, f) => arr.reduce((s, x) => s + (Number(typeof f === 'function' ? f(x) : x[f]) || 0), 0);
  AiC.avg = (arr, f) => (arr.length ? AiC.sum(arr, f) / arr.length : 0);
  AiC.nextId = (prefix, list) => {
    let max = 0;
    list.forEach((x) => { const id = String(x.id || ''); const m = id.match(/(\d+)$/); if (id.indexOf(prefix) === 0 && m) max = Math.max(max, +m[1]); });
    return prefix + (max + 1);
  };
  AiC.initials = (name) => String(name || '?').replace(/^(Cond\.|Condomínio|Escola|Padaria|Clínica)\s+/i, '').split(/\s+/).filter((p) => /^[A-ZÀ-Ý0-9]/.test(p)).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
  AiC.count = (arr, fn) => { const m = {}; arr.forEach((x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; }); return m; };
  AiC.toBars = (obj, money) => Object.keys(obj).map((k) => ({ l: k, v: obj[k] })).sort((a, b) => b.v - a.v);
  AiC.rng = function (seed) { let s = seed || 7; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
  AiC.first = (name) => String(name || '').split(' ')[0];

  /* ------------------------------------------------------------------
     Ícones (traço, 24x24)
     ------------------------------------------------------------------ */
  const IC = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.6c2 .7 3.3 2.5 3.8 5.4"/>',
    tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.5 7.2L4 20.5l1.3-4.8A8 8 0 1 1 21 12z"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 11h6M9 15h4"/>',
    chart: '<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
    money: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v.01M18 14.5v.01"/>',
    wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><path d="M16 14h.01"/>',
    truck: '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    box: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h12l2-8H6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M15 16l4-4-4-4M19 12H9"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    alert: '<path d="M12 3L2 20h20z"/><path d="M12 10v4M12 17v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    arrowL: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    arrowR: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    send: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
    flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
    route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
    store: '<path d="M3 9l2-5h14l2 5"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    scale: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    gutter: '<path d="M3 8h18"/><path d="M4 8v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8"/><path d="M16 14v7"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    thumb: '<path d="M7 11v9H4v-9z"/><path d="M7 11l4-8a2 2 0 0 1 2.5 2.6L12.5 10H19a2 2 0 0 1 2 2.3l-1.3 6A2 2 0 0 1 17.7 20H7"/>',
    swap: '<path d="M7 4L3 8l4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/>',
  };
  AiC.icon = (n, s) => '<svg class="i" width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || IC.info) + '</svg>';
  const icon = AiC.icon;

  AiC.logo = (light) => '<span class="logo' + (light ? ' light' : '') + '"><svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true"><path d="M20 3.5s8.2 8.8 8.2 14.5a8.2 8.2 0 0 1-16.4 0C11.8 12.3 20 3.5 20 3.5z" fill="#3fb0e6"/><path d="M4 24.5h32v3.8a7 7 0 0 1-7 7H11a7 7 0 0 1-7-7z" fill="#c26d38"/><path d="M4 24.5h32" stroke="#e8a06a" stroke-width="2.2"/></svg><b>Ai<span>Calhas</span></b></span>';

  /* ------------------------------------------------------------------
     Ilustrações (fotos fictícias de obras de calhas)
     ------------------------------------------------------------------ */
  const ILL = {
    'calha-frontal': { l: 'Calha frontal', sky: ['#8ec5e8', '#e6f3fb'], wall: '#efe5d6', roof: '#b45a34', g: 'galv', pipe: 1 },
    condutor: { l: 'Condutor / descida', sky: ['#a7c7dc', '#eef5f9'], wall: '#e7ecf0', roof: '#6b7a88', g: 'galv', pipe: 2 },
    rufo: { l: 'Rufo em platibanda', sky: ['#b7d3e6', '#f2f7fb'], wall: '#f1ece4', roof: '#9c4a2c', g: 'galv', rufo: 1 },
    'calha-cobre': { l: 'Calha de cobre', sky: ['#f0c497', '#fbeee0'], wall: '#f4efe8', roof: '#5d4037', g: 'copper', pipe: 1 },
    aluminio: { l: 'Calha de alumínio', sky: ['#9fd0e9', '#eaf6fc'], wall: '#dfe7ee', roof: '#37474f', g: 'white', pipe: 1 },
    vazamento: { l: 'Vazamento na emenda', sky: ['#7d93a6', '#cfdbe4'], wall: '#e7dfd2', roof: '#a35233', g: 'galv', leak: 1 },
    limpeza: { l: 'Calha com folhas', sky: ['#a9d4b8', '#eef8f1'], wall: '#efe7da', roof: '#8d4b2e', g: 'galv', leaves: 1 },
    obra: { l: 'Foto com marca de terceiros', sky: ['#c9d6e2', '#f3f6f9'], wall: '#d9d4cc', roof: '#7b8794', g: 'galv', mark: 1, pipe: 1 },
  };
  AiC.ILL = ILL;
  function illus(key) {
    const o = ILL[key] || ILL['calha-frontal'];
    const k = 'il' + Object.keys(ILL).indexOf(key in ILL ? key : 'calha-frontal');
    const gm = { galv: ['#d3dbe2', '#8a97a2'], copper: ['#eaa874', '#a1572a'], white: ['#ffffff', '#c8d0d7'] }[o.g];
    let s = '<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(o.l) + '">';
    s += '<defs><linearGradient id="' + k + 's" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + o.sky[0] + '"/><stop offset="1" stop-color="' + o.sky[1] + '"/></linearGradient>';
    s += '<linearGradient id="' + k + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + gm[0] + '"/><stop offset="1" stop-color="' + gm[1] + '"/></linearGradient>';
    s += '<linearGradient id="' + k + 'p" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + gm[1] + '"/><stop offset=".45" stop-color="' + gm[0] + '"/><stop offset="1" stop-color="' + gm[1] + '"/></linearGradient>';
    s += '<pattern id="' + k + 't" width="22" height="12" patternUnits="userSpaceOnUse"><rect width="22" height="12" fill="' + o.roof + '"/><path d="M0 12 Q11 1 22 12" fill="none" stroke="rgba(0,0,0,.24)" stroke-width="1.6"/></pattern></defs>';
    s += '<rect width="320" height="200" fill="url(#' + k + 's)"/>';
    s += '<rect x="0" y="104" width="320" height="96" fill="' + o.wall + '"/>';
    s += '<rect x="40" y="132" width="56" height="44" rx="2" fill="#9db7c8" stroke="#fff" stroke-width="4"/><path d="M68 132v44" stroke="#fff" stroke-width="3"/>';
    if (o.rufo) s += '<rect x="196" y="14" width="140" height="92" fill="#ebe4d9"/><path d="M190 10h146v8H198l-8 7z" fill="url(#' + k + 'g)" stroke="rgba(0,0,0,.15)"/><path d="M196 92l-14 6" stroke="url(#' + k + 'g)" stroke-width="6"/>';
    s += '<path d="M-10 92L28 30H' + (o.rufo ? '196' : '292') + 'L' + (o.rufo ? '196 92' : '330 92') + 'Z" fill="url(#' + k + 't)"/>';
    s += '<rect x="-10" y="90" width="340" height="9" fill="rgba(0,0,0,.18)"/>';
    s += '<path d="M-6 97H326V106Q326 114 318 114H2Q-6 114-6 106Z" fill="url(#' + k + 'g)" stroke="rgba(0,0,0,.18)"/><path d="M-6 98.5H326" stroke="rgba(255,255,255,.65)" stroke-width="1.5"/>';
    if (o.pipe) { const x = o.pipe === 2 ? 150 : 258; s += '<rect x="' + x + '" y="112" width="14" height="92" fill="url(#' + k + 'p)" stroke="rgba(0,0,0,.15)"/><rect x="' + (x - 2) + '" y="142" width="18" height="5" rx="1" fill="rgba(0,0,0,.2)"/><rect x="' + (x - 2) + '" y="178" width="18" height="5" rx="1" fill="rgba(0,0,0,.2)"/>'; }
    if (o.leak) {
      s += '<ellipse cx="128" cy="160" rx="18" ry="46" fill="rgba(60,80,100,.16)"/><path d="M122 112h12" stroke="#6d4b33" stroke-width="3"/>';
      s += '<path d="M128 114q-4 7 0 10q4-3 0-10z" fill="#3d9ad6"/><circle cx="128" cy="136" r="2.6" fill="#3d9ad6"/><circle cx="129" cy="156" r="2.2" fill="#3d9ad6"/><circle cx="127" cy="176" r="2" fill="#3d9ad6"/>';
      for (let i = 0; i < 14; i++) s += '<path d="M' + (i * 23 + 6) + ' ' + ((i * 37) % 70) + 'l-4 14" stroke="rgba(255,255,255,.55)" stroke-width="1.4"/>';
    }
    if (o.leaves) { const cs = ['#5b8c3a', '#a3762b', '#7aa03f', '#8c5a24']; for (let i = 0; i < 16; i++) s += '<ellipse cx="' + (i * 21 + 8) + '" cy="' + (96 - (i % 3) * 2) + '" rx="7" ry="3.2" fill="' + cs[i % 4] + '" transform="rotate(' + ((i * 47) % 60 - 30) + ' ' + (i * 21 + 8) + ' ' + (96 - (i % 3) * 2) + ')"/>'; }
    if (o.mark) s += '<g transform="rotate(-14 160 120)" fill="rgba(255,255,255,.82)" font-family="Arial,sans-serif" font-weight="700"><text x="160" y="96" text-anchor="middle" font-size="24">CALHAS XYZ ®</text><text x="160" y="122" text-anchor="middle" font-size="14">(11) 9xxxx-xxxx</text></g>';
    s += '</svg>';
    return s;
  }
  AiC.illus = illus;
  /** Foto: aceita uma chave de ilustração ou uma imagem enviada (data URL). */
  AiC.photo = (p, cap, tag, cls) => {
    const inner = String(p || '').indexOf('data:') === 0 ? '<img src="' + p + '" alt="' + esc(cap || 'Foto enviada') + '">' : illus(p);
    return '<span class="pimg ' + (cls || '') + '">' + inner + (tag ? '<span class="tag">' + tag + '</span>' : '') + (cap ? '<span class="cap">' + esc(cap) + '</span>' : '') + '</span>';
  };
  AiC.zoomable = (p, cap, tag) => '<button type="button" class="zoom" style="border:0;padding:0;background:none;display:block;width:100%" data-act="core.zoom" data-cap="' + esc(cap || '') + '">' + AiC.photo(p, cap, tag) + '</button>';

  /* ------------------------------------------------------------------
     Base de dados fictícia comum aos cenários
     ------------------------------------------------------------------ */
  AiC.USERS = {
    cliente: { nome: 'Mariana Costa', sub: 'Proprietária de residência em Campinas/SP', email: 'mariana.costa@email.demo', ref: 'CLI-201', cor: '#a8326e' },
    profissional: { nome: 'Carlos Mendes', sub: 'Mendes Calhas & Coberturas', email: 'carlos@mendescalhas.demo', ref: 'PRF-101', cor: '#0f6f86' },
    mediador: { nome: 'Juliana Rocha', sub: 'Mediadora de operações AiCalhas', email: 'juliana.rocha@aicalhas.demo', ref: 'MED-01', cor: '#b8612e' },
  };
  AiC.base = function () {
    const d = AiC.d;
    return {
      cidades: ['Campinas', 'Valinhos', 'Vinhedo', 'Sumaré', 'Hortolândia', 'Paulínia', 'Indaiatuba', 'Jundiaí', 'Americana'],
      servicos: [
        { id: 'SRV-01', nome: 'Instalação de calhas', desc: 'Calhas novas sob medida (galvanizada, alumínio, PVC ou cobre).', ativo: true },
        { id: 'SRV-02', nome: 'Troca de calhas', desc: 'Substituição de trechos ou de toda a calha danificada.', ativo: true },
        { id: 'SRV-03', nome: 'Conserto de vazamentos', desc: 'Correção de emendas, furos e pontos de infiltração.', ativo: true },
        { id: 'SRV-04', nome: 'Limpeza e desentupimento', desc: 'Remoção de folhas e detritos, teste de escoamento.', ativo: true },
        { id: 'SRV-05', nome: 'Rufos e pingadeiras', desc: 'Proteção de muros, platibandas e encontros de telhado.', ativo: true },
        { id: 'SRV-06', nome: 'Condutores e descidas', desc: 'Instalação e troca de condutores de águas pluviais.', ativo: true },
        { id: 'SRV-07', nome: 'Manutenção preventiva', desc: 'Revisão periódica de calhas, rufos e condutores.', ativo: true },
      ],
      pros: [
        { id: 'PRF-101', nome: 'Carlos Mendes', empresa: 'Mendes Calhas & Coberturas', cidade: 'Campinas', regioes: ['Campinas', 'Valinhos', 'Sumaré', 'Hortolândia'], servicos: ['SRV-01', 'SRV-02', 'SRV-03', 'SRV-05', 'SRV-06'], nota: 4.8, avals: 46, tel: '(19) 99812-4410', email: 'carlos@mendescalhas.demo', desde: 2011, status: 'Publicado', cor: '#0f6f86', doc: 'CNPJ 12.345.678/0001-90', sobre: 'Equipe própria com 14 anos de experiência em calhas galvanizadas, rufos e condutores. Atendimento residencial e comercial com garantia de 12 meses.', disp: 'Disponível', taxaAceite: 92, tempoResp: 2.1 },
        { id: 'PRF-102', nome: 'Rafael Lima', empresa: 'RL Calhas Sob Medida', cidade: 'Campinas', regioes: ['Campinas', 'Paulínia', 'Sumaré'], servicos: ['SRV-01', 'SRV-02', 'SRV-06'], nota: 4.6, avals: 31, tel: '(19) 99730-2281', email: 'rafael@rlcalhas.demo', desde: 2016, status: 'Publicado', cor: '#6d4bb3', doc: 'CNPJ 23.456.789/0001-01', sobre: 'Calhas de alumínio e galvanizadas dobradas na hora, sob medida para cada telhado.', disp: 'Disponível', taxaAceite: 84, tempoResp: 3.4 },
        { id: 'PRF-103', nome: 'Ana Beatriz Souza', empresa: 'Telhado Seguro Manutenção', cidade: 'Valinhos', regioes: ['Valinhos', 'Vinhedo', 'Campinas'], servicos: ['SRV-03', 'SRV-04', 'SRV-07'], nota: 4.9, avals: 58, tel: '(19) 99654-7702', email: 'ana@telhadoseguro.demo', desde: 2014, status: 'Publicado', cor: '#2e7d4f', doc: 'CNPJ 34.567.890/0001-12', sobre: 'Especialista em manutenção, limpeza e correção de vazamentos. Relatório com fotos ao final de cada visita.', disp: 'Agenda cheia', taxaAceite: 88, tempoResp: 1.6 },
        { id: 'PRF-104', nome: 'João Pereira', empresa: 'Pereira Funilaria de Obra', cidade: 'Sumaré', regioes: ['Sumaré', 'Hortolândia', 'Americana'], servicos: ['SRV-02', 'SRV-03', 'SRV-05'], nota: 4.4, avals: 22, tel: '(19) 99511-3390', email: 'joao@pereirafunilaria.demo', desde: 2009, status: 'Publicado', cor: '#9a5b13', doc: 'CPF 123.456.789-00 (MEI)', sobre: 'Funilaria de obra: rufos, chapéus de muro, calhas e pingadeiras.', disp: 'Disponível', taxaAceite: 61, tempoResp: 9.8 },
        { id: 'PRF-105', nome: 'Marcos Teixeira', empresa: 'Teixeira Coberturas', cidade: 'Jundiaí', regioes: ['Jundiaí', 'Vinhedo'], servicos: ['SRV-01', 'SRV-02', 'SRV-04', 'SRV-06'], nota: 4.7, avals: 39, tel: '(11) 99420-1187', email: 'marcos@teixeiracoberturas.demo', desde: 2012, status: 'Publicado', cor: '#1f56c4', doc: 'CNPJ 45.678.901/0001-23', sobre: 'Coberturas, calhas e condutores para residências e pequenos comércios.', disp: 'Disponível', taxaAceite: 79, tempoResp: 4.2 },
        { id: 'PRF-106', nome: 'Fernanda Alves', empresa: 'Águas Pluviais Soluções', cidade: 'Indaiatuba', regioes: ['Indaiatuba', 'Campinas'], servicos: ['SRV-01', 'SRV-06', 'SRV-07'], nota: 4.5, avals: 17, tel: '(19) 99388-6145', email: 'fernanda@aguaspluviais.demo', desde: 2019, status: 'Publicado', cor: '#b03a48', doc: 'CNPJ 56.789.012/0001-34', sobre: 'Projetos de drenagem de águas pluviais, calhas e reaproveitamento de água da chuva.', disp: 'Disponível', taxaAceite: 90, tempoResp: 2.8 },
        { id: 'PRF-107', nome: 'Lucas Barbosa', empresa: 'Barbosa Calhas', cidade: 'Indaiatuba', regioes: ['Indaiatuba'], servicos: ['SRV-01', 'SRV-04'], nota: 0, avals: 0, tel: '(19) 99201-5548', email: 'lucas@barbosacalhas.demo', desde: 2021, status: 'Em análise', cor: '#4a6b2a', doc: 'CNPJ 67.890.123/0001-45', sobre: 'Instalação e limpeza de calhas em Indaiatuba e região.', disp: 'Disponível', taxaAceite: 0, tempoResp: 0, enviado: d(-1, '16:20'), docs: { id: true, endereco: true, nr35: true, seguro: false } },
        { id: 'PRF-108', nome: 'Paulo Henrique Dias', empresa: 'PH Calhas e Rufos', cidade: 'Americana', regioes: ['Americana', 'Sumaré'], servicos: ['SRV-02', 'SRV-05'], nota: 0, avals: 0, tel: '(19) 99107-4423', email: 'paulo@phcalhas.demo', desde: 2018, status: 'Em análise', cor: '#7a3b8f', doc: 'CPF 987.654.321-00 (MEI)', sobre: 'Rufos, pingadeiras e troca de calhas.', disp: 'Disponível', taxaAceite: 0, tempoResp: 0, enviado: d(0, '08:05'), docs: { id: true, endereco: false, nr35: false, seguro: false } },
      ],
      clientes: [
        { id: 'CLI-201', nome: 'Mariana Costa', tipo: 'Residencial', cidade: 'Campinas', bairro: 'Taquaral', endereco: 'Rua das Hortênsias, 120', tel: '(19) 98877-1203', email: 'mariana.costa@email.demo', desde: d(-140), contato: '' },
        { id: 'CLI-202', nome: 'Roberto Nunes', tipo: 'Residencial', cidade: 'Valinhos', bairro: 'Jardim Paiquerê', endereco: 'Rua dos Ipês, 45', tel: '(19) 98701-4432', email: 'roberto.nunes@email.demo', desde: d(-96) },
        { id: 'CLI-203', nome: 'Cond. Jardim das Palmeiras', tipo: 'Condomínio', cidade: 'Sumaré', bairro: 'Nova Veneza', endereco: 'Av. das Palmeiras, 900', tel: '(19) 3800-1122', email: 'sindico.palmeiras@email.demo', desde: d(-80), contato: 'Patrícia Gomes (síndica)' },
        { id: 'CLI-204', nome: 'Helena Martins', tipo: 'Residencial', cidade: 'Jundiaí', bairro: 'Eloy Chaves', endereco: 'Rua Ibirapuera, 77', tel: '(11) 98622-0918', email: 'helena.martins@email.demo', desde: d(-71) },
        { id: 'CLI-205', nome: 'Padaria Pão Dourado', tipo: 'Comercial', cidade: 'Hortolândia', bairro: 'Jardim Amanda', endereco: 'Rua Sete, 310', tel: '(19) 3865-4400', email: 'contato@paodourado.demo', desde: d(-64), contato: 'Antônio Ribeiro' },
        { id: 'CLI-206', nome: 'Escola Pequeno Saber', tipo: 'Comercial', cidade: 'Campinas', bairro: 'Barão Geraldo', endereco: 'Rua Albert Einstein, 18', tel: '(19) 3288-7700', email: 'adm@pequenosaber.demo', desde: d(-52), contato: 'Cláudia Moraes' },
        { id: 'CLI-207', nome: 'Gustavo Ramos', tipo: 'Residencial', cidade: 'Indaiatuba', bairro: 'Jardim Pau Preto', endereco: 'Rua Ceará, 512', tel: '(19) 98455-3301', email: 'gustavo.ramos@email.demo', desde: d(-33) },
        { id: 'CLI-208', nome: 'Clínica Vida Plena', tipo: 'Comercial', cidade: 'Campinas', bairro: 'Cambuí', endereco: 'Rua Coronel Quirino, 1500', tel: '(19) 3254-9900', email: 'facilities@vidaplena.demo', desde: d(-12), contato: 'Renata Lopes' },
      ],
      materiais: [
        { id: 'MAT-01', nome: 'Calha galvanizada nº 26 — corte 33', un: 'm', custo: 49, preco: 68, estoque: 42, forn: 'FOR-1' },
        { id: 'MAT-02', nome: 'Calha de alumínio — corte 30', un: 'm', custo: 58, preco: 79.9, estoque: 18, forn: 'FOR-2' },
        { id: 'MAT-03', nome: 'Calha PVC pluvial 125 mm', un: 'barra 3 m', custo: 72, preco: 96, estoque: 12, forn: 'FOR-3' },
        { id: 'MAT-04', nome: 'Rufo galvanizado — corte 25', un: 'm', custo: 29, preco: 42, estoque: 35, forn: 'FOR-1' },
        { id: 'MAT-05', nome: 'Condutor PVC pluvial 88 mm', un: 'barra 3 m', custo: 39, preco: 54.9, estoque: 24, forn: 'FOR-3' },
        { id: 'MAT-06', nome: 'Bocal de saída 88 mm', un: 'un', custo: 11.5, preco: 18.5, estoque: 30, forn: 'FOR-1' },
        { id: 'MAT-07', nome: 'Cabeceira de calha', un: 'un', custo: 8, preco: 14, estoque: 40, forn: 'FOR-1' },
        { id: 'MAT-08', nome: 'Suporte de calha (mão-francesa)', un: 'un', custo: 5.6, preco: 9.8, estoque: 160, forn: 'FOR-2' },
        { id: 'MAT-09', nome: 'Curva PVC 88 mm 45°', un: 'un', custo: 7.4, preco: 12.4, estoque: 50, forn: 'FOR-3' },
        { id: 'MAT-10', nome: 'Vedante PU 400 g', un: 'tubo', custo: 21, preco: 32, estoque: 28, forn: 'FOR-2' },
        { id: 'MAT-11', nome: 'Abraçadeira para condutor 88 mm', un: 'un', custo: 3.9, preco: 6.5, estoque: 90, forn: 'FOR-3' },
        { id: 'MAT-12', nome: 'Tela protetora contra folhas', un: 'm', custo: 9, preco: 15.9, estoque: 60, forn: 'FOR-2' },
      ],
      fornecedores: [
        { id: 'FOR-1', nome: 'Distribuidora Aço Sul', cidade: 'Campinas', contato: 'Vendas — (19) 3200-0101', prazo: '2 dias úteis', doc: 'CNPJ 71.000.111/0001-01' },
        { id: 'FOR-2', nome: 'Casa das Calhas Atacado', cidade: 'Sumaré', contato: 'Comercial — (19) 3800-0202', prazo: '3 dias úteis', doc: 'CNPJ 72.000.222/0001-02' },
        { id: 'FOR-3', nome: 'PVC Forte Materiais', cidade: 'Valinhos', contato: 'Pedidos — (19) 3871-0303', prazo: '1 dia útil', doc: 'CNPJ 73.000.333/0001-03' },
      ],
    };
  };
  /** Converte linhas compactas em registros de log. */
  AiC.L = (rows) => rows.map((r) => ({ ts: AiC.d(r[0], r[1]), usuario: r[2], perfil: r[3], acao: r[4], ref: r[5] || '', demo: false }));
  AiC.findBy = (list, id) => list.find((x) => x.id === id);

  /* ------------------------------------------------------------------
     Estado da demonstração
     ------------------------------------------------------------------ */
  const PROF = {
    cliente: { label: 'Cliente', short: 'Cliente', icon: 'user' },
    profissional: { label: 'Profissional / Instalador', short: 'Profissional', icon: 'tool' },
    mediador: { label: 'Mediador / Gestão AiCalhas', short: 'Mediador', icon: 'shield' },
  };
  AiC.PROF = PROF;
  const LV = { 1: 'baixa', 2: 'média', 3: 'alta', 4: 'total' };
  AiC.LV = LV;

  function freshState() {
    const data = S.cfg.seed();
    const logs = S.cfg.seedLogs ? S.cfg.seedLogs(data) : [];
    return { data: data, logs: logs, started: AiC.now() };
  }
  function freshUI() { return { profile: null, view: null, sel: {}, tab: {}, f: {}, about: true }; }
  function save() { try { sessionStorage.setItem(S.key, JSON.stringify({ st: S.st, ui: S.ui })); } catch (e) { /* memória apenas */ } }

  AiC.db = () => S.st.data;
  AiC.profile = () => S.ui.profile;
  AiC.me = () => S.cfg.users[S.ui.profile];
  AiC.users = () => S.cfg.users;
  AiC.sel = (view) => S.ui.sel[view];
  AiC.setSel = (view, v) => { S.ui.sel[view] = v; };

  /** Registra uma ação no histórico (trilha de auditoria simulada). */
  AiC.log = function (acao, ref, who) {
    const u = who || { nome: AiC.me() ? AiC.me().nome : 'Sistema', perfil: S.ui.profile || 'sistema' };
    S.st.logs.push({ ts: AiC.now(), usuario: u.nome, perfil: u.perfil, acao: acao, ref: ref || '', demo: true });
  };

  AiC.start = function (cfg) {
    S.cfg = cfg;
    cfg.users = cfg.users || AiC.USERS;
    S.key = 'aicalhas-demo-v1-' + cfg.id;
    document.body.classList.add('sc-' + cfg.num);
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(S.key) || 'null'); } catch (e) { saved = null; }
    if (saved && saved.st && saved.ui && saved.st.data) { S.st = saved.st; S.ui = Object.assign(freshUI(), saved.ui); }
    else { S.st = freshState(); S.ui = freshUI(); }
    if (!document.getElementById('modal-root')) { const m = document.createElement('div'); m.id = 'modal-root'; document.body.appendChild(m); }
    if (!document.getElementById('toasts')) { const t = document.createElement('div'); t.id = 'toasts'; t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    bind();
    render();
  };

  /* ------------------------------------------------------------------
     Renderização
     ------------------------------------------------------------------ */
  function menuOf(p) {
    const P = S.cfg.profiles[p];
    return P.menu.concat([{ sec: p === 'mediador' ? 'Controle' : 'Conta' }, logView(p)]);
  }
  function findView(id) {
    const p = S.ui.profile;
    if (!p) return null;
    const m = menuOf(p).find((x) => x.id === id);
    if (m) return m;
    const h = S.cfg.profiles[p].hidden || {};
    return h[id] ? Object.assign({ id: id }, h[id]) : null;
  }
  function render() {
    const root = document.getElementById('app');
    if (!S.ui.profile) { root.innerHTML = loginHTML(); document.title = 'AiCalhas · Cenário ' + S.cfg.num + ' — ' + S.cfg.title; save(); return; }
    if (!S.ui.view || !findView(S.ui.view)) S.ui.view = S.cfg.profiles[S.ui.profile].home;
    root.innerHTML = shellHTML();
    renderContent();
  }
  function renderContent() {
    const v = findView(S.ui.view);
    const el = document.getElementById('content');
    if (!el || !v) return;
    let html;
    try { html = v.render(); } catch (e) { console.error(e); html = AiC.empty('Não foi possível montar esta tela: ' + e.message, 'alert'); }
    el.innerHTML = html;
    updateNav();
    const t = document.getElementById('top-title');
    if (t) t.textContent = v.title || v.label;
    document.title = (v.title || v.label) + ' · AiCalhas — Cenário ' + S.cfg.num;
    save();
  }
  /** Atualiza a tela atual mantendo rolagem e foco em filtros de busca. */
  AiC.refresh = function () {
    if (!S.ui.profile) { render(); return; }
    const ae = document.activeElement;
    let fk = null, pos = null;
    if (ae && ae.dataset && ae.dataset.filter) { fk = ae.dataset.filter; try { pos = ae.selectionStart; } catch (e) { pos = null; } }
    const y = window.scrollY;
    renderContent();
    window.scrollTo(0, y);
    if (fk) {
      const n = document.querySelector('[data-filter="' + fk + '"]');
      if (n) { n.focus(); try { if (pos != null) n.setSelectionRange(pos, pos); } catch (e) { /* select */ } }
    }
  };
  AiC.go = function (view, sel) {
    if (sel !== undefined) S.ui.sel[view] = sel;
    S.ui.view = view;
    closeMenu();
    renderContent();
    window.scrollTo(0, 0);
  };
  function updateNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    const cur = findView(S.ui.view);
    const active = cur && cur.parent ? cur.parent : S.ui.view;
    nav.innerHTML = menuOf(S.ui.profile).map((it) => {
      if (it.sec) return '<div class="nav-sec">' + esc(it.sec) + '</div>';
      let n = 0;
      try { n = it.badge ? it.badge() : 0; } catch (e) { n = 0; }
      return '<button type="button" class="' + (it.id === active ? 'on' : '') + '" data-act="core.nav" data-view="' + it.id + '">' + icon(it.icon || 'grid') + '<span>' + esc(it.label) + '</span>' + (n ? '<span class="cnt">' + n + '</span>' : '') + '</button>';
    }).join('');
  }

  function shellHTML() {
    const c = S.cfg, p = S.ui.profile, u = AiC.me();
    return '<div class="app" id="shell">' +
      '<aside class="side" id="side" aria-label="Menu principal">' +
      '<div class="side-head"><a href="index.html" style="text-decoration:none" title="Voltar à capa">' + AiC.logo(true) + '</a></div>' +
      '<div class="side-sc">Cenário ' + c.num + '<b>' + esc(c.title) + '</b></div>' +
      '<nav class="nav" id="nav"></nav>' +
      '<div class="side-foot">' +
      '<button class="sbtn" data-act="core.explain">' + icon('info', 16) + ' Como funciona este cenário</button>' +
      '<button class="sbtn" data-act="core.reset">' + icon('refresh', 16) + ' Reiniciar demonstração</button>' +
      '<a class="sbtn" href="index.html">' + icon('arrowL', 16) + ' Voltar à capa</a>' +
      '<div class="demo-tag">Ambiente demonstrativo — dados fictícios</div>' +
      '</div></aside>' +
      '<div class="scrim" data-act="core.menu"></div>' +
      '<div class="main">' +
      '<header class="top">' +
      '<button class="ibtn hamb" data-act="core.menu" aria-label="Abrir menu">' + icon('menu') + '</button>' +
      '<div class="top-t"><span>Cenário ' + c.num + ' — ' + esc(c.title) + '</span><b id="top-title"></b></div>' +
      '<div class="psw" role="group" aria-label="Trocar perfil">' + ['cliente', 'profissional', 'mediador'].map((k) => '<button type="button" class="' + (k === p ? 'on' : '') + '" data-act="core.switch" data-p="' + k + '" title="Entrar como ' + PROF[k].label + '" aria-pressed="' + (k === p) + '">' + icon(PROF[k].icon, 16) + '<span>' + PROF[k].short + '</span></button>').join('') + '</div>' +
      '<div class="um"><button type="button" class="um-btn" data-act="core.umenu" aria-label="Menu do usuário">' + AiC.av(u.nome, u.cor) + '<span class="um-n"><b>' + esc(u.nome) + '</b><small>' + esc(PROF[p].label) + '</small></span></button>' +
      '<div class="um-dd" id="umdd" hidden><div class="um-h"><b>' + esc(u.nome) + '</b><small>' + esc(u.email) + '</small><small>' + esc(PROF[p].label) + '</small></div>' +
      '<button data-act="core.explain">' + icon('info', 16) + ' Como funciona</button>' +
      '<button data-act="core.reset">' + icon('refresh', 16) + ' Reiniciar demonstração</button>' +
      '<a href="index.html">' + icon('arrowL', 16) + ' Voltar à capa</a>' +
      '<button data-act="core.logout">' + icon('logout', 16) + ' Sair</button></div></div>' +
      '</header>' +
      aboutHTML() +
      '<main class="content" id="content"></main>' +
      '<footer class="foot">AiCalhas — Cenário ' + c.num + ': ' + esc(c.title) + '. Ambiente demonstrativo — dados fictícios. Contatos, mensagens e pagamentos são apenas simulados.</footer>' +
      '</div></div>';
  }
  function aboutHTML() {
    const a = S.cfg.about, p = S.ui.profile;
    if (!S.ui.about) return '<div class="about mini"><button class="lnk" data-act="core.about">' + icon('info', 16) + ' Mostrar o papel deste perfil no cenário</button></div>';
    return '<div class="about" id="about">' +
      '<div class="ab-lv">' + AiC.meter(a.level) + '<small>Participação da AiCalhas: ' + LV[a.level] + '</small></div>' +
      '<div class="ab-t"><b>' + esc(a.perfil[p].t) + '</b><span>' + esc(a.perfil[p].d) + '</span></div>' +
      '<div class="ab-a"><button class="btn sm" data-act="core.explain">Como funciona</button><button class="ibtn" data-act="core.about" title="Recolher resumo" aria-label="Recolher resumo">' + icon('x', 16) + '</button></div>' +
      '</div>';
  }
  function loginHTML() {
    const c = S.cfg, a = c.about, us = c.users;
    return '<div class="login">' +
      '<section class="lg-brand"><div class="lg-rain" aria-hidden="true"></div>' +
      '<a class="lg-back" href="index.html">' + icon('arrowL', 16) + ' Voltar à capa</a>' +
      AiC.logo(true) +
      '<div class="lg-sc"><span class="eyebrow">Cenário ' + c.num + ' de 4</span><h1>' + esc(c.title) + '</h1><p>' + esc(a.resumo) + '</p></div>' +
      '<div class="lg-lv">' + AiC.meter(a.level, true) + '<span>Participação da AiCalhas: <b>' + LV[a.level] + '</b></span></div>' +
      '<ul class="lg-pts">' + a.mediador.slice(0, 4).map((x) => '<li>' + icon('check', 16) + '<span>' + esc(x) + '</span></li>').join('') + '</ul>' +
      '<button class="btn light" data-act="core.explain">' + icon('info', 16) + ' Como este modelo funciona</button>' +
      '</section>' +
      '<section class="lg-main"><div class="lg-card">' +
      '<h2>Acesso demonstrativo</h2><p class="muted">Escolha um perfil para navegar. Nenhum cadastro real é necessário.</p>' +
      '<div class="lg-quick">' + ['cliente', 'profissional', 'mediador'].map((k) => '<button type="button" class="lg-p" data-act="core.quick" data-p="' + k + '">' + AiC.av(us[k].nome, us[k].cor) + '<span class="lg-t"><b>Entrar como ' + esc(PROF[k].label) + '</b><small>' + esc(us[k].nome) + ' — ' + esc(us[k].sub) + '</small></span>' + icon('arrowR', 16) + '</button>').join('') + '</div>' +
      '<div class="or">ou use as credenciais de demonstração</div>' +
      '<form data-form="core.login" class="lg-form" autocomplete="off">' +
      '<div class="f"><label for="lg-email">E-mail</label><input id="lg-email" class="inp" type="email" name="email" value="' + esc(us.cliente.email) + '" required></div>' +
      '<div class="f"><label for="lg-pass">Senha</label><input id="lg-pass" class="inp" type="password" name="senha" value="demo1234" required></div>' +
      '<div class="lg-hint">Contas fictícias: <code>' + esc(us.cliente.email) + '</code>, <code>' + esc(us.profissional.email) + '</code> ou <code>' + esc(us.mediador.email) + '</code>. Qualquer senha é aceita.</div>' +
      '<button class="btn p" type="submit">' + icon('logout', 16) + ' Entrar</button>' +
      '</form>' +
      '<p class="demo-tag dark">Ambiente demonstrativo — dados fictícios. <button class="lnk" data-act="core.reset" style="font-size:12px">Reiniciar demonstração</button></p>' +
      '</div></section></div>';
  }

  /* ------------------------------------------------------------------
     Componentes de interface
     ------------------------------------------------------------------ */
  const PAL = ['#0f6f86', '#6d4bb3', '#9a5b13', '#a8326e', '#2e7d4f', '#1f56c4', '#b03a48', '#4a6b2a', '#7a3b8f', '#b8612e'];
  AiC.colorFor = (name) => { let h = 0; String(name).split('').forEach((ch) => { h = (h * 31 + ch.charCodeAt(0)) % 997; }); return PAL[h % PAL.length]; };
  AiC.av = (name, color, cls) => '<span class="av ' + (cls || '') + '" style="background:' + (color || AiC.colorFor(name)) + '" aria-hidden="true">' + esc(AiC.initials(name)) + '</span>';
  AiC.stars = (n) => '<span class="stars" title="' + AiC.num(n, 1) + ' de 5"><i style="width:' + Math.max(0, Math.min(100, (n / 5) * 100)) + '%"></i></span>';
  AiC.rating = (n, count) => n ? '<span class="rt">' + AiC.stars(n) + '<b>' + AiC.num(n, 1) + '</b>' + (count != null ? '<span class="muted">(' + count + ')</span>' : '') + '</span>' : '<span class="muted small">Sem avaliações</span>';
  AiC.meter = (lv, big) => '<span class="meter' + (big ? ' big' : '') + '" role="img" aria-label="Participação da AiCalhas: ' + LV[lv] + '">' + [1, 2, 3, 4].map((i) => '<i class="' + (i <= lv ? 'on' : '') + '"></i>').join('') + '</span>';

  const TONES = {
    ok: ['Publicado', 'Publicada', 'Aprovado', 'Aprovada', 'Concluído', 'Concluída', 'Pago', 'Aceito', 'Ativo', 'Disponível', 'Respondido', 'Recebida', 'Recebido pelo cliente', 'Entregue', 'Conferido', 'Conferida', 'Liberado ao cliente', 'Serviço contratado', 'Avaliado', 'Resolvido', 'Resolvida', 'Encerrado', 'Encerrada', 'Confirmada', 'Confirmado', 'Em dia', 'Realizada', 'Liberado', 'Separado'],
    warn: ['Em análise', 'Em moderação', 'Aguardando', 'Pendente', 'Encaminhado', 'Em triagem', 'Ajuste solicitado', 'Agenda cheia', 'Em apuração', 'Previsto', 'Solicitada', 'Programada', 'Agendada', 'Em negociação', 'Aguardando retorno', 'Aguardando resposta', 'Aguardando aprovação', 'Aguardando pagamento', 'Aguardando alçada', 'Em elaboração', 'Aguardando conferência', 'A vencer', 'Reagendada'],
    bad: ['Recusado', 'Recusada', 'Suspenso', 'Atrasado', 'Atrasada', 'Cancelado', 'Cancelada', 'Sem resposta', 'Aberto', 'Aberta', 'Pausado', 'Não contratado', 'Vencido', 'Falta de material', 'Reclamação'],
    info: ['Recebido', 'Novo', 'Nova', 'Em contato', 'Em execução', 'Em andamento', 'Enviado', 'Enviada', 'Em rota', 'Em compra', 'Agendado'],
  };
  const toneOf = (t) => { for (const k in TONES) if (TONES[k].indexOf(t) >= 0) return k; return 'neutral'; };
  AiC.badge = (txt, tone) => '<span class="bdg t-' + (tone || toneOf(txt)) + '">' + esc(txt) + '</span>';
  AiC.kpi = (o) => '<div class="card kpi' + (o.tone ? ' k-' + o.tone : '') + '">' + (o.icon ? '<span class="ic">' + icon(o.icon, 19) + '</span>' : '') + '<div><div class="l">' + esc(o.l) + '</div><div class="v">' + o.v + '</div>' + (o.s ? '<div class="s">' + o.s + '</div>' : '') + '</div></div>';
  AiC.ph = (title, sub, acts, back) => (back ? '<button class="back" data-act="core.nav" data-view="' + back[0] + '">' + icon('arrowL', 15) + ' ' + esc(back[1]) + '</button>' : '') + '<div class="ph"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div>';
  AiC.card = (title, body, o) => { o = o || {}; return '<section class="card ' + (o.cls || '') + '">' + (title != null ? '<div class="card-h">' + (o.icon ? icon(o.icon, 18) : '') + '<h3>' + esc(title) + '</h3>' + (o.right ? '<div class="card-r">' + o.right + '</div>' : '') + '</div>' : '') + '<div class="card-b' + (o.flush ? ' flush' : '') + '">' + body + '</div></section>'; };
  /** Botão: rótulo, ação, dados (data-*), classes, ícone. */
  AiC.b = (label, act, data, cls, ic, extra) => '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '"' + Object.keys(data || {}).map((k) => ' data-' + k + '="' + esc(data[k]) + '"').join('') + (extra || '') + '>' + (ic ? icon(ic, 16) : '') + (label ? '<span>' + esc(label) + '</span>' : '') + '</button>';
  AiC.nav = (label, view, sel, cls, ic) => AiC.b(label, 'core.nav', sel != null ? { view: view, id: sel } : { view: view }, cls, ic);
  AiC.empty = (msg, ic, action) => '<div class="empty">' + icon(ic || 'inbox', 28) + '<p>' + esc(msg) + '</p>' + (action || '') + '</div>';
  AiC.table = (cols, rows, o) => {
    o = o || {};
    if (!rows.length) return AiC.empty(o.empty || 'Nenhum registro encontrado para os filtros selecionados.', 'search');
    return '<div class="tw"><table class="tbl ' + (o.cls || '') + '"><thead><tr>' + cols.map((c) => '<th class="' + (c.cls || '') + '">' + esc(c.l) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map((r) => '<tr' + (o.rowAct ? ' class="clk" data-act="' + o.rowAct + '" data-id="' + esc(r.id) + '"' + (o.rowView ? ' data-view="' + o.rowView + '"' : '') : '') + '>' + cols.map((c) => '<td class="' + (c.cls || '') + '">' + (c.f ? c.f(r) : esc(r[c.k])) + '</td>').join('') + '</tr>').join('') +
      '</tbody>' + (o.foot ? '<tfoot><tr>' + o.foot.map((x, i) => '<td class="' + ((cols[i] && cols[i].cls) || '') + '">' + x + '</td>').join('') + '</tr></tfoot>' : '') + '</table></div>';
  };
  AiC.dl = (pairs, cls) => '<dl class="dl ' + (cls || '') + '">' + pairs.filter(Boolean).map((p) => '<div><dt>' + esc(p[0]) + '</dt><dd>' + (p[1] == null || p[1] === '' ? '—' : p[1]) + '</dd></div>').join('') + '</dl>';
  AiC.note = (html, tone, ic) => '<div class="note ' + (tone || '') + '">' + icon(ic || (tone === 'warn' || tone === 'bad' ? 'alert' : 'info'), 17) + '<div>' + html + '</div></div>';
  AiC.chips = (arr, cls) => '<div class="chips">' + arr.map((x) => '<span class="chip ' + (cls || '') + '">' + esc(x) + '</span>').join('') + '</div>';
  AiC.tab = (scope, def) => S.ui.tab[scope] || def;
  AiC.setTab = (scope, id) => { S.ui.tab[scope] = id; };
  AiC.tabs = (scope, items, def) => {
    const cur = AiC.tab(scope, def || items[0].id);
    return '<div class="tabs" role="tablist">' + items.map((t) => '<button type="button" role="tab" aria-selected="' + (t.id === cur) + '" class="tab ' + (t.id === cur ? 'on' : '') + '" data-act="core.tab" data-scope="' + scope + '" data-id="' + t.id + '">' + esc(t.l) + (t.n != null ? '<span class="n">' + t.n + '</span>' : '') + '</button>').join('') + '</div>';
  };
  const opt = (o) => (o !== null && typeof o === 'object' ? o : { v: o, l: o });
  AiC.PERIODS = [{ v: 'all', l: 'Todo o período' }, { v: '0', l: 'Hoje' }, { v: '7', l: 'Últimos 7 dias' }, { v: '30', l: 'Últimos 30 dias' }, { v: '90', l: 'Últimos 90 dias' }];
  AiC.inPeriod = (v, per) => { if (!per || per === 'all') return true; const dd = AiC.dayDiff(v); return dd > 0 ? true : -dd <= +per; };
  AiC.fv = (scope, key, def) => { const v = S.ui.f[scope + '.' + key]; return v == null ? (def == null ? '' : def) : v; };
  AiC.filters = (scope, defs, extra) => '<div class="filters">' + icon('filter', 16) + defs.map((d) => {
    const key = scope + '.' + d.k;
    const val = AiC.fv(scope, d.k, d.def != null ? d.def : '');
    if (d.type === 'search') return '<input class="inp fsearch" type="search" placeholder="' + esc(d.l) + '" aria-label="' + esc(d.l) + '" data-filter="' + key + '" value="' + esc(val) + '">';
    return '<label class="fsel"><span>' + esc(d.l) + '</span><select class="inp" data-filter="' + key + '">' + d.o.map((o) => { o = opt(o); return '<option value="' + esc(o.v) + '"' + (String(o.v) === String(val) ? ' selected' : '') + '>' + esc(o.l) + '</option>'; }).join('') + '</select></label>';
  }).join('') + (extra || '') + '<button type="button" class="btn sm gh" data-act="core.clearf" data-scope="' + scope + '">Limpar filtros</button></div>';
  AiC.opts = (arr, all) => (all ? [{ v: '', l: all }] : []).concat(arr.map(opt));
  AiC.bars = (data, o) => {
    o = o || {};
    if (!data.length) return AiC.empty('Sem dados para os filtros selecionados.', 'chart');
    const max = Math.max.apply(null, data.map((d) => d.v).concat([1]));
    return '<div class="bars">' + data.map((d) => '<div class="bar"><span class="bl" title="' + esc(d.l) + '">' + esc(d.l) + '</span><span class="tr"><span class="fl" style="width:' + Math.max(2, (d.v / max) * 100) + '%' + (d.c ? ';background:' + d.c : '') + '"></span></span><b>' + (o.money ? AiC.kmoney(d.v) : AiC.num(d.v, o.dec || 0)) + (o.suffix || '') + '</b></div>').join('') + '</div>';
  };
  AiC.cols = (labels, series, o) => {
    o = o || {};
    const max = Math.max.apply(null, [1].concat(...series.map((s) => s.v)));
    return '<div class="cc"><div class="cc-plot">' + labels.map((lb, i) => '<div class="cc-g">' + series.map((s) => '<div class="cc-b" style="height:' + Math.max(1, (s.v[i] / max) * 86) + '%;background:' + s.c + '" title="' + esc(s.n) + ': ' + (o.money ? AiC.money(s.v[i]) : s.v[i]) + '"><span>' + (o.money ? AiC.kmoney(s.v[i]) : AiC.num(s.v[i])) + '</span></div>').join('') + '<small>' + esc(lb) + '</small></div>').join('') + '</div>' +
      (series.length > 1 || o.legend ? '<div class="cc-leg">' + series.map((s) => '<span><i style="background:' + s.c + '"></i>' + esc(s.n) + '</span>').join('') + '</div>' : '') + '</div>';
  };
  AiC.funnel = (steps) => {
    const top = Math.max(1, steps[0].v);
    return '<div class="fun">' + steps.map((s, i) => '<div class="fun-i"><span>' + esc(s.l) + '</span><div><div class="fun-b" style="width:' + Math.max(6, (s.v / top) * 100) + '%;opacity:' + (1 - i * 0.1) + '">' + s.v + '</div></div><small>' + (i ? AiC.pct(s.v, top) : '100%') + '</small></div>').join('') + '</div>';
  };
  AiC.stepper = (steps, cur) => '<ol class="stp">' + steps.map((s, i) => '<li class="' + (i < cur ? 'done' : i === cur ? 'cur' : '') + '"><span class="dot">' + (i < cur ? icon('check', 13) : i + 1) + '</span><span class="sl">' + esc(s) + '</span></li>').join('') + '</ol>';
  AiC.timeline = (evs) => evs.length ? '<div class="tl">' + evs.map((e) => '<div class="tl-i ' + (e.tone ? 't-' + e.tone : '') + '"><div class="tl-t">' + esc(e.txt) + '</div><small>' + AiC.fdt(e.ts) + (e.by ? ' — ' + esc(e.by) : '') + '</small></div>').join('') + '</div>' : AiC.empty('Sem eventos registrados.', 'history');
  const ROLE = { cliente: 'Cliente', profissional: 'Profissional', mediador: 'AiCalhas' };
  AiC.chat = (msgs, formAct, ref) => {
    const me = S.ui.profile;
    return '<div class="chat">' + (msgs.length ? msgs.map((m) => m.de === 'sistema' ? '<div class="msg sys">' + esc(m.txt) + ' — ' + AiC.when(m.ts) + '</div>' : '<div class="msg r-' + m.de + (m.de === me ? ' me' : '') + '"><div class="who">' + esc(m.nome) + ' <span>' + ROLE[m.de] + '</span></div><div>' + esc(m.txt) + '</div><time>' + AiC.when(m.ts) + '</time></div>').join('') : AiC.empty('Nenhuma mensagem ainda.', 'chat')) + '</div>' +
      (formAct ? '<form class="chat-f" data-form="' + formAct + '" autocomplete="off"><input type="hidden" name="ref" value="' + esc(ref) + '"><input class="inp" name="txt" placeholder="Escreva uma mensagem (simulação)" aria-label="Mensagem" required><button class="btn p" type="submit">' + icon('send', 16) + '<span>Enviar</span></button></form>' : '');
  };
  AiC.doc = (title, sub, body) => '<div class="doc"><div class="doc-h"><div>' + AiC.logo(false) + '</div><div style="text-align:right"><h2>' + esc(title) + '</h2><span class="muted">' + sub + '</span></div></div>' + body + '<div class="wm">Documento demonstrativo gerado em ambiente de simulação — dados fictícios, sem validade jurídica ou fiscal.</div></div>';
  AiC.qr = (seed) => { const r = AiC.rng(seed || 3); let s = '<svg class="qr" viewBox="0 0 29 29" shape-rendering="crispEdges" role="img" aria-label="QR Code demonstrativo"><rect width="29" height="29" fill="#fff"/>'; const fin = (x, y) => '<rect x="' + x + '" y="' + y + '" width="7" height="7" fill="#142230"/><rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="5" height="5" fill="#fff"/><rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" fill="#142230"/>'; for (let y = 0; y < 29; y++) for (let x = 0; x < 29; x++) { if ((x < 8 && y < 8) || (x > 20 && y < 8) || (x < 8 && y > 20)) continue; if (r() > 0.52) s += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="#142230"/>'; } return s + fin(0, 0) + fin(22, 0) + fin(0, 22) + '</svg>'; };

  /* Mapa esquemático das cidades atendidas (sem escala) */
  const MAPXY = { Americana: [74, 70], Paulínia: [176, 62], Sumaré: [118, 118], Hortolândia: [128, 168], Campinas: [210, 150], Valinhos: [236, 206], Indaiatuba: [92, 236], Vinhedo: [228, 256], Jundiaí: [262, 304] };
  AiC.regionMap = (selected, label) => {
    let s = '<svg viewBox="0 0 340 340" role="img" aria-label="' + esc(label || 'Mapa esquemático das cidades atendidas') + '" style="width:100%;max-width:380px;display:block;margin:auto">';
    s += '<path d="M40 40 C120 10 260 20 310 90 C340 160 320 300 250 330 C170 345 60 320 30 240 C10 170 10 80 40 40Z" fill="#eef3f7" stroke="#d6e0e8" stroke-dasharray="4 4"/>';
    s += '<path d="M60 70 L176 62 L210 150 L262 304 M118 118 L210 150 L92 236 M128 168 L210 150 L236 206 L228 256" fill="none" stroke="#d3dde6" stroke-width="2"/>';
    Object.keys(MAPXY).forEach((c) => {
      const on = selected.indexOf(c) >= 0, xy = MAPXY[c];
      s += '<g><circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="' + (on ? 12 : 7) + '" fill="' + (on ? 'var(--acc)' : '#c4ced7') + '" opacity="' + (on ? 0.95 : 1) + '"/>' + (on ? '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="19" fill="var(--acc)" opacity=".14"/>' : '') +
        '<text x="' + xy[0] + '" y="' + (xy[1] + (on ? 30 : 22)) + '" text-anchor="middle" font-size="12" font-weight="' + (on ? 700 : 400) + '" fill="' + (on ? '#142230' : '#7b8a98') + '" font-family="inherit">' + esc(c) + '</text></g>';
    });
    return s + '</svg><p class="small muted" style="text-align:center;margin:6px 0 0">Mapa esquemático, sem escala.</p>';
  };

  /* Jornada de participação (comum a todos os cenários) */
  const JOURNEY = [
    { l: 'Vitrine e cadastro de profissionais', lv: [2, 2, 2, 2] },
    { l: 'Triagem da necessidade do cliente', lv: [0, 2, 2, 2] },
    { l: 'Seleção e indicação do profissional', lv: [0, 2, 2, 2] },
    { l: 'Visita técnica e orçamento', lv: [0, 0, 1, 2] },
    { l: 'Negociação de preço e prazo', lv: [0, 0, 1, 2] },
    { l: 'Pagamento', lv: [0, 0, 0, 2] },
    { l: 'Compra e entrega de materiais', lv: [0, 0, 0, 2] },
    { l: 'Execução do serviço', lv: [0, 0, 1, 2] },
    { l: 'Pós-venda, avaliações e reclamações', lv: [1, 1, 2, 2] },
  ];
  AiC.JOURNEY = JOURNEY;
  AiC.journey = (num) => '<div class="jr">' + JOURNEY.map((j) => { const v = j.lv[num - 1]; return '<div class="jr-i v' + v + '"><span class="jr-d">' + icon(v === 2 ? 'check' : v === 1 ? 'eye' : 'x', 13) + '</span><span>' + esc(j.l) + '</span><small>' + ['Fora da AiCalhas', 'Acompanha', 'Conduz'][v] + '</small></div>'; }).join('') + '</div>';
  const SCN = [
    { n: 1, t: 'Vitrine de profissionais', f: 'cenario-1.html', lv: 1 },
    { n: 2, t: 'Indicação direcionada', f: 'cenario-2.html', lv: 2 },
    { n: 3, t: 'Atendimento acompanhado', f: 'cenario-3.html', lv: 3 },
    { n: 4, t: 'Contratação centralizada', f: 'cenario-4.html', lv: 4 },
  ];
  AiC.SCN = SCN;

  /* ------------------------------------------------------------------
     Modais, formulários, confirmações e avisos
     ------------------------------------------------------------------ */
  AiC.modal = function (o) {
    const root = document.getElementById('modal-root');
    const foot = o.foot === '' ? '' : '<div class="md-f">' + (o.foot || '<button type="button" class="btn" data-act="core.close">Fechar</button>') + '</div>';
    root.innerHTML = '<div class="mb" data-backdrop="1"><div class="md ' + (o.size || '') + '" role="dialog" aria-modal="true" aria-labelledby="md-title"><div class="md-h"><div><h3 id="md-title">' + esc(o.title) + '</h3>' + (o.sub ? '<p>' + o.sub + '</p>' : '') + '</div><button type="button" class="ibtn" data-act="core.close" aria-label="Fechar">' + icon('x') + '</button></div><div class="md-b">' + o.body + '</div>' + foot + '</div></div>';
    document.body.classList.add('noscroll');
    setTimeout(() => {
      const first = root.querySelector('.md-b input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), .md-b textarea, .md-b select');
      if (first && window.innerWidth > 760) first.focus(); else { const c = root.querySelector('.md-h .ibtn'); if (c) c.focus(); }
    }, 30);
  };
  AiC.close = function () {
    const r = document.getElementById('modal-root');
    if (r) r.innerHTML = '';
    S.formCalc = null; S.formExtra = {};
    document.body.classList.remove('noscroll');
  };
  function fieldHTML(f) {
    const id = 'f_' + f.name + '_' + Math.random().toString(36).slice(2, 6);
    const req = f.required ? ' required' : '';
    const val = f.value == null ? '' : f.value;
    const lab = f.label ? '<label for="' + id + '">' + esc(f.label) + (f.required ? ' <i class="req">*</i>' : '') + '</label>' : '';
    const help = f.help ? '<small class="help">' + esc(f.help) + '</small>' : '';
    let inner = '';
    switch (f.type) {
      case 'hidden': return '<input type="hidden" name="' + f.name + '" value="' + esc(val) + '">';
      case 'html': return '<div class="f full">' + f.html + '</div>';
      case 'section': return '<div class="f full fsec">' + esc(f.label) + '</div>';
      case 'textarea': inner = '<textarea class="inp" id="' + id + '" name="' + f.name + '" rows="' + (f.rows || 3) + '" placeholder="' + esc(f.placeholder || '') + '"' + req + '>' + esc(val) + '</textarea>'; break;
      case 'select': inner = '<select class="inp" id="' + id + '" name="' + f.name + '"' + req + '>' + (f.placeholder != null ? '<option value="">' + esc(f.placeholder) + '</option>' : '') + f.options.map((o) => { o = opt(o); return '<option value="' + esc(o.v) + '"' + (String(o.v) === String(val) ? ' selected' : '') + '>' + esc(o.l) + '</option>'; }).join('') + '</select>'; break;
      case 'checks': { const vals = (Array.isArray(val) ? val : []).map(String); inner = '<div class="checks" data-multi="' + f.name + '">' + f.options.map((o) => { o = opt(o); return '<label class="ck"><input type="checkbox" name="' + f.name + '" value="' + esc(o.v) + '"' + (vals.indexOf(String(o.v)) >= 0 ? ' checked' : '') + '><span>' + esc(o.l) + '</span></label>'; }).join('') + '</div>'; break; }
      case 'radios': inner = '<div class="checks">' + f.options.map((o) => { o = opt(o); return '<label class="ck"><input type="radio" name="' + f.name + '" value="' + esc(o.v) + '"' + (String(o.v) === String(val) ? ' checked' : '') + req + '><span>' + esc(o.l) + '</span></label>'; }).join('') + '</div>'; break;
      case 'check': return '<div class="f ' + (f.half ? '' : 'full') + '"><label class="ck single"><input type="checkbox" data-bool="1" name="' + f.name + '"' + (val ? ' checked' : '') + req + '><span>' + esc(f.text || f.label) + (f.required ? ' <i class="req">*</i>' : '') + '</span></label>' + help + '</div>';
      case 'photos': inner = photoField(f); break;
      case 'items': inner = AiC.itemsEditor(f.name, f.catalog, f.value || []); break;
      default: inner = '<input class="inp" id="' + id + '" type="' + (f.type || 'text') + '" name="' + f.name + '" value="' + esc(val) + '" placeholder="' + esc(f.placeholder || '') + '"' + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') + (f.step != null ? ' step="' + f.step + '"' : '') + req + '>';
    }
    return '<div class="f ' + (f.full ? 'full' : '') + '">' + lab + inner + help + '</div>';
  }
  function photoField(f) {
    const presets = f.presets || ['calha-frontal', 'vazamento', 'condutor', 'rufo', 'limpeza', 'aluminio'];
    return '<div class="pf"><label class="pf-up">' + icon('camera', 22) + '<span><b>Escolher fotos do dispositivo</b><small>Simulação: as imagens ficam apenas neste navegador.</small></span><input type="file" name="' + f.name + '" accept="image/*" multiple data-preview="1"></label><div class="fprev"></div>' +
      '<div class="pf-or">Ou marque imagens ilustrativas para a demonstração:</div><div class="pf-pre" data-multi="' + f.name + '__preset">' + presets.map((k) => '<label class="pf-p"><input type="checkbox" name="' + f.name + '__preset" value="' + k + '"' + ((f.preselect || []).indexOf(k) >= 0 ? ' checked' : '') + '>' + AiC.photo(k) + '<small>' + esc(ILL[k].l) + '</small></label>').join('') + '</div></div>';
  }
  /** Editor de itens (materiais) com subtotal e total automáticos. */
  AiC.itemsEditor = function (name, catalog, items) {
    S.catalogs[name] = catalog;
    const rows = (items.length ? items : [{}]).map((it) => itemRow(catalog, it)).join('');
    return '<div class="ied" data-name="' + name + '"><div class="tw"><table class="tbl ied-t"><thead><tr><th>Material</th><th class="r">Qtd.</th><th class="r">Preço unit.</th><th class="r">Subtotal</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div><div class="ied-f"><button type="button" class="btn sm" data-act="core.addLine" data-name="' + name + '">' + icon('plus', 15) + ' Adicionar item</button><span class="ied-tot">Total dos itens: <b>' + AiC.money(AiC.sum(items, (x) => x.qtd * x.preco)) + '</b></span></div></div>';
  };
  function itemRow(cat, it) {
    return '<tr><td><select class="inp ied-m" aria-label="Material"><option value="">Selecione…</option>' + cat.map((m) => '<option value="' + m.id + '" data-price="' + m.preco + '"' + (m.id === it.id ? ' selected' : '') + '>' + esc(m.nome) + ' (' + esc(m.un) + ')</option>').join('') + '</select></td><td class="r"><input class="inp ied-q" type="number" min="0" step="0.5" aria-label="Quantidade" value="' + (it.qtd != null ? it.qtd : 1) + '"></td><td class="r"><input class="inp ied-p" type="number" min="0" step="0.01" aria-label="Preço unitário" value="' + (it.preco != null ? it.preco : '') + '"></td><td class="r ied-s num">' + AiC.money((it.qtd || 0) * (it.preco || 0)) + '</td><td><button type="button" class="ibtn" data-act="core.delLine" title="Remover item" aria-label="Remover item">' + icon('trash', 15) + '</button></td></tr>';
  }
  function readItems(ed) {
    const cat = S.catalogs[ed.dataset.name] || [];
    return Array.from(ed.querySelectorAll('tbody tr')).map((tr) => {
      const id = tr.querySelector('.ied-m').value;
      if (!id) return null;
      const m = cat.find((x) => x.id === id) || {};
      return { id: id, nome: m.nome, un: m.un, qtd: +tr.querySelector('.ied-q').value || 0, preco: +tr.querySelector('.ied-p').value || 0, custo: m.custo || 0 };
    }).filter((x) => x && x.qtd > 0);
  }
  AiC.readItems = readItems;
  function recalcItems(ed) {
    let tot = 0;
    ed.querySelectorAll('tbody tr').forEach((tr) => { const q = +tr.querySelector('.ied-q').value || 0, p = +tr.querySelector('.ied-p').value || 0; tr.querySelector('.ied-s').textContent = AiC.money(q * p); tot += q * p; });
    ed.querySelector('.ied-tot b').textContent = AiC.money(tot);
  }
  AiC.itemsTotal = (items) => AiC.sum(items || [], (x) => x.qtd * x.preco);

  AiC.form = function (o) {
    S.formExtra = o.extra || {};
    const body = (o.intro ? AiC.note(o.intro) + '<div style="height:14px"></div>' : '') + '<form data-form="' + o.submit + '" id="mform" class="fg' + (o.one ? ' one' : '') + '" autocomplete="off">' + o.fields.map(fieldHTML).join('') + '</form>' + (o.after || '');
    AiC.modal({ title: o.title, sub: o.sub, size: o.size, body: body, foot: '<button type="button" class="btn" data-act="core.close">Cancelar</button><button class="btn ' + (o.btnCls || 'p') + '" type="submit" form="mform">' + icon(o.icon || 'check', 16) + ' ' + esc(o.submitLabel || 'Salvar') + '</button>' });
    S.formCalc = o.calc || null;
    if (S.formCalc) setTimeout(() => { const f = document.getElementById('mform'); if (f && S.formCalc) S.formCalc(f); }, 0);
  };
  AiC.confirm = function (o) {
    S.pendingOk = o.onOk;
    AiC.modal({ title: o.title, size: 'sm', body: '<p class="cf">' + o.msg + '</p>' + (o.note ? AiC.note(o.note, o.noteTone) : ''), foot: '<button type="button" class="btn" data-act="core.close">Cancelar</button><button type="button" class="btn ' + (o.danger ? 'dgs' : 'p') + '" data-act="core.ok">' + esc(o.ok || 'Confirmar') + '</button>' });
  };
  AiC.toast = function (msg, tone) {
    const w = document.getElementById('toasts');
    if (!w) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (tone || 'ok');
    t.innerHTML = icon(tone === 'bad' ? 'alert' : tone === 'warn' ? 'info' : 'check', 16) + '<span>' + esc(msg) + '</span>';
    w.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3400);
    setTimeout(() => t.remove(), 3800);
  };
  /** Conclui uma ação: registra no histórico, fecha o modal, atualiza a tela e avisa. */
  AiC.done = function (msg, acao, ref, tone) {
    if (acao) AiC.log(acao, ref);
    AiC.close();
    AiC.refresh();
    if (msg) AiC.toast(msg, tone);
  };
  AiC.readImage = (file) => new Promise((res, rej) => {
    if (!/^image\//.test(file.type)) { rej(new Error('Arquivo não é imagem')); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 640, k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        try { res(cv.toDataURL('image/jpeg', 0.72)); } catch (e) { res(fr.result); }
      };
      img.onerror = rej;
      img.src = fr.result;
    };
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });

  /* ------------------------------------------------------------------
     Histórico de atividades (logs)
     ------------------------------------------------------------------ */
  function logView(p) {
    return { id: 'historico', label: p === 'mediador' ? 'Histórico e logs' : 'Minhas atividades', icon: 'history', title: p === 'mediador' ? 'Histórico de atividades e logs' : 'Minhas atividades', render: () => renderLog(p) };
  }
  function logRows(p) {
    const me = AiC.me();
    let rows = S.st.logs.slice().sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
    const own = p !== 'mediador';
    if (own) rows = rows.filter((l) => l.usuario === me.nome);
    const pf = AiC.fv('log', 'perfil'), per = AiC.fv('log', 'per', 'all'), org = AiC.fv('log', 'org'), q = AiC.fv('log', 'q').toLowerCase();
    if (pf) rows = rows.filter((l) => l.perfil === pf);
    rows = rows.filter((l) => AiC.inPeriod(l.ts, per));
    if (org === 'demo') rows = rows.filter((l) => l.demo);
    if (org === 'hist') rows = rows.filter((l) => !l.demo);
    if (q) rows = rows.filter((l) => (l.acao + ' ' + l.ref + ' ' + l.usuario).toLowerCase().indexOf(q) >= 0);
    return rows;
  }
  const pname = (p) => (PROF[p] ? PROF[p].short : p === 'sistema' ? 'Sistema' : p);
  function renderLog(p) {
    const own = p !== 'mediador';
    const rows = logRows(p);
    const all = own ? S.st.logs.filter((l) => l.usuario === AiC.me().nome) : S.st.logs;
    const demoN = all.filter((l) => l.demo).length;
    const users = Object.keys(AiC.count(all, (l) => l.usuario)).length;
    const last = all.slice().sort((a, b) => (a.ts < b.ts ? 1 : -1))[0];
    const defs = (own ? [] : [{ k: 'perfil', l: 'Perfil', o: AiC.opts([{ v: 'cliente', l: 'Cliente' }, { v: 'profissional', l: 'Profissional' }, { v: 'mediador', l: 'Mediador' }], 'Todos') }])
      .concat([{ k: 'per', l: 'Período', def: 'all', o: AiC.PERIODS }, { k: 'org', l: 'Origem', o: AiC.opts([{ v: 'demo', l: 'Nesta demonstração' }, { v: 'hist', l: 'Histórico fictício' }], 'Todas') }, { k: 'q', type: 'search', l: 'Buscar ação, registro ou usuário' }]);
    return AiC.ph(own ? 'Minhas atividades' : 'Histórico de atividades e logs',
      own ? 'Registro das suas ações neste cenário. A gestão AiCalhas visualiza o histórico completo de todos os perfis.' : 'Trilha de auditoria simulada: data, horário, usuário, perfil e ação realizada. As ações feitas durante a demonstração aparecem destacadas.',
      AiC.b('Exportar CSV', 'core.csv', {}, '', 'download')) +
      '<div class="g4 mb16">' +
      AiC.kpi({ l: 'Registros no histórico', v: AiC.num(all.length), icon: 'history' }) +
      AiC.kpi({ l: 'Ações nesta demonstração', v: AiC.num(demoN), icon: 'flag', s: 'Desde o último reinício' }) +
      AiC.kpi({ l: own ? 'Perfil' : 'Usuários envolvidos', v: own ? esc(PROF[p].short) : users, icon: 'users' }) +
      AiC.kpi({ l: 'Último registro', v: last ? AiC.ft(last.ts) : '—', s: last ? AiC.fd(last.ts) : '', icon: 'clock' }) +
      '</div>' +
      AiC.card(null, AiC.filters('log', defs) + AiC.table([
        { l: 'Data', f: (r) => '<span class="nowrap">' + AiC.fd(r.ts) + '</span>' },
        { l: 'Horário', f: (r) => AiC.ft(r.ts) },
        { l: 'Usuário', f: (r) => '<span class="nowrap">' + esc(r.usuario) + '</span>' },
        { l: 'Perfil', f: (r) => AiC.badge(pname(r.perfil), 'neutral') },
        { l: 'Ação realizada', f: (r) => esc(r.acao) + (r.demo ? '<span class="new">nesta demonstração</span>' : '') },
        { l: 'Registro', f: (r) => '<span class="muted">' + esc(r.ref) + '</span>' },
      ], rows.slice(0, 400), { empty: 'Nenhuma atividade encontrada para os filtros.' }), { flush: true });
  }

  /* ------------------------------------------------------------------
     Explicação do cenário
     ------------------------------------------------------------------ */
  function explain() {
    const c = S.cfg, a = c.about;
    const body = '<div class="ex-top">' + AiC.meter(a.level, true) + '<span>Participação da AiCalhas: <b>' + LV[a.level] + '</b></span></div>' +
      '<p class="lead">' + esc(a.resumo) + '</p>' +
      '<div class="g2"><div><h4>Como funciona</h4><ol class="ol">' + a.como.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol></div>' +
      '<div><h4>Papel do mediador</h4><ul class="ul chk">' + a.mediador.map((x) => '<li>' + icon('check', 15) + '<span>' + esc(x) + '</span></li>').join('') + '</ul></div></div>' +
      '<h4>Até onde vai a participação da AiCalhas</h4>' + AiC.journey(c.num) +
      '<div style="height:12px"></div>' + AiC.note('<b>Limite deste modelo:</b> ' + esc(a.limite)) +
      '<h4>Exemplo prático</h4><p>' + esc(a.exemplo) + '</p>' +
      '<h4>O painel da gestão acompanha</h4><p>' + esc(a.painel) + '</p>' +
      '<h4>Compare com os outros cenários</h4><div class="scx">' + SCN.map((s) => '<a href="' + s.f + '" class="' + (s.n === c.num ? 'on' : '') + '">' + AiC.meter(s.lv) + '<b>Cenário ' + s.n + '</b><span>' + esc(s.t) + '</span></a>').join('') + '</div>';
    AiC.modal({ title: 'Como funciona — Cenário ' + c.num + ': ' + c.title, body: body, size: 'lg', foot: '<a class="btn" href="index.html">' + icon('arrowL', 16) + ' Voltar à capa</a><button type="button" class="btn p" data-act="core.close">Entendi</button>' });
  }

  /* ------------------------------------------------------------------
     Ações internas e eventos
     ------------------------------------------------------------------ */
  function closeMenu() { const sh = document.getElementById('shell'); if (sh) sh.classList.remove('menu-open'); }
  function closeUM() { const u = document.getElementById('umdd'); if (u) u.hidden = true; }
  function login(p, how) {
    S.ui.profile = p;
    S.ui.view = S.cfg.profiles[p].home;
    S.ui.sel = {}; S.ui.f = {};
    AiC.log(how || 'Login demonstrativo', 'Acesso ao perfil ' + PROF[p].label);
    render();
    window.scrollTo(0, 0);
    AiC.toast('Você entrou como ' + AiC.me().nome + ' (' + PROF[p].short + ').');
  }
  const CORE = {
    'core.nav': (ds) => { closeUM(); AiC.go(ds.view, ds.id); },
    'core.tab': (ds) => { S.ui.tab[ds.scope] = ds.id; AiC.refresh(); },
    'core.clearf': (ds) => { Object.keys(S.ui.f).forEach((k) => { if (k.indexOf(ds.scope + '.') === 0) delete S.ui.f[k]; }); AiC.refresh(); },
    'core.menu': () => { const sh = document.getElementById('shell'); if (sh) sh.classList.toggle('menu-open'); },
    'core.umenu': () => { const u = document.getElementById('umdd'); if (u) u.hidden = !u.hidden; },
    'core.quick': (ds) => login(ds.p, 'Login demonstrativo (acesso rápido)'),
    'core.login': (v) => {
      const em = String(v.email || '').trim().toLowerCase();
      const us = S.cfg.users;
      const p = Object.keys(us).find((k) => us[k].email.toLowerCase() === em);
      if (!p) { AiC.toast('E-mail não encontrado. Use uma das contas de demonstração indicadas.', 'warn'); return; }
      login(p, 'Login demonstrativo (e-mail e senha)');
    },
    'core.switch': (ds) => {
      closeUM();
      if (ds.p === S.ui.profile) return;
      AiC.log('Saída do sistema (troca de perfil)', 'Encerrou a sessão de ' + PROF[S.ui.profile].label);
      login(ds.p, 'Login demonstrativo (troca rápida de perfil)');
    },
    'core.logout': () => {
      closeUM();
      AiC.log('Saída do sistema (logout)', 'Sessão encerrada');
      S.ui.profile = null;
      render();
      window.scrollTo(0, 0);
      AiC.toast('Sessão encerrada. Escolha um perfil para entrar novamente.');
    },
    'core.reset': () => {
      closeUM();
      AiC.confirm({
        title: 'Reiniciar demonstração',
        msg: 'Os dados fictícios voltarão ao estado inicial e as ações feitas nesta demonstração serão descartadas. Deseja continuar?',
        ok: 'Reiniciar',
        onOk: () => {
          const p = S.ui.profile, about = S.ui.about;
          S.st = freshState(); S.ui = freshUI(); S.ui.about = about;
          if (p) { S.ui.profile = p; S.ui.view = S.cfg.profiles[p].home; AiC.log('Demonstração reiniciada', 'Dados fictícios restaurados'); }
          render(); window.scrollTo(0, 0);
          AiC.toast('Demonstração reiniciada com os dados fictícios iniciais.');
        },
      });
    },
    'core.explain': () => { closeUM(); explain(); },
    'core.about': () => { S.ui.about = !S.ui.about; const el = document.querySelector('.about'); if (el) el.outerHTML = aboutHTML(); save(); },
    'core.close': () => AiC.close(),
    'core.ok': () => { const fn = S.pendingOk; S.pendingOk = null; AiC.close(); if (fn) fn(); },
    'core.addLine': (ds) => { const ed = document.querySelector('.ied[data-name="' + ds.name + '"]'); if (!ed) return; ed.querySelector('tbody').insertAdjacentHTML('beforeend', itemRow(S.catalogs[ds.name] || [], {})); },
    'core.delLine': (ds, el) => { const ed = el.closest('.ied'); el.closest('tr').remove(); if (ed) { recalcItems(ed); runCalc(); } },
    'core.zoom': (ds, el) => { const p = el.querySelector('.pimg'); AiC.modal({ title: ds.cap || 'Foto', size: 'lg', body: '<div style="max-width:100%">' + (p ? p.outerHTML.replace('<span class="cap">', '<span class="cap" hidden>') : '') + '</div>' }); },
    'core.csv': () => {
      const rows = logRows(S.ui.profile);
      const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
      const lines = [['Data', 'Horário', 'Usuário', 'Perfil', 'Ação', 'Registro', 'Origem'].map(q).join(';')].concat(rows.map((r) => [AiC.fd(r.ts), AiC.ft(r.ts), r.usuario, pname(r.perfil), r.acao, r.ref, r.demo ? 'Demonstração' : 'Histórico fictício'].map(q).join(';')));
      try {
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'aicalhas-cenario-' + S.cfg.num + '-historico.csv';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        AiC.log('Exportação do histórico (CSV)', rows.length + ' registros');
        AiC.toast('Arquivo CSV gerado com ' + rows.length + ' registros.');
        AiC.refresh();
      } catch (e) { AiC.toast('Não foi possível gerar o arquivo neste navegador.', 'bad'); }
    },
  };
  function runCalc() { const f = document.getElementById('mform'); if (f && S.formCalc) { try { S.formCalc(f); } catch (e) { console.error(e); } } }

  async function formValues(f) {
    const o = {};
    const fd = new FormData(f);
    fd.forEach((v, k) => {
      if (typeof v !== 'string') return;
      if (o[k] !== undefined) { if (!Array.isArray(o[k])) o[k] = [o[k]]; o[k].push(v); } else o[k] = v;
    });
    f.querySelectorAll('[data-multi]').forEach((g) => { const n = g.dataset.multi; if (o[n] === undefined) o[n] = []; else if (!Array.isArray(o[n])) o[n] = [o[n]]; });
    f.querySelectorAll('input[type=checkbox][data-bool]').forEach((c) => { o[c.name] = c.checked; });
    f.querySelectorAll('.ied').forEach((ed) => { o[ed.dataset.name] = readItems(ed); });
    const files = f.querySelectorAll('input[type=file]');
    for (let i = 0; i < files.length; i++) {
      const inp = files[i], arr = [];
      const list = Array.prototype.slice.call(inp.files || [], 0, 6);
      for (let j = 0; j < list.length; j++) { try { arr.push(await AiC.readImage(list[j])); } catch (e) { /* ignora */ } }
      o[inp.name] = arr;
    }
    Object.keys(o).forEach((k) => {
      if (k.slice(-8) === '__preset') { const base = k.slice(0, -8); o[base] = (Array.isArray(o[base]) ? o[base] : []).concat(o[k]); delete o[k]; }
    });
    return o;
  }

  let debounce = null;
  function bind() {
    document.addEventListener('click', (e) => {
      const um = document.getElementById('umdd');
      if (um && !um.hidden && !e.target.closest('.um')) um.hidden = true;
      if (e.target.matches && e.target.matches('.mb[data-backdrop]')) { AiC.close(); return; }
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      e.preventDefault();
      const name = el.dataset.act;
      const fn = CORE[name] || (S.cfg.actions && S.cfg.actions[name]);
      if (!fn) { console.warn('Ação não encontrada:', name); AiC.toast('Ação demonstrativa indisponível: ' + name, 'warn'); return; }
      try { fn(el.dataset, el, e); } catch (err) { console.error(err); AiC.toast('Não foi possível concluir a ação: ' + err.message, 'bad'); }
    });
    document.addEventListener('submit', async (e) => {
      const f = e.target.closest('form[data-form]');
      if (!f) return;
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      const name = f.dataset.form;
      const fn = CORE[name] || (S.cfg.actions && S.cfg.actions[name]);
      if (!fn) { AiC.toast('Formulário demonstrativo indisponível: ' + name, 'warn'); return; }
      const extra = S.formExtra || {};
      try { const vals = await formValues(f); fn(vals, extra, f); } catch (err) { console.error(err); AiC.toast('Não foi possível salvar: ' + err.message, 'bad'); }
    });
    document.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset && t.dataset.filter && t.tagName === 'SELECT') { S.ui.f[t.dataset.filter] = t.value; AiC.refresh(); return; }
      if (t.classList && t.classList.contains('ied-m')) {
        const op = t.options[t.selectedIndex];
        const pr = t.closest('tr').querySelector('.ied-p');
        if (op && op.dataset.price) pr.value = op.dataset.price;
        recalcItems(t.closest('.ied'));
      }
      if (t.type === 'file' && t.dataset.preview) {
        const box = t.closest('.pf').querySelector('.fprev');
        box.innerHTML = '';
        Array.prototype.slice.call(t.files || [], 0, 6).forEach((file) => { if (/^image\//.test(file.type)) { const img = document.createElement('img'); img.alt = file.name; img.src = URL.createObjectURL(file); box.appendChild(img); } });
      }
      if (t.closest && t.closest('#mform')) runCalc();
    });
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset && t.dataset.filter && t.tagName === 'INPUT') {
        clearTimeout(debounce);
        debounce = setTimeout(() => { S.ui.f[t.dataset.filter] = t.value; AiC.refresh(); }, 220);
        return;
      }
      if (t.closest && t.closest('.ied')) recalcItems(t.closest('.ied'));
      if (t.closest && t.closest('#mform')) runCalc();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (document.querySelector('#modal-root .mb')) AiC.close(); closeUM(); closeMenu(); }
    });
  }
})();
