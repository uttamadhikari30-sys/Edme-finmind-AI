/**
 * Sends a one-time temporary password to a newly created user.
 *
 * Uses Resend (https://resend.com) via its HTTP API — no SDK dependency needed.
 * Falls back to a no-op + log if RESEND_API_KEY is not configured, so the admin
 * UI can still surface the temp password manually.
 *
 * Required env vars (set on Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY  = re_xxx... (from https://resend.com/api-keys)
 *   EMAIL_FROM      = "FINMIND AI <noreply@yourdomain.com>"  (must be a Resend-verified sender)
 *   APP_URL         = https://your-deployed-app.vercel.app   (used in the email link)
 */

export type SendTempPasswordResult = {
  sent: boolean;
  provider: "resend" | "none";
  reason?: string; // present when sent=false
  message_id?: string; // present when sent=true
};

export async function sendTempPasswordEmail(params: {
  to: string;
  fullName: string | null;
  tempPassword: string;
  loginUrl: string;
  createdBy?: string | null;
}): Promise<SendTempPasswordResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "FINMIND AI <onboarding@resend.dev>";

  if (!apiKey) {
    return {
      sent: false,
      provider: "none",
      reason:
        "RESEND_API_KEY not configured. Add it in Vercel env vars to auto-email new users.",
    };
  }

  const displayName = params.fullName?.trim() || params.to.split("@")[0];

  const subject = "Welcome to FINMIND AI — your login credentials";

  const html = renderHtmlEmail({
    displayName,
    email: params.to,
    tempPassword: params.tempPassword,
    loginUrl: params.loginUrl,
    createdBy: params.createdBy ?? null,
  });

  const text = renderTextEmail({
    displayName,
    email: params.to,
    tempPassword: params.tempPassword,
    loginUrl: params.loginUrl,
    createdBy: params.createdBy ?? null,
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        sent: false,
        provider: "resend",
        reason: `Resend API error (${res.status}): ${errText.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as { id?: string };
    return { sent: true, provider: "resend", message_id: data.id };
  } catch (e: any) {
    return {
      sent: false,
      provider: "resend",
      reason: `Email send threw: ${e?.message ?? String(e)}`,
    };
  }
}

// ---------- email body templates ----------

function renderHtmlEmail(p: {
  displayName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
  createdBy: string | null;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Welcome to FINMIND AI</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F1F3D;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(15,31,61,0.06);">
          <tr>
            <td style="padding:28px 36px 12px;border-bottom:1px solid #f0f1f4;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#0F1F3D;letter-spacing:-0.2px;">
                FINMIND <span style="color:#ED1B2F;">AI</span>
              </div>
              <div style="font-size:11px;color:#7a8395;margin-top:2px;letter-spacing:0.5px;">Edme Insurance Brokers Limited</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 8px;">
              <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#0F1F3D;margin:0 0 8px;">
                Welcome, ${escapeHtml(p.displayName)}.
              </h1>
              <p style="font-size:14px;line-height:1.55;color:#4a5365;margin:0 0 18px;">
                ${p.createdBy ? `${escapeHtml(p.createdBy)} has created` : "An admin has created"} a FINMIND AI account for you.
                Use the credentials below to sign in. You'll be asked to set your own password on your first login.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafbfc;border:1px solid #e5e7eb;border-radius:10px;margin:0 0 18px;">
                <tr>
                  <td style="padding:14px 18px;border-bottom:1px solid #eef0f3;">
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#7a8395;font-weight:700;margin-bottom:4px;">Email</div>
                    <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:13px;font-weight:600;color:#0F1F3D;">${escapeHtml(p.email)}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;">
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#7a8395;font-weight:700;margin-bottom:4px;">Temporary password</div>
                    <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:15px;font-weight:700;color:#ED1B2F;letter-spacing:1px;">${escapeHtml(p.tempPassword)}</div>
                    <div style="font-size:11px;color:#7a8395;margin-top:6px;">You will be required to change this on first login.</div>
                  </td>
                </tr>
              </table>

              <div style="text-align:center;margin:0 0 22px;">
                <a href="${escapeHtml(p.loginUrl)}"
                   style="display:inline-block;background:linear-gradient(135deg,#ED1B2F 0%,#b8101f 100%);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;border-radius:10px;box-shadow:0 6px 18px rgba(237,27,47,0.30);">
                   Sign in to FINMIND AI &rarr;
                </a>
              </div>

              <p style="font-size:12px;line-height:1.55;color:#7a8395;margin:0 0 6px;">
                If the button doesn't work, copy this link into your browser:
              </p>
              <p style="font-size:11.5px;line-height:1.5;color:#4a5365;word-break:break-all;margin:0 0 18px;">
                <a href="${escapeHtml(p.loginUrl)}" style="color:#0F1F3D;text-decoration:underline;">${escapeHtml(p.loginUrl)}</a>
              </p>

              <div style="border-top:1px solid #f0f1f4;padding-top:14px;font-size:11px;line-height:1.55;color:#9aa3b5;">
                For your security, never share this password. If you did not expect this email,
                please contact your admin or reply to let us know.
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 36px 22px;background:#fafbfc;font-size:10.5px;color:#9aa3b5;text-align:center;">
              &copy; ${new Date().getFullYear()} Edme Insurance Brokers Limited &middot; FINMIND AI
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderTextEmail(p: {
  displayName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
  createdBy: string | null;
}): string {
  return [
    `Welcome to FINMIND AI, ${p.displayName}.`,
    ``,
    `${p.createdBy ? `${p.createdBy} has created` : "An admin has created"} an account for you.`,
    `You will be required to change this password on first login.`,
    ``,
    `  Login URL:          ${p.loginUrl}`,
    `  Email:              ${p.email}`,
    `  Temporary password: ${p.tempPassword}`,
    ``,
    `For your security, never share this password.`,
    `If you did not expect this email, contact your admin.`,
    ``,
    `— FINMIND AI · Edme Insurance Brokers Limited`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
