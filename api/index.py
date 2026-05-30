"""
Nocturne API — Vercel Serverless
单文件处理所有 API 路由
"""
import json
import hashlib
import os
import re
import secrets
import sys
import time

import requests
import uuid
from datetime import datetime, timezone
from html import escape as html_escape
from pathlib import Path
from http.server import BaseHTTPRequestHandler
from io import BytesIO

sys.path.insert(0, str(Path(__file__).parent.parent))

# ── Storage (in-memory for Vercel — resets on cold start, acceptable for demo) ──

_users = {}
_sessions = {}
_broadcasts = []

# Try loading persisted data
_DATA_DIR = Path('/tmp/nocturne')
_DATA_DIR.mkdir(exist_ok=True)
_USERS_FILE = _DATA_DIR / 'users.json'
_BROADCAST_FILE = _DATA_DIR / 'broadcast.json'

try:
    if _USERS_FILE.exists(): _users = json.loads(_USERS_FILE.read_text())
    if _BROADCAST_FILE.exists(): _broadcasts = json.loads(_BROADCAST_FILE.read_text())
except Exception:
    pass

def _save():
    try:
        _USERS_FILE.write_text(json.dumps(_users, ensure_ascii=False))
        _BROADCAST_FILE.write_text(json.dumps(_broadcasts, ensure_ascii=False))
    except Exception:
        pass

ALLOWED_EMOTIONS = {'fear', 'joy', 'calm', 'anxiety', 'wonder', 'sad', 'strange'}

# ── Rate limiting ──
_rate_limits = {}
RATE_WINDOW = 60  # seconds

def _check_rate(key, max_req=5, window=RATE_WINDOW):
    now = time.time()
    if key not in _rate_limits:
        _rate_limits[key] = []
    _rate_limits[key] = [t for t in _rate_limits[key] if now - t < window]
    _rate_limits[key].append(now)
    return len(_rate_limits[key]) <= max_req

# ── Session expiry ──
SESSION_TTL = 24 * 3600  # 24 hours
_session_timestamps = {}

# ── Helpers ──

# Password hashing: PBKDF2-HMAC-SHA256 with 600,000 iterations
_PBKDF2_ITERATIONS = 600_000
_PBKDF2_SALT_BYTES = 16

def _hash_pw(password, salt_hex=None):
    salt_bytes = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(_PBKDF2_SALT_BYTES)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt_bytes, _PBKDF2_ITERATIONS)
    return salt_bytes.hex() + ':' + dk.hex()

def _verify_pw(password, stored):
    try:
        salt_hex, _ = stored.split(':', 1)
        return _hash_pw(password, salt_hex) == stored
    except Exception:
        return False

def _require_auth(headers):
    token = headers.get('authorization', '').replace('Bearer ', '')
    username = _sessions.get(token)
    if not username:
        return None
    # Check session expiry
    created = _session_timestamps.get(token, 0)
    if time.time() - created > SESSION_TTL:
        _sessions.pop(token, None)
        _session_timestamps.pop(token, None)
        return None
    # Refresh session timestamp on activity
    _session_timestamps[token] = time.time()
    return username

def _json(data, status=200):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://sun-rise-dev.github.io',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
        'body': json.dumps(data, ensure_ascii=False),
    }

def _cors():
    return {
        'Access-Control-Allow-Origin': 'https://sun-rise-dev.github.io',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    }

# ── Dream Processing ──

def _process_dream(text):
    try:
        from backend.dream_service import DreamService
        svc = DreamService()
        return svc.process(text)
    except Exception:
        pass

    # Local fallback
    emotion = _detect_emotion(text)
    words = [w for w in re.findall(r'[\w一-鿿]{2,}', text) if w not in {'的','了','是','我','在','有','和','就','不','人','都','一','个','the','a','an','is','was'}]
    keywords = words[:8]
    narrative = text

    # Try image generation directly
    image_url = None
    try:
        image_url = _gen_image(narrative, keywords, emotion)
    except Exception:
        pass

    return {'success': True, 'narrative': narrative, 'emotion': emotion, 'keywords': keywords, 'title': text[:28], 'image_url': image_url}


