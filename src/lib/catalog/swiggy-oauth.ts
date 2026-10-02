import fs from "node:fs";
import path from "node:path";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

/** Local-only credential store. `.swiggy/` is gitignored and never sent to the browser. */
const STORE = path.join(process.cwd(), ".swiggy", "oauth.json");
/** Callback for the one-time CLI login. Port 3000 matches Swiggy's docs; override if that port is busy. */
export const REDIRECT_URL = `http://localhost:${process.env.SWIGGY_REDIRECT_PORT ?? 3000}/oauth/callback`;
export const IM_SERVER_URL = "https://mcp.swiggy.com/im";

type Store = { client?: OAuthClientInformationMixed; tokens?: OAuthTokens; verifier?: string; savedAt?: number };

function read(): Store {
  try {
    return JSON.parse(fs.readFileSync(STORE, "utf8")) as Store;
  } catch {
    return {};
  }
}

function write(patch: Partial<Store>) {
  fs.mkdirSync(path.dirname(STORE), { recursive: true, mode: 0o700 });
  fs.writeFileSync(STORE, JSON.stringify({ ...read(), ...patch }), { mode: 0o600 });
}

export function hasSwiggyToken(): boolean {
  return Boolean(read().tokens?.access_token);
}

/**
 * OAuth 2.1 + PKCE provider for the MCP SDK (DCR happens automatically).
 * `onRedirect` is only supplied by the CLI login script; the app server has no way to
 * send the user to Swiggy, so it throws and the UI shows the "auth required" state.
 */
export function swiggyOAuthProvider(onRedirect?: (url: URL) => void): OAuthClientProvider {
  return {
    get redirectUrl() {
      return REDIRECT_URL;
    },
    get clientMetadata(): OAuthClientMetadata {
      return {
        client_name: "Smart Basket Planner (independent prototype)",
        redirect_uris: [REDIRECT_URL],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        scope: "mcp:tools",
      };
    },
    clientInformation: () => read().client,
    saveClientInformation: (client) => write({ client }),
    tokens: () => read().tokens,
    saveTokens: (tokens) => write({ tokens, savedAt: Date.now() }),
    saveCodeVerifier: (verifier) => write({ verifier }),
    codeVerifier: () => {
      const v = read().verifier;
      if (!v) throw new Error("Missing PKCE verifier");
      return v;
    },
    redirectToAuthorization: (url) => {
      if (!onRedirect) throw new Error("AUTH_REQUIRED");
      onRedirect(url);
    },
  };
}
