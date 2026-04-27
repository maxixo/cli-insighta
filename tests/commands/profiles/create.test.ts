import { describe, expect, it, vi } from "vitest";

import { runProfilesCreateCommand } from "../../../src/commands/profiles/create.js";
import type { ApiClient } from "../../../src/lib/api-client.js";
import type { TokenManager } from "../../../src/lib/token-manager.js";
import {
  createProfile,
  createStoredCredentials,
  createStringWriter,
} from "../../support/helpers.js";

describe("profiles create command", () => {
  it("creates a profile and renders its details", async () => {
    const stdout = createStringWriter();
    const credentials = createStoredCredentials();
    const createProfileRequest = vi.fn(async () =>
      createProfile({
        name: "Grace Hopper",
      }),
    );

    await runProfilesCreateCommand({
      name: "Grace Hopper",
      stdout: stdout.writer,
      readStoredCredentials: async () => credentials,
      createClient: () =>
        createProfileClient({
          createProfile: createProfileRequest,
        }),
      createAuthTokenManager: () =>
        createPassthroughTokenManager(credentials),
    });

    expect(createProfileRequest).toHaveBeenCalledWith(
      "Grace Hopper",
      "access-token",
    );
    expect(stdout.output()).toContain("Grace Hopper");
    expect(stdout.output()).toContain("Created At");
  });
});

function createProfileClient(overrides: {
  createProfile: ApiClient["createProfile"];
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
    createProfile: overrides.createProfile,
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
