import { describe, expect, it, vi } from "vitest";

import { runProfilesListCommand } from "../../../src/commands/profiles/list.js";
import type { ApiClient } from "../../../src/lib/api-client.js";
import type { TokenManager } from "../../../src/lib/token-manager.js";
import {
  createProfilesResponse,
  createStoredCredentials,
  createStringWriter,
} from "../../support/helpers.js";

describe("profiles list command", () => {
  it("renders a profile table and pagination summary", async () => {
    const stdout = createStringWriter();
    const credentials = createStoredCredentials();
    const listProfiles = vi.fn(async () => createProfilesResponse());

    await runProfilesListCommand({
      gender: "female",
      country: "NG",
      page: 2,
      limit: 10,
      stdout: stdout.writer,
      readStoredCredentials: async () => credentials,
      createClient: () =>
        createProfilesClient({
          listProfiles,
        }),
      createAuthTokenManager: () =>
        createPassthroughTokenManager(credentials),
    });

    expect(listProfiles).toHaveBeenCalledWith(
      {
        gender: "female",
        country_id: "NG",
        age_group: undefined,
        min_age: undefined,
        max_age: undefined,
        sort_by: undefined,
        order: undefined,
        page: 2,
        limit: 10,
      },
      "access-token",
    );
    expect(stdout.output()).toContain("Ada Lovelace");
    expect(stdout.output()).toContain("Total Results");
  });
});

function createProfilesClient(overrides: {
  listProfiles: ApiClient["listProfiles"];
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
    listProfiles: overrides.listProfiles,
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
