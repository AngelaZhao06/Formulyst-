from flask import Flask, request, jsonify
from flask_cors import CORS
from ai_service import check_ingredients

app = Flask(__name__)
# Allow your React dev server (change port if yours is different)
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/check-ingredients")
def check():
    payload = request.get_json(force=True, silent=True) or {}
    result = check_ingredients(payload)
    return jsonify(result), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
