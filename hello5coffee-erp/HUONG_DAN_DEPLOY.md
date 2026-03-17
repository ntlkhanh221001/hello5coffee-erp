# Hướng dẫn Deploy Hello 5 Coffee ERP lên Firebase + Vercel

## Tổng quan

Hệ thống sẽ hoạt động như sau:
- **Vercel**: host các file HTML/JS (miễn phí)
- **Firebase Firestore**: database online, realtime sync giữa mọi người
- **firebase-sync.js**: layer đồng bộ tự động localStorage ↔ Firestore

Thời gian setup: ~15-20 phút.

---

## Bước 1: Tạo Firebase Project

1. Vào https://console.firebase.google.com
2. Bấm **"Create a project"** (hoặc "Tạo dự án")
3. Đặt tên: `hello5coffee-erp` → Next
4. Tắt Google Analytics (không cần) → Create Project
5. Đợi tạo xong → Continue

## Bước 2: Tạo Firestore Database

1. Trong Firebase Console, bấm **"Build"** → **"Firestore Database"** (menu bên trái)
2. Bấm **"Create database"**
3. Chọn location: **asia-southeast1 (Singapore)** → Next
4. Chọn **"Start in test mode"** → Create
   *(Sau này sẽ cấu hình security rules chặt hơn)*

## Bước 3: Lấy Firebase Config

1. Trong Firebase Console, bấm **biểu tượng bánh răng** (cạnh "Project Overview") → **Project settings**
2. Kéo xuống phần **"Your apps"** → Bấm biểu tượng **</>** (Web)
3. Đặt tên app: `h5c-erp` → Register app
4. Copy đoạn `firebaseConfig`:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "hello5coffee-erp.firebaseapp.com",
  projectId: "hello5coffee-erp",
  storageBucket: "hello5coffee-erp.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Bước 4: Cập nhật firebase-sync.js

Mở file **firebase-sync.js**, tìm đoạn:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  ...
};
```

Thay bằng config vừa copy ở Bước 3.

## Bước 5: Cấu hình Firestore Security Rules

1. Trong Firebase Console → Firestore Database → tab **Rules**
2. Thay nội dung bằng:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // H5C ERP data - cho phép đọc/ghi từ domain của bạn
    match /h5c_data/{document=**} {
      allow read, write: if true;
    }
    match /h5c_sessions/{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Bấm **Publish**

> **Lưu ý**: Rules này cho phép mọi người đọc/ghi. Sau khi hệ thống ổn định, 
> nên thêm Firebase Auth và lock rules chặt hơn.

## Bước 6: Deploy lên Vercel

### Cách 1: Kéo thả (nhanh nhất)

1. Vào https://vercel.com → Sign up (dùng GitHub hoặc email)
2. Tạo folder trên máy tên `h5c-erp`, bỏ tất cả file vào:
   - dashboard.html, orders.html, leads.html, expenses.html
   - warehouse.html, users.html, reports.html, announcements.html
   - sidebar.js, firebase-sync.js, START_SERVER.bat
3. Vào https://vercel.com/new
4. Kéo thả folder `h5c-erp` vào trang → Vercel tự deploy
5. Vercel sẽ cho bạn URL: `https://h5c-erp-xxx.vercel.app`
6. Truy cập: `https://h5c-erp-xxx.vercel.app/dashboard.html`

### Cách 2: Qua GitHub (dễ cập nhật sau này)

1. Tạo GitHub account (nếu chưa có): https://github.com
2. Tạo repo mới tên `h5c-erp`, upload tất cả file
3. Vào https://vercel.com → New Project → Import từ GitHub → Chọn repo `h5c-erp`
4. Bấm Deploy → Xong!
5. Sau này muốn cập nhật: push code lên GitHub → Vercel tự động deploy lại

## Bước 7: Test

1. Mở URL Vercel trên trình duyệt 1: đăng nhập admin@hello5coffee.com
2. Mở URL Vercel trên trình duyệt 2 (hoặc tab ẩn danh): đăng nhập sales@hello5coffee.com
3. Trên trình duyệt 1: tạo 1 đơn hàng mới
4. Trên trình duyệt 2: đơn hàng mới xuất hiện tự động (realtime!)

## Bước 8: Chia sẻ cho nhân viên

Gửi link Vercel + tài khoản cho nhân viên:
- URL: `https://h5c-erp-xxx.vercel.app/dashboard.html`
- Email: (tài khoản đã tạo trong module Nhân viên)
- Mật khẩu: (mật khẩu đã set)

---

## Custom Domain (tùy chọn)

Nếu anh muốn dùng domain riêng (ví dụ: erp.hello5coffee.com):

1. Vercel Dashboard → Project → Settings → Domains
2. Thêm domain: `erp.hello5coffee.com`
3. Vercel sẽ hướng dẫn thêm CNAME record vào DNS
4. SSL tự động, miễn phí

---

## Troubleshooting

**Trang trắng sau deploy?**
- Mở Console (F12) → xem lỗi
- Kiểm tra firebase-sync.js đã điền config chưa

**Dữ liệu không sync?**
- Mở Console → tìm dòng "H5C Sync: Ready!"
- Nếu thấy "Firebase not configured" → chưa điền config
- Kiểm tra Firestore Rules đã publish chưa

**Dữ liệu cũ từ localStorage?**
- Lần đầu deploy, localStorage trống → hệ thống tạo data mẫu
- Nếu muốn import data cũ: mở Console → chạy lệnh sau cho từng key:
  ```javascript
  firebase.firestore().collection('h5c_data').doc('orders').set({
    value: JSON.parse(localStorage.getItem('h5c_v1_orders')),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  ```
