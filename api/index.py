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

# ── Helpers ──

def _hash_pw(password, salt=None):
    salt = salt or secrets.token_hex(8)
    return f"{salt}:{hashlib.sha256(f'{salt}:{password}'.encode()).hexdigest()}"

def _verify_pw(password, stored):
    try:
        salt, _ = stored.split(':', 1)
        return _hash_pw(password, salt) == stored
    except Exception:
        return False

def _require_auth(headers):
    token = headers.get('authorization', '').replace('Bearer ', '')
    return _sessions.get(token)

def _json(data, status=200):
    return {'statusCode': status, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': 'https://nocturne-dream-journal.vercel.app'}, 'body': json.dumps(data, ensure_ascii=False)}

def _cors():
    return {'Access-Control-Allow-Origin': 'https://nocturne-dream-journal.vercel.app', 'Access-Control-Allow-Methods': '*', 'Access-Control-Allow-Headers': '*'}

# ── Dream Processing ──

def _process_dream(text):
    try:
        from backend.dream_service import DreamService
        svc = DreamService()
        return svc.process(text)
    except Exception:
        words = [w for w in re.findall(r'[\w一-鿿]{2,}', text) if w not in {'的','了','是','我','在','有','和','就','不','人','都','一','个','the','a','an','is','was'}]
        return {'success': True, 'narrative': text, 'emotion': 'wonder', 'keywords': words[:8], 'title': text[:28]}

# ── Router ──

def handler(request):  # noqa: C901
    method = request.get('method', 'GET')
    path = request.get('path', '/')
    headers = {k.lower(): v for k, v in request.get('headers', {}).items()}

    if method == 'OPTIONS':
        return {'statusCode': 204, 'headers': _cors()}

    body_raw = request.get('body', b'')
    if isinstance(body_raw, str): body_raw = body_raw.encode()
    try:
        body = json.loads(body_raw) if body_raw else {}
    except Exception:
        body = {}

    # ── Health ──
    if path == '/api/health':
        return _json({'status': 'ok'})

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
                _users[username]['nickname'] = body['nickname'].strip()
            if 'bio' in body and len(body['bio'].strip()) <= 200:
                _users[username]['bio'] = body['bio'].strip()
            _save()
            return _json({'success': True, 'user': {k: v for k, v in _users[username].items() if k != 'password'}})

    # ── Auth: Logout ──
    if path == '/api/auth/logout' and method == 'POST':
        token = headers.get('authorization', '').replace('Bearer ', '')
        _sessions.pop(token, None)
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
        if len(_broadcasts) > 200: _broadcasts = _broadcasts[:200]
        _save()
        return _json({'success': True, 'broadcast_id': item['id']}, 201)

    # ── Broadcast: List ──
    if path == '/api/broadcast' and method == 'GET':
        return _json({'success': True, 'broadcasts': _broadcasts[:50]})

    # ── Broadcast: React ──
    m = re.match(r'/api/broadcast/([^/]+)/react', path)
    if m and method == 'POST':
        bid = m.group(1)
        emoji = (body.get('emoji') or '').strip()
        if not emoji or len(emoji) > 4:
            return _json({'success': False, 'error': 'Invalid'}, 400)
        for item in _broadcasts:
            if item['id'] == bid:
                item['reactions'][emoji] = item['reactions'].get(emoji, 0) + 1
                _save()
                return _json({'success': True, 'count': item['reactions'][emoji]})
        return _json({'success': False, 'error': 'Not found'}, 404)

    return _json({'success': False, 'error': 'Not found'}, 404)
