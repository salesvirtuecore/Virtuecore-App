import nodemailer from 'nodemailer'
import { getAppUrl } from './auth.js'

// Single source of truth for the app's brand colour in emails — the app UI's
// real token is vc-primary #6C5CE7; earlier emails had drifted to #7C3AED.
const BRAND_COLOR = '#6C5CE7'

export function createMailTransport() {
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS
  if (!user || !pass) return null
  return nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
}

// Wraps body HTML in the shared branded header/card frame used by every
// transactional email (invite, welcome, billing receipt, payment reminder).
export function wrapEmailHtml(headerText, bodyHtml) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 0;">
      <div style="background: ${BRAND_COLOR}; padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; font-size: 20px; margin: 0;">${headerText}</h1>
      </div>
      <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        ${bodyHtml}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="font-size: 13px; color: #9ca3af; margin: 0;">VirtueCore — sales@virtuecore.co.uk</p>
      </div>
    </div>`
}

function ctaButton(href, label) {
  return `<a href="${href}" style="display: inline-block; background: ${BRAND_COLOR}; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 15px; font-weight: 600;">${label}</a>`
}

async function send({ to, subject, html }) {
  const transport = createMailTransport()
  if (!transport || !to) return { sent: false }
  await transport.sendMail({
    from: process.env.EMAIL_FROM || `VirtueCore <${process.env.EMAIL_USER}>`,
    to, subject, html,
  })
  return { sent: true }
}

export async function sendInviteEmail({ email, fullName, role, signupUrl }) {
  const isVA = role === 'va'
  const roleLabel = isVA ? 'Virtual Assistant' : 'Client'
  const subject = isVA ? `You've been invited to join VirtueCore as a Virtual Assistant` : `You've been invited to your VirtueCore Client Portal`
  const body = `
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 16px;">Hi ${fullName || 'there'},</p>
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 16px;">You've been invited to VirtueCore as a <strong>${roleLabel}</strong>.</p>
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 24px;">Click the button below to create your account and get started:</p>
    ${ctaButton(signupUrl, 'Create Your Account')}
    <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 24px 0 0;">
      Or copy and paste this link into your browser:<br>
      <a href="${signupUrl}" style="color: ${BRAND_COLOR}; word-break: break-all;">${signupUrl}</a>
    </p>`
  return send({ to: email, subject, html: wrapEmailHtml('VirtueCore', body) })
}

export async function sendWelcomeOnboardingEmail({ email, fullName }) {
  const appUrl = getAppUrl()
  const onboardingUrl = `${appUrl}/client/onboarding`
  const body = `
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 16px;">Hi ${fullName || 'there'},</p>
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 16px;">Welcome to VirtueCore! We're excited to start working with you.</p>
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 24px;">
      Head over to your Getting Started page — it walks you through everything we need from you (domain, Google Workspace, Supabase, your Meta Ads account, and where to send us your logins) in a few short video steps.
    </p>
    ${ctaButton(onboardingUrl, 'Start Onboarding')}`
  return send({ to: email, subject: `Welcome to VirtueCore, ${fullName || ''}`.trim(), html: wrapEmailHtml('Welcome to VirtueCore', body) })
}

// Daily nudge sent to a client who hasn't finished the onboarding checklist
// yet — fired by the onboarding reminder cron, once per calendar day, until
// they either finish (see sendOnboardingCompleteEmail) or churn.
export async function sendOnboardingReminderEmail({ email, fullName, companyName, completedCount, totalSteps }) {
  const appUrl = getAppUrl()
  const onboardingUrl = `${appUrl}/client/onboarding`
  const remaining = Math.max(0, totalSteps - completedCount)
  const stepWord = remaining === 1 ? 'step' : 'steps'
  const body = `
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 16px;">Hi ${fullName || 'there'},</p>
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 16px;">
      You're <strong>${completedCount}/${totalSteps}</strong> through your VirtueCore onboarding — just ${remaining} ${stepWord} left before we can get started on ${companyName || 'your account'}.
    </p>
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 24px;">Pick up right where you left off:</p>
    ${ctaButton(onboardingUrl, 'Continue Onboarding')}
    <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 24px 0 0;">Already finished? Give it a few minutes and this reminder will stop on its own.</p>`
  return send({
    to: email,
    subject: `${remaining} ${stepWord} left to finish your VirtueCore onboarding`,
    html: wrapEmailHtml('Finish Setting Up', body),
  })
}

