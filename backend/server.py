"""
Nocturne · 梦境记录器 — Flask API 服务
运行: python backend/server.py
端口: 12450
"""
import hashlib
import json
import logging
import os
import re
import secrets
import sys
import uuid
from datetime import datetime, timezone
from functools import wraps
from html import escape as html_escape
from pathlib import Path
from flask import Flask, request, jsonify, g
from flask_cors import CORS

sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.dream_service import DreamService

logging.basicConfig(level=logging.INFO, format='%(asctime)s | %(levelname)-7s | %(message)s', datefmt='%H:%M:%S')
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024  # 1 MB

CORS(app, origins=[
    'http://localhost:12450',
    'http://127.0.0.1:12450',
    'https://sun-rise-dev.github.io',
], supports_credentials=True)

dream_service = DreamService()

ALLOWED_EMOTIONS = {'fear', 'joy', 'calm', 'anxiety', 'wonder', 'sad', 'strange'}
ALLOWED_AVATAR_COLORS = ['#3A4A5C','#5B6E82','#8B7D6B','#6B3A5C','#2A4A3C','#4A3A5C']

_rate_limits = {}
BROADCAST_FILE = Path.cwd() / 'broadcast.json'
USERS_FILE = Path.cwd() / 'users.json'
SESSIONS = {}


def _load_broadcasts():
    if BROADCAST_FILE.exists():
        try:
            return json.loads(BROADCAST_FILE.read_text(encoding='utf-8'))
        except Exception as e:
            logger.warning(f"Failed to load broadcasts: {e}")
    return []


def _save_broadcasts(data):
    try:
        BROADCAST_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    except Exception as e:
        logger.error(f"Failed to save broadcasts: {e}")
        raise


def _check_rate(key, max_req=5, window=60):
    now = datetime.now(timezone.utc).timestamp()
    if key not in _rate_limits:
        _rate_limits[key] = []
    _rate_limits[key] = [t for t in _rate_limits[key] if now - t < window]
    _rate_limits[key].append(now)
    return len(_rate_limits[key]) <= max_req


# ═══════════════════════ User Management ═══════════════════════

def _load_users():
    if USERS_FILE.exists():
        try: return json.loads(USERS_FILE.read_text(encoding='utf-8'))
        except Exception as e: logger.warning(f"Failed to load users: {e}")
    return {}


def _save_users(data):
    try: USERS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    except Exception as e: logger.error(f"Failed to save users: {e}"); raise


def _hash_pw(password, salt=None):
    salt = salt or secrets.token_hex(8)
    h = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return f"{salt}:{h}"


def _verify_pw(password, stored):
    try:
        salt, _ = stored.split(':', 1)
        return _hash_pw(password, salt) == stored
    except Exception:
        return False


def _require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token or token not in SESSIONS:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        g.user_id = SESSIONS[token]
        return f(*args, **kwargs)
    return wrapper


# ═══════════════════════ Auth Routes ═══════════════════════