def _detect_emotion(text):
    patterns = {
        'fear': ['害怕','恐惧','逃跑','黑暗','追赶','坠落','死亡','血','鬼','怪物','噩梦','吓','恐怖','尖叫','逃','躲','深渊','窒息','afraid','fear','scared','monster','dark','chase','falling','death','nightmare','horror','ghost','scream'],
        'joy': ['开心','笑','美','幸福','温暖','爱','光明','彩虹','拥抱','庆祝','鲜花','阳光','婚礼','团聚','成功','happy','love','light','warm','beautiful','joy','smile','laugh'],
        'calm': ['安静','水','湖','海','风','云','月','星星','花','雪','山','林','草原','日落','宁静','安详','漂浮','calm','water','lake','ocean','wind','moon','star','quiet','peaceful','forest','sunset'],
        'anxiety': ['考试','迟到','找','迷路','丢','忘','急','错','没准备','赶不上','错过','等待','紧张','担心','焦虑','exam','late','lost','forgot','anxious','naked','stuck','rush','nervous'],
        'wonder': ['飞','魔法','变','穿越','巨大','奇怪','宇宙','光','翅膀','神奇','幻想','星辰','银河','龙','精灵','仙境','fly','magic','cosmic','giant','wonder','fantasy','dragon','fairy','castle','portal'],
        'sad': ['哭','难过','失去','离别','死','老','病','泪','悲伤','孤独','寂寞','哀伤','痛苦','心碎','分手','遗��','怀念','cry','sad','loss','goodbye','sorrow','lonely','grief','tears','regret'],
        'strange': ['扭曲','颠倒','动物','说话','变成','平行','无限','超现实','荒诞','错位','融化','变形','分身','循环','混乱','surreal','twisted','animal','talking','strange','bizarre','weird','melt','distort','warp'],
    }
    scores = {e: sum(text.count(w) for w in ws) for e, ws in patterns.items()}
    sorted_pairs = sorted(scores.items(), key=lambda x: -x[1])
    best_score = sorted_pairs[0][1]
    if best_score > 0:
        tied = [e for e, s in sorted_pairs if s == best_score]
        import random
        return random.choice(tied)
    import random
    return random.choice(list(patterns.keys()))


def _gen_image(narrative, keywords, emotion):
    api_key = os.environ.get('IMAGE_API_KEY', '')
    if not api_key:
        return None
    try:
        moods = {
            'fear': 'dark and mysterious, deep purple and blue tones',
            'joy': 'warm golden light, bright and radiant',
            'calm': 'serene and peaceful, soft blue and teal tones',
            'anxiety': 'tense and surreal, fragmented light',
            'wonder': 'magical and ethereal, shimmering starlight',
            'sad': 'melancholic and quiet, soft grey blue',
            'strange': 'surreal and dreamlike, impossible geometry',
        }
        mood = moods.get(emotion, 'dreamlike and ethereal')
        image_prompt = (
            f"Create a dreamlike illustration. Atmosphere: {mood}. "
            f"Style: soft watercolor meets oil painting, misty edges, luminous. "
            f"Key elements: {', '.join(keywords[:5]) if keywords else 'surreal landscape'}. "
            f"Essence: {narrative[:200]}. Aspect ratio 3:4, vertical. No text."
        )
        resp = requests.post(
            f'{os.environ.get("IMAGE_API_BASE", "https://shiyunapi.com")}/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={'model': os.environ.get('IMAGE_MODEL', 'gemini-3.1-flash-image-preview'), 'messages': [{'role': 'user', 'content': image_prompt}], 'max_tokens': 4096, 'temperature': 1.0},
            timeout=120,
        )
        if resp.status_code == 200:
            content = resp.json().get('choices', [{}])[0].get('message', {}).get('content', '')
            urls = re.findall(r'!\[.*?\]\((https?://[^\s)]+)\)', content)
            if urls: return urls[0]
            if content.startswith('data:image'): return content
    except Exception:
        pass
    return None

# ── Router ──

