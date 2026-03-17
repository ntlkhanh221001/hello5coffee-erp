(function() {
  // ═══════════════════════════════════════════
  // H5C SIDEBAR - Shared component v2
  // ═══════════════════════════════════════════

  // 1. Inject CSS - dùng var() thay vì hardcode màu
  const style = document.createElement('style');
  style.id = 'h5c-sidebar-style';
  style.textContent = `
    :root{--brown:#38261C;--brown-l:#5C3D2A;--brown-m:#7A5240;--green:#8FC643;--green-d:#6FA030;--green-l:#C5E08A;--cream:#FBF6F0;--cream-d:#F0E6D8;--cream-b:#E2D0BC;--white:#FFF;--red:#C0392B;--orange:#D4851A;--blue:#2980B9}
    .layout{display:flex;min-height:100vh}
    .sidebar{width:240px;background:var(--brown);display:flex;flex-direction:column;position:fixed;height:100vh;left:0;top:0;z-index:100}
    .sidebar-header{padding:24px;text-align:center;border-bottom:1px solid rgba(255,255,255,.1)}
    .sidebar-logo{width:56px;height:56px;background:var(--green);border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--brown)}
    .sidebar-brand{font-size:15px;font-weight:800;color:var(--green)}
    .sidebar-tagline{font-size:10px;color:rgba(255,255,255,.6);margin-top:4px}
    .sidebar-nav{flex:1;padding:16px 12px;overflow-y:auto}
    .nav-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;color:rgba(255,255,255,.7);font-size:13px;font-weight:600;cursor:pointer;margin-bottom:4px;transition:all .2s}
    .nav-item:hover{background:rgba(255,255,255,.08);color:#fff}
    .nav-item.active{background:var(--green);color:var(--brown)}
    .nav-item .icon{font-size:18px;flex-shrink:0}
    .sidebar-footer{padding:16px;border-top:1px solid rgba(255,255,255,.1)}
    .lang-toggle{display:flex;background:rgba(255,255,255,.1);border-radius:8px;overflow:hidden}
    .lang-btn{flex:1;padding:8px;border:none;background:transparent;color:rgba(255,255,255,.6);font-size:11px;font-weight:700;cursor:pointer;transition:all .2s}
    .lang-btn.active{background:var(--green);color:var(--brown)}
    .main{margin-left:240px;flex:1;min-height:100vh;display:flex;flex-direction:column}
  `;
  document.getElementById('h5c-sidebar-style')?.remove();
  document.head.appendChild(style);

  // 2. Nav items
  const NAV_ITEMS = [
    {id:'dashboard',     icon:'📊', label:'Tổng quan'},
    {id:'orders',        icon:'📦', label:'Đơn Hàng Bán'},
    {id:'leads',         icon:'🎯', label:'Lead / CRM'},
    {id:'expenses',      icon:'💰', label:'Chi phí'},
    {id:'warehouse',     icon:'🏭', label:'Kho hàng'},
    {id:'users',         icon:'👥', label:'Nhân viên'},

    {id:'reports',       icon:'📈', label:'Báo cáo'},
    {id:'announcements', icon:'📢', label:'Thông báo'},
  ];

  const PAGE_MAP = {
    dashboard:'dashboard.html', orders:'orders.html', leads:'leads.html',
    expenses:'expenses.html',   warehouse:'warehouse.html', users:'users.html',
    reports:'reports.html',     announcements:'announcements.html',
  };

  // 3. Detect current page
  const currentPage = window.location.pathname.split('/').pop().replace('.html','') || 'dashboard';

  // 4. Core render function - ALWAYS use this, never the per-file renderNav
  function _canViewModule(moduleId) {
    try {
      const session  = JSON.parse(localStorage.getItem('h5c_erp_user') || 'null');
      if (!session) return false;
      const accounts = JSON.parse(localStorage.getItem('h5c_v1_accounts') || '[]');
      const acc      = accounts.find(a => a.email === (session.email||''));
      if (!acc) return (session.role === 'C_LEVEL');
      if (acc.permissions) {
        // New granular format: flat keys like 'dash.view', 'orders.view'
        const viewMap = {
          dashboard:'dash.view', orders:'orders.view', leads:'leads.view',
          expenses:'expenses.view', warehouse:'wh.view_stock', users:'users.view',
          reports:'reports.view', announcements:'ann.view'
        };
        const permId = viewMap[moduleId];
        if (permId) {
          const val = acc.permissions[permId];
          return val === true || val === 'all' || val === 'own';
        }
        // Fallback: old format check
        if (acc.permissions[moduleId] && acc.permissions[moduleId].view) return true;
        return false;
      }
      // Role template defaults
      const roleDefs = {
        C_LEVEL:          null, // sees all
        MANAGER:          ['dashboard','orders','leads','expenses','warehouse','users','reports','announcements'],
        EMPLOYEE_SALES:   ['dashboard','orders','leads','announcements'],
        EMPLOYEE_FINANCE: ['dashboard','expenses','reports','announcements'],
        EMPLOYEE_HR:      ['dashboard','users','announcements'],
      };
      const allowed = roleDefs[acc.role];
      if (allowed === null || allowed === undefined) return true;
      return allowed.includes(moduleId);
    } catch(e) { return true; }
  }

  function buildNav() {
    const nav = document.getElementById('sidebarNav');
    if (!nav) return;
    nav.innerHTML = NAV_ITEMS.filter(item => _canViewModule(item.id)).map(item => {
      const active  = item.id === currentPage ? ' active' : '';
      const onclick = PAGE_MAP[item.id]
        ? `navigateTo('${item.id}')`
        : `alert('Module đang phát triển!')`;
      return `<div class="nav-item${active}" onclick="${onclick}">
        <span class="icon">${item.icon}</span>
        <span>${item.label}</span>
      </div>`;
    }).join('');
  }

  // 5. Build full sidebar HTML
  function buildSidebar() {
    const aside = document.querySelector('aside.sidebar');
    if (!aside) return;
    aside.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-logo">☕</div>
        <div class="sidebar-brand">Hello 5 Coffee</div>
        <div class="sidebar-tagline">Internal Management</div>
      </div>
      <nav class="sidebar-nav" id="sidebarNav"></nav>
      <div class="sidebar-footer">
        <div class="lang-toggle">
          <button class="lang-btn active" data-lang="vi" onclick="setLang('vi')">🇻🇳 VI</button>
          <button class="lang-btn" data-lang="en" onclick="setLang('en')">🇬🇧 EN</button>
        </div>
      </div>
    `;
    buildNav();
  }

  // 6. Override navigateTo và renderNav toàn cục
  //    Chạy SAU DOMContentLoaded để override được hàm của từng file
  window.navigateTo = function(page) {
    if (page === currentPage) return;
    if (PAGE_MAP[page]) window.location.href = PAGE_MAP[page];
    else alert('Module "' + page + '" đang được phát triển!');
  };

  window.setLang = function(l) {
    document.querySelectorAll('.lang-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.lang === l)
    );
  };

  // Override renderNav của từng file - dùng hàm của sidebar.js
  window.renderNav = buildNav;

  // 7. Init
  function init() {
    buildSidebar();
    // Override lại sau khi file's own script đã chạy xong
    window.renderNav = buildNav;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 8. Safety: override renderNav lần nữa sau 50ms (phòng file ghi đè lại)
  setTimeout(function() {
    window.renderNav = buildNav;
    buildNav(); // re-render nav để chắc chắn
  }, 50);

})();
