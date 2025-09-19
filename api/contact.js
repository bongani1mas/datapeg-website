// /api/contact.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse JSON manually (vanilla Vercel functions)
  let payload = {};
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8') || '{}';
    payload = JSON.parse(raw);
  } catch (e) {
    console.error('JSON parse error:', e);
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { name, email, company, message } = payload || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const esc = (s = '') =>
    s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const html = `
    <h2>New enquiry – DataPEG website</h2>
    <p><b>Name:</b> ${esc(name)}</p>
    <p><b>Email:</b> ${esc(email)}</p>
    <p><b>Company:</b> ${esc(company || '-')}</p>
    <p><b>Message:</b></p>
    <pre style="white-space:pre-wrap">${esc(message)}</pre>
  `;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'DataPEG <info@datapeg.co.za>',   // or no-reply@, but domain must be verified in Resend
        to: ['info@datapeg.co.za'],             // your inbox
        reply_to: email,
        subject: `Website enquiry from ${name}`,
        html
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('Resend error:', text);
      return res.status(502).json({ error: 'Email service failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Unexpected error' });
  }
}