@app.route('/api/auth/register', methods=['POST'])
def register():
    if not request.is_json:
        return jsonify({'success': False, 'error': 'JSON required'}), 400

    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '')

    if not re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
        return jsonify({'success': False, 'error': '用户名 3-20 位字母数字下划线'}), 400
    if len(password) < 6:
        return jsonify({'success': False, 'error': '密码至少 6 位'}), 400

    users = _load_users()
    if username.lower() in (u.lower() for u in users):
        return jsonify({'success': False, 'error': '用户名已存在'}), 409

    color = ALLOWED_AVATAR_COLORS[len(users) % len(ALLOWED_AVATAR_COLORS)]
    users[username] = {
        'username': username,
        'password': _hash_pw(password),
        'nickname': username,
        'avatar_color': color,
        'bio': '',
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    _save_users(users)

    token = secrets.token_hex(32)
    SESSIONS[token] = username
    logger.info(f"User registered: {username}")

    return jsonify({'success': True, 'token': token, 'user': _public_user(users[username])}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    if not request.is_json:
        return jsonify({'success': False, 'error': 'JSON required'}), 400

    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = data.get('password', '')

    users = _load_users()
    user = None
    for u, udata in users.items():
        if u.lower() == username.lower():
            user = (u, udata)
            break

    if not user or not _verify_pw(password, user[1]['password']):
        return jsonify({'success': False, 'error': '用户名或密码错误'}), 401

    token = secrets.token_hex(32)
    SESSIONS[token] = user[0]
    logger.info(f"User logged in: {user[0]}")

    return jsonify({'success': True, 'token': token, 'user': _public_user(user[1])})


@app.route('/api/auth/me', methods=['GET', 'PUT'])
@_require_auth
def profile():
    users = _load_users()
    username = g.user_id
    if username not in users:
        return jsonify({'success': False, 'error': 'User not found'}), 404

    if request.method == 'GET':
        return jsonify({'success': True, 'user': _public_user(users[username])})

    # PUT — update profile
    data = request.get_json()
    nickname = (data.get('nickname') or '').strip()
    bio = (data.get('bio') or '').strip()

    if nickname and 1 <= len(nickname) <= 30:
        users[username]['nickname'] = nickname
    if bio and len(bio) <= 200:
        users[username]['bio'] = bio

    _save_users(users)
    return jsonify({'success': True, 'user': _public_user(users[username])})


@app.route('/api/auth/logout', methods=['POST'])
@_require_auth
def logout():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    SESSIONS.pop(token, None)
    return jsonify({'success': True})


def _public_user(user):
    return {
        'username': user['username'],
        'nickname': user['nickname'],
        'avatar_color': user['avatar_color'],
        'bio': user['bio'],
        'created_at': user.get('created_at', ''),
    }


# ═══════════════════════ Dream Processing ═══════════════════════

@app.route('/api/dreams', methods=['POST'])
def process_dream():
    client_ip = request.remote_addr or 'unknown'
    if not _check_rate(f'dream:{client_ip}', max_req=5, window=60):
        return jsonify({'success': False, 'error': 'Too many requests. Wait a moment.'}), 429

    if not request.is_json:
        return jsonify({'success': False, 'error': 'JSON required'}), 400

    data = request.get_json()
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'success': False, 'error': 'Empty text'}), 400
    if len(text) < 10:
        return jsonify({'success': False, 'error': 'Too short — say more'}), 400
    if len(text) > 10000:
        return jsonify({'success': False, 'error': 'Text too long'}), 413

    logger.info(f"Processing dream: {text[:50]}...")
    result = dream_service.process(text)
    return jsonify(result)


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'Nocturne API'})


# ═══════════════════════ Broadcast ═══════════════════════

@app.route('/api/broadcast', methods=['POST'])
def share_broadcast():
    """匿名分享梦境到广播频道"""
    data = request.get_json()
    narrative = (data.get('narrative') or '').strip()
    emotion = data.get('emotion', 'wonder')

    if not narrative:
        return jsonify({'success': False, 'error': 'Empty narrative'}), 400

    broadcasts = _load_broadcasts()
    if emotion not in ALLOWED_EMOTIONS:
        emotion = 'wonder'

    item = {
        'id': 'b_' + uuid.uuid4().hex[:10],
        'narrative': html_escape(narrative[:300]),
        'emotion': emotion,
        'date': datetime.now(timezone.utc).isoformat(),
        'reactions': {},
    }
    broadcasts.insert(0, item)
    _save_broadcasts(broadcasts)

    logger.info(f"Broadcast shared: {item['id']}")
    return jsonify({'success': True, 'broadcast_id': item['id']}), 201


@app.route('/api/broadcast', methods=['GET'])
def list_broadcasts():
    """获取广播列表"""
    broadcasts = _load_broadcasts()
    # Return latest 50
    return jsonify({'success': True, 'broadcasts': broadcasts[:50]})


@app.route('/api/broadcast/<broadcast_id>/react', methods=['POST'])
def react_broadcast(broadcast_id):
    """添加表情反应"""
    data = request.get_json()
    emoji = (data.get('emoji') or '').strip()
    if not emoji or len(emoji) > 4:
        return jsonify({'success': False, 'error': 'Invalid emoji'}), 400

    broadcasts = _load_broadcasts()
    for item in broadcasts:
        if item['id'] == broadcast_id:
            item['reactions'][emoji] = item['reactions'].get(emoji, 0) + 1
            _save_broadcasts(broadcasts)
            return jsonify({'success': True, 'count': item['reactions'][emoji]})

    return jsonify({'success': False, 'error': 'Not found'}), 404


if __name__ == '__main__':
    logger.info("Nocturne API: http://localhost:12450")
    app.run(host='127.0.0.1', port=12450, debug=os.environ.get('FLASK_DEBUG', '0') == '1')