def handler(request):  # noqa: C901
    method = request.get('method', 'GET')
    path = request.get('path', '/')
    headers = {k.lower(): v for k, v in request.get('headers', {}).items()}

    if method == 'OPTIONS':
        return {'statusCode': 204, 'headers': _cors()}

    body_raw = request.get('body', b'')
    if isinstance(body_raw, str): body_raw = body_raw.encode()
    # Enforce max body size: 100 KB
    if len(body_raw) > 102_400:
        return _json({'success': False, 'error': 'Request body too large'}, 413)

    content_type = headers.get('content-type', '')
    body = {}
    if body_raw:
        if 'application/json' not in content_type:
            return _json({'success': False, 'error': 'Content-Type must be application/json'}, 415)
        try:
            body = json.loads(body_raw)
        except Exception:
            return _json({'success': False, 'error': 'Invalid JSON'}, 400)

    # ── Health ──
    if path == '/api/health':
        return _json({'status': 'ok'})

    # ── Rate limit check for sensitive routes ──
    client_ip = request.get('remote_addr', 'unknown')
    rate_limited_paths = ['/api/auth/register', '/api/auth/login', '/api/dreams', '/api/broadcast']
    for rp in rate_limited_paths:
        if path.startswith(rp):
            if not _check_rate(f'{rp}:{client_ip}', max_req=5, window=60):
                return _json({'success': False, 'error': 'Too many requests. Wait a moment.'}, 429)
            break

    # ── Auth: Register ──
    if path == '/api/auth/register' and method == 'POST':
        username = (body.get('username') or '').strip()
        password = body.get('password', '')
        if not re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
            return _json({'success': False, 'error': 'Username 3-20 chars'}, 400)
        if len(password) < 6:
            return _json({'success': False, 'error': 'Password 6+ chars'}, 400)
        if any(u.lower() == username.lower() for u in _users):
            return _json({'success': False, 'error': 'Username taken'}, 409)
        _users[username] = {'username': username, 'password': _hash_pw(password), 'nickname': username, 'avatar_color': '#5B6E82', 'bio': '', 'created_at': datetime.now(timezone.utc).isoformat()}
        token = secrets.token_hex(32)
        _sessions[token] = username
        _session_timestamps[token] = time.time()
        _save()
        return _json({'success': True, 'token': token, 'user': {k: v for k, v in _users[username].items() if k != 'password'}}, 201)

    # ── Auth: Login ──
    if path == '/api/auth/login' and method == 'POST':
        username = (body.get('username') or '').strip()
        password = body.get('password', '')
        user_key = next((u for u in _users if u.lower() == username.lower()), None)
        if not user_key or not _verify_pw(password, _users[user_key]['password']):
            return _json({'success': False, 'error': 'Invalid credentials'}, 401)
        token = secrets.token_hex(32)
        _sessions[token] = user_key
        _session_timestamps[token] = time.time()
        return _json({'success': True, 'token': token, 'user': {k: v for k, v in _users[user_key].items() if k != 'password'}})

    # ── Auth: Profile ──
    if path == '/api/auth/me':
        username = _require_auth(headers)
        if not username or username not in _users:
            return _json({'success': False, 'error': 'Auth required'}, 401)
        if method == 'GET':
            return _json({'success': True, 'user': {k: v for k, v in _users[username].items() if k != 'password'}})
        if method == 'PUT':
            if 'nickname' in body and 1 <= len(body['nickname'].strip()) <= 30:
                _users[username]['nickname'] = html_escape(body['nickname'].strip())
            if 'bio' in body and len(body['bio'].strip()) <= 200:
                _users[username]['bio'] = html_escape(body['bio'].strip())
            _save()
            return _json({'success': True, 'user': {k: v for k, v in _users[username].items() if k != 'password'}})

    # ── Auth: Logout ──
    if path == '/api/auth/logout' and method == 'POST':
        token = headers.get('authorization', '').replace('Bearer ', '')
        _sessions.pop(token, None)
        _session_timestamps.pop(token, None)
        return _json({'success': True})

    # ── Dreams ──
    if path == '/api/dreams' and method == 'POST':
        text = (body.get('text') or '').strip()
        if not text or len(text) < 10:
            return _json({'success': False, 'error': 'Text too short'}, 400)
        if len(text) > 10000:
            return _json({'success': False, 'error': 'Text too long'}, 413)
        return _json(_process_dream(text))

    # ── Broadcast: Share ──
    if path == '/api/broadcast' and method == 'POST':
        narrative = (body.get('narrative') or '').strip()
        if not narrative:
            return _json({'success': False, 'error': 'Empty'}, 400)
        emotion = body.get('emotion', 'wonder')
        if emotion not in ALLOWED_EMOTIONS: emotion = 'wonder'
        item = {'id': 'b_' + uuid.uuid4().hex[:10], 'narrative': html_escape(narrative[:300]), 'emotion': emotion, 'date': datetime.now(timezone.utc).isoformat(), 'reactions': {}}
        _broadcasts.insert(0, item)
        if len(_broadcasts) > 200: _broadcasts[:] = _broadcasts[:200]
        _save()
        return _json({'success': True, 'broadcast_id': item['id']}, 201)

    # ── Broadcast: List ──
    if path == '/api/broadcast' and method == 'GET':
        return _json({'success': True, 'broadcasts': _broadcasts[:50]})

    # ── Broadcast: React ──
    m = re.match(r'/api/broadcast/([^/]+)/react', path)
    if m and method == 'POST':
        bid = m.group(1)
        if not _check_rate(f'react:{client_ip}', max_req=10, window=30):
            return _json({'success': False, 'error': 'Too many reactions. Slow down.'}, 429)
        emoji = (body.get('emoji') or '').strip()
        if not emoji or len(emoji) > 8:
            return _json({'success': False, 'error': 'Invalid emoji'}, 400)
        for item in _broadcasts:
            if item['id'] == bid:
                item['reactions'][emoji] = item['reactions'].get(emoji, 0) + 1
                _save()
                return _json({'success': True, 'count': item['reactions'][emoji]})
        return _json({'success': False, 'error': 'Not found'}, 404)

    return _json({'success': False, 'error': 'Not found'}, 404)
