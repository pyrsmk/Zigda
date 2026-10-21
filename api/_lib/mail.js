const RESEND_URL = 'https://api.resend.com/emails/batch'

export function mailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM)
}

export async function sendMails(mails) {
  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(mails.map((mail) => ({ from: process.env.MAIL_FROM, ...mail }))),
  })
  if (!res.ok) throw new Error(`Resend answered ${res.status}: ${await res.text()}`)
}
