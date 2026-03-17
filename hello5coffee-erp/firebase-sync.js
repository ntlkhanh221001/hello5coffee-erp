// ═══════════════════════════════════════════════════════════════
// H5C FIREBASE SYNC LAYER v1
// 
// Cách hoạt động:
// 1. Page load → tải ALL data từ Firestore → ghi vào localStorage
// 2. H5C.set() → ghi localStorage (nhanh, cho UI) + ghi Firestore (background)
// 3. Firestore realtime listener → cập nhật localStorage → re-render
//
// File này PHẢI được load SAU <script> chính của mỗi page
// và TRƯỚC DOMContentLoaded event.
// ═══════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ──────────────────────────────────────────────
  // FIREBASE CONFIG — Thay bằng config của anh
  // ──────────────────────────────────────────────
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC535lClzEDgH41xKYGlvHRxo_vGtQY6w0",
    authDomain: "hello5coffee-erp.firebaseapp.com",
    projectId: "hello5coffee-erp",
    storageBucket: "hello5coffee-erp.firebasestorage.app",
    messagingSenderId: "325690479954",
    appId: "1:325690479954:web:8be769b17433f2543ad68b"
  };

  // Danh sách các key cần sync
  const SYNC_KEYS = [
    'employees', 'attendance', 'kpi', 'skus', 'lots',
    'orders', 'leads', 'expenses', 'announcements',
    'accounts', 'perm_templates', 'comm_schemes', 'sales_schemes',
    'order_requests', 'pending_order'
  ];

  const LS_PREFIX = 'h5c_v1_';
  const FIRESTORE_COLLECTION = 'h5c_data'; // Single collection, each key = 1 document
  let _db = null;
  let _storage = null;
  let _syncReady = false;
  let _listeners = [];

  // ──────────────────────────────────────────────
  // Load Firebase SDK from CDN
  // ──────────────────────────────────────────────
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function initFirebase() {
    try {
      // Load Firebase SDK (compat version for simplicity)
      if (!window.firebase) {
        await loadScript('https://cdn.jsdelivr.net/npm/firebase@10/firebase-app-compat.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/firebase@10/firebase-firestore-compat.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/firebase@10/firebase-storage-compat.min.js');
      }

      // Initialize
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      _db = firebase.firestore();
      _storage = firebase.storage();

      // Enable offline persistence
      try {
        await _db.enablePersistence({ synchronizeTabs: true });
      } catch(e) {
        console.warn('H5C Sync: Persistence failed (may already be enabled):', e.code);
      }

      console.log('H5C Sync: Firebase initialized (Firestore + Storage)');
      return true;
    } catch(e) {
      console.error('H5C Sync: Firebase init failed:', e);
      return false;
    }
  }

  // ──────────────────────────────────────────────
  // SYNC: Firestore → localStorage (initial load)
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
      console.log('H5C Sync: Pulled', snapshot.size, 'documents from Firestore');
    } catch(e) {
      console.warn('H5C Sync: Pull failed (using local cache):', e);
    }
  }

  // ──────────────────────────────────────────────
  // SYNC: localStorage → Firestore (on write)
  // ──────────────────────────────────────────────
  function pushToFirestore(key, value) {
    if (!_db || !SYNC_KEYS.includes(key)) return;
    _db.collection(FIRESTORE_COLLECTION).doc(key).set({
      value: value,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: _getCurrentUserName()
    }).catch(e => {
      console.warn('H5C Sync: Push failed for', key, e);
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
      return session ? session.name : 'unknown';
    } catch(e) { return 'unknown'; }
  }

  // ──────────────────────────────────────────────
  // REALTIME LISTENER: Firestore → localStorage → re-render
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
              console.log('H5C Sync: Updated', key, 'from Firestore');
            }
          } else if (change.type === 'removed') {
            localStorage.removeItem(LS_PREFIX + key);
            changed = true;
          }
        });

        // Re-render if data changed and render function exists
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
  // OVERRIDE H5C object
  // ──────────────────────────────────────────────
  function patchH5C() {
    // Wait for H5C to exist (defined in page scripts)
    const checkInterval = setInterval(() => {
      if (typeof window.H5C !== 'undefined' || document.readyState === 'complete') {
        clearInterval(checkInterval);
        _doPatch();
      }
    }, 10);
  }

  function _doPatch() {
    // If H5C doesn't exist, it will be defined by the page script later
    // We'll use a MutationObserver or just override after a short delay
    
    const origSet = function(k, v) {
      try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch(e) {}
    };
    const origGet = function(k) {
      try { const v = localStorage.getItem(LS_PREFIX + k); return v ? JSON.parse(v) : null; } catch(e) { return null; }
    };

    // Override H5C.set to also push to Firestore
    const patchObj = (obj) => {
      if (!obj || obj._h5c_patched) return;
      
      const _origSet = obj.set.bind(obj);
      obj.set = function(k, v) {
        _origSet(k, v);
        pushToFirestore(k, v);
      };

      const _origClear = obj.clear.bind(obj);
      obj.clear = function(k) {
        _origClear(k);
        deleteFromFirestore(k);
      };

      const _origInit = obj.init.bind(obj);
      obj.init = function(k, def) {
        const v = origGet(k);
        if (v !== null) return v;
        obj.set(k, def); // This now also pushes to Firestore
        return def;
      };

      obj._h5c_patched = true;
      console.log('H5C Sync: H5C object patched');
    };

    // Patch immediately if H5C exists
    if (window.H5C) {
      patchObj(window.H5C);
    }

    // Also intercept future H5C definitions
    let _h5c = window.H5C;
    Object.defineProperty(window, 'H5C', {
      get() { return _h5c; },
      set(val) {
        _h5c = val;
        if (val) patchObj(val);
      },
      configurable: true
    });
  }

  // ──────────────────────────────────────────────
  // INIT: Run before DOMContentLoaded
  // ──────────────────────────────────────────────
  async function init() {
    // Check if config is set
    if (FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') {
      console.warn('H5C Sync: Firebase not configured! Edit firebase-sync.js with your Firebase config.');
      console.warn('H5C Sync: Running in LOCAL-ONLY mode (no sync).');
      return;
    }

    // Start patching H5C early
    patchH5C();

    // Initialize Firebase
    const ok = await initFirebase();
    if (!ok) return;

    // Pull latest data from Firestore
    await pullFromFirestore();

    // Start realtime sync
    startRealtimeSync();

    _syncReady = true;
    console.log('H5C Sync: Ready! Data syncing with Firestore.');
  }

  // Run init immediately
  init();

  // ──────────────────────────────────────────────
  // SESSION SYNC (login state across tabs)
  // ──────────────────────────────────────────────
  const _origSaveSession = window.saveSession;
  window.addEventListener('load', () => {
    if (typeof window.saveSession === 'function') {
      const orig = window.saveSession;
      window.saveSession = function(user) {
        orig(user);
        // Also save to Firestore for audit (optional)
        if (_db) {
          _db.collection('h5c_sessions').doc(user.email || user.id).set({
            ...user,
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(() => {});
        }
      };
    }
  });

  // ──────────────────────────────────────────────
  // FILE STORAGE HELPER (Firebase Storage)
  // Dùng cho đính kèm file (chi phí, đơn hàng, v.v.)
  // ──────────────────────────────────────────────
  window.H5CStorage = {
    /**
     * Upload file lên Firebase Storage
     * @param {File} file - File object từ input
     * @param {string} folder - Thư mục (vd: 'expenses', 'orders')
     * @param {function} onProgress - Callback (percent) cho progress bar
     * @returns {Promise<{name, url, path, size}>}
     */
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

    /**
     * Lấy download URL từ path
     * @param {string} path - Storage path
     * @returns {Promise<string>}
     */
    async getURL(path) {
      if (!_storage) return null;
      try {
        return await _storage.ref(path).getDownloadURL();
      } catch(e) {
        console.warn('H5CStorage: getURL failed for', path, e);
        return null;
      }
    },

    /**
     * Xóa file trên Storage
     * @param {string} path - Storage path
     */
    async remove(path) {
      if (!_storage) return;
      try {
        await _storage.ref(path).delete();
      } catch(e) {
        console.warn('H5CStorage: remove failed for', path, e);
      }
    },

    /** Check Storage có sẵn sàng không */
    get ready() { return !!_storage; }
  };

})();
