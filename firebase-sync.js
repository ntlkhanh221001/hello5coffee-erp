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
    'wholesale_customers', 'dash_config'
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

  localStorage.setItem = function(key, value) {
    _origSetItem(key, value);
    if (!key.startsWith(LS_PREFIX)) return;
    const syncKey = key.slice(LS_PREFIX.length);
    if (!SYNC_KEYS.includes(syncKey)) return;
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
  function _pushToFirestore(key, value) {
    if (!_db) return;
    _db.collection(FIRESTORE_COLLECTION).doc(key).set({
      value: value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: _getCurrentUserName()
    }).then(() => {
      console.log('H5C Sync: Pushed', key, '✅');
    }).catch(e => {
      console.warn('H5C Sync: Push FAILED for', key, '-', e.code || e.message);
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
          const newVal = JSON.stringify(change.doc.data().value);
          const curVal = localStorage.getItem(LS_PREFIX + key);
          if (newVal !== curVal) { _origSetItem(LS_PREFIX + key, newVal); changed = true; }
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
