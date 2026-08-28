import nodemailer from 'nodemailer';
import { admin } from './supabase.js';

/* Sends app-originated email (e.g. the learning-reminder feature) using
 * SMTP credentials an admin configured via /api/admin/smtp — stored in
 * public.smtp_settings, a service-role-only singleton row (see migration
 * 003). This is UNRELATED to Supabase Auth's own confirmation/reset
 * emails, which are sent by Supabase's own infrastructure and configured
 * only in the Supabase Dashboard (Authentication → Settings → SMTP
 * Settings) — nothing here can affect those. */

function mailerErr(msg) {
  const e = new Error(msg);
  e.status = 503;
  return e;
}

export async function getSmtpSettings() {
  const { data, error } = await admin.from('smtp_settings')
    .select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data;
}

/** Builds a fresh transporter per call — settings can change between sends
 *  (an admin editing them mid-session) and email volume here is low
 *  (reminders, test sends), so there is no need for a cached/shared
 *  transporter with the lifecycle bugs that come with one. */
async function transporter() {
  const s = await getSmtpSettings();
  if (!s) throw mailerErr(
    'SMTP is not configured yet — set it up under Admin → Email.');
  return {
    settings: s,
    client: nodemailer.createTransport({
      host: s.host,
      port: s.port,
      secure: s.secure,
      auth: { user: s.username, pass: s.password }
    })
  };
}

/** sendMail({to, subject, html, text}) — throws on failure (caller decides
 *  whether that's fatal; the /smtp/test route surfaces it directly). */
export async function sendMail({ to, subject, html, text }) {
  const { settings, client } = await transporter();
  const from = settings.from_name
    ? `"${settings.from_name.replace(/"/g, '')}" <${settings.from_email}>`
    : settings.from_email;
  return client.sendMail({ from, to, subject, html, text });
}
