# Hướng dẫn bật Firebase Storage cho đính kèm file

## Tại sao cần làm bước này?

Hệ thống đã được cập nhật để lưu file đính kèm (hóa đơn, chứng từ...) lên **Firebase Storage** thay vì nhét vào database Firestore.

**Lợi ích:**
- Firestore (database): quota free 1 GB → dùng cho dữ liệu text (đơn hàng, chi phí...) — rất nhẹ
- Firebase Storage: quota free **1 GB riêng** → dùng cho file đính kèm (PDF, ảnh, hóa đơn...)
- Tổng cộng anh có **2 GB miễn phí** thay vì 1 GB

---

## Bước 1: Bật Firebase Storage (2 phút)

1. Vào **Firebase Console**: https://console.firebase.google.com
2. Chọn project **hello5coffee-erp**
3. Menu bên trái → **Build** → **Storage**
4. Bấm **"Get started"**
5. Chọn **"Start in test mode"** → **Next**
6. Chọn location: **asia-southeast1 (Singapore)** → **Done**

> ✅ Xong! Storage đã được bật.

---

## Bước 2: Cấu hình Storage Rules (1 phút)

1. Vẫn trong **Storage** → bấm tab **"Rules"**
2. Thay nội dung bằng:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /h5c_files/{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

3. Bấm **"Publish"**

> ⚠️ Rule này cho phép mọi người đọc/ghi. Sau khi ổn định, nên thêm Firebase Auth để lock chặt hơn.

---

## Bước 3: Kiểm tra storageBucket trong config

Mở file **firebase-sync.js**, kiểm tra dòng `storageBucket`:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "hello5coffee-erp",
  storageBucket: "hello5coffee-erp.firebasestorage.app",  // ← QUAN TRỌNG
  ...
};
```

Nếu `storageBucket` đang trống hoặc sai → vào Firebase Console → Project Settings → copy lại config.

---

## Bước 4: Deploy file mới

Thay thế các file sau lên Vercel/hosting:
- `firebase-sync.js` (đã thêm Firebase Storage SDK)
- `expenses.html` (đã sửa upload file lên Storage)

---

## Cách hoạt động

### Khi tạo chi phí + đính kèm file:
1. Chọn file → hiện tên file + dung lượng
2. Bấm "Lưu" → file được **upload lên Firebase Storage** (có progress %)
3. Firestore chỉ lưu: `fileUrl` (link download) + `filePath` + `file` (tên file)

### Khi xem chi tiết chi phí:
- Ảnh (jpg, png): hiện **preview inline** + nút Tải + nút Xem
- PDF: hiện nút **Tải** + nút **Xem** (mở tab mới)
- File khác: hiện nút **Tải**

### Khi sửa chi phí:
- Giữ nguyên file cũ nếu không chọn file mới
- Chọn file mới → upload file mới, ghi đè URL

### Nếu Storage chưa bật hoặc lỗi:
- Hệ thống tự động **fallback về base64** (lưu trực tiếp vào Firestore)
- Không mất dữ liệu, chỉ tốn quota Firestore hơn

---

## Kiểm tra dung lượng

### Firestore (database):
- Firebase Console → Firestore Database → tab **Usage**

### Storage (file):
- Firebase Console → Storage → tab **Usage**
- Hoặc: Google Cloud Console → Storage → Browser

---

## Giới hạn gói miễn phí

| Service | Free quota | Ghi chú |
|---------|-----------|---------|
| Firestore | 1 GB storage | Cho text data |
| Firestore | 50K reads/ngày | Reset mỗi đêm |
| Firestore | 20K writes/ngày | Reset mỗi đêm |
| Storage | 1 GB storage | Cho file đính kèm |
| Storage | 1 GB download/ngày | Tải file |
| Storage | 5 GB download/tháng | Tổng tháng |

Với quy mô 5-20 người dùng, gói miễn phí **dư sức** cho 1-2 năm đầu.
