// /api/contact.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, company, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "DataPEG <no-reply@datapeg.co.za>",  // must be verified in Resend
        to: ["hello@datapeg.co.za"],              // your inbox
        reply_to: email,
        subject: `Website enquiry from ${name}`,
        html: `
          <h2>New enquiry – DataPEG website</h2>
          <p><b>Name:</b> ${name}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Company:</b> ${company || '-'}</p>
          <p><b>Message:</b></p>
          <pre>${message}</pre>
        `
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Resend error:", text);
      return res.status(500).json({ error: "Failed to send email" });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unexpected error" });
  }
}
