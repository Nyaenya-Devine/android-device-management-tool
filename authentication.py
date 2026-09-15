# authentication.py - salted hashing, login, lockout, secure sessions
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone

import config

USERS_FILE = "data/users.json"
ITERATIONS = 600_000
ALLOWED_ROLES = {"viewer", "operator", "admin", "security_analyst"}
SESSION_TOKEN_BYTES = 32


def _load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    with open(USERS_FILE, "r") as f:
        return json.load(f)


def _save_users(users):
    os.makedirs("data", exist_ok=True)
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)


def _hash_password(password, salt_hex, iterations=ITERATIONS):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), iterations).hex()


def create_user(username, password, role="viewer"):
    if role not in ALLOWED_ROLES or len(password) < config.PASSWORD_MIN_LENGTH:
        return False
    users = _load_users()
    if username in users:
        return False
    salt_hex = secrets.token_hex(16)
    users[username] = {"salt": salt_hex, "hash": _hash_password(password, salt_hex), "iterations": ITERATIONS,
                       "role": role, "failed": 0, "locked_until": None, "last_failed_at": None}
    _save_users(users)
    return True


def verify_password(username, password):
    record = _load_users().get(username)
    if not record:
        _hash_password(password, "00" * 16)
        return False
    actual = _hash_password(password, record["salt"], int(record.get("iterations", ITERATIONS)))
    return hmac.compare_digest(record["hash"], actual)


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
            if now < locked_until:
                return False, "invalid credentials"
            record["failed"] = 0
            record["locked_until"] = None
        except (ValueError, TypeError):
            record["locked_until"] = None
            record["failed"] = 0

    expected = record["hash"]
    actual = _hash_password(password, record["salt"], int(record.get("iterations", ITERATIONS)))
    if hmac.compare_digest(expected, actual):
        record["failed"] = 0
        record["locked_until"] = None
        record["last_failed_at"] = None
        _save_users(users)
        return True, "welcome"

    record["failed"] = int(record.get("failed", 0)) + 1
    record["last_failed_at"] = now.isoformat()
    if record["failed"] >= config.MAX_FAILED_LOGINS:
        record["locked_until"] = (now + timedelta(minutes=config.LOCKOUT_DURATION_MINUTES)).isoformat()
    _save_users(users)
    return False, "invalid credentials"


def unlock(username):
    users = _load_users()
    if username in users:
        users[username]["failed"] = 0
        users[username]["locked_until"] = None
        users[username]["last_failed_at"] = None
        _save_users(users)
        return True
    return False


SESSIONS_FILE = "data/sessions.json"


def _load_sessions():
    if not os.path.exists(SESSIONS_FILE):
        return {}
    with open(SESSIONS_FILE, "r") as f:
        return json.load(f)


def _save_sessions(sessions):
    os.makedirs("data", exist_ok=True)
    with open(SESSIONS_FILE, "w") as f:
        json.dump(sessions, f, indent=2)


def start_session(username):
    users = _load_users()
    if username not in users:
        raise ValueError("unknown user")
    sessions = _load_sessions()
    token = secrets.token_urlsafe(SESSION_TOKEN_BYTES)
    now = datetime.now(timezone.utc)
    sessions[token] = {"username": username, "role": users[username]["role"], "created_at": now.isoformat(),
                       "expires_at": (now + timedelta(minutes=config.SESSION_TTL_MINUTES)).isoformat()}
    _save_sessions(sessions)
    return token


def check_session(token):
    if not isinstance(token, str) or not token or len(token) > 512:
        return None
    sessions = _load_sessions()
    session = sessions.get(token)
    if session is None:
        return None
    try:
        expires = datetime.fromisoformat(session["expires_at"])
    except (KeyError, TypeError, ValueError):
        sessions.pop(token, None)
        _save_sessions(sessions)
        return None
    if datetime.now(timezone.utc) >= expires:
        sessions.pop(token, None)
        _save_sessions(sessions)
        return None
    return session


def end_session(token):
    sessions = _load_sessions()
    if token in sessions:
        del sessions[token]
        _save_sessions(sessions)
        return True
    return False


if __name__ == "__main__":
    print("Authentication module loaded successfully.")
