// ═══════════════════════════════════════════════════════════════
// H5C FIREBASE SYNC LAYER v3
// Fix: intercept localStorage.setItem trực tiếp
// Không phụ thuộc vào H5C object — hoạt động với mọi file
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC535lClzEDgH41xKYGlvHRxo_vGtQY6w0",
    authDomain: "hello5coffee-erp.firebaseapp.com",
    projectId: "hello5coffee-erp",
    storageBucket: "hello5coffee-erp.firebasestorage.app",
    messagingSenderId: "325690479954",
    appId: "1:325690479954:web:8be769b17433f2543ad68b"
  };

  const SYNC_KEYS = [
    'employees', 'attendance', 'kpi', 'skus', 'lots',
    'orders', 'leads', 'expenses', 'announcements',
    'accounts', 'perm_templates', 'comm_schemes', 'sales_schemes',
    'order_requests', 'pending_order',
    'pos', 'comm_config', 'suppliers', 'warehouses', 'wh_history',
    'holidays', 'birthday_template',
    'wholesale_customers', 'dash_config',
    'customers', 'payments', 'production_orders', 'boms',
    'cash_receipts', 'cash_payments', 'bank_accounts',
    'chart_of_accounts', 'journal_entries',
    'shipments', 'shipping_partners',
    'attendance_records', 'payroll_records', 'payroll_config',
    'qc_standards', 'qc_inspections',
    'contracts',
    'tw_branches', 'tw_menu_items', 'tw_ingredients', 'tw_recipes',
    'tw_stock_central', 'tw_stock_branch', 'tw_distributions',
    'tw_shifts', 'tw_orders', 'tw_expenses', 'tw_partner_config'
  ];

  const LS_PREFIX = 'h5c_v1_';
  const FIRESTORE_COLLECTION = 'h5c_data';

  let _db = null;
  let _storage = null;
  let _syncReady = false;

  // ──────────────────────────────────────────────
  // STEP 1: Override localStorage.setItem NGAY LẬP TỨC
  // ──────────────────────────────────────────────
  const _origSetItem    = localStorage.setItem.bind(localStorage);
  const _origRemoveItem = localStorage.removeItem.bind(localStorage);

  let _writeQueue    = [];
  let _firebaseReady = false;

  // Track local modification timestamps per sync key
  let _localTimestamps = {};
  // Track last known remote timestamps per sync key
  let _remoteTimestamps = {};

  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    if (!key.startsWith(LS_PREFIX)) return;
    const syncKey = key.slice(LS_PREFIX.length);
    if (!SYNC_KEYS.includes(syncKey)) return;
    _localTimestamps[syncKey] = Date.now();
    if (_firebaseReady && _db) {
      _pushToFirestore(syncKey, _safeParse(value));
    } else {
      _writeQueue = _writeQueue.filter(q => q.key !== syncKey);
      _writeQueue.push({ key: syncKey, value: _safeParse(value) });
    }
  };

  localStorage.removeItem = function(key) {
    _origRemoveItem(key);
    if (!key.startsWith(LS_PREFIX)) return;
    const syncKey = key.slice(LS_PREFIX.length);
    if (!SYNC_KEYS.includes(syncKey)) return;
    if (_firebaseReady && _db) _deleteFromFirestore(syncKey);
  };

  function _safeParse(value) {
    try { return JSON.parse(value); } catch(e) { return value; }
  }

  function _flushQueue() {
    if (!_writeQueue.length) return;
    console.log('H5C Sync: Flushing', _writeQueue.length, 'queued writes...');
    _writeQueue.forEach(({ key, value }) => _pushToFirestore(key, value));
    _writeQueue = [];
  }

  // ──────────────────────────────────────────────
  // STEP 2: Load Firebase SDK (gstatic → unpkg)
  // ──────────────────────────────────────────────
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = url; s.crossOrigin = 'anonymous';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const SDK_SOURCES = [
    {
      label: 'gstatic.com',
      app:       'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
      firestore: 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js',
      storage:   'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage-compat.js',
    },
    {
      label: 'unpkg.com',
      app:       'https://unpkg.com/firebase@10.14.1/firebase-app-compat.js',
      firestore: 'https://unpkg.com/firebase@10.14.1/firebase-firestore-compat.js',
      storage:   'https://unpkg.com/firebase@10.14.1/firebase-storage-compat.js',
    },
  ];

  async function loadFirebaseSDK() {
    if (window.firebase && window.firebase.firestore) return true;
    for (const src of SDK_SOURCES) {
      try {
        console.log('H5C Sync: Loading SDK from', src.label);
        await loadScript(src.app);
        await loadScript(src.firestore);
        await loadScript(src.storage);
        if (window.firebase) {
          console.log('H5C Sync: SDK loaded from', src.label, '✅');
          return true;
        }
      } catch(e) {
        console.warn('H5C Sync: Failed from', src.label);
      }
    }
    return false;
  }

  // ──────────────────────────────────────────────
  // STEP 3: Push / Delete
  // ──────────────────────────────────────────────
  const _retryQueue = [];
  const MAX_RETRIES = 3;

  function _pushToFirestore(key, value, attempt) {
    if (!_db) return;
    attempt = attempt || 1;
    _db.collection(FIRESTORE_COLLECTION).doc(key).set({
      value: value,
      _lastModified: _localTimestamps[key] || Date.now(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: _getCurrentUserName()
    }).then(() => {
      console.log('H5C Sync: Pushed', key, '✅');
    }).catch(e => {
      console.warn('H5C Sync: Push FAILED for', key, '(attempt '+attempt+')', '-', e.code || e.message);
      if (attempt < MAX_RETRIES) {
        setTimeout(() => _pushToFirestore(key, value, attempt + 1), 2000 * attempt);
      } else {
        console.error('H5C Sync: Gave up pushing', key, 'after', MAX_RETRIES, 'attempts');
        if (typeof window.showToast === 'function') {
          window.showToast('Lỗi đồng bộ dữ liệu "' + key + '". Vui lòng kiểm tra kết nối!', 'error', 5000);
        }
      }
    });
  }

  function _deleteFromFirestore(key) {
    if (!_db) return;
    _db.collection(FIRESTORE_COLLECTION).doc(key).delete().catch(e => {
      console.warn('H5C Sync: Delete failed for', key, e);
    });
  }

  function _getCurrentUserName() {
    try {
      const s = JSON.parse(localStorage.getItem('h5c_erp_user') || 'null');
      return s ? (s.name || s.email || 'unknown') : 'unknown';
    } catch(e) { return 'unknown'; }
  }

  // ──────────────────────────────────────────────
  // STEP 4: Pull Firestore → localStorage
  // ──────────────────────────────────────────────
  async function pullFromFirestore() {
    if (!_db) return [];
    const pulled = [];
    try {
      const snapshot = await _db.collection(FIRESTORE_COLLECTION).get();
      snapshot.forEach(doc => {
        const key = doc.id;
        if (SYNC_KEYS.includes(key)) {
          const data = doc.data().value;
          if (data !== undefined && data !== null) {
            _origSetItem(LS_PREFIX + key, JSON.stringify(data));
            _remoteTimestamps[key] = doc.data()._lastModified || 0;
            pulled.push(key);
          }
        }
      });
      console.log('H5C Sync: Pulled', snapshot.size, 'documents ✅');
    } catch(e) {
      console.warn('H5C Sync: Pull failed:', e);
    }
    return pulled;
  }

  // ──────────────────────────────────────────────
  // STEP 5: Realtime listener
  // ──────────────────────────────────────────────
  function startRealtimeSync() {
    if (!_db) return;
    _db.collection(FIRESTORE_COLLECTION).onSnapshot(snapshot => {
      let changed = false;
      snapshot.docChanges().forEach(change => {
        const key = change.doc.id;
        if (!SYNC_KEYS.includes(key)) return;
        if (change.type === 'modified' || change.type === 'added') {
          const docData = change.doc.data();
          const remoteModified = docData._lastModified || 0;
          const localModified = _localTimestamps[key] || 0;
          const lastRemote = _remoteTimestamps[key] || 0;

          const newVal = JSON.stringify(docData.value);
          const curVal = localStorage.getItem(LS_PREFIX + key);

          // Same data — no action needed
          if (newVal === curVal) {
            _remoteTimestamps[key] = remoteModified;
            return;
          }

          // Check if local has unsync'd changes (local modified AFTER last known remote)
          const localHasChanges = localModified > lastRemote && localModified > 0 && lastRemote > 0;
          // Check if remote has new changes
          const remoteHasChanges = remoteModified > lastRemote || lastRemote === 0;

          if (localHasChanges && remoteHasChanges && remoteModified !== localModified) {
            // ── TRUE CONFLICT: both sides changed independently ──
            // Keep local data but flag as conflicted
            console.warn('H5C Sync: CONFLICT detected for "' + key + '" — local=' + localModified + ', remote=' + remoteModified);
            // Merge: store local version but mark conflicted in metadata
            try {
              var localData = _safeParse(curVal);
              // If array, try to merge by adding remote-only items
              if (Array.isArray(localData) && Array.isArray(docData.value)) {
                var localIds = new Set(localData.map(function(item) { return item.id; }).filter(Boolean));
                var remoteOnly = docData.value.filter(function(item) { return item.id && !localIds.has(item.id); });
                if (remoteOnly.length) {
                  remoteOnly.forEach(function(item) { localData.push(item); });
                  _origSetItem(LS_PREFIX + key, JSON.stringify(localData));
                }
              }
            } catch(e) {}
            // Flag conflict for this key
            _origSetItem(LS_PREFIX + '_conflict_' + key, JSON.stringify({
              detectedAt: Date.now(),
              localModified: localModified,
              remoteModified: remoteModified
            }));
            if (typeof window.showToast === 'function') {
              window.showToast('Có xung đột dữ liệu [' + key + '], vui lòng kiểm tra', 'warning', 5000);
            }
            changed = true;
          } else if (localHasChanges && localModified > remoteModified) {
            // ── LOCAL IS NEWER: keep local, push to remote ──
            console.log('H5C Sync: Local newer for "' + key + '", pushing local → remote');
            _pushToFirestore(key, _safeParse(curVal));
          } else {
            // ── REMOTE IS NEWER (or first sync): apply remote ──
            _origSetItem(LS_PREFIX + key, newVal);
            changed = true;
          }

          _remoteTimestamps[key] = remoteModified;
        } else if (change.type === 'removed') {
          _origRemoveItem(LS_PREFIX + key); changed = true;
        }
      });
      if (changed && _syncReady) {
        if (typeof window.render === 'function')          { try { window.render();     } catch(e) {} }
        else if (typeof window.renderPage === 'function') { try { window.renderPage(); } catch(e) {} }
      }
    }, err => console.warn('H5C Sync: Realtime error:', err));
  }

  // ──────────────────────────────────────────────
  // MAIN INIT
  // ──────────────────────────────────────────────
  async function init() {
    console.log('H5C Sync v3: Starting (localStorage intercept)...');
    const loaded = await loadFirebaseSDK();
    if (!loaded) { console.error('H5C Sync: SDK load failed — LOCAL ONLY'); return; }

    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      _db = firebase.firestore();
      _storage = firebase.storage();
      try { await _db.enablePersistence({ synchronizeTabs: true }); } catch(e) {
        if (e.code !== 'failed-precondition' && e.code !== 'unimplemented')
          console.warn('H5C Sync: Persistence error:', e.code || e.message);
      }
      console.log('H5C Sync: Firebase initialized ✅');
    } catch(e) { console.error('H5C Sync: Init error:', e); return; }

    const pulledKeys = await pullFromFirestore();
    // Loại bỏ các key đã được pull từ Firestore khỏi write queue
    // để tránh ghi đè data thật bằng DEFAULT_ACCOUNTS
    _writeQueue = _writeQueue.filter(q => !pulledKeys.includes(q.key));
    _firebaseReady = true;
    _flushQueue();
    startRealtimeSync();
    _syncReady = true;
    console.log('H5C Sync: Ready! ✅');

    setTimeout(() => {
      if (typeof window.render === 'function')          { try { window.render();     } catch(e) {} }
      else if (typeof window.renderPage === 'function') { try { window.renderPage(); } catch(e) {} }
    }, 200);
  }

  init();

  // ──────────────────────────────────────────────
  // H5CStorage
  // ──────────────────────────────────────────────
  window.H5CStorage = {
    async upload(file, folder, onProgress) {
      if (!_storage) throw new Error('Storage chưa sẵn sàng');
      const safeName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = 'h5c_files/' + (folder || 'general') + '/' + safeName;
      const ref = _storage.ref(path);
      const task = ref.put(file);
      return new Promise((resolve, reject) => {
        task.on('state_changed',
          snap => { if (onProgress) onProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)); },
          err => reject(err),
          async () => { const url = await ref.getDownloadURL(); resolve({ name: file.name, url, path, size: file.size }); }
        );
      });
    },
    async getURL(path) {
      if (!_storage) return null;
      try { return await _storage.ref(path).getDownloadURL(); } catch(e) { return null; }
    },
    async remove(path) {
      if (!_storage) return;
      try { await _storage.ref(path).delete(); } catch(e) {}
    },
    get ready() { return !!_storage; }
  };

})();
