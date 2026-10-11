"""Tests for POST /api/feedback (iteration 20)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

GUEST_ID = "a7f7c2a4-e875-468d-ba40-a3773875cec8"


def _post(payload):
    return requests.post(f"{API}/feedback", json=payload, timeout=15)


def test_feedback_valid_bug():
    r = _post({
        "guest_id": GUEST_ID,
        "profession_id": "hospitality",
        "category": "bug",
        "message": "TEST_iter20 bug feedback",
        "app_version": "1.0.0-test",
        "route": "/support/feedback",
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert "id" in body and body["status"] == "new"


def test_feedback_invalid_category():
    r = _post({
        "guest_id": GUEST_ID,
        "profession_id": "hospitality",
        "category": "spam",
        "message": "x",
    })
    assert r.status_code == 422, r.text


def test_feedback_empty_message():
    r = _post({
        "guest_id": GUEST_ID,
        "profession_id": "hospitality",
        "category": "other",
        "message": "",
    })
    assert r.status_code == 422, r.text


def test_feedback_whitespace_message():
    r = _post({
        "guest_id": GUEST_ID,
        "profession_id": "hospitality",
        "category": "other",
        "message": "   ",
    })
    assert r.status_code == 422, r.text


def test_feedback_unknown_guest_stored_as_null():
    r = _post({
        "guest_id": "00000000-0000-0000-0000-000000000000",
        "profession_id": "hospitality",
        "category": "suggestion",
        "message": "TEST_iter20 unknown guest",
    })
    assert r.status_code == 201, r.text
    fid = r.json()["id"]
    # Verify directly in mongo via a side-channel: there's no GET endpoint, so verify indirectly via assertions
    # by checking the collection via a mongo lookup through a helper endpoint. Fallback: trust server logic
    # but confirm persistence shape by requerying through mongo client.
    from pymongo import MongoClient
    mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    dbname = os.environ.get("DB_NAME") or "test_database"
    doc = mongo[dbname].feedback.find_one({"id": fid}, {"_id": 0})
    assert doc is not None
    assert doc["guest_id"] is None
    assert doc["user_id"] is None
    assert doc["profession_id"] == "hospitality"
    assert doc["category"] == "suggestion"
    assert doc["message"] == "TEST_iter20 unknown guest"
    assert doc["status"] == "new"
    assert "created_at" in doc
    # No extra sensitive fields
    allowed = {"id", "user_id", "guest_id", "profession_id", "category", "message", "app_version", "route", "created_at", "status"}
    assert set(doc.keys()).issubset(allowed), f"Unexpected fields: {set(doc.keys()) - allowed}"


def test_feedback_known_guest_fields_persisted():
    r = _post({
        "guest_id": GUEST_ID,
        "profession_id": "hospitality",
        "category": "confusing",
        "message": "TEST_iter20 known guest persistence check",
    })
    assert r.status_code == 201
    fid = r.json()["id"]
    from pymongo import MongoClient
    mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    dbname = os.environ.get("DB_NAME") or "test_database"
    doc = mongo[dbname].feedback.find_one({"id": fid}, {"_id": 0})
    assert doc is not None
    assert doc["guest_id"] == GUEST_ID
    assert doc["category"] == "confusing"
    assert doc["status"] == "new"


def test_feedback_backend_env_cors_for_api():
    # Minimal sanity: feedback endpoint should be reachable via the public ingress /api prefix
    r = requests.options(f"{API}/feedback", timeout=10)
    assert r.status_code in (200, 204, 405), r.status_code
