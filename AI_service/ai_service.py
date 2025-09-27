import json, re
from rapidfuzz import fuzz, process
import os, json
from PIL import Image
import pytesseract



def extract_text_from_image(image_path: str) -> str:
    img = Image.open(image_path)
    text = pytesseract.image_to_string(img)
    return text

def parse_ingredients(text: str) -> dict:
    # Remove line breaks
    cleaned = re.sub(r'[\n\r]', ' ', text)
    # Split by commas
    parts = [p.strip() for p in cleaned.split(",") if p.strip()]
    return {"ingredients": parts}
def create_ingredient_dict(image_path: str) -> dict:
    text = extract_text_from_image(image_path)
    return parse_ingredients(text)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE_DIR, "alias_index.json"), "r", encoding="utf-8") as f:
    ALIAS_MAP = json.load(f)

with open(os.path.join(BASE_DIR, "hazards.json"), "r", encoding="utf-8") as f:
    HAZARDS = json.load(f)


# Build id -> item map
ITEM_BY_ID = {h["id"]: h for h in HAZARDS}
# Alias keys for fuzzy search
ALIASES = list(ALIAS_MAP.keys())

def _norm(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()

def _tokenize(payload):
    if "ingredients" in payload and payload["ingredients"]:
        return [_norm(t) for t in payload["ingredients"] if t and t.strip()]
    text = (payload.get("text") or "")
    return [_norm(t) for t in re.split(r"[,\n;]+", text) if t and t.strip()]

def _lookup_exact(token_norm):
    id_ = ALIAS_MAP.get(token_norm)
    if id_:
        return ITEM_BY_ID[id_], 0.99, token_norm
    return None, 0.0, None

def _lookup_fuzzy(token_norm, threshold=0.86):
    match = process.extractOne(token_norm, ALIASES, scorer=fuzz.token_set_ratio)
    if match:
        alias_key, score, _ = match
        if score >= threshold * 100:
            id_ = ALIAS_MAP[alias_key]
            return ITEM_BY_ID[id_], score/100.0, alias_key
    return None, 0.0, None

def check_ingredients(payload, threshold=0.86):
    tokens = _tokenize(payload)
    analysis = []

    seen_ids = set()
    for raw in tokens:
        item, conf, matched_alias = _lookup_exact(raw)
        if not item:
            item, conf, matched_alias = _lookup_fuzzy(raw, threshold=threshold)
        if item and item["id"] not in seen_ids:
            seen_ids.add(item["id"])
            analysis.append({
                "query": raw,
                "matched_alias": matched_alias,
                "id": item["id"],
                "name": item["name"],
                "cas": item.get("cas", []),
                "hazard_level": item.get("hazard_level", "Unknown"),
                "recommendation": item.get("recommendation", "Suggest avoid"),
                "categories": item.get("categories", []),
                "reasons": item.get("reasons", []),
                "regulatory_CA": item.get("regulatory_CA", ""),
                "regulatory_EU": item.get("regulatory_EU", ""),
                "prop65": bool(item.get("prop65", False)),
                "source_regulatory": item.get("source_regulatory", ""),
                "source_scientific": item.get("source_scientific", ""),
                "source_consumer": item.get("source_consumer", ""),
                "confidence": round(conf, 2),
            })
        else:
            analysis.append({
                "query": raw,
                "matched_alias": None,
                "id": None,
                "name": None,
                "cas": [],
                "hazard_level": "Unknown",
                "recommendation": "Suggest avoid",
                "categories": [],
                "reasons": [],
                "regulatory_CA": "",
                "regulatory_EU": "",
                "prop65": False,
                "source_regulatory": "",
                "source_scientific": "",
                "source_consumer": "",
                "confidence": 0.0,
            })
    summary = {
        "high": sum(1 for r in analysis if r["hazard_level"] == "High"),
        "medium": sum(1 for r in analysis if r["hazard_level"] == "Medium"),
        "low": sum(1 for r in analysis if r["hazard_level"] == "Low"),
        "unknown": sum(1 for r in analysis if r["hazard_level"] == "Unknown"),
        "total": len(analysis),
    }
    return {"analysis": analysis, "summary": summary}

file_path = "/Users/yasemannikoo/projects/Formulyst-/AI_service/Screenshot2.png"

# Step 1: OCR
ingredients = create_ingredient_dict(file_path)
print("OCR Ingredients:", ingredients)

# Step 2: Hazard check
hazard_results = check_ingredients(ingredients)["summary"]
print("Hazard Results:", hazard_results)

