import asyncio, os, json
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import dotenv_values

env = {**dotenv_values("/app/backend/.env"), **os.environ}

async def main():
    cli = AsyncIOMotorClient(env["MONGO_URL"])
    db = cli[env["DB_NAME"]]
    out = {}
    for coll in await db.list_collection_names():
        out[coll] = await db[coll].count_documents({})
    print(json.dumps(out, sort_keys=True))
    # duplicate keys check
    for coll, key in (("situations","slug"),("lessons","situation_slug"),("skills","id"),("learning_items","id"),("categories","slug")):
        if coll not in out: continue
        pipe=[{"$group":{"_id":f"${key}","n":{"$sum":1}}},{"$match":{"n":{"$gt":1}}}]
        dupes=[d async for d in db[coll].aggregate(pipe)]
        print(f"DUPES {coll}.{key}:", dupes)

asyncio.run(main())
