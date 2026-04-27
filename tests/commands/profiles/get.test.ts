import { describe, expect, it, vi } from "vitest";

import { runProfilesGetCommand } from "../../../src/commands/profiles/get.js";
import type { ApiClient } from "../../../src/lib/api-client.js";
import type { TokenManager } from "../../../src/lib/token-manager.js";
import {
  createProfile,
  createStoredCredentials,
  createStringWriter,
} from "../../support/helpers.js";

describe("profiles get command", () => {
  it("renders a single profile", async () => {
    const stdout = createStringWriter();
    const credentials = createStoredCredentials();
    const getProfile = vi.fn(async () => createProfile());

    await runProfilesGetCommand({
      id: "profile-123",
      stdout: stdout.writer,
      readStoredCredentials: async () => credentials,
      createClient: () =>
        createGetClient({
          getProfile,
        }),
      createAuthTokenManager: () =>
        createPassthroughTokenManager(credentials),
    });

    expect(getProfile).toHaveBeenCalledWith("profile-123", "access-token");
    expect(stdout.output()).toContain("Ada Lovelace");
    expect(stdout.output()).toContain("Country Name");
  });
});

function createGetClient(overrides: {
  getProfile: ApiClient["getProfile"];
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
    getProfile: overrides.getProfile,
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
