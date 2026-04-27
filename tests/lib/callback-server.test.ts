import { describe, expect, it } from "vitest";

import {
  CallbackServerError,
  startCallbackServer,
} from "../../src/lib/callback-server.js";

describe("callback server", () => {
  it("captures a successful oauth callback and shuts down", async () => {
    const server = await startCallbackServer({
      timeoutMs: 2_000,
    });

    const callbackPromise = server.waitForCallback();
    const response = await fetch(
      `${server.redirectUri}?code=auth-code-123&state=state-123`,
    );
    const body = await response.text();
    const callback = await callbackPromise;

    expect(response.status).toBe(200);
    expect(body).toContain("Login complete");
    expect(callback.code).toBe("auth-code-123");
    expect(callback.state).toBe("state-123");
    expect(callback.url).toContain("code=auth-code-123");
  });

  it("rejects when the provider redirects back with an oauth error", async () => {
    const server = await startCallbackServer({
      timeoutMs: 2_000,
    });

    const callbackPromise = server.waitForCallback();
    const callbackExpectation = expect(callbackPromise).rejects.toMatchObject({
      code: "CALLBACK_ERROR",
      message: "access_denied: User cancelled",
    } satisfies Partial<CallbackServerError>);
    const response = await fetch(
      `${server.redirectUri}?error=access_denied&error_description=User%20cancelled`,
    );
    const body = await response.text();

    await callbackExpectation;
    expect(response.status).toBe(400);
    expect(body).toContain("Login failed");
  });

  it("times out when no callback is received", async () => {
    const server = await startCallbackServer({
      timeoutMs: 50,
    });

    await expect(server.waitForCallback()).rejects.toMatchObject({
      code: "TIMEOUT",
      message: "Timed out waiting for OAuth callback.",
    } satisfies Partial<CallbackServerError>);
  });
});
