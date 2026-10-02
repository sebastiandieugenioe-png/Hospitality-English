"""
Isolated OpenAI Speaking evaluator (backend-only, Structured Outputs).

Judges whether an open-ended spoken response handles a hospitality service
situation. Uses the user-provided OPENAI_API_KEY (never the Emergent key, never
the browser). Returns a strict JSON object matching the spec schema. The model
receives ONLY the whitelisted fields; it does not score accent/native-likeness
and does not translate.
"""
import json
import os

from openai import AsyncOpenAI

MODEL = "gpt-4o-mini"

ISSUE_CODES = [
    "too_short", "off_topic", "missing_solution", "too_direct",
    "grammar_minor", "grammar_major", "awkward_wording", "unclear_transcript",
]
RATING = ["strong", "partial", "missed"]

SCHEMA = {
    "type": "object",
    "properties": {
        "understandable": {"type": "boolean"},
        "situation_handled": {"type": "string", "enum": RATING},
        "professional_service_english": {"type": "string", "enum": RATING},
        "grammar_vocabulary": {"type": "string", "enum": RATING},
        "naturalness": {"type": "string", "enum": RATING},
        "issue_codes": {"type": "array", "items": {"type": "string", "enum": ISSUE_CODES}},
        "improved_response_en": {"type": ["string", "null"]},
        "overall": {"type": "string", "enum": ["strong", "good", "needs_practice"]},
    },
    "required": [
        "understandable", "situation_handled", "professional_service_english",
        "grammar_vocabulary", "naturalness", "issue_codes", "improved_response_en", "overall",
    ],
    "additionalProperties": False,
}

SYSTEM = (
    "You evaluate a hospitality worker's SPOKEN reply (transcribed) to a guest in a "
    "service situation. Multiple valid answers exist. model_response_en is only ONE "
    "example, not the required wording. Judge whether the reply appropriately handles "
    "the situation with clear, polite, professional service English. Rules: do NOT score "
    "accent, native-likeness or personality; do NOT penalize accent unless the transcript "
    "suggests the speech was unintelligible (use issue code 'unclear_transcript'); do NOT "
    "invent facts not present in the situation; keep improved_response_en at most 30 words "
    "or null; return the JSON object only."
)

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _client


def _cap_words(text, n=30):
    if not text:
        return text
    words = text.split()
    return " ".join(words[:n]) if len(words) > n else text


async def evaluate(profession_id, role, situation_slug, prompt_transcript_en, model_response_en, user_transcript):
    client = _get_client()
    user_payload = {
        "profession_id": profession_id,
        "role": role,
        "situation_slug": situation_slug,
        "prompt_transcript_en": prompt_transcript_en,
        "model_response_en": model_response_en,
        "user_transcript": user_transcript,
    }
    completion = await client.chat.completions.create(
        model=MODEL,
        temperature=0,
        seed=7,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "speaking_evaluation", "strict": True, "schema": SCHEMA},
        },
    )
    msg = completion.choices[0].message
    if getattr(msg, "refusal", None):
        raise RuntimeError("evaluation refused")
    data = json.loads(msg.content)
    data["improved_response_en"] = _cap_words(data.get("improved_response_en"))
    return data
