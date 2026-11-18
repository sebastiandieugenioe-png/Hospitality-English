"""Offline unit tests for speaking_limits (no backend, no Mongo, no paid APIs).

Run: cd backend && python -m pytest tests/test_speaking_limits.py -n 0  (no backend or API keys needed)
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import speaking_limits as sl  # noqa: E402


class FakeCollection:
    def __init__(self):
        self.rows = []

    def _match(self, row, q):
        for k, v in q.items():
            if isinstance(v, dict) and "$gte" in v:
                if row.get(k) is None or row[k] < v["$gte"]:
                    return False
            elif row.get(k) != v:
                return False
        return True

    async def count_documents(self, q):
        await asyncio.sleep(0)  # yield, so concurrent callers really interleave
        return sum(1 for r in self.rows if self._match(r, q))

    async def insert_one(self, doc):
        await asyncio.sleep(0)
        row = dict(doc)
        row["_id"] = len(self.rows) + 1000 + sum(1 for _ in self.rows)
        self.rows.append(row)

        class R:
            inserted_id = row["_id"]
        return R()

    async def delete_one(self, q):
        for i, r in enumerate(self.rows):
            if self._match(r, q):
                del self.rows[i]
                return


class FakeDB(dict):
    def __missing__(self, key):
        self[key] = FakeCollection()
        return self[key]


class FakeUpload:
    def __init__(self, data):
        self.data = data

    async def read(self, n=-1):
        return self.data if n < 0 else self.data[:n]


def run(coro):
    return asyncio.run(coro)


def test_free_profile_quota(monkeypatch):
    monkeypatch.setattr(sl, "FREE_DAILY_PER_PROFILE", 3)
    db = FakeDB()
    for _ in range(3):
        assert run(sl.check_and_record(db, "g1", False)) is None
    assert run(sl.check_and_record(db, "g1", False)) == "profile"
    # another profile is unaffected
    assert run(sl.check_and_record(db, "g2", False)) is None


def test_premium_has_larger_quota(monkeypatch):
    monkeypatch.setattr(sl, "FREE_DAILY_PER_PROFILE", 1)
    monkeypatch.setattr(sl, "PREMIUM_DAILY_PER_PROFILE", 3)
    db = FakeDB()
    for _ in range(3):
        assert run(sl.check_and_record(db, "p1", True)) is None
    assert run(sl.check_and_record(db, "p1", True)) == "profile"


def test_global_free_cap_does_not_affect_premium(monkeypatch):
    monkeypatch.setattr(sl, "FREE_DAILY_PER_PROFILE", 100)
    monkeypatch.setattr(sl, "FREE_DAILY_GLOBAL", 2)
    db = FakeDB()
    assert run(sl.check_and_record(db, "a", False)) is None
    assert run(sl.check_and_record(db, "b", False)) is None
    assert run(sl.check_and_record(db, "c", False)) == "global"
    assert run(sl.check_and_record(db, "p", True)) is None


def test_window_is_rolling_24h(monkeypatch):
    monkeypatch.setattr(sl, "FREE_DAILY_PER_PROFILE", 1)
    db = FakeDB()
    t0 = datetime(2026, 11, 18, 9, 0, tzinfo=timezone.utc)
    assert run(sl.check_and_record(db, "g", False, now=t0)) is None
    assert run(sl.check_and_record(db, "g", False, now=t0 + timedelta(hours=23))) == "profile"
    assert run(sl.check_and_record(db, "g", False, now=t0 + timedelta(hours=25))) is None


def test_blocked_attempts_are_not_recorded(monkeypatch):
    monkeypatch.setattr(sl, "FREE_DAILY_PER_PROFILE", 1)
    db = FakeDB()
    run(sl.check_and_record(db, "g", False))
    run(sl.check_and_record(db, "g", False))
    assert len(db[sl.COLLECTION].rows) == 1


def test_read_limited():
    data, too_large = run(sl.read_limited(FakeUpload(b"x" * 10), max_bytes=10))
    assert data == b"x" * 10 and not too_large
    data, too_large = run(sl.read_limited(FakeUpload(b"x" * 50), max_bytes=10))
    assert too_large and len(data) == 11


def test_concurrent_requests_never_exceed_limit(monkeypatch):
    monkeypatch.setattr(sl, "FREE_DAILY_PER_PROFILE", 5)
    db = FakeDB()

    async def burst():
        return await asyncio.gather(*[sl.check_and_record(db, "g", False) for _ in range(20)])

    results = run(burst())
    assert sum(1 for r in results if r is None) <= 5
    assert len(db[sl.COLLECTION].rows) <= 5
