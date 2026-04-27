import { describe, expect, it, vi } from "vitest";

import { runWhoAmICommand } from "../../../src/commands/auth/whoami.js";
import type { ApiClient } from "../../../src/lib/api-client.js";
import type { TokenManager } from "../../../src/lib/token-manager.js";
import {
  createStoredCredentials,
  createStringWriter,
  createUser,
} from "../../support/helpers.js";

describe("whoami command", () => {
  it("renders the current authenticated user", async () => {
    const stdout = createStringWriter();
    const credentials = createStoredCredentials();
    const getCurrentUser = vi.fn(async () =>
      createUser({
        username: "insighta-user",
      }),
    );

    await runWhoAmICommand({
      stdout: stdout.writer,
      readStoredCredentials: async () => credentials,
      createClient: () =>
        createWhoAmIClient({
          getCurrentUser,
        }),
      createAuthTokenManager: () =>
        createPassthroughTokenManager(credentials),
    });

    expect(getCurrentUser).toHaveBeenCalledWith("access-token");
    expect(stdout.output()).toContain("Username");
    expect(stdout.output()).toContain("insighta-user");
    expect(stdout.output()).toContain("Email");
  });
});

function createWhoAmIClient(overrides: {
  getCurrentUser: ApiClient["getCurrentUser"];
}): ApiClient {
  return {
    getBaseUrl: () => "https://api.example.com",
    startGithubDeviceLogin: async () => {
      throw new Error("Not implemented in test");
    },
    loginWithGithubCallback: async () => {
      throw new Error("Not implemented in test");
    },
    refreshSession: async () => {
      throw new Error("Not implemented in test");
    },
    logoutSession: async () => {
      throw new Error("Not implemented in test");
    },
    getCurrentUser: overrides.getCurrentUser,
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

function createPassthroughTokenManager(
  credentials = createStoredCredentials(),
): TokenManager {
  return {
    readStoredCredentials: async () => credentials,
    shouldRefresh: () => false,
    getValidCredentials: async () => credentials,
    refreshStoredSession: async () => credentials,
    withAuthenticatedRequest: async (request, requestOptions = {}) =>
      request("access-token", requestOptions.credentials ?? credentials),
  };
}
