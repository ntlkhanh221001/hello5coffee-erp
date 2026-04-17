// ════════════════════════════════════════════════════════
// Vercel Serverless Function — Send order notification email
// Endpoint: POST /api/send-order-email
// Body: { code, customer_code, customerName, customerPhone,
//         total, items, orderType, source, createdAt,
//         deliveryAddress, note, branchName, isScheduled, scheduledAt }
// ════════════════════════════════════════════════════════

const nodemailer = require('nodemailer');

// In-memory cache to dedupe duplicate requests (same order code within 60s)
// Vercel functions are warm for a short time, so this catches most retries.
const _recentSent = new Map();
const DEDUPE_TTL = 60 * 1000;

function _isDuplicate(code) {
  if (!code) return false;
  const now = Date.now();
  // Cleanup old entries
  for (const [k, t] of _recentSent) {
    if (now - t > DEDUPE_TTL) _recentSent.delete(k);
  }
  if (_recentSent.has(code)) return true;
  _recentSent.set(code, now);
  return false;
}

function fmtMoney(n) {
  return (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(o) {
  const items = Array.isArray(o.items) ? o.items : [];
  const itemRows = items.map(it => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee">${escapeHtml(it.name)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center">${it.qty || 0}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">${fmtMoney(it.price)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right"><strong>${fmtMoney((it.price || 0) * (it.qty || 0))}</strong></td>
    </tr>
  `).join('');

  const sourceLabel = o.source === 'online' ? '🌐 Online (khách tự đặt)' : '🏪 Offline (nhân viên tạo)';
  const typeLabel = o.orderType === 'delivery' ? '🚚 Giao tận nơi' : (o.orderType === 'pickup' ? '🏪 Đến lấy tại quán' : '—');
  const timeLabel = o.isScheduled && o.scheduledAt
    ? `📅 Hẹn: ${new Date(o.scheduledAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}`
    : '🕐 Ngay bây giờ';
  const createdLabel = o.createdAt
    ? new Date(o.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'medium' })
    : new Date().toLocaleString('vi-VN');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#f5f0e8">
<div style="max-width:600px;margin:0 auto;background:#fff;padding:24px">
  <div style="background:#5a7a5e;color:#fff;padding:20px;border-radius:10px;text-align:center;margin-bottom:20px">
    <div style="font-size:30px;margin-bottom:8px">☕</div>
    <h1 style="margin:0;font-size:20px">Đơn hàng mới — Hello 5 Coffee</h1>
    <div style="font-size:12px;opacity:.85;margin-top:4px">${sourceLabel}</div>
  </div>

  ${o.customer_code ? `
  <div style="background:#eef3ee;border-radius:8px;padding:14px;text-align:center;margin-bottom:16px">
    <div style="font-size:11px;color:#666;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Mã khách</div>
    <div style="font-family:monospace;font-size:26px;font-weight:800;letter-spacing:3px;color:#5a7a5e">${escapeHtml(o.customer_code)}</div>
  </div>` : ''}

  <div style="border:1px solid #e0d8cc;border-radius:8px;padding:14px 16px;margin-bottom:16px">
    <div style="font-size:12px;color:#999;margin-bottom:4px">Mã đơn nội bộ</div>
    <div style="font-family:monospace;font-size:16px;font-weight:700;color:#2d2a24">${escapeHtml(o.code || '—')}</div>
  </div>

  <h3 style="margin:20px 0 10px;font-size:15px;color:#5a7a5e">👤 Khách hàng</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:6px 0;color:#666;width:130px">Tên</td><td style="padding:6px 0"><strong>${escapeHtml(o.customerName || '—')}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#666">SĐT</td><td style="padding:6px 0"><a href="tel:${escapeHtml(o.customerPhone || '')}" style="color:#5a7a5e;text-decoration:none"><strong>${escapeHtml(o.customerPhone || '—')}</strong></a></td></tr>
    <tr><td style="padding:6px 0;color:#666">Hình thức</td><td style="padding:6px 0">${typeLabel}</td></tr>
    ${o.orderType === 'delivery' && o.deliveryAddress ? `<tr><td style="padding:6px 0;color:#666;vertical-align:top">Địa chỉ</td><td style="padding:6px 0">${escapeHtml(o.deliveryAddress)}</td></tr>` : ''}
    ${o.branchName ? `<tr><td style="padding:6px 0;color:#666">Chi nhánh</td><td style="padding:6px 0">${escapeHtml(o.branchName)}</td></tr>` : ''}
    <tr><td style="padding:6px 0;color:#666">Thời gian</td><td style="padding:6px 0">${timeLabel}</td></tr>
    ${o.note ? `<tr><td style="padding:6px 0;color:#666;vertical-align:top">Ghi chú</td><td style="padding:6px 0;font-style:italic">${escapeHtml(o.note)}</td></tr>` : ''}
  </table>

  ${items.length ? `
  <h3 style="margin:20px 0 10px;font-size:15px;color:#5a7a5e">🛒 Đơn hàng</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #eee">
    <thead>
      <tr style="background:#f5f0e8">
        <th style="padding:10px;text-align:left">Món</th>
        <th style="padding:10px;text-align:center;width:50px">SL</th>
        <th style="padding:10px;text-align:right;width:90px">Đơn giá</th>
        <th style="padding:10px;text-align:right;width:90px">Thành tiền</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr style="background:#eef3ee">
        <td colspan="3" style="padding:12px 10px;text-align:right;font-size:14px"><strong>Tổng cộng</strong></td>
        <td style="padding:12px 10px;text-align:right;font-size:16px;color:#5a7a5e"><strong>${fmtMoney(o.total)}</strong></td>
      </tr>
    </tfoot>
  </table>` : `
  <div style="background:#eef3ee;padding:14px;border-radius:8px;text-align:right;font-size:16px;color:#5a7a5e;margin-top:16px">
    <strong>Tổng cộng: ${fmtMoney(o.total)}</strong>
  </div>`}

  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center">
    ⏱ Tạo lúc: ${createdLabel}<br>
    Email tự động từ hệ thống Hello 5 Coffee ERP
  </div>
</div>
</body></html>`;
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Health check
  if (req.method === 'GET') {
    const configured = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && process.env.NOTIFY_EMAIL);
    res.status(200).json({ ok: true, configured });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const { GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_EMAIL } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !NOTIFY_EMAIL) {
    res.status(500).json({ ok: false, error: 'Email env vars not configured (GMAIL_USER/GMAIL_APP_PASSWORD/NOTIFY_EMAIL)' });
    return;
  }

  try {
    // Parse body (Vercel auto-parses if Content-Type: application/json)
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    if (!body.code && !body.customer_code) {
      res.status(400).json({ ok: false, error: 'Missing order code' });
      return;
    }

    if (_isDuplicate(body.code || body.customer_code)) {
      res.status(200).json({ ok: true, deduped: true });
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD.replace(/\s/g, '') }
    });

    const subjectPrefix = body.source === 'online' ? '🌐 Đơn online mới' : '🏪 Đơn mới';
    const subject = `${subjectPrefix} — ${body.customer_code || body.code} — ${fmtMoney(body.total)}`;

    // NOTIFY_EMAIL hỗ trợ nhiều địa chỉ phân cách bằng dấu phẩy
    // VD: "a@gmail.com, b@gmail.com, c@gmail.com"
    const recipients = NOTIFY_EMAIL
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (!recipients.length) {
      res.status(500).json({ ok: false, error: 'NOTIFY_EMAIL empty after parsing' });
      return;
    }

    await transporter.sendMail({
      from: `"Hello 5 Coffee" <${GMAIL_USER}>`,
      to: recipients.join(', '),
      subject,
      html: buildHtml(body),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-order-email error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Unknown error' });
  }
};
