"""Private funnel stats built ONLY from data the app already stores (no new tracking,
no cookies, no third parties, no personal data in the output: just counts).

Cohort = guest profiles created in the last N days. Steps:
  1. profiles created (opened the app)       guests.created_at
  2. onboarding completed                     guests.onboarding_completed
  3. started a situation                      situation_attempts
  4. completed a situation                    situation_attempts.status == "completed"
  5. used speaking                            speaking_attempts
  6. created an account                       guests.user_id
Paid / trial conversions live in RevenueCat (its dashboard), not here.

Disabled unless the ADMIN_STATS_TOKEN env var is set; the token must be sent as the
`key` query parameter or the `X-Admin-Key` header.
"""
import hmac
import html
import os
from datetime import datetime, timedelta, timezone

STEPS = [
    ("created", "Abrieron la app (perfil creado)"),
    ("onboarded", "Completaron el onboarding"),
    ("started", "Empezaron una situación"),
    ("completed", "Completaron una situación"),
    ("spoke", "Usaron speaking"),
    ("account", "Crearon una cuenta"),
]

LANG_NAMES = {"es": "Español", "en": "English", "it": "Italiano", "fr": "Français", "pt": "Português",
              "de": "Deutsch", "pl": "Polski", "ro": "Română", "uk": "Українська", "nl": "Nederlands"}


def token_ok(provided):
    expected = os.environ.get("ADMIN_STATS_TOKEN", "").strip()
    if not expected or not provided:
        return None if not expected else False  # None = feature disabled
    return hmac.compare_digest(str(provided).strip(), expected)


def compute_funnel(cohort, started_ids, completed_ids, spoke_ids):
    """cohort: list of guest dicts (id, onboarding_completed, user_id, interface_language).
    Returns {"total": {step: n}, "by_language": {lang: {step: n}}}."""
    def empty():
        return {k: 0 for k, _ in STEPS}

    total, by_lang = empty(), {}
    for g in cohort:
        gid = g.get("id")
        lang = g.get("interface_language") or "?"
        row = by_lang.setdefault(lang, empty())
        flags = {
            "created": True,
            "onboarded": bool(g.get("onboarding_completed")),
            "started": gid in started_ids,
            "completed": gid in completed_ids,
            "spoke": gid in spoke_ids,
            "account": bool(g.get("user_id")),
        }
        for k, on in flags.items():
            if on:
                total[k] += 1
                row[k] += 1
    by_lang = dict(sorted(by_lang.items(), key=lambda kv: -kv[1]["created"]))
    return {"total": total, "by_language": by_lang}


async def gather(db, days):
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cohort = await db.guests.find(
        {"created_at": {"$gte": since}},
        {"_id": 0, "id": 1, "onboarding_completed": 1, "user_id": 1, "interface_language": 1},
    ).to_list(None)
    ids = [g["id"] for g in cohort if g.get("id")]
    if not ids:
        return compute_funnel([], set(), set(), set())
    started = set(await db.situation_attempts.distinct("guest_id", {"guest_id": {"$in": ids}}))
    completed = set(await db.situation_attempts.distinct("guest_id", {"guest_id": {"$in": ids}, "status": "completed"}))
    spoke = set(await db.speaking_attempts.distinct("guest_id", {"guest_id": {"$in": ids}}))
    return compute_funnel(cohort, started, completed, spoke)


def _pct(n, base):
    return f"{round(100 * n / base)} %" if base else "–"


def render_html(data, days):
    t = data["total"]
    base = t["created"]
    rows = []
    prev = None
    for k, label in STEPS:
        n = t[k]
        step = _pct(n, t[prev]) if prev else ""
        rows.append(f"<tr><td>{html.escape(label)}</td><td class=n>{n}</td><td class=n>{_pct(n, base)}</td><td class=n>{step}</td></tr>")
        prev = k
    head = "".join(f"<th class=n>{html.escape(label.split(' (')[0])}</th>" for _, label in STEPS)
    lang_rows = "".join(
        "<tr><td>" + html.escape(LANG_NAMES.get(lang, lang)) + "</td>"
        + "".join(f"<td class=n>{v[k]}</td>" for k, _ in STEPS) + "</tr>"
        for lang, v in data["by_language"].items()
    )
    links = " · ".join(
        f'<a href="?key={{KEY}}&days={d}"{" class=on" if d == days else ""}>{d} días</a>' for d in (7, 30, 90, 365)
    )
    return f"""<!doctype html><html lang=es><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1"><meta name=robots content=noindex>
<title>Embudo · Hospitality English</title>
<style>body{{font:16px/1.45 system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#222824}}
h1{{font-size:22px;margin:0 0 4px}}p.s{{color:#6B736E;margin:0 0 16px}}table{{border-collapse:collapse;width:100%;margin:12px 0 28px}}
th,td{{padding:8px 6px;border-bottom:1px solid #DEE2DE;text-align:left}}th{{font-size:13px;color:#6B736E;font-weight:600}}
.n{{text-align:right;font-variant-numeric:tabular-nums}}a{{color:#173D31}}a.on{{font-weight:700;text-decoration:none}}
.w{{overflow-x:auto}}</style></head><body>
<h1>Embudo de usuarios</h1>
<p class=s>Perfiles creados en los últimos {days} días · {links}</p>
<table><tr><th>Paso</th><th class=n>Personas</th><th class=n>Del total</th><th class=n>Del paso anterior</th></tr>{''.join(rows)}</table>
<h2 style="font-size:18px">Por idioma de la app</h2>
<div class=w><table><tr><th>Idioma</th>{head}</tr>{lang_rows}</table></div>
<p class=s>Solo cuenta datos que la app ya guarda; no hay datos personales. Pruebas gratis y pagos: panel de RevenueCat.</p>
</body></html>"""
