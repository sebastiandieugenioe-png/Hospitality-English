"""Offline unit tests for admin_funnel (no backend, no Mongo).

Run: cd backend && python -m pytest tests/test_admin_funnel.py -n 0
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import admin_funnel as af  # noqa: E402

COHORT = [
    {"id": "a", "onboarding_completed": True, "user_id": "usr_1", "interface_language": "es"},
    {"id": "b", "onboarding_completed": True, "user_id": None, "interface_language": "es"},
    {"id": "c", "onboarding_completed": False, "user_id": None, "interface_language": "pt"},
]


def test_compute_funnel_counts_each_step():
    d = af.compute_funnel(COHORT, started_ids={"a", "b"}, completed_ids={"a"}, spoke_ids={"a"})
    assert d["total"] == {"created": 3, "onboarded": 2, "started": 2, "completed": 1, "spoke": 1, "account": 1}
    assert d["by_language"]["es"]["created"] == 2
    assert d["by_language"]["pt"] == {"created": 1, "onboarded": 0, "started": 0, "completed": 0, "spoke": 0, "account": 0}
    assert list(d["by_language"]) == ["es", "pt"]  # biggest first


def test_token(monkeypatch):
    import hashlib
    monkeypatch.delenv("ADMIN_STATS_TOKEN", raising=False)
    monkeypatch.setenv("ADMIN_STATS_TOKEN_SHA256", "")
    assert af.token_ok("anything") is None  # disabled -> 404
    monkeypatch.setenv("ADMIN_STATS_TOKEN", "s3cret")
    assert af.token_ok("s3cret") is True
    assert af.token_ok("wrong") is False
    assert af.token_ok(None) is False
    # hash mode (no plain key configured)
    monkeypatch.delenv("ADMIN_STATS_TOKEN")
    monkeypatch.setenv("ADMIN_STATS_TOKEN_SHA256", hashlib.sha256(b"k3y").hexdigest())
    assert af.token_ok("k3y") is True
    assert af.token_ok("nope") is False


def test_hash_still_works_when_plain_key_is_wrong(monkeypatch):
    import hashlib
    monkeypatch.setenv("ADMIN_STATS_TOKEN", '"mistyped"')
    monkeypatch.setenv("ADMIN_STATS_TOKEN_SHA256", hashlib.sha256(b"k3y").hexdigest())
    assert af.token_ok("k3y") is True
    assert af.token_ok("mistyped") is True  # quotes around the stored value are ignored
    assert af.token_ok("other") is False


def test_default_hash_is_a_sha256():
    assert len(af.DEFAULT_TOKEN_SHA256) == 64


def test_render_html_has_steps_and_no_ids():
    d = af.compute_funnel(COHORT, {"a", "b"}, {"a"}, {"a"})
    page = af.render_html(d, 30)
    for _, label in af.STEPS:
        assert label in page
    assert "usr_1" not in page and '"a"' not in page
    assert "67 %" in page  # 2 of 3 completed onboarding


class FakeCursor:
    def __init__(self, rows):
        self.rows = rows

    async def to_list(self, n):
        return self.rows


class FakeCol:
    def __init__(self, rows):
        self.rows = rows

    def find(self, q, proj):
        since = q["created_at"]["$gte"]
        return FakeCursor([r for r in self.rows if r["created_at"] >= since])

    async def distinct(self, field, q):
        ids = set(q["guest_id"]["$in"])
        return list({r[field] for r in self.rows if r[field] in ids and all(r.get(k) == v for k, v in q.items() if k != "guest_id")})


class FakeDB:
    pass


def test_gather_uses_only_the_cohort_window():
    now = datetime.now(timezone.utc)
    old = (now - timedelta(days=60)).isoformat()
    new = (now - timedelta(days=1)).isoformat()
    db = FakeDB()
    db.guests = FakeCol([dict(COHORT[0], created_at=new), dict(COHORT[1], created_at=old)])
    db.situation_attempts = FakeCol([{"guest_id": "a", "status": "completed"}, {"guest_id": "b", "status": "completed"}])
    db.speaking_attempts = FakeCol([{"guest_id": "b"}])
    d = asyncio.run(af.gather(db, 30))
    assert d["total"]["created"] == 1
    assert d["total"]["completed"] == 1
    assert d["total"]["spoke"] == 0
