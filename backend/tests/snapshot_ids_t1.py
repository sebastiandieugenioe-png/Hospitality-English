"""Snapshot stable IDs + counts for idempotency comparison across restarts."""
import asyncio
import hashlib
import json
import sys

from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

env = dotenv_values("/app/backend/.env")


async def main(out_path):
    client = AsyncIOMotorClient(env["MONGO_URL"])
    db = client[env["DB_NAME"]]
    snap = {}
    snap["situations_total"] = await db.situations.count_documents({})
    snap["situations_active"] = await db.situations.count_documents({"active": True})
    snap["lessons"] = await db.lessons.count_documents({})
    snap["learning_items"] = await db.learning_items.count_documents({})
    snap["situation_ids"] = sorted(
        [f"{d['slug']}:{d.get('id')}" for d in await db.situations.find({}, {"slug": 1, "id": 1}).to_list(1000)]
    )
    snap["learning_item_ids"] = sorted(
        [str(d.get("id")) for d in await db.learning_items.find({}, {"id": 1}).to_list(5000)]
    )
    snap["inactive_slugs"] = sorted(
        [d["slug"] for d in await db.situations.find({"active": False}, {"slug": 1}).to_list(500)]
    )
    dups = {}
    for coll, key in [("situations", "slug"), ("lessons", "situation_slug"), ("learning_items", "id")]:
        pipe = [{"$group": {"_id": f"${key}", "n": {"$sum": 1}}}, {"$match": {"n": {"$gt": 1}}}]
        dups[coll] = await db[coll].aggregate(pipe).to_list(200)
    snap["duplicates"] = dups
    snap["hash"] = hashlib.sha256(
        json.dumps([snap["situation_ids"], snap["learning_item_ids"]], sort_keys=True).encode()
    ).hexdigest()
    with open(out_path, "w") as f:
        json.dump(snap, f, indent=1)
    print({k: v for k, v in snap.items() if k not in ("situation_ids", "learning_item_ids")})


asyncio.run(main(sys.argv[1]))
