# approve_helper.py - the second human approves from the terminal
import re
import sys
import getpass

import authentication
import reset_workflow

if len(sys.argv) != 2:
    print("Usage: python approve_helper.py <request_id>")
    sys.exit(1)

request_id = sys.argv[1].strip()
if not re.fullmatch(r"[0-9a-fA-F]{16,64}", request_id):
    print("Invalid request_id")
    sys.exit(1)

user = input("approver user: ").strip()
password = getpass.getpass("approver pass: ")

ok, msg = authentication.login(user, password)
if not ok:
    print("login failed:", msg)
    sys.exit(1)

token = authentication.start_session(user)
result = reset_workflow.approve_reset(token, request_id)
print(result)
