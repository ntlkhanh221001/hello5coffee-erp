// ═══════════════════════════════════════════════════════════════
// H5C FIREBASE SYNC LAYER v3
// Fix race condition: override localStorage.setItem trực tiếp
// Bắt MỌI write vào h5c_v1_ prefix, bất kể thứ tự load file
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
    'order_requests', 'pending_order', 'pos', 'comm_config', 'suppliers'
  ];

  const LS_PREFIX = 'h5c_v1_';
  const FIRESTORE_COLLECTION = 'h5c_data';

  let _db = null;
  let _storage = null;
  let _syncReady = false;

  // ──────────────────────────────────────────────
  // STEP 1: Override localStorage.setItem NGAY LẬP TỨC
  // Chạy trước mọi thứ, bắt mọi write dù firebase chưa init xong
  // ──────────────────────────────────────────────
  const _origSetItem = localStorage.setItem.bind(localStorage);
  const _origRemoveItem = localStorage.removeItem.bind(localStorage);

  // Queue các write trong lúc firebase chưa sẵn sàng
  let _writeQueue = [];
  let _firebaseReady = false;

  localStorage.setItem = function(key, value) {
    // Luôn ghi localStorage trước (không chặn UI)
    _origSetItem(key, value);

    // Chỉ sync các key của H5C
    if (!key.startsWith(LS_PREFIX)) return;
    const syncKey = key.slice(LS_PREFIX.length);
    if (!SYNC_KEYS.includes(syncKey)) return;

    if (_firebaseReady && _db) {
      // Firebase sẵn sàng — push ngay
      _pushToFirestore(syncKey, JSON.parse(value));
    } else {
      // Firebase chưa sẵn sàng — queue lại
      // Chỉ giữ write mới nhất cho mỗi key
      _writeQueue = _writeQueue.filter(q => q.key !== syncKey);
      _writeQueue.push({ key: syncKey, value: JSON.parse(value) });
    }
  };

  localStorage.removeItem = function(key) {
    _origRemoveItem(key);

    if (!key.startsWith(LS_PREFIX)) return;
    const syncKey = key.slice(LS_PREFIX.length);
    if (!SYNC_KEYS.includes(syncKey)) return;

    if (_firebaseReady && _db) {
      _deleteFromFirestore(syncKey);
    }
  };

  // Flush queue sau khi firebase sẵn sàng
  function _flushQueue() {
    if (!_writeQueue.length) return;
    console.log('H5C Sync: Flushing', _writeQueue.length, 'queued writes...');
    _writeQueue.forEach(({ key, value }) => {
      _pushToFirestore(key, value);
    });
    _writeQueue = [];
  }

  // ──────────────────────────────────────────────
  // STEP 2: Load Firebase SDK (gstatic → unpkg fallback)
  // ──────────────────────────────────────────────
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = url;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = reject;
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
        console.warn('H5C Sync: Failed from', src.label, '- trying next...');
      }
    }
    return false;
  }

  // ──────────────────────────────────────────────
  // STEP 3: Push / Delete helpers
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
  // STEP 4: Pull Firestore → localStorage (initial load)
  // ──────────────────────────────────────────────
  async function pullFromFirestore() {
    if (!_db) return;
    try {
      const snapshot = await _db.collection(FIRESTORE_COLLECTION).get();
      snapshot.forEach(doc => {
        const key = doc.id;
        if (SYNC_KEYS.includes(key)) {
          const data = doc.data().value;
          if (data !== undefined && data !== null) {
            // Ghi trực tiếp qua _origSetItem để không trigger push lại lên Firestore
            _origSetItem(LS_PREFIX + key, JSON.stringify(data));
          }
        }
      });
      console.log('H5C Sync: Pulled', snapshot.size, 'documents ✅');
    } catch(e) {
      console.warn('H5C Sync: Pull failed:', e);
    }
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
          if (newVal !== curVal) {
            // Dùng _origSetItem để không trigger push ngược lại
            _origSetItem(LS_PREFIX + key, newVal);
            changed = true;
          }
        } else if (change.type === 'removed') {
          _origRemoveItem(LS_PREFIX + key);
          changed = true;
        }
      });

      if (changed && _syncReady) {
        if (typeof window.render === 'function') { try { window.render(); } catch(e) {} }
        else if (typeof window.renderPage === 'function') { try { window.renderPage(); } catch(e) {} }
      }
    }, err => {
      console.warn('H5C Sync: Realtime error:', err);
    });
  }

  // ──────────────────────────────────────────────
  // MAIN INIT
  // ──────────────────────────────────────────────
  async function init() {
    console.log('H5C Sync: Starting v3 (localStorage intercept mode)...');

    const loaded = await loadFirebaseSDK();
    if (!loaded) {
      console.error('H5C Sync: SDK load failed — LOCAL ONLY mode');
      return;
    }

    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      _db = firebase.firestore();
      _storage = firebase.storage();

      try {
        await _db.enablePersistence({ synchronizeTabs: true });
      } catch(e) {
        // Không sao nếu persistence lỗi, vẫn hoạt động bình thường
      }

      console.log('H5C Sync: Firebase initialized ✅');
    } catch(e) {
      console.error('H5C Sync: Firebase init error:', e);
      return;
    }

    // Pull data mới nhất từ Firestore
    await pullFromFirestore();

    // Flush các write đã queue trong lúc chờ firebase
    _firebaseReady = true;
    _flushQueue();

    // Bắt đầu realtime sync
    startRealtimeSync();

    _syncReady = true;
    console.log('H5C Sync: Ready! ✅ Mọi thay đổi sẽ tự động sync lên Firestore.');

    // Re-render page với data mới nhất từ Firestore
    setTimeout(() => {
      if (typeof window.render === 'function') { try { window.render(); } catch(e) {} }
      else if (typeof window.renderPage === 'function') { try { window.renderPage(); } catch(e) {} }
    }, 200);
  }

  init();

  // ──────────────────────────────────────────────
  // H5CStorage — Firebase Storage helper
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
