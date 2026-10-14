# SLC central sign-in for Stock Management (LogiTask)

Super_Admin and Admin accounts can sign in with their **SLC Account**, the one
login (with MFA) shared by every SLC app and managed from SLC Central Admin.
Store managers, team leaders and engineers keep their email + password.

## How it works

1. The login page shows **Sign in with SLC Account** when the backend reports
   SSO is configured (`GET /api/auth/sso/config`).
2. The browser signs in at Keycloak with the Authorization Code flow + PKCE as
   the public client `stock-admin` and returns to `/sso/callback`.
3. The callback sends the access token once to `POST /api/auth/sso`. The backend
   verifies it against Keycloak's keys (issuer, `aud=stock-admin`, expiry).
4. The SLC role decides which local accounts may be opened:

   | SLC role (`stock-admin` client) | May sign in to a local account with role |
   | --- | --- |
   | `super_admin` | Super_Admin or Admin |
   | `manager` | Admin |
   | `viewer` or none | none (no read-only role exists in this app yet) |

5. The person must already have an account in Stock Management, so organisations
   and roles stay managed here. On first SLC sign-in the account is linked by
   **verified** email (`User.ssoSubject`); after that the link is by Keycloak
   subject only.
6. The backend then issues this app's normal access + refresh tokens, so every
   existing route and permission check works unchanged. SSO refresh tokens last
   at most `SSO_SESSION_MAX_HOURS` (default 10, the SLC session maximum) and
   record the SLC session id (`RefreshToken.ssoSid`).

## Central sign-out

When an admin is disabled or signed out in SLC Central Admin, Keycloak calls
`POST /api/auth/sso/backchannel-logout`. The logout token is verified (signature,
issuer, audience, event, age) and the matching refresh tokens are revoked, so the
admin is out within one access-token lifetime (15 minutes). Signing out here also
ends the SLC session.

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `SSO_ISSUER_URL` | empty (off) | e.g. `https://id.slcvet.com/realms/slc` |
| `SSO_CLIENT_ID` | `stock-admin` | |
| `SSO_PROVIDER_NAME` | `SLC Account` | button label |
| `SSO_ENFORCE_FOR_ADMINS` | `false` | `true` blocks email + password for Super_Admin / Admin |
| `SSO_SESSION_MAX_HOURS` | `10` | |

In Keycloak, the `stock-admin` client needs this app's URLs as redirect URIs and
web origins, and `https://<api-host>/api/auth/sso/backchannel-logout` as its
back-channel logout URL (already set for localhost and logitask.in in the SLC
realm file).

## Rollout

1. Deploy with `SSO_ISSUER_URL` set and `SSO_ENFORCE_FOR_ADMINS=false`.
2. In SLC Central Admin → Admin access, give each admin `stock-admin: admin` (or
   `super_admin`). Each signs in once with SLC to link their account.
3. Set `SSO_ENFORCE_FOR_ADMINS=true`.

Migration `20261014120000_slc_sso` adds `User.ssoSubject` and
`RefreshToken.ssoSid`. Tests: `cd backend && npm test`.

Note: on a brand-new database the existing migration
`20260624000001_sku_org_scoped_uniqueness` fails (it drops a constraint named
`MainInventory_skuId_key`, which the init migration does not create under that
name). Existing databases are unaffected; this is unrelated to SSO.
