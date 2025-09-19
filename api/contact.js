// /api/contact.js

// === Config ===
const COOKIE_NAME = 'dp_last_submit';
const COOLDOWN_SEC = 60; // block rapid repeat submits for 60s
const FROM_ADDRESS = 'DataPEG <hello@datapeg.co.za>'; // or use no-reply@ if you prefer
const INTERNAL_TO = ['info@datapeg.co.za']; // where you receive enquiries

// === Helpers ===
function parseCookies(header = '') {
  return header.split(';').reduce((acc, part) => {
    const i = part.indexOf('=');
    if (i > -1) acc[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    return acc;
  }, {});
}

function setCookieHeader(name, value, seconds) {
  const expires = new Date(Date.now() + seconds * 1000).toUTCString();
  return `${name}=${encodeURIComponent(value)}; Path=/; Expires=${expires}; HttpOnly; SameSite=Lax; Secure`;
}

function esc(s = '') {
  return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// === Handler ===
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Server-side cooldown via cookie
  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const last = Number(cookies[COOKIE_NAME] || 0);
    if (!Number.isNaN(last) && Date.now() - last < COOLDOWN_SEC * 1000) {
      const wait = Math.ceil((COOLDOWN_SEC * 1000 - (Date.now() - last)) / 1000);
      return res.status(429).json({ error: `Please wait ${wait}s before sending again.` });
    }
  } catch {
    // ignore cookie parse errors
  }

  // Manually parse JSON (vanilla Vercel functions)
  let payload = {};
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8') || '{}';
    payload = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { name, email, company, message, __ts_token } = payload || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!__ts_token) {
    return res.status(400).json({ error: 'Verification token missing.' });
  }

  // Verify Turnstile token (Cloudflare)
  try {
    const form = new URLSearchParams();
    form.append('secret', process.env.TURNSTILE_SECRET_KEY || '');
    form.append('response', __ts_token);
    // pass through client IP if available
    const ip = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim();
    if (ip) form.append('remoteip', ip);

    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form
    });
    const result = await verify.json();
    if (!result.success) {
      return res.status(400).json({ error: 'Verification failed.' });
    }
  } catch (e) {
    console.error('Turnstile verify error:', e);
    return res.status(502).json({ error: 'Verification service error.' });
  }

  // Compose emails
  const internalHtml = `
    <h2>New enquiry – DataPEG website</h2>
    <p><b>Name:</b> ${esc(name)}</p>
    <p><b>Email:</b> ${esc(email)}</p>
    <p><b>Company:</b> ${esc(company || '-')}</p>
    <p><b>Message:</b></p>
    <pre style="white-space:pre-wrap;font-family:system-ui,-apple-system,Segoe UI,Helvetica,Arial">${esc(message)}</pre>
  `;

  const confirmationHtml = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Helvetica,Arial;line-height:1.5">
      <h2 style="margin:0 0 12px">Thanks for contacting DataPEG</h2>
      <p>Hi ${esc(name)},</p>
      <p>We’ve received your message and one of our consultants will be in touch shortly.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0" />
      <p style="margin:0 0 6px"><b>Your message</b></p>
      <pre style="white-space:pre-wrap;margin:0;background:#fafafa;padding:10px;border:1px solid #eee;border-radius:8px">${esc(message)}</pre>
      <p style="margin-top:16px">If you need to add anything, just reply to this email.</p>
      <p style="margin-top:16px">— DataPEG</p>
      <p style="color:#64748b;font-size:12px;margin-top:24px">
        Centurion, Gauteng • info@datapeg.co.za • https://www.datapeg.co.za
      </p>
    </div>
  `;

  try {
    // 1) Internal notification
    const r1 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,       // must be on your verified domain
        to: INTERNAL_TO,          // your inbox(es)
        reply_to: email,          // replying goes to the submitter
        subject: `Website enquiry from ${name}`,
        html: internalHtml,
      }),
    });
    if (!r1.ok) {
      const t = await r1.text();
      console.error('Resend internal send error:', t);
      return res.status(502).json({ error: 'Email service failed (internal).' });
    }

    // 2) Confirmation to the submitter
    const r2 = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [email],
        reply_to: 'info@datapeg.co.za',
        subject: 'We received your enquiry — DataPEG',
        html: confirmationHtml,
      }),
    });
    if (!r2.ok) {
      const t = await r2.text();
      console.error('Resend confirmation send error:', t);
      // We still continue; no need to block the user if confirmation fails
    }

    // Set cooldown cookie
    res.setHeader('Set-Cookie', setCookieHeader(COOKIE_NAME, String(Date.now()), COOLDOWN_SEC));

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: 'Unexpected error.' });
  }
}
