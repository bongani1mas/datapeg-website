export default function handler(req, res) {
  const hasKey = !!process.env.RESEND_API_KEY;
  res.status(200).json({
    ok: true,
    route: "/api/debug",
    has_RESEND_API_KEY: hasKey
  });
}
