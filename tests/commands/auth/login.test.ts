import { describe, expect, it, vi } from "vitest";

import { runLoginCommand } from "../../../src/commands/auth/login.js";
import type { ApiClient } from "../../../src/lib/api-client.js";
import { CredentialsStoreError } from "../../../src/lib/credentials-store.js";
import {
  createStringWriter,
  createUser,
} from "../../support/helpers.js";

describe("login command", () => {
  it("completes the oauth flow and persists the session", async () => {
    const stdout = createStringWriter();
    const stderr = createStringWriter();
    let expectedState = "";
    const close = vi.fn(async () => undefined);
    const openBrowser = vi.fn(async () => undefined);
    const writeStoredCredentials = vi.fn(async (credentials) => credentials);
    const client = createLoginClient({
      startGithubDeviceLogin: vi.fn(async (input) => {
        expectedState = input.state;
        return {
          authorization_url: "https://github.com/login",
          state: input.state,
          redirect_uri: input.redirect_uri,
        };
      }),
      loginWithGithubCallback: vi.fn(async () => ({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        token_type: "Bearer",
        expires_in: 300,
        user: createUser(),
      })),
    });

    await runLoginCommand({
      baseUrl: "https://cli.example.com",
      stdout: stdout.writer,
      stderr: stderr.writer,
      openBrowser,
      createClient: () => client,
      readStoredCredentials: async () => {
        throw new CredentialsStoreError(
          "CREDENTIALS_NOT_FOUND",
          "Not logged in. Run insighta login.",
        );
      },
      writeStoredCredentials,
      startServer: async () => ({
        redirectUri: "http://127.0.0.1:43123/callback",
        waitForCallback: async () => ({
          code: "callback-code",
          state: expectedState,
          url: `http://127.0.0.1:43123/callback?code=callback-code&state=${expectedState}`,
        }),
        close,
      }),
    });

    expect(openBrowser).toHaveBeenCalledWith("https://github.com/login");
    expect(writeStoredCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        base_url: "https://cli.example.com",
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
      }),
    );
    expect(stdout.output()).toContain(
      "Complete authentication in your browser to continue.",
    );
    expect(stdout.output()).toContain("Signed in as Example User");
    expect(stderr.output()).toBe("");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("prints the authorization url when automatic browser launch fails", async () => {
    const stdout = createStringWriter();
    const stderr = createStringWriter();
    let expectedState = "";

    await runLoginCommand({
      stdout: stdout.writer,
      stderr: stderr.writer,
      openBrowser: vi.fn(async () => {
        throw new Error("launch failed");
      }),
      createClient: () =>
        createLoginClient({
          startGithubDeviceLogin: vi.fn(async (input) => {
            expectedState = input.state;
            return {
              authorization_url: "https://github.com/manual",
              state: input.state,
              redirect_uri: input.redirect_uri,
            };
          }),
          loginWithGithubCallback: vi.fn(async () => ({
            access_token: "access-token",
            refresh_token: "refresh-token",
            token_type: "Bearer",
            expires_in: 300,
            user: createUser({
              username: "manual-user",
            }),
          })),
        }),
      readStoredCredentials: async () => {
        throw new CredentialsStoreError(
          "CREDENTIALS_NOT_FOUND",
          "Not logged in. Run insighta login.",
        );
      },
      writeStoredCredentials: async (credentials) => credentials,
      startServer: async () => ({
        redirectUri: "http://127.0.0.1:43123/callback",
        waitForCallback: async () => ({
          code: "callback-code",
          state: expectedState,
          url: `http://127.0.0.1:43123/callback?code=callback-code&state=${expectedState}`,
        }),
        close: async () => undefined,
      }),
    });

    expect(stderr.output()).toContain(
      "Failed to open the browser automatically. Open this URL manually:",
    );
    expect(stderr.output()).toContain("https://github.com/manual");
    expect(stderr.output()).toContain("launch failed");
    expect(stdout.output()).toContain("Signed in as Example User");
  });
});

function createLoginClient(overrides: {
  startGithubDeviceLogin: ApiClient["startGithubDeviceLogin"];
  loginWithGithubCallback: ApiClient["loginWithGithubCallback"];
}): ApiClient {
  return {
    getBaseUrl: () => "https://api.example.com",
    startGithubDeviceLogin: overrides.startGithubDeviceLogin,
    loginWithGithubCallback: overrides.loginWithGithubCallback,
    refreshSession: async () => {
      throw new Error("Not implemented in test");
    },
    logoutSession: async () => {
      throw new Error("Not implemented in test");
    },
    getCurrentUser: async () => {
      throw new Error("Not implemented in test");
    },
    listProfiles: async () => {
      throw new Error("Not implemented in test");
    },
    getProfile: async () => {
      throw new Error("Not implemented in test");
    },
    searchProfiles: async () => {
      throw new Error("Not implemented in test");
    },
    createProfile: async () => {
      throw new Error("Not implemented in test");
    },
    exportProfilesCsv: async () => {
      throw new Error("Not implemented in test");
    },
  };
}
