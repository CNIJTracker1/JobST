"""Transactional email (verification, password reset, weekly report).

Uses Resend when RESEND_API_KEY is set (same provider as the original Supabase
edge functions). Without a key, emails are logged so local dev still works.
"""
import html

import httpx

from catalog import PIPELINE
from core import EMAIL_FROM, RESEND_API_KEY, logger

BRAND_GREEN = "#76BC21"
INK = "#1F2A1A"


async def send_email(to: str, subject: str, html_body: str) -> bool:
    if not RESEND_API_KEY:
        logger.info("[email disabled] to=%s subject=%s", to, subject)
        return False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                json={"from": EMAIL_FROM, "to": [to], "subject": subject, "html": html_body},
            )
        if resp.status_code >= 300:
            logger.warning("Resend error %s: %s", resp.status_code, resp.text)
            return False
        return True
    except Exception as exc:  # network errors shouldn't break the request
        logger.warning("Email send failed: %s", exc)
        return False


def _shell(title: str, body: str) -> str:
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;background:#F4F6F1;font-family:Inter,Segoe UI,Arial,sans-serif;color:{INK}">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:{INK};padding:24px 28px"><span style="color:{BRAND_GREEN};font-size:22px;font-weight:800">CareerNiche</span>
<span style="color:#cfd8c5;font-size:13px;margin-left:8px">{html.escape(title)}</span></td></tr>
<tr><td style="padding:28px">{body}</td></tr>
<tr><td style="padding:18px 28px;background:#F9FAF7;color:#7a8572;font-size:12px">You're receiving this because you have a CareerNiche Job Tracker account.</td></tr>
</table></td></tr></table></body></html>"""


def _button(url: str, label: str) -> str:
    return (f'<a href="{html.escape(url)}" style="display:inline-block;background:{BRAND_GREEN};color:#111;'
            f'text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">{html.escape(label)}</a>')


def verification_email(name: str, url: str) -> str:
    return _shell("Verify your email", f"<h2 style='margin:0 0 8px'>Welcome, {html.escape(name)} 👋</h2>"
                  f"<p>Confirm your email to start tracking your job search with CareerNiche.</p><p>{_button(url, 'Verify email')}</p>")


def reset_email(name: str, url: str) -> str:
    return _shell("Reset your password", f"<h2 style='margin:0 0 8px'>Hi {html.escape(name)},</h2>"
                  f"<p>Someone asked to reset your password. If it was you, use the button below. The link expires in 1 hour.</p>"
                  f"<p>{_button(url, 'Choose a new password')}</p><p style='color:#7a8572;font-size:13px'>Didn't ask? You can ignore this email.</p>")


def weekly_report_email(name: str, stats: dict, app_url: str) -> str:
    rows = "".join(
        f"<tr><td style='padding:6px 0'>{s}</td><td align='right' style='font-weight:700'>{stats['by_status'].get(s, 0)}</td></tr>"
        for s in PIPELINE + ["Archived"]
    )
    top = "".join(
        f"<li style='margin-bottom:6px'><b>{html.escape(j['job_name'])}</b> · {html.escape(j.get('company_name') or '')} "
        f"<span style='color:#7a8572'>({j['status']}, priority {j.get('priority_score') or '—'}/5)</span></li>"
        for j in stats["top_jobs"]
    ) or "<li>No active applications yet — add one this week!</li>"
    body = f"""<h2 style="margin:0 0 6px">Hi {html.escape(name)} 👋</h2>
<p style="margin:0 0 18px;color:#4a5544">Here's your job search for {stats['week_label']}.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px"><tr>
<td style="background:#F1F8E8;border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800">{stats['total']}</div><div style="font-size:12px;color:#4a5544">Tracked</div></td><td width="10"></td>
<td style="background:#F1F8E8;border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800">{stats['applied_this_week']}</div><div style="font-size:12px;color:#4a5544">Applied this week</div></td><td width="10"></td>
<td style="background:#F1F8E8;border-radius:12px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:800">{stats['points_this_week']}</div><div style="font-size:12px;color:#4a5544">Points this week</div></td></tr></table>
<h3 style="margin:0 0 8px;font-size:15px">Applications by status</h3><table width="100%" style="font-size:14px;margin-bottom:18px">{rows}</table>
<h3 style="margin:0 0 8px;font-size:15px">Top priority applications</h3><ul style="padding-left:18px;font-size:14px;margin:0 0 20px">{top}</ul>
<p>{_button(app_url, 'Open my tracker')}</p>"""
    return _shell("Your weekly progress", body)
