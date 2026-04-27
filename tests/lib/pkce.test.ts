import { describe, expect, it } from "vitest";

import {
  createCodeChallenge,
  createCodeVerifier,
  createOAuthState,
  createPkcePair,
} from "../../src/lib/pkce.js";

describe("pkce", () => {
  it("creates a non-empty code verifier", () => {
    const verifier = createCodeVerifier();

    expect(verifier.length).toBeGreaterThan(0);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("creates the expected SHA256 code challenge", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

    expect(createCodeChallenge(verifier)).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("creates a pkce pair whose challenge matches the verifier", () => {
    const pair = createPkcePair();

    expect(pair.codeVerifier.length).toBeGreaterThan(0);
    expect(pair.codeChallenge).toBe(
      createCodeChallenge(pair.codeVerifier),
    );
  });

  it("creates unique opaque oauth state values", () => {
    const first = createOAuthState();
    const second = createOAuthState();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
