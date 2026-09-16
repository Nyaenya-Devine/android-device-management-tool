# authentication.py - salted hashing, login lockout, hashed sessions
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone

import config

USERS_FILE = "data/users.json"
SESSIONS_FILE = "data/sessions.json"
ITERATIONS = 600_000
ALLOWED_ROLES = {"viewer", "operator", "admin", "security_analyst"}
SESSION_TOKEN_BYTES = 32


def _secure_json_load(path):
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            value = json.load(f)
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return {}


def _secure_json_save(path, value):
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    temp_path = f"{path}.{secrets.token_hex(8)}.tmp"
    try:
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(value, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        try:
            os.chmod(temp_path, 0o600)
        except OSError:
            pass
        os.replace(temp_path, path)
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
    finally:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except OSError:
            pass


def _load_users():
    return _secure_json_load(USERS_FILE)


def _save_users(users):
    _secure_json_save(USERS_FILE, users)


def _hash_password(password, salt_hex, iterations=ITERATIONS):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), iterations).hex()


def create_user(username, password, role="viewer"):
    if not isinstance(username, str) or not username or len(username) > 128: return False
    if not isinstance(password, str) or len(password) < config.PASSWORD_MIN_LENGTH or len(password) > 1024: return False
    if role not in ALLOWED_ROLES: return False
    users = _load_users()
    if username in users: return False
    salt_hex = secrets.token_hex(16)
    users[username] = {"salt": salt_hex, "hash": _hash_password(password, salt_hex), "iterations": ITERATIONS, "role": role, "failed": 0, "locked_until": None, "last_failed_at": None}
    _save_users(users)
    return True


def verify_password(username, password):
    if not isinstance(username, str) or not isinstance(password, str): return False
    record = _load_users().get(username)
    if not record:
        _hash_password(password, "00" * 16)
        return False
    try:
        actual = _hash_password(password, record["salt"], int(record.get("iterations", ITERATIONS)))
        return hmac.compare_digest(record["hash"], actual)
    except (KeyError, TypeError, ValueError):
        return False


def login(username, password):
    users = _load_users()
    record = users.get(username)
    now = datetime.now(timezone.utc)
    if record is None:
        _hash_password(password, "00" * 16)
        return False, "invalid credentials"
    locked_until_str = record.get("locked_until")
    if locked_until_str:
        try:
            locked_until = datetime.fromisoformat(locked_until_str)
            if now < locked_until: return False, "invalid credentials"
            record["failed"] = 0; record["locked_until"] = None
        except (ValueError, TypeError):
            record["locked_until"] = None; record["failed"] = 0
    try:
        expected = record["hash"]
        actual = _hash_password(password, record["salt"], int(record.get("iterations", ITERATIONS)))
    except (KeyError, TypeError, ValueError):
        return False, "invalid credentials"
    if hmac.compare_digest(expected, actual):
        record["failed"] = 0; record["locked_until"] = None; record["last_failed_at"] = None
        _save_users(users); return True, "welcome"
    record["failed"] = int(record.get("failed", 0)) + 1
    record["last_failed_at"] = now.isoformat()
    if record["failed"] >= config.MAX_FAILED_LOGINS:
        record["locked_until"] = (now + timedelta(minutes=config.LOCKOUT_DURATION_MINUTES)).isoformat()
    _save_users(users); return False, "invalid credentials"


def unlock(username):
    users = _load_users()
    if username in users:
        users[username]["failed"] = 0; users[username]["locked_until"] = None; users[username]["last_failed_at"] = None
        _save_users(users); return True
    return False


def _load_sessions():
    return _secure_json_load(SESSIONS_FILE)


def _save_sessions(sessions):
    _secure_json_save(SESSIONS_FILE, sessions)


def _session_key(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def start_session(username):
    users = _load_users()
    user = users.get(username)
    if not user or user.get("role") not in ALLOWED_ROLES: raise ValueError("unknown user")
    sessions = _load_sessions()
    token = secrets.token_urlsafe(SESSION_TOKEN_BYTES)
    now = datetime.now(timezone.utc)
    sessions[_session_key(token)] = {"username": username, "created_at": now.isoformat(), "expires_at": (now + timedelta(minutes=config.SESSION_TTL_MINUTES)).isoformat()}
    _save_sessions(sessions)
    return token


def check_session(token):
    if not isinstance(token, str) or not token or len(token) > 512: return None
    sessions = _load_sessions()
    key = _session_key(token)
    session = sessions.get(key)
    if session is None: return None
    try:
        expires = datetime.fromisoformat(session["expires_at"])
    except (KeyError, TypeError, ValueError):
        sessions.pop(key, None); _save_sessions(sessions); return None
    if datetime.now(timezone.utc) >= expires:
        sessions.pop(key, None); _save_sessions(sessions); return None
    user = _load_users().get(session.get("username"))
    if not user or user.get("role") not in ALLOWED_ROLES:
        sessions.pop(key, None); _save_sessions(sessions); return None
    return {**session, "role": user["role"]}


def end_session(token):
    if not isinstance(token, str) or not token or len(token) > 512: return False
    sessions = _load_sessions()
    key = _session_key(token)
    if key in sessions:
        del sessions[key]; _save_sessions(sessions); return True
    return False


if __name__ == "__main__": print("Authentication module loaded successfully.")
