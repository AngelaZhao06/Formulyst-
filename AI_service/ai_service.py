import json, re, os
from rapidfuzz import fuzz, process
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

with open(os.path.join(BASE_DIR, "hazards_with_environment.json"), "r", encoding="utf-8") as f:
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

def _level_from_text(value: str) -> str:
    if not value:
        return "Unknown"
    v = value.lower()
    if "high" in v:
        return "High"
    if "moderate" in v or "medium" in v:
        return "Moderate"
    if "low" in v:
        return "Low"
    if "variable" in v:
        return "Variable"
    if "unknown" in v:
        return "Unknown"
    return "Unknown"

def _env_block(item: dict) -> dict:
    env = (item.get("environmental_impact") or {})
    return {
        "persistence": env.get("persistence", "Unknown"),
        "aquatic_toxicity": env.get("aquatic_toxicity", "Unknown"),
        "bioaccumulation": env.get("bioaccumulation", "Unknown"),
    }

# -------------------- Scoring helpers --------------------

_HEALTH_WEIGHT = {"High": 1.0, "Medium": 0.6, "Low": 0.3}
_ENV_WEIGHT = {"High": 1.0, "Moderate": 0.6, "Low": 0.2, "Unknown": 0.5, "Variable": 0.6}

def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))

def _compute_health_score(analysis_items) -> int:
    """
    0–100 (higher = worse).
    Per-item base from hazard_level, +0.15 if endocrine-related category, +0.2 if Prop65.
    """
    if not analysis_items:
        return 0
    per_item = []
    for it in analysis_items:
        base = _HEALTH_WEIGHT.get(it.get("hazard_level"), 0.3)
        cats = it.get("categories") or []
        endocrine_bump = 0.15 if any(re.search(r"endocrine", c, re.I) for c in cats) else 0.0
        prop65_bump = 0.2 if it.get("prop65") else 0.0
        per_item.append(_clamp01(base + endocrine_bump + prop65_bump))
    avg = sum(per_item) / len(per_item)
    return int(round(avg * 100))

def _compute_environment_score(analysis_items) -> int:
    """
    0–100 (higher = worse).
    For each item: average of weights for aquatic_toxicity, bioaccumulation, persistence.
    Overall score = average across items.
    """
    if not analysis_items:
        return 0
    per_item = []
    for it in analysis_items:
        env = it.get("environmental_impact") or {}
        a = _ENV_WEIGHT.get(_level_from_text(env.get("aquatic_toxicity")), 0.5)
        b = _ENV_WEIGHT.get(_level_from_text(env.get("bioaccumulation")), 0.5)
        c = _ENV_WEIGHT.get(_level_from_text(env.get("persistence")), 0.5)
        per_item.append((a + b + c) / 3.0)
    avg = sum(per_item) / len(per_item)
    return int(round(avg * 100))

# -------------------- Main API --------------------

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
            env = _env_block(item)
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
                "environmental_impact": env
            })

    # Health summary counts
    health_summary = {
        "high": sum(1 for r in analysis if r.get("hazard_level") == "High"),
        "medium": sum(1 for r in analysis if r.get("hazard_level") == "Medium"),
        "low": sum(1 for r in analysis if r.get("hazard_level") == "Low"),
        "total": len(analysis),
    }

    # Environment tally
    env_counts = {
        "persistence": {"High": 0, "Moderate": 0, "Low": 0, "Unknown": 0, "Variable": 0},
        "aquatic_toxicity": {"High": 0, "Moderate": 0, "Low": 0, "Unknown": 0, "Variable": 0},
        "bioaccumulation": {"High": 0, "Moderate": 0, "Low": 0, "Unknown": 0, "Variable": 0},
        "ingredients_with_any_high_env_flag": 0,
    }
    for r in analysis:
        env = r["environmental_impact"]
        p = _level_from_text(env.get("persistence"))
        a = _level_from_text(env.get("aquatic_toxicity"))
        b = _level_from_text(env.get("bioaccumulation"))
        env_counts["persistence"][p] += 1
        env_counts["aquatic_toxicity"][a] += 1
        env_counts["bioaccumulation"][b] += 1
        if "High" in {p, a, b}:
            env_counts["ingredients_with_any_high_env_flag"] += 1

    # Remove 'Unknown' bucket from environment summary (optional)
    for k in ["persistence", "aquatic_toxicity", "bioaccumulation"]:
        if "Unknown" in env_counts[k]:
            del env_counts[k]["Unknown"]

    # ---- NEW: scores added here ----
    health_score = _compute_health_score(analysis)
    environment_score = _compute_environment_score(analysis)

    return {
        "analysis": analysis,
        "summary": {
            "health": health_summary,
            "environment": env_counts,
            "health_score": health_score,            # 0–100
            "environment_score": environment_score,  # 0–100
        }
    }

# ---------- Example run ----------
if __name__ == "__main__":
    file_path = "/Users/yasemannikoo/projects/Formulyst-/AI_service/Screenshot.png"

    # Step 1: OCR
    ingredients = create_ingredient_dict(file_path)
    print("OCR Ingredients:", ingredients)

    # Step 2: Hazard + Environmental check
    results = check_ingredients(ingredients)
    print("Health Summary:", results["summary"]["health"])
    print("Environmental Summary:", results["summary"]["environment"])
    print("Scores:", {"health": results["summary"]["health_score"], "environment": results["summary"]["environment_score"]})
