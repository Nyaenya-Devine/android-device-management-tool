# 📡 LIVE_MODE_GUIDE — taking the console to real Android devices

This guide turns the console's **live mode** on: real Google Cloud project,
real Android Management API (AM API) calls, and a real enrolled Android phone
you can remote-wipe.

> ⚠️ **Honest prerequisites before you start**
> - A **physical Android device** you are willing to factory-reset (Android 8.0+
>   recommended; REBOOT command needs Android 7.0+ fully-managed). An emulator
>   **cannot** be provisioned this way.
> - A **Gmail account not already bound to an enterprise** (or a BTE
>   Google Workspace flow if your EMM sign-up is enabled for it).
> - A **Google Cloud project** you own.
> - Time for one factory-reset loop per test. After a wipe the device comes
>   back to factory state and must be **re-enrolled with a fresh QR**.

Reference (always read the current version — Google changes flows):
- [Quickstart](https://developers.google.com/android/management/quickstart)
- [Create an enterprise binding](https://developers.google.com/android/management/create-enterprise)
- [Command reference (issueCommand)](https://developers.google.com/android/management/reference/rest/v1/enterprises.devices/issueCommand)
- [Permissible usage & quota](https://developers.google.com/android/management/permissible-usage)

---

## Phase 0 — Google Cloud project

1. Create a project at <https://console.cloud.google.com/project>. Note the
   **project ID** (not the display name).
2. Enable the **Android Management API** (API Library → Android Management API
   → Enable).
3. **Request the initial device quota** — see the
   [permissible-usage page](https://developers.google.com/android/management/permissible-usage#quotas_and_restrictions).
   The quickstart links the request form; quota is typically granted quickly
   for development use.
4. IAM & Admin → Service Accounts → create a service account (e.g.
   `amapi-console`). Note its **email**. Add the role **Android Management API
   User** (or grant at project level) and **create a JSON key** — download it,
   keep it secret, and delete from disk after importing (see Phase 3 — the app
   encrypts it at rest).
5. (Optional, later) Pub/Sub for state-change notifications — out of scope for
   the first live proof.

## Phase 1 — Create the enterprise binding

The console's Enterprise Settings page wraps this flow, or call the REST API
directly as the service account:

1. **Get a sign-up URL**
   `POST signupUrls.create?projectId=YOUR_PROJECT_ID` with a
   `callbackUrl` (https). Response: `{ "name", "url" }`.
2. **Sign up**: open `url` in an incognito window with the chosen Gmail
   account. Complete the organization registration; the flow redirects to your
   `callbackUrl` with `?enterpriseToken=…` appended. **Save that token** — it
   is single-purpose.
3. **Bind the enterprise**:
   `POST /v1/enterprises?projectId=YOUR_PROJECT_ID&signupUrlName=NAME&enterpriseToken=TOKEN`
   with an `Enterprise` body (`enterpriseDisplayName`, `primaryColor` etc.).
   Response: `enterprises/LC0…` — the enterprise ID.

> In the console UI (Enterprise Settings), this is where you paste the
> enterprise ID + service-account details and flip the mode to `LIVE_AMAPI`.
> The simulator keeps working while you set things up — nothing is sent to
> Google until the enterprise is configured AND you issue a real action.

## Phase 2 — Policy + enrollment token

1. Create a **policy** (Policy Center) with the settings you want. The default
   policy is a reasonable starting point (password requirements, status
   reporting, clouddpc + docs + Gmail + Authenticator). For a wipe-lab you may
   want `maximumFailedPasswordsForWipe` and system-update settings explicit.
2. Create an **enrollment token** bound to that policy with a reasonable
   expiration (e.g. 1 day). Use the console's **QR generator** — it builds the
   official CloudDPC provisioning bundle (component name, signature checksum,
   download location, token) and renders a scannable QR. Optionally embed
   Wi-Fi credentials in the bundle so the device can join the network during
   provisioning.
3. (Real AM API enrollment tokens are created via
   `enterprises.enrollmentTokens.create`; the console only synthesizes the QR
   wrapper — the token itself must come from Google in live mode.)

## Phase 3 — Import credentials into the console

1. In **Enterprise Settings** set mode = **LIVE_AMAPI**.
2. Paste the service-account **email** and **private key** (from the JSON key
   file). The app encrypts the key at rest with AES-256-CBC using
   `CREDENTIALS_SECRET` — set that env var to a real random value before going
   live (see `.env.example`).
3. Save. The dashboard now shows a live-mode enterprise; simulator devices
   remain listed but commands target real devices via
   `androidmanagement.googleapis.com`.

## Phase 4 — Provision the real device

1. Factory-reset the test device (Settings → System → Reset → Factory reset —
   or via recovery if already stuck).
2. During initial setup choose the **QR-code provisioning** option (steps vary
   by OEM/Android version; follow the setup wizard's corporate/QR path —
   Android Enterprise's "enroll devices with a QR code" doc describes the
   per-device steps).
3. Scan the console's QR with the device camera. The device downloads the
   CloudDPC (Android Device Policy) app and enrolls into your enterprise.
4. In the console, the device appears with its real `name`
   (`enterprises/LC0…/devices/…`), model, serial, state `ACTIVE`.

## Phase 5 — The live wipe proof

1. (Optional but recommended first) issue **LOCK**, then **REBOOT** — observe
   the phone respond within seconds (REBOOT requires fully managed, Android
   7.0+).
2. From the device row run **WIPE** (or from the API:
   `POST …/enterprises/LC0…/devices/DEVICE_ID:issueCommand` body
   `{ "type": "WIPE" }`).
3. **Expected behavior per the API:** the command is created; the device
   acknowledges it (you can cancel before acknowledgement); then the phone
   factory-resets. The console marks the device `WIPE_PENDING` — not deleted.
4. After the reset the device is at factory state. **Re-enroll** with a fresh
   QR if you want to keep testing.

## Phase 6 — Cleanup (do this when done)

1. **Deprovision + factory-reset any remaining enrolled device**: call
   `DELETE enterprises/LC0…/devices/DEVICE_ID` — this is the deprovision path
   (the console's device DELETE does this in live mode).
2. **Delete the enterprise / unbind your Gmail**: visit
   <https://play.google.com/work> with the account that created the
   enterprise → **Admin Settings** → Organization information → **⋮ → Delete
   Organization**. (A Gmail account can only be bound to one enterprise, so
   this matters for future tests.)
3. Optionally delete the Cloud project and revoke/delete the service account
   key.

---

## Known limitations (be honest about these)

- The web layer has **no authentication/RBAC yet** — anyone who can reach the
  console could issue commands. Run it on localhost or behind your own auth
  until that lands; never expose it publicly in this state.
- No Pub/Sub wiring yet: command acknowledgement is not pushed back into the
  UI automatically; poll the device row / API.
- `RESET_PASSWORD`, lost mode and eSIM commands exist but were not exercised
  in this repo — test them on your own device before claiming support.
- Device quota, API usage and acceptable use are governed by
  [Google's permissible-usage policy](https://developers.google.com/android/management/permissible-usage);
  don't point this at other people's devices.

## Suggested next milestones (roadmap)

1. Auth + RBAC on the web layer, then port the Reset Lab's **four-eyes
   dual-control** and **default-deny** rules to WIPE (this is the flagship
   differentiator: "a wipe requires two approved humans").
2. Hash-chained + HMAC audit log on the web layer (currently plain audit rows).
3. Pub/Sub subscription for real-time command/state events.
4. Threat-model + attack the live-mode console in a controlled session
   (documented, authorized, on your own enterprise).
5. Then — and only then — update the portfolio to claim live device
   management.
