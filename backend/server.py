"""
Nocturne · 梦境记录器 — Flask API 服务
运行: python backend/server.py
端口: 12450
"""
import logging
import sys
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.dream_service import DreamService

logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)-7s | %(message)s', datefmt='%H:%M:%S')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)
dream_service = DreamService()


@app.route('/api/dreams', methods=['POST'])
def process_dream():
    """接收转写文本，返回整理后的叙事 + 关键词 + 情绪"""
    data = request.get_json()
    text = (data.get('text') or '').strip()

    if not text:
        return jsonify({'success': False, 'error': '文本为空'}), 400
    if len(text) < 10:
        return jsonify({'success': False, 'error': '内容太短，多说一些吧'}), 400

    logger.info(f"处理梦境: {text[:50]}...")
    result = dream_service.process(text)
    return jsonify(result)


@app.route('/api/dreams', methods=['GET'])
def list_dreams():
    return jsonify({'success': True, 'dreams': []})


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'Nocturne API'})


if __name__ == '__main__':
    logger.info("Nocturne API 启动: http://localhost:12450")
    app.run(host='127.0.0.1', port=12450, debug=True)
