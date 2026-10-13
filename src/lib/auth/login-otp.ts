import { emailEnabled, sendEmail } from "@/lib/email"

// Sends the second-factor code, or logs it when email is not configured so local development still works.
export async function sendLoginOtp(email: string, otp: string): Promise<void> {
  if (!emailEnabled()) {
    console.warn(`[dev] email OTP for ${email}: ${otp}`)
    return
  }
  await sendEmail(
    [email],
    "Your Gardik sign-in code",
    `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111;line-height:1.5">` +
      `<p>Your sign-in code is <strong style="font-size:18px;letter-spacing:2px">${otp}</strong>.</p>` +
      `<p>It expires shortly. If you did not try to sign in, ignore this email.</p>` +
      `</div>`
  )
}
