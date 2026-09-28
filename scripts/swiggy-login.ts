/**
 * One-time Swiggy login for live mode: DCR + OAuth 2.1 PKCE via the MCP SDK.
 * Opens the browser for phone + OTP, catches the redirect on localhost:3000, stores the token in .swiggy/ (gitignored).
 * Stop `npm run dev` first — this script needs port 3000.
 */
import http from "node:http";
import { execFile } from "node:child_process";
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { IM_SERVER_URL, REDIRECT_URL, swiggyOAuthProvider } from "../src/lib/catalog/swiggy-oauth";

const provider = swiggyOAuthProvider((url) => {
  console.log("Opening Swiggy login in your browser…");
  execFile("open", [url.toString()]);
});

function waitForCode(): Promise<string> {
  const { port, pathname } = new URL(REDIRECT_URL);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url ?? "/", REDIRECT_URL);
      if (u.pathname !== pathname) return void res.writeHead(404).end();
      const code = u.searchParams.get("code");
      res.writeHead(200, { "Content-Type": "text/html" }).end(
        code ? "<h2>Swiggy connected. You can close this tab.</h2>" : "<h2>Login failed. Check the terminal.</h2>",
      );
      server.close();
      if (code) resolve(code);
      else reject(new Error(u.searchParams.get("error") ?? "No code returned"));
    });
    server.listen(Number(port));
    setTimeout(() => (server.close(), reject(new Error("Timed out waiting for login"))), 5 * 60_000);
  });
}

async function main() {
  const first = await auth(provider, { serverUrl: IM_SERVER_URL, scope: "mcp:tools" });
  if (first === "AUTHORIZED") return console.log("Already connected ✔");
  const code = await waitForCode();
  const result = await auth(provider, { serverUrl: IM_SERVER_URL, authorizationCode: code, scope: "mcp:tools" });
  console.log(result === "AUTHORIZED" ? "Swiggy connected ✔ Set CATALOG_MODE=live in .env.local" : `Unexpected: ${result}`);
}

main().catch((e) => {
  console.error("Login failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
