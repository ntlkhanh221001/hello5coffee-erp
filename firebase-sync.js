// ═══════════════════════════════════════════════════════════════
// H5C FIREBASE SYNC LAYER v2
// Fix: Không dùng CDN jsdelivr.net (bị Edge/Safari block)
// Thay bằng: gstatic.com (Google host chính thức, không bị block)
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
  let _listeners = [];

  // ──────────────────────────────────────────────
  // Load script helper với retry
  // ──────────────────────────────────────────────
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      // Check đã load chưa
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve(); return;
      }
      const s = document.createElement('script');
      s.src = url;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ──────────────────────────────────────────────
  // Danh sách CDN fallback — thử lần lượt
  // jsdelivr bị Edge/Safari block → dùng gstatic (Google host chính thức)
  // ──────────────────────────────────────────────
  const SDK_SOURCES = [
    // Source 1: gstatic (Google host chính thức — không bị coi là tracker)
    {
      app:      'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
      firestore:'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js',
      storage:  'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage-compat.js',
    },
    // Source 2: unpkg (fallback)
    {
      app:      'https://unpkg.com/firebase@10.14.1/firebase-app-compat.js',
      firestore:'https://unpkg.com/firebase@10.14.1/firebase-firestore-compat.js',
      storage:  'https://unpkg.com/firebase@10.14.1/firebase-storage-compat.js',
    },
    // Source 3: jsdelivr (fallback cuối — bị block bởi Edge/Safari tracking prevention)
    {
      app:      'https://cdn.jsdelivr.net/npm/firebase@10/firebase-app-compat.min.js',
      firestore:'https://cdn.jsdelivr.net/npm/firebase@10/firebase-firestore-compat.min.js',
      storage:  'https://cdn.jsdelivr.net/npm/firebase@10/firebase-storage-compat.min.js',
    }
  ];

  async function loadFirebaseSDK() {
    if (window.firebase && window.firebase.firestore) return true;

    for (const src of SDK_SOURCES) {
      try {
        console.log('H5C Sync: Trying SDK source:', src.app.split('/')[2]);
        await loadScript(src.app);
        await loadScript(src.firestore);
        await loadScript(src.storage);
        if (window.firebase) {
          console.log('H5C Sync: SDK loaded from', src.app.split('/')[2]);
          return true;
        }
      } catch(e) {
        console.warn('H5C Sync: SDK source failed, trying next...', e.message || e);
      }
    }
    return false;
  }

  // ──────────────────────────────────────────────
  // Init Firebase
  // ──────────────────────────────────────────────
  async function initFirebase() {
    try {
      const loaded = await loadFirebaseSDK();
      if (!loaded) {
        console.error('H5C Sync: Không load được Firebase SDK từ tất cả sources!');
        return false;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }

      _db = firebase.firestore();
      _storage = firebase.storage();

      // Tắt persistence để tránh lỗi trên một số browser
      // (persistence gây conflict với tracking prevention)
      try {
        await _db.enablePersistence({ synchronizeTabs: true });
      } catch(e) {
        if (e.code === 'failed-precondition') {
          console.warn('H5C Sync: Multi-tab persistence conflict, continuing without persistence');
        } else if (e.code === 'unimplemented') {
          console.warn('H5C Sync: Persistence not supported in this browser');
        }
        // Vẫn tiếp tục dù không có persistence
      }

      console.log('H5C Sync: Firebase initialized ✅');
      return true;
    } catch(e) {
      console.error('H5C Sync: Firebase init failed:', e);
      return false;
    }
  }

  // ──────────────────────────────────────────────
  // PULL: Firestore → localStorage
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
            localStorage.setItem(LS_PREFIX + key, JSON.stringify(data));
          }
        }
      });
      console.log('H5C Sync: Pulled', snapshot.size, 'documents from Firestore ✅');
    } catch(e) {
      console.warn('H5C Sync: Pull failed (using local cache):', e);
    }
  }

  // ──────────────────────────────────────────────
  // PUSH: localStorage → Firestore
  // ──────────────────────────────────────────────
  function pushToFirestore(key, value) {
    if (!_db || !SYNC_KEYS.includes(key)) return;

    _db.collection(FIRESTORE_COLLECTION).doc(key).set({
      value: value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: _getCurrentUserName()
    }).then(() => {
      console.log('H5C Sync: Pushed', key, '✅');
    }).catch(e => {
      console.warn('H5C Sync: Push failed for', key, '—', e.code, e.message);
    });
  }

  function deleteFromFirestore(key) {
    if (!_db || !SYNC_KEYS.includes(key)) return;
    _db.collection(FIRESTORE_COLLECTION).doc(key).delete().catch(e => {
      console.warn('H5C Sync: Delete failed for', key, e);
    });
  }

  function _getCurrentUserName() {
    try {
      const session = JSON.parse(localStorage.getItem('h5c_erp_user') || 'null');
      return session ? (session.name || session.email || 'unknown') : 'unknown';
    } catch(e) { return 'unknown'; }
  }

  // ──────────────────────────────────────────────
  // REALTIME LISTENER
  // ──────────────────────────────────────────────
  function startRealtimeSync() {
    if (!_db) return;

    const unsubscribe = _db.collection(FIRESTORE_COLLECTION)
      .onSnapshot(snapshot => {
        let changed = false;
        snapshot.docChanges().forEach(change => {
          const key = change.doc.id;
          if (!SYNC_KEYS.includes(key)) return;

          if (change.type === 'modified' || change.type === 'added') {
            const newVal = JSON.stringify(change.doc.data().value);
            const curVal = localStorage.getItem(LS_PREFIX + key);
            if (newVal !== curVal) {
              localStorage.setItem(LS_PREFIX + key, newVal);
              changed = true;
              console.log('H5C Sync: Realtime update —', key);
            }
          } else if (change.type === 'removed') {
            localStorage.removeItem(LS_PREFIX + key);
            changed = true;
          }
        });

        if (changed && _syncReady) {
          if (typeof window.render === 'function') {
            try { window.render(); } catch(e) {}
          } else if (typeof window.renderPage === 'function') {
            try { window.renderPage(); } catch(e) {}
          }
        }
      }, err => {
        console.warn('H5C Sync: Realtime listener error:', err);
      });

    _listeners.push(unsubscribe);
  }

  // ──────────────────────────────────────────────
  // PATCH H5C object
  // ──────────────────────────────────────────────
  function patchH5C() {
    const checkInterval = setInterval(() => {
      if (typeof window.H5C !== 'undefined' || document.readyState === 'complete') {
        clearInterval(checkInterval);
        _doPatch();
      }
    }, 10);
  }

  function _doPatch() {
    const patchObj = (obj) => {
      if (!obj || obj._h5c_patched) return;

      const _origSet = obj.set.bind(obj);
      obj.set = function(k, v) {
        _origSet(k, v);
        pushToFirestore(k, v); // Luôn push lên Firestore
      };

      const _origClear = obj.clear.bind(obj);
      obj.clear = function(k) {
        _origClear(k);
        deleteFromFirestore(k);
      };

      const _origInit = obj.init.bind(obj);
      obj.init = function(k, def) {
        try {
          const raw = localStorage.getItem(LS_PREFIX + k);
          if (raw !== null) return JSON.parse(raw);
        } catch(e) {}
        obj.set(k, def);
        return def;
      };

      obj._h5c_patched = true;
      console.log('H5C Sync: H5C object patched ✅');
    };

    if (window.H5C) patchObj(window.H5C);

    let _h5c = window.H5C;
    Object.defineProperty(window, 'H5C', {
      get() { return _h5c; },
      set(val) { _h5c = val; if (val) patchObj(val); },
      configurable: true
    });
  }

  // ──────────────────────────────────────────────
  // MAIN INIT
  // ──────────────────────────────────────────────
  async function init() {
    patchH5C();

    const ok = await initFirebase();
    if (!ok) {
      console.error('H5C Sync: Chạy ở LOCAL-ONLY mode — data sẽ không sync!');
      return;
    }

    await pullFromFirestore();
    startRealtimeSync();

    _syncReady = true;
    console.log('H5C Sync: Ready! ✅ Data syncing with Firestore.');

    // Trigger re-render sau khi pull data
    setTimeout(() => {
      if (typeof window.render === 'function') {
        try { window.render(); } catch(e) {}
      } else if (typeof window.renderPage === 'function') {
        try { window.renderPage(); } catch(e) {}
      }
    }, 100);
  }

  init();

  // ──────────────────────────────────────────────
  // H5CStorage — Firebase Storage helper
  // ──────────────────────────────────────────────
  window.H5CStorage = {
    async upload(file, folder, onProgress) {
      if (!_storage) throw new Error('Firebase Storage chưa sẵn sàng');
      const safeName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = 'h5c_files/' + (folder || 'general') + '/' + safeName;
      const ref = _storage.ref(path);
      const task = ref.put(file);

      return new Promise((resolve, reject) => {
        task.on('state_changed',
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            if (onProgress) onProgress(pct);
          },
          (err) => { reject(err); },
          async () => {
            const url = await ref.getDownloadURL();
            resolve({ name: file.name, url, path, size: file.size });
          }
        );
      });
    },

    async getURL(path) {
      if (!_storage) return null;
      try { return await _storage.ref(path).getDownloadURL(); }
      catch(e) { return null; }
    },

    async remove(path) {
      if (!_storage) return;
      try { await _storage.ref(path).delete(); }
      catch(e) { console.warn('H5CStorage: remove failed', e); }
    },

    get ready() { return !!_storage; }
  };

})();
