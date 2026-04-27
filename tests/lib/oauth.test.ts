import { describe, expect, it } from "vitest";

import {
  assertOAuthState,
  buildGithubAuthorizationUrl,
  createLoopbackRedirectUri,
  readOAuthCallbackParams,
} from "../../src/lib/oauth.js";

describe("oauth helpers", () => {
  it("creates a normalized loopback redirect uri", () => {
    expect(createLoopbackRedirectUri(43123, "callback")).toBe(
      "http://127.0.0.1:43123/callback",
    );
  });

  it("builds the github authorization url with pkce params", () => {
    const url = new URL(
      buildGithubAuthorizationUrl({
        clientId: "client-id",
        redirectUri: "http://127.0.0.1:43123/callback",
        state: "state-123",
        scope: "read:user user:email",
        codeChallenge: "challenge-123",
        allowSignup: false,
      }),
    );

    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:43123/callback",
    );
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("scope")).toBe("read:user user:email");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-123");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("allow_signup")).toBe("false");
  });

  it("reads oauth callback params from a callback url", () => {
    const callback = readOAuthCallbackParams(
      "http://127.0.0.1:43123/callback?code=abc123&state=state-1",
    );

    expect(callback).toEqual({
      code: "abc123",
      state: "state-1",
      error: undefined,
      errorDescription: undefined,
    });
  });

  it("throws when the oauth state does not match", () => {
    expect(() => assertOAuthState("expected", "actual")).toThrow(
      "OAuth state mismatch.",
    );
  });
});
