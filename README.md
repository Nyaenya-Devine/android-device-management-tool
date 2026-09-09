# 📱 Android Device Management Tool

> **What it is:** an evolving, dual-mode Android Enterprise management console —
> a **local simulator** for development and demos, plus a **live integration**
> with Google's Android Management API (AM API) for real managed devices.
> Its lineage is the [Android Reset Lab](https://android-reset-lab.vercel.app) ([source](https://github.com/Nyaenya-Devine/android-reset-lab))
> (a Python simulation of a reset system with RBAC, four-eyes dual-control and
> tamper-evident audit) — this repo carries that safety-first thinking into a
> realistic web application.

> **Status — read honestly:** this is an **experimental / work-in-progress**
> learning project. The simulator mode works end-to-end with local data; the
> live AM API path is implemented (service-account auth, policies, enrollment
> QR, commands) but has **not yet been exercised against a real enrolled
> device**. See [`LIVE_MODE_GUIDE.md`](LIVE_MODE_GUIDE.md) for exactly what it
> takes to go live. Nothing in this repo has wiped a real phone, and nothing
> here should be pointed at production fleets yet.

---

## The two layers

| Layer | What it is | Status |
|---|---|---|
| **Simulator** | SQLite-free local store via PostgreSQL (dev database), synthetic devices/policies/commands — like the Reset Lab, but as a web app | Works |
| **Live AM API** | Real Google integration: OAuth2 service-account JWT, `enterprises.policies`, `enrollmentTokens`, CloudDPC **QR provisioning bundle**, `devices.issueCommand` (LOCK / WIPE / REBOOT / RELINQUISH_OWNERSHIP / CLEAR_APP_DATA / lost mode / RESET_PASSWORD), `enterprises.devices.delete` (deprovision + factory reset) | Implemented, **needs a real Google enterprise + device to prove** |

**Design goal:** whichever layer runs, the same console, API routes and audit
log record every action — so a wipe that would be simulated locally becomes a
real command the moment the enterprise is switched to live mode.

## Honest semantics note (WIPE)

A remote wipe is **not** instant and it is **not** "delete". Per Google's AM
API:

- `issueCommand` with `WIPE` factory-resets a company-owned device (or removes
  the work profile on BYOD). The wipe only happens **once the device
  acknowledges** the command and it can be cancelled before that.
- `enterprises.devices.delete` **deprovisions and factory-resets** the device.
- After a wipe, the device returns to factory state and must be re-enrolled
  (keep your enrollment token / QR handy).

The console reflects this: issuing WIPE moves the device to `WIPE_PENDING` —
it is never marked deleted at issue time.

## Repo map

```
src/
  app/api/...            REST routes: devices, policies, enrollment-tokens,
                         commands, enterprise, logs, test-suite, webhooks/pubsub
  components/            Fleet dashboard, policy center, enrollment hub,
                         command console, audit log viewer, device modals
  lib/amapi/             AM API service: QR bundles, OAuth2 JWT, API calls
  lib/crypto.ts          AES-256-CBC at-rest encryption + RSA-signed JWT
  lib/types/amapi.ts     AM API types (policy, command, enrollment token)
  db/                    Drizzle schema + PostgreSQL pool
*.py (repo root)         Reset Lab lineage scripts kept for reference/tests
tests/                   Python tests for the simulation lineage
```

## Quick start (simulator mode)

```bash
# 1. PostgreSQL must be reachable; put the URL in .env (see .env.example)
cp .env.example .env   # set DATABASE_URL (+ CREDENTIALS_SECRET in real use)
npm ci
npm run dev            # http://localhost:3000
```

The app seeds a demo enterprise + devices on first run. Use the UI in
**simulator** mode to explore policies, enrollment QR codes, and commands.

## Going live (real devices)

Read **[`LIVE_MODE_GUIDE.md`](LIVE_MODE_GUIDE.md)** — it walks through the
Google Cloud project, service account, EMM sign-up, enterprise creation,
device quota, QR enrollment on a physical device, and the live wipe proof.
You will need a physical Android device you can factory-reset (Android 8+
recommended) and a Gmail account not tied to another enterprise.

## Security posture & known gaps

- Service-account private keys are encrypted at rest (AES-256-CBC,
  `CREDENTIALS_SECRET`). **Do not run with the hardcoded dev fallback** outside
  local development.
- Every command and device change is written to an audit-log table.
- **Known gaps (WIP):** no user authentication/RBAC on the web layer yet (the
  Reset Lab's four-eyes + default-deny rules are not ported); Pub/Sub webhook
  is scaffolded but not wired to a real Google Cloud subscription; no
  rate-limiting; simulator and live rows share one store by design.
- CI: Python simulation tests + typecheck/lint/build for the web app.

## License

MIT (see LICENSE). The Android Management API integration is subject to
[Google's permissible-usage policy](https://developers.google.com/android/management/permissible-usage).
