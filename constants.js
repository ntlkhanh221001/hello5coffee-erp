// ════════════════════════════════════════════════════════════════
// HELLO 5 COFFEE ERP — Shared Constants & Format Helpers
// Load after core.js, before inline page scripts
// ════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── STATUS ENUMS ─────────────────────────────────────────────

  const ORDER_STATUS = Object.freeze({
    CONFIRMED:  'confirmed',
    PRODUCING:  'producing',
    PRODUCED:   'produced',
    SHIPPING:   'shipping',
    COMPLETED:  'completed',
    RETURNED:   'returned',
    CANCELLED:  'cancelled'
  });

  const PAYMENT_STATUS = Object.freeze({
    UNPAID:  'unpaid',
    PARTIAL: 'partial',
    PAID:    'paid'
  });

  const EXPENSE_STATUS = Object.freeze({
    CHO_DUYET: 'cho_duyet',
    DA_DUYET:  'da_duyet',
    TU_CHOI:   'tu_choi'
  });

  const EXPENSE_PAYMENT = Object.freeze({
    CHUA_THANH_TOAN: 'chua_thanh_toan',
    DA_THANH_TOAN:   'da_thanh_toan',
    MOT_PHAN:        'mot_phan'
  });

  const LEAD_PIPELINE = Object.freeze({
    LEAD:      'lead',
    BAO_GIA:   'bao_gia',
    GUI_SAMPLE:'gui_sample',
    DEAL:      'deal',
    CHOT_DON:  'chot_don',
    QUAY_LAI:  'quay_lai'
  });

  const LOT_TYPE = Object.freeze({
    NHAP: 'nhap',
    XUAT: 'xuat'
  });

  const SHIPMENT_STATUS = Object.freeze({
    CHO_LAY:   'cho_lay',
    DANG_GIAO: 'dang_giao',
    DA_GIAO:   'da_giao',
    THAT_BAI:  'that_bai',
    HOAN:      'hoan'
  });

  const PRODUCTION_STATUS = Object.freeze({
    DRAFT:       'draft',
    PLANNED:     'planned',
    IN_PROGRESS: 'in_progress',
    COMPLETED:   'completed',
    CANCELLED:   'cancelled'
  });

  const ORDER_REQUEST_STATUS = Object.freeze({
    PENDING:    'pending',
    PROCESSING: 'processing',
    CONVERTED:  'converted',
    REJECTED:   'rejected'
  });

  const IMPORT_STATUS = Object.freeze({
    CONFIRMED:   'imp_confirmed',
    PRODUCING:   'imp_producing',
    SHIPPING:    'imp_shipping',
    RECEIVED:    'imp_received'
  });

  // ── FORMAT HELPERS ───────────────────────────────────────────

  /** Format number with vi-VN locale (e.g. 1.234.567) */
  var fmt = function(n) {
    return new Intl.NumberFormat('vi-VN').format(Math.round(n || 0));
  };

  /** Format large numbers: tỷ / triệu shorthand */
  var fmtB = function(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + ' tỷ';
    if (n >= 1e6) return Math.round(n / 1e6) + ' tr';
    return fmt(n);
  };

  /** Format date ISO → DD/MM/YYYY */
  var formatDate = function(d) {
    if (!d) return '—';
    var dt = new Date(d);
    return String(dt.getDate()).padStart(2, '0') + '/' +
           String(dt.getMonth() + 1).padStart(2, '0') + '/' +
           dt.getFullYear();
  };

  /** Alias for formatDate (used in orders.html) */
  var fmtDate = formatDate;

  /** Format currency — VND default, USD if specified */
  var fmtCurrency = function(n, currency) {
    if (currency === 'USD') {
      return '$' + new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(n || 0);
    }
    return fmt(n) + 'đ';
  };

  /** Format percentage (e.g. 12.5%) */
  var fmtPercent = function(n) {
    return (Math.round((n || 0) * 100) / 100) + '%';
  };

  // ── COUNTRY LABELS ───────────────────────────────────────────

  const COUNTRY_LABELS = Object.freeze({
    vietnam:'Việt Nam','Việt Nam':'Việt Nam',
    japan:'Nhật Bản','Nhật Bản':'Nhật Bản',
    korea:'Hàn Quốc','Hàn Quốc':'Hàn Quốc',
    china:'Trung Quốc','Trung Quốc':'Trung Quốc',
    taiwan:'Đài Loan','Đài Loan':'Đài Loan',
    singapore:'Singapore','Singapore':'Singapore',
    thailand:'Thái Lan','Thái Lan':'Thái Lan',
    malaysia:'Malaysia','Malaysia':'Malaysia',
    usa:'Mỹ','Mỹ':'Mỹ',
    uk:'Anh','Anh':'Anh',
    france:'Pháp','Pháp':'Pháp',
    germany:'Đức','Đức':'Đức',
    australia:'Úc','Úc':'Úc',
    uae:'UAE','UAE':'UAE',
    eu:'EU','EU':'EU',
    other:'Khác',khac:'Khác'
  });

  // ── EXPORT TO WINDOW ────────────────────────────────────────

  window.H5C_CONST = {
    ORDER_STATUS:          ORDER_STATUS,
    PAYMENT_STATUS:        PAYMENT_STATUS,
    EXPENSE_STATUS:        EXPENSE_STATUS,
    EXPENSE_PAYMENT:       EXPENSE_PAYMENT,
    LEAD_PIPELINE:         LEAD_PIPELINE,
    LOT_TYPE:              LOT_TYPE,
    SHIPMENT_STATUS:       SHIPMENT_STATUS,
    PRODUCTION_STATUS:     PRODUCTION_STATUS,
    ORDER_REQUEST_STATUS:  ORDER_REQUEST_STATUS,
    IMPORT_STATUS:         IMPORT_STATUS,
    COUNTRY_LABELS:        COUNTRY_LABELS
  };

  // Shared label map (used in reports.html, leads.html, etc.)
  window.COUNTRY_LABELS = COUNTRY_LABELS;

  // Global format helpers (backward-compatible names)
  window.fmt        = fmt;
  window.fmtB       = fmtB;
  window.fmtDate    = fmtDate;
  window.formatDate = formatDate;
  window.fmtCurrency = fmtCurrency;
  window.fmtPercent  = fmtPercent;

  // ── OPTIMISTIC LOCKING HELPERS FOR LOTS ─────────────────────
  //
  // Each lot gets a `_version` (timestamp). Before saving modified
  // lots back to storage, we re-read and verify versions haven't
  // changed (another tab / Firebase sync may have mutated them).
  //
  // Usage:
  //   const snap = H5C_LOT.read();          // { lots, versions }
  //   // ... modify snap.lots ...
  //   if (!H5C_LOT.save(snap)) return;      // aborts if stale
  //

  window.H5C_LOT = {

    /** Read lots from storage, snapshot _version of every lot */
    read: function() {
      var lots = (window.H5C ? H5C.get('lots') : null) || [];
      var versions = {};
      lots.forEach(function(l) { versions[l.id] = l._version || 0; });
      return { lots: lots, versions: versions };
    },

    /** Stamp _version on a single lot (call when creating new lots) */
    stamp: function(lot) {
      lot._version = Date.now();
      return lot;
    },

    /**
     * Save lots with optimistic lock check.
     * @param {Object} snap — the snapshot from read()
     * @param {string[]} [modifiedIds] — IDs that were changed; if omitted checks ALL snapshotted lots
     * @returns {boolean} true if saved successfully, false if conflict detected
     */
    save: function(snap, modifiedIds) {
      // Re-read current state from storage
      var current = (window.H5C ? H5C.get('lots') : null) || [];
      var idsToCheck = modifiedIds || Object.keys(snap.versions);
      var now = Date.now();

      for (var i = 0; i < idsToCheck.length; i++) {
        var id = idsToCheck[i];
        var expected = snap.versions[id];
        if (expected === undefined) continue; // new lot, no version to check
        var cur = current.find(function(l) { return l.id === id; });
        if (cur && (cur._version || 0) !== expected) {
          // Version mismatch — data was modified by another source
          if (typeof window.showToast === 'function') {
            window.showToast('Dữ liệu tồn kho đã thay đổi, vui lòng thử lại', 'warning');
          }
          // Reload lots from storage and re-render
          if (typeof window.render === 'function') {
            try { window.render(); } catch(e) {}
          }
          return false;
        }
      }

      // All versions match — bump _version on modified lots and save
      snap.lots.forEach(function(l) {
        if (idsToCheck.indexOf(l.id) !== -1) {
          l._version = now;
        }
      });
      H5C.set('lots', snap.lots);
      return true;
    }
  };

})();
