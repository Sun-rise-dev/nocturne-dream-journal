import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

PROMPT_PATH = os.path.join(os.path.dirname(__file__), "prompts", "dream_prompt.txt")


def load_prompt() -> str:
    with open(PROMPT_PATH, "r", encoding="utf-8") as f:
        return f.read()


def call_ai(text: str) -> dict:
    """
    Stub AI call — replace with your GenAI backend (OpenAI / DeepSeek / local LLM).
    The prompt in dream_prompt.txt guides the narrative voice.
    """
    prompt = load_prompt().replace("{text}", text)

    # TODO: send `prompt` to your AI API and parse the reply.
    # For now, return a local fallback mirroring DreamService.localFallback in the iOS layer.
    return {
        "narrative": text,
        "emotion": "wonder",
        "keywords": extract_keywords(text),
        "title": text[:28],
    }


STOP_WORDS: set[str] = {
    "的", "了", "是", "我", "在", "有", "和", "就", "不", "人", "都", "一", "个",
    "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看",
    "好", "自己", "这", "那", "什么", "好像", "感觉", "觉得",
    "the", "a", "an", "is", "was", "in", "on", "at", "to", "of", "and",
    "it", "that", "this", "my", "me", "I",
}


def extract_keywords(text: str, max_kw: int = 8) -> list[str]:
    words = text.replace(",", " ").replace(".", " ").replace("，", " ").replace("。", " ").split()
    return [w for w in words if len(w) > 1 and w.lower() not in STOP_WORDS][:max_kw]


@app.route("/api/dreams", methods=["POST"])
def process_dream():
    body = request.get_json(silent=True)
    if not body or "text" not in body:
        return jsonify({"success": False, "error": "Missing 'text' field"}), 400

    text = body["text"].strip()
    if not text:
        return jsonify({"success": False, "error": "Empty text"}), 400

    try:
        result = call_ai(text)
        return jsonify({"success": True, **result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=12450, debug=True)
