# app.py
import os, tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
from AI_service.ai_service import check_ingredients, create_ingredient_dict

app = Flask(__name__)
app.url_map.strict_slashes = False  # avoid 308 redirects on trailing slash

# Allow your FRONTEND origins (Live Server / Vite)
CORS(app, resources={r"/*": {"origins": [
    "http://127.0.0.1:5500",
    "http://localhost:5500"
]}})


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/check-ingredients")
def check():
    # ✅ Handle uploaded image
    if "image" in request.files:
        f = request.files["image"]
        if not f or f.filename == "":
            return jsonify({"error": "Empty file"}), 400

        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            f.save(tmp.name)
            tmp_path = tmp.name

        try:
            # 👇 Use ai_service’s OCR + hazard checker
            ingredients = create_ingredient_dict(tmp_path)
            result = check_ingredients(ingredients)
            return jsonify(result), 200
        finally:
            try:
                os.remove(tmp_path)
            except:
                pass

    # ✅ Handle JSON with ingredients
    payload = request.get_json(silent=True) or {}
    if isinstance(payload.get("ingredients"), list):
        result = check_ingredients({"ingredients": payload["ingredients"]})
        return jsonify(result), 200

    return jsonify({"error": "No image or ingredients provided"}), 400


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