// Fired exactly once, the moment a client completes every onboarding step —
// either eagerly (right after their last step) or as a safety-net catch on
// the next cron pass. Links out to the marketing-site walkthrough page
// (PLATFORM_GUIDE_URL) rather than anything inside the app itself.
export async function sendOnboardingCompleteEmail({ email, fullName, companyName }) {
  const guideUrl = process.env.PLATFORM_GUIDE_URL || 'https://virtuecore.co.uk'
  const body = `
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 16px;">Hi ${fullName || 'there'},</p>
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 16px;">
      You're all set! Onboarding is complete${companyName ? ` for ${companyName}` : ''}, and your VirtueCore portal is fully up and running.
    </p>
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 24px;">
      We've put together a short walkthrough of exactly how the platform works — your dashboard, billing, messaging, and everything in between.
    </p>
    ${ctaButton(guideUrl, 'Watch How VirtueCore Works')}`
  return send({
    to: email,
    subject: `Welcome aboard — here's how VirtueCore works`,
    html: wrapEmailHtml('You’re All Set', body),
  })
}

export async function sendPaymentReminderEmail({ email, fullName, amount, dueDate }) {
  const appUrl = getAppUrl()
  const body = `
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 16px;">Hi ${fullName || 'there'},</p>
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 24px;">
      A heads up that your VirtueCore billing cycle charges your card on file on <strong>${dueDate}</strong>, for an estimated <strong>£${Number(amount || 0).toLocaleString()}</strong> based on revenue tracked so far this period.
    </p>
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 24px;">No action needed if your card is up to date — just flagging it ahead of time.</p>
    ${ctaButton(`${appUrl}/client/billing`, 'View Billing')}`
  return send({ to: email, subject: `Upcoming VirtueCore charge — £${Number(amount || 0).toLocaleString()} on ${dueDate}`, html: wrapEmailHtml('Upcoming Payment', body) })
}

export async function sendPaymentFailedEmail({ email, fullName, amount }) {
  const appUrl = getAppUrl()
  const body = `
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 16px;">Hi ${fullName || 'there'},</p>
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 24px;">
      We tried to charge your card on file for <strong>£${Number(amount || 0).toLocaleString()}</strong> and it didn't go through. We'll automatically retry over the next couple of weeks, but you can update your card now to avoid any interruption.
    </p>
    ${ctaButton(`${appUrl}/client/billing`, 'Update Payment Method')}`
  return send({ to: email, subject: `Payment failed — action may be needed`, html: wrapEmailHtml('Payment Failed', body) })
}

export async function sendBillingReceiptEmail(client, invoice) {
  if (!client.contact_email) return { sent: false }
  const appUrl = getAppUrl()
  const body = `
    <p style="font-size: 15px; color: #111827; margin: 0 0 16px;">Hi ${client.contact_name || 'there'},</p>
    <p style="font-size: 15px; color: #111827; line-height: 1.6; margin: 0 0 24px;">
      We've successfully charged your card on file for your VirtueCore monthly cycle. Here's the breakdown:
    </p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Period</td><td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">${invoice.period_start} to ${invoice.period_end}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Revenue tracked from Stripe</td><td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">£${Number(invoice.revenue_amount || 0).toLocaleString()}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Commission</td><td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">£${Number(invoice.commission_amount || 0).toLocaleString()}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Monthly retainer</td><td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px;">£${Number(invoice.retainer_amount || 0).toLocaleString()}</td></tr>
      <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 12px 0 0; color: #111827; font-size: 16px; font-weight: 600;">Total charged</td><td style="padding: 12px 0 0; text-align: right; color: #111827; font-size: 16px; font-weight: 600;">£${Number(invoice.amount).toLocaleString()}</td></tr>
    </table>
    ${ctaButton(`${appUrl}/client/invoices`, 'View invoice details')}
    <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">Stripe will also send you an official receipt separately.</p>`
  try {
    return await send({ to: client.contact_email, subject: `Payment received — £${Number(invoice.amount).toLocaleString()}`, html: wrapEmailHtml('VirtueCore — Payment Received', body) })
  } catch {
    return { sent: false } // don't fail the whole billing run if email fails
  }
}
