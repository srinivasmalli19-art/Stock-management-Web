/**
 * "Sign in with SLC Account": browser side of the central Keycloak sign-in.
 *
 * Uses the Authorization Code flow with PKCE as the public `stock-admin`
 * client. After Keycloak redirects back to /sso/callback, the access token is
 * sent once to the backend (POST /api/auth/sso), which verifies it and returns
 * this app's normal session. The Keycloak tokens are not kept afterwards; only
 * the ID token is held in sessionStorage so sign-out can end the SLC session.
 */
import { UserManager, WebStorageStateStore } from "oidc-client-ts";
import api from "../services/api";

const ID_TOKEN_KEY = "slcIdToken";
let managerPromise = null;

/** SSO settings from the backend, or null when SLC sign-in is off. */
export async function getSsoConfig() {
  try {
    const res = await api.get("/auth/sso/config");
    return res.data.data.enabled ? res.data.data : null;
  } catch {
    return null;
  }
}

async function getManager() {
  if (!managerPromise) {
    managerPromise = getSsoConfig().then((cfg) => {
      if (!cfg) throw new Error("SLC sign-in is not configured");
      return new UserManager({
        authority: cfg.issuer,
        client_id: cfg.clientId,
        redirect_uri: `${window.location.origin}/sso/callback`,
        post_logout_redirect_uri: `${window.location.origin}/login`,
        response_type: "code",
        scope: "openid email profile",
        userStore: new WebStorageStateStore({ store: window.sessionStorage }),
        loadUserInfo: false,
        automaticSilentRenew: false,
      });
    });
    managerPromise.catch(() => {
      managerPromise = null;
    });
  }
  return managerPromise;
}

export async function startSlcSignIn() {
  const manager = await getManager();
  await manager.signinRedirect();
}

/** Finish the redirect and exchange the Keycloak token for this app's session. */
export async function completeSlcSignIn() {
  const manager = await getManager();
  const oidcUser = await manager.signinRedirectCallback();
  const res = await api.post("/auth/sso", { accessToken: oidcUser.access_token });
  sessionStorage.setItem(ID_TOKEN_KEY, oidcUser.id_token || "");
  await manager.removeUser();
  return res.data.data;
}

/** After the app's own logout: also end the SLC session when there is one. */
export async function endSlcSessionIfAny() {
  const idToken = sessionStorage.getItem(ID_TOKEN_KEY);
  if (!idToken) return false;
  sessionStorage.removeItem(ID_TOKEN_KEY);
  try {
    const manager = await getManager();
    await manager.signoutRedirect({ id_token_hint: idToken });
    return true;
  } catch {
    return false;
  }
}
