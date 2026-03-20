// ═══════════════════════════════════════════════════════════════
// H5C CORE.JS v2 — Hello 5 Coffee ERP
// Load trong <head>, TRƯỚC sidebar.js
// Tự override handleLogin sau khi tất cả page script đã chạy
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ──────────────────────────────────────────────
  // 1. GOOGLE SANS FONT
  // ──────────────────────────────────────────────
  const fontLink = document.createElement('link');
  fontLink.rel = 'preconnect';
  fontLink.href = 'https://fonts.googleapis.com';
  document.head.appendChild(fontLink);

  const fontLink2 = document.createElement('link');
  fontLink2.rel = 'preconnect';
  fontLink2.href = 'https://fonts.gstatic.com';
  fontLink2.crossOrigin = 'anonymous';
  document.head.appendChild(fontLink2);

  const fontLink3 = document.createElement('link');
  fontLink3.rel = 'stylesheet';
  fontLink3.href = 'https://fonts.googleapis.com/css2?family=Google+Sans:wght@300;400;500;700&family=Google+Sans+Text:wght@300;400;500;700&display=swap';
  document.head.appendChild(fontLink3);

  // Inject font override CSS
  const fontStyle = document.createElement('style');
  fontStyle.id = 'h5c-font-override';
  fontStyle.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@300;400;500;700&display=swap');

    /* Fallback nếu Google Sans không load được */
    @font-face {
      font-family: 'Google Sans';
      src: local('Google Sans'), local('GoogleSans');
      font-weight: 100 900;
    }

    * {
      font-family: 'Google Sans', 'Segoe UI', system-ui, -apple-system, sans-serif !important;
    }
    input, select, button, textarea {
      font-family: 'Google Sans', 'Segoe UI', system-ui, -apple-system, sans-serif !important;
    }

    /* ═══ SMOOTH TRANSITIONS ═══ */

    /* Page load: fade in */
    @keyframes h5c-page-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    /* Page navigate out: fade + slide */
    @keyframes h5c-page-out {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: 0; transform: translateY(-8px); }
    }
    /* Content swap: smooth fade */
    @keyframes h5c-content-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Apply page-in animation on load */
    .main { animation: h5c-page-in .3s ease; }

    /* Content area transitions */
    .content, #pageContent {
      animation: h5c-content-in .25s ease;
    }

    /* Page leaving state */
    body.h5c-leaving .main {
      animation: h5c-page-out .2s ease forwards;
      pointer-events: none;
    }

    /* Smooth transitions for interactive elements */
    .stat-card, .kpi-card, .chart-card, .announce-card, .request-card,
    .nav-item, .tab-btn, .btn-add, .btn-secondary, .modal-btn,
    .data-table tr, .filter-select, .filter-input {
      transition: all .2s ease;
    }

    /* Modal open: slide up + fade */
    @keyframes h5c-modal-in {
      from { opacity: 0; transform: scale(.96) translateY(12px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes h5c-overlay-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .modal-overlay:not(.hidden) {
      animation: h5c-overlay-in .2s ease;
    }
    .modal-overlay:not(.hidden) .modal {
      animation: h5c-modal-in .25s ease;
    }

    /* Scrollbar smooth */
    * { scroll-behavior: smooth; }

    /* Toast styles */
    @keyframes h5c-toast-in  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes h5c-toast-out { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(16px)} }
    @keyframes h5c-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }

    #h5c-toast-container {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      display: flex; flex-direction: column; gap: 8px; pointer-events: none;
    }
    .h5c-toast {
      padding: 13px 18px; border-radius: 12px; font-size: 13px; font-weight: 500;
      color: #fff; min-width: 260px; max-width: 380px;
      box-shadow: 0 8px 24px rgba(0,0,0,.18);
      display: flex; align-items: center; gap: 10px;
      pointer-events: all; cursor: default;
      animation: h5c-toast-in .3s ease;
    }
    .h5c-toast.success { background: linear-gradient(135deg,#2E7D32,#388E3C); }
    .h5c-toast.error   { background: linear-gradient(135deg,#C62828,#D32F2F); }
    .h5c-toast.warning { background: linear-gradient(135deg,#E65100,#F57F17); }
    .h5c-toast.info    { background: linear-gradient(135deg,#1565C0,#1976D2); }
    .h5c-toast-icon { font-size: 18px; flex-shrink: 0; }
    .h5c-toast-msg  { flex: 1; line-height: 1.4; }
    .h5c-toast-close {
      background: none; border: none; color: rgba(255,255,255,.6);
      cursor: pointer; font-size: 18px; padding: 0; line-height: 1; flex-shrink: 0;
    }
    .h5c-toast-close:hover { color: #fff; }
  `;
  document.head.appendChild(fontStyle);

  // ──────────────────────────────────────────────
  // 2. TOAST NOTIFICATION
  // ──────────────────────────────────────────────
  let _toastContainer = null;
  function _ensureToastContainer() {
    if (!_toastContainer) {
      _toastContainer = document.createElement('div');
      _toastContainer.id = 'h5c-toast-container';
      document.body.appendChild(_toastContainer);
    }
    return _toastContainer;
  }

  const TOAST_ICONS = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };

  window.showToast = function(message, type = 'success', duration = 3000) {
    const container = _ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = 'h5c-toast ' + type;
    toast.innerHTML = `
      <span class="h5c-toast-icon">${TOAST_ICONS[type] || 'ℹ️'}</span>
      <span class="h5c-toast-msg">${message}</span>
      <button class="h5c-toast-close" onclick="this.parentElement.remove()" title="Đóng">×</button>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'h5c-toast-out .3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  // ──────────────────────────────────────────────
  // 3. H5C SHARED DATA STORE
  // ──────────────────────────────────────────────
  const LS_PREFIX = 'h5c_v1_';

  // Chỉ define nếu chưa có (firebase-sync.js có thể đã patch)
  if (!window.H5C) {
    window.H5C = {
      _k: k => LS_PREFIX + k,
      get(k) {
        try { const v = localStorage.getItem(this._k(k)); return v ? JSON.parse(v) : null; } catch(e) { return null; }
      },
      set(k, v) {
        try { localStorage.setItem(this._k(k), JSON.stringify(v)); } catch(e) {}
      },
      init(k, def) {
        const v = this.get(k); if (v !== null) return v; this.set(k, def); return def;
      },
      clear(k) { localStorage.removeItem(this._k(k)); },
      mergeEmployees(arr) {
        const stored = this.get('employees');
        if (stored && stored.length) arr.splice(0, arr.length, ...stored);
      },
      salesList() {
        return (this.get('employees') || []).filter(e => e.status !== 'inactive').map(e => e.name);
      },
      productsList() {
        const skus = this.get('skus') || []; if (!skus.length) return null;
        const UM = {kg:'Kg',hop:'Hộp',chiec:'Chiếc',tui:'Túi',stick:'Stick',cont:'Cont'};
        return skus.map(s => ({id:s.id,name:s.name,unit:UM[s.unit]||s.unit||'Cái',price:s.suggestedPrice||0}));
      }
    };
  }

  // ──────────────────────────────────────────────
  // 4. SESSION (8 giờ expire)
  // ──────────────────────────────────────────────
  const SESSION_KEY = 'h5c_erp_user';
  const SESSION_TTL = 8 * 60 * 60 * 1000;

  window.saveSession = function(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...user, loginAt: Date.now() }));
  };

  window.loadSession = function() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s.loginAt && Date.now() - s.loginAt > SESSION_TTL) {
        localStorage.removeItem(SESSION_KEY);
        showToast('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại', 'warning');
        return null;
      }
      return s;
    } catch(e) { return null; }
  };

  window.clearSession = function() { localStorage.removeItem(SESSION_KEY); };

  // ──────────────────────────────────────────────
  // 5. ACCOUNTS — đọc từ Firebase (H5C)
  // ──────────────────────────────────────────────
  const DEFAULT_ACCOUNTS = [
    { email:'admin@hello5coffee.com',   pw:'Admin@123456', role:'C_LEVEL',          name:'Louis Nguyen',   pos:'CCO & Co-Founder',       empId:'EMP001', permissions:null },
    { email:'manager@hello5coffee.com', pw:'123456',       role:'MANAGER',          name:'Nguyễn Thị Lan', pos:'Trưởng phòng HR',        empId:'EMP002', permissions:null },
    { email:'sales@hello5coffee.com',   pw:'123456',       role:'EMPLOYEE_SALES',   name:'Lê Minh Khoa',   pos:'Chuyên viên Kinh doanh', empId:'EMP003', permissions:null },
    { email:'finance@hello5coffee.com', pw:'123456',       role:'EMPLOYEE_FINANCE', name:'Phạm Thị Mai',   pos:'Kế toán viên',           empId:'EMP004', permissions:null },
    { email:'nv@hello5coffee.com',      pw:'123456',       role:'EMPLOYEE_HR',      name:'Đặng Văn Hùng',  pos:'Chuyên viên Nhân sự',    empId:'EMP005', permissions:null },
  ];

  window.getAccounts = function() {
    const stored = H5C.get('accounts');
    if (!stored || !stored.length) { H5C.set('accounts', DEFAULT_ACCOUNTS); return DEFAULT_ACCOUNTS; }
    return stored;
  };

  // ──────────────────────────────────────────────
  // 6. UNIFIED HANDLELOGIN — override sau khi page script chạy
  // ──────────────────────────────────────────────
  function _unifiedHandleLogin() {
    const emailEl = document.getElementById('loginEmail');
    const pwEl    = document.getElementById('loginPassword');
    const errEl   = document.getElementById('loginError');
    if (!emailEl || !pwEl) return;

    const email = emailEl.value.trim().toLowerCase();
    const pw    = pwEl.value;

    if (!email || !pw) {
      if (errEl) { errEl.textContent = 'Vui lòng điền đầy đủ thông tin'; errEl.classList.add('show'); }
      return;
    }

    // Luôn đọc accounts mới nhất từ localStorage (firebase-sync đã pull về)
    const accounts = getAccounts();
    const acc = accounts.find(a => (a.email || '').toLowerCase() === email);

    if (!acc || acc.pw !== pw) {
      if (errEl) { errEl.textContent = 'Email hoặc mật khẩu không đúng'; errEl.classList.add('show'); }
      const box = document.querySelector('.login-box');
      if (box) { box.style.animation = 'none'; void box.offsetWidth; box.style.animation = 'h5c-shake .4s ease'; }
      return;
    }

    const userObj = {
      id: acc.empId || acc.email,
      name: acc.name,
      role: acc.role,
      pos: acc.pos,
      email: acc.email,
      empId: acc.empId || ''
    };

    if (typeof window.state !== 'undefined') window.state.user = userObj;
    saveSession(userObj);
    if (typeof window.showMain === 'function') window.showMain();
  }

  function _unifiedHandleLogout() {
    clearSession();
    if (typeof window.state !== 'undefined') window.state.user = null;
    const lp = document.getElementById('loginPage');
    const ml = document.getElementById('mainLayout');
    if (lp) lp.classList.remove('hidden');
    if (ml) ml.classList.add('hidden');
    const e = document.getElementById('loginEmail');
    const p = document.getElementById('loginPassword');
    if (e) { e.value = ''; }
    if (p) { p.value = ''; }
  }

  // ──────────────────────────────────────────────
  // 7. PERMISSION ENGINE
  // ──────────────────────────────────────────────
  const ROLE_PERMS = {
    C_LEVEL: null,
    MANAGER: {
      'dash.view':true,'dash.kpi_finance':true,'dash.ar_ap':true,'dash.top_sales':true,
      'orders.view':'all','orders.view_detail':true,'orders.view_cost':true,
      'orders.view_commission':'all','orders.view_history':true,'orders.view_cancelled':true,
      'orders.create':true,'orders.edit':'all','orders.update_progress':true,
      'orders.request_cancel':true,'orders.request_restore':true,
      'orders.approve_edit':true,'orders.approve_cancel':true,'orders.approve_restore':true,
      'orders.approve_request':true,'orders.submit_request':true,'orders.commission_config':true,
      'leads.view':'all','leads.create':true,'leads.edit':'all','leads.delete':true,'leads.convert_order':true,
      'expenses.view':'all','expenses.create':true,'expenses.edit':'all','expenses.approve':true,'expenses.reject':true,
      'wh.view_stock':true,'wh.view_lots':true,'wh.view_suppliers':true,'wh.view_po':true,
      'wh.create_sku':true,'wh.edit_sku':true,'wh.import':true,'wh.export':true,'wh.create_po':true,
      'users.view':true,'users.view_salary':true,'users.manage_attendance':true,'users.evaluate_kpi':true,
      'users.manage_accounts':false,
      'reports.view':true,
      'ann.view':true,'ann.create':true,'ann.approve':true,
    },
    EMPLOYEE_SALES: {
      'dash.view':true,'dash.top_sales':true,
      'orders.view':'own','orders.view_detail':true,'orders.view_commission':'own','orders.view_history':true,
      'orders.create':true,'orders.edit':'own','orders.update_progress':true,
      'orders.request_cancel':true,'orders.submit_request':true,
      'leads.view':'own','leads.create':true,'leads.edit':'own','leads.convert_order':true,
      'ann.view':true,
    },
    EMPLOYEE_FINANCE: {
      'dash.view':true,'dash.kpi_finance':true,'dash.ar_ap':true,
      'expenses.view':'all','expenses.create':true,'expenses.edit':'own',
      'reports.view':true,
      'ann.view':true,
    },
    EMPLOYEE_HR: {
      'dash.view':true,
      'users.view':true,'users.manage_attendance':true,'users.evaluate_kpi':true,
      'ann.view':true,'ann.create':true,
    },
  };

  window.getPermissions = function(acc) {
    if (!acc) return {};
    if (acc.role === 'C_LEVEL') return null;
    if (acc.permissions) return acc.permissions;
    return ROLE_PERMS[acc.role] || ROLE_PERMS['EMPLOYEE_HR'];
  };

  window._can = function(permId) {
    const session = loadSession(); if (!session) return false;
    if (session.role === 'C_LEVEL') return true;
    const acc = getAccounts().find(a => (a.email||'').toLowerCase() === (session.email||'').toLowerCase());
    if (!acc) return false;
    if (acc.role === 'C_LEVEL') return true;
    const perms = getPermissions(acc);
    if (!perms) return true;
    const val = perms[permId];
    return val === true || val === 'all' || val === 'own';
  };

  window._canScope = function(permId) {
    const session = loadSession(); if (!session) return false;
    if (session.role === 'C_LEVEL') return 'all';
    const acc = getAccounts().find(a => (a.email||'').toLowerCase() === (session.email||'').toLowerCase());
    if (!acc) return false;
    if (acc.role === 'C_LEVEL') return 'all';
    const perms = getPermissions(acc);
    if (!perms) return 'all';
    const val = perms[permId];
    if (val === true || val === 'all') return 'all';
    if (val === 'own') return 'own';
    return false;
  };

  // ──────────────────────────────────────────────
  // 8. NAVIGATION
  // ──────────────────────────────────────────────
  const PAGE_MAP = {
    dashboard:'dashboard.html', orders:'orders.html', leads:'leads.html',
    expenses:'expenses.html', warehouse:'warehouse.html', users:'users.html',
    reports:'reports.html', announcements:'announcements.html',
  };

  window.navigateTo = function(page) {
    const current = window.location.pathname.split('/').pop().replace('.html','');
    if (page === current) return;
    if (PAGE_MAP[page]) {
      // Check module permission before navigating
      const PERM_MAP = {
        orders:'orders.view', leads:'leads.view', expenses:'expenses.view',
        warehouse:'wh.view_stock', users:'users.view', reports:'reports.view',
        announcements:'ann.view'
      };
      const permId = PERM_MAP[page];
      if (permId && typeof window._can === 'function' && !window._can(permId)) {
        showToast('Bạn không có quyền truy cập module này', 'warning');
        return;
      }
      // Smooth page transition: fade out then navigate
      document.body.classList.add('h5c-leaving');
      setTimeout(function() { window.location.href = PAGE_MAP[page]; }, 180);
    }
    else showToast('Module "' + page + '" đang được phát triển!', 'warning');
  };

  window.setLang = function(l) {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === l));
  };

  // ──────────────────────────────────────────────
  // 9. UTILITIES
  // ──────────────────────────────────────────────
  window.fmtVND     = n => new Intl.NumberFormat('vi-VN').format(n || 0);
  window.formatDate = d => { if(!d)return'—'; const dt=new Date(d); return dt.getDate()+'/'+(dt.getMonth()+1)+'/'+dt.getFullYear(); };
  window.getInitials= n => n ? n.split(' ').map(w=>w[0]).slice(-2).join('').toUpperCase() : '?';

  // Collision-safe ID generator: H5C_genId('CP', existingArray)
  window.H5C_genId = function(prefix, existingArr) {
    let id;
    do { id = prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase(); }
    while (existingArr && existingArr.find(x => x.id === id));
    return id;
  };

  // Smooth content re-render: briefly fade out content, update, fade back in
  window.H5C_smoothRender = function(containerId, renderFn) {
    const el = document.getElementById(containerId);
    if (!el) { if (renderFn) renderFn(); return; }
    el.style.transition = 'opacity .15s ease';
    el.style.opacity = '0';
    setTimeout(function() {
      if (renderFn) renderFn();
      // Re-trigger animation
      el.style.removeProperty('transition');
      el.style.removeProperty('opacity');
      el.style.animation = 'none';
      void el.offsetWidth; // force reflow
      el.style.animation = 'h5c-content-in .25s ease';
    }, 150);
  };

  // ──────────────────────────────────────────────
  // 10. SAVE REFERENCES — for force override later
  //     HTML files may redefine _can, loadSession etc.
  //     We save core.js versions and re-apply after DOM ready
  // ──────────────────────────────────────────────
  const _core_can        = window._can;
  const _core_canScope   = window._canScope;
  const _core_loadSession  = window.loadSession;
  const _core_saveSession  = window.saveSession;
  const _core_clearSession = window.clearSession;
  const _core_navigateTo   = window.navigateTo;
  const _core_getAccounts  = window.getAccounts;
  const _core_getPerms     = window.getPermissions;

  // ──────────────────────────────────────────────
  // 11. INIT — DOMContentLoaded
  // ──────────────────────────────────────────────
  window.addEventListener('DOMContentLoaded', function() {
    // Đảm bảo toast container tồn tại
    _ensureToastContainer();

    // ★ FORCE OVERRIDE — HTML files redefine these locally, ghi đè lại bằng core.js version
    window.handleLogin   = _unifiedHandleLogin;
    window.handleLogout  = _unifiedHandleLogout;
    window._can          = _core_can;
    window._canScope     = _core_canScope;
    window.loadSession   = _core_loadSession;
    window.saveSession   = _core_saveSession;
    window.clearSession  = _core_clearSession;
    window.navigateTo    = _core_navigateTo;
    window.getAccounts   = _core_getAccounts;
    window.getPermissions = _core_getPerms;

    // Enter key cho login form
    const pwEl    = document.getElementById('loginPassword');
    const emailEl = document.getElementById('loginEmail');
    if (pwEl)    pwEl.addEventListener('keypress',    e => { if (e.key==='Enter') window.handleLogin(); });
    if (emailEl) emailEl.addEventListener('keypress', e => { if (e.key==='Enter') pwEl ? pwEl.focus() : window.handleLogin(); });
  });

  // ──────────────────────────────────────────────
  // 12. window.load — auto-login từ session + override lần nữa phòng page ghi đè
  // ──────────────────────────────────────────────
  window.addEventListener('load', function() {
    // ★ Override lại lần cuối — đảm bảo 100% dùng core.js version
    window.handleLogin   = _unifiedHandleLogin;
    window.handleLogout  = _unifiedHandleLogout;
    window._can          = _core_can;
    window._canScope     = _core_canScope;
    window.loadSession   = _core_loadSession;
    window.saveSession   = _core_saveSession;
    window.clearSession  = _core_clearSession;
    window.navigateTo    = _core_navigateTo;
    window.getAccounts   = _core_getAccounts;
    window.getPermissions = _core_getPerms;

    // Auto-login từ session nếu chưa login
    const ml = document.getElementById('mainLayout');
    if (ml && ml.classList.contains('hidden')) {
      const saved = loadSession();
      if (saved) {
        if (typeof window.state !== 'undefined') window.state.user = saved;
        if (typeof window.showMain === 'function') window.showMain();
      }
    }

    console.log('H5C Core v3: Ready ✅ — all functions unified, permission engine protected');
  });

})();
