# tests/test_workflow.py - authentication and simulation safety regressions
import json
import os
import sys
from datetime import datetime, timezone, timedelta

PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT)

import authentication
import authorization
import device_simulator
import reset_workflow
import config


def _tokens():
    authentication.unlock("t_admin")
    authentication.unlock("t_ops")
    authentication.create_user("t_admin", "AdminPass!1", "admin")
    authentication.create_user("t_ops", "OpsPass!1", "operator")
    authentication.login("t_admin", "AdminPass!1")
    admin = authentication.start_session("t_admin")
    authentication.login("t_ops", "OpsPass!1")
    ops = authentication.start_session("t_ops")
    return admin, ops


def test_execute_without_approval_blocked():
    admin, ops = _tokens()
    ok, rid = reset_workflow.request_reset(ops, "AND-004")
    assert ok
    ok, msg = reset_workflow.execute_reset(admin, rid)
    assert not ok
    assert "not approved" in msg


def test_self_approval_blocked():
    admin, ops = _tokens()
    ok, rid = reset_workflow.request_reset(admin, "AND-005")
    assert ok
    ok, msg = reset_workflow.approve_reset(admin, rid)
    assert not ok
    assert "differ" in msg


def test_unknown_device_denied():
    admin, ops = _tokens()
    ok, msg = reset_workflow.request_reset(ops, "AND-999")
    assert not ok
    assert "fleet" in msg


def test_operator_cannot_approve():
    admin, ops = _tokens()
    ok, rid = reset_workflow.request_reset(ops, "AND-004")
    ok, msg = reset_workflow.approve_reset(ops, rid)
    assert not ok


def test_approved_reset_wipes_simulated_device():
    admin, ops = _tokens()
    ok, rid = reset_workflow.request_reset(ops, "AND-004")
    ok, msg = reset_workflow.approve_reset(admin, rid)
    assert ok
    ok, msg = reset_workflow.execute_reset(admin, rid)
    assert ok
    assert device_simulator.get_device("AND-004")["status"] == "wiped"


def test_session_expires():
    authentication.create_user("t_exp", "ExpPass!1", "viewer")
    authentication.login("t_exp", "ExpPass!1")
    token = authentication.start_session("t_exp")
    sessions = authentication._load_sessions()
    key = authentication._session_key(token)
    assert key in sessions
    sessions[key]["expires_at"] = "2020-01-01T00:00:00+00:00"
    authentication._save_sessions(sessions)
    assert authentication.check_session(token) is None


def test_wrong_password_rejected():
    authentication.create_user("t_wrong", "CorrectPass!1", "viewer")
    ok, msg = authentication.login("t_wrong", "WrongPass!1")
    assert not ok
    assert "invalid credentials" in msg


def test_account_locks_after_three_failures():
    authentication.create_user("t_lock", "CorrectPass!1", "viewer")
    for _ in range(3):
        ok, msg = authentication.login("t_lock", "WrongPass!1")
        assert not ok
    ok, msg = authentication.login("t_lock", "CorrectPass!1")
    assert not ok
    # Lockout is intentionally indistinguishable from bad credentials.
    assert msg == "invalid credentials"
    users = authentication._load_users()
    assert users["t_lock"]["failed"] >= config.MAX_FAILED_LOGINS
    assert users["t_lock"]["locked_until"] is not None


def test_lockout_auto_unlocks_after_time():
    authentication.create_user("t_lock_time", "CorrectPass!1", "viewer")
    for _ in range(3):
        authentication.login("t_lock_time", "WrongPass!1")
    ok, msg = authentication.login("t_lock_time", "CorrectPass!1")
    assert not ok
    assert msg == "invalid credentials"
    users = authentication._load_users()
    past = datetime.now(timezone.utc) - timedelta(minutes=20)
    users["t_lock_time"]["locked_until"] = past.isoformat()
    authentication._save_users(users)
    ok, msg = authentication.login("t_lock_time", "CorrectPass!1")
    assert ok
    assert msg == "welcome"


def test_password_strength_enforced():
    assert not authentication.create_user("t_weak", "short", "viewer")
    assert authentication.create_user("t_strong", "StrongPass!123", "viewer")


def test_role_whitelist():
    assert not authentication.create_user("t_badrole", "ValidPass!1", "superadmin")
    assert not authentication.create_user("t_badrole2", "ValidPass!1", "admin'; DROP TABLE")
    assert authentication.create_user("t_goodrole", "ValidPass!1", "admin")


def test_successful_login_resets_failed_counter():
    authentication.create_user("t_reset", "CorrectPass!1", "viewer")
    authentication.login("t_reset", "WrongPass!1")
    ok, msg = authentication.login("t_reset", "CorrectPass!1")
    assert ok and msg == "welcome"


def test_invalid_session_rejected():
    assert authentication.check_session("definitely-invalid-token") is None


def test_logout_invalidates_session():
    authentication.create_user("t_logout", "LogoutPass!1", "viewer")
    authentication.login("t_logout", "LogoutPass!1")
    token = authentication.start_session("t_logout")
    assert authentication.check_session(token) is not None
    authentication.end_session(token)
    assert authentication.check_session(token) is None


def test_unknown_role_denied():
    assert authorization.can("unknown_role", "view_dashboard") is False


def test_viewer_cannot_request_reset():
    assert authorization.can("viewer", "request_reset") is False


def test_operator_cannot_approve_reset():
    assert authorization.can("operator", "approve_reset") is False


def test_admin_can_approve_reset():
    assert authorization.can("admin", "approve_reset") is True


def test_unknown_user_generic_message():
    ok, msg = authentication.login("nonexistent_user_12345", "whatever")
    assert not ok and "invalid credentials" in msg
    assert "unknown user" not in msg


def test_execute_logs_correct_actor():
    admin, ops = _tokens()
    ok, rid = reset_workflow.request_reset(ops, "AND-004")
    assert ok
    ok, _ = reset_workflow.approve_reset(admin, rid)
    assert ok
    authentication.create_user("t_admin2", "Admin2Pass!1", "admin")
    authentication.login("t_admin2", "Admin2Pass!1")
    admin2_token = authentication.start_session("t_admin2")
    ok, _ = reset_workflow.execute_reset(admin2_token, rid)
    assert ok
    import security_logger
    ok_chain, _ = security_logger.verify_logs()
    assert ok_chain
    with open(config.LOG_FILE, "r", encoding="utf-8") as f:
        lines = f.read().splitlines()
    last = json.loads(lines[-1])
    assert last["actor"] == "t_admin2"
    assert last["event_type"] == "RESET_EXECUTED"


def test_audit_log_tampering_detected():
    import security_logger
    security_logger.log_event("TEST_INTEGRITY", "tester", "original")
    with open(config.LOG_FILE, "r", encoding="utf-8") as f:
        lines = f.read().splitlines()
    entry = json.loads(lines[-1])
    entry["outcome"] = "tampered"
    lines[-1] = json.dumps(entry)
    with open(config.LOG_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    ok, bad_line = security_logger.verify_logs()
    assert ok is False
    assert bad_line == len(lines)
