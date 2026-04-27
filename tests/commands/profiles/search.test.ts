import { describe, expect, it, vi } from "vitest";

import { runProfilesSearchCommand } from "../../../src/commands/profiles/search.js";
import type { ApiClient } from "../../../src/lib/api-client.js";
import type { TokenManager } from "../../../src/lib/token-manager.js";
import {
  createProfilesResponse,
  createStoredCredentials,
  createStringWriter,
} from "../../support/helpers.js";

describe("profiles search command", () => {
  it("passes the query and renders search results", async () => {
    const stdout = createStringWriter();
    const credentials = createStoredCredentials();
    const searchProfiles = vi.fn(async () => createProfilesResponse());

    await runProfilesSearchCommand({
      query: "Ada",
      gender: "female",
      stdout: stdout.writer,
      readStoredCredentials: async () => credentials,
      createClient: () =>
        createSearchClient({
          searchProfiles,
        }),
      createAuthTokenManager: () =>
        createPassthroughTokenManager(credentials),
    });

    expect(searchProfiles).toHaveBeenCalledWith(
      "Ada",
      {
        gender: "female",
        country_id: undefined,
        age_group: undefined,
        min_age: undefined,
        max_age: undefined,
        sort_by: undefined,
        order: undefined,
        page: undefined,
        limit: undefined,
      },
      "access-token",
    );
    expect(stdout.output()).toContain("Ada Lovelace");
    expect(stdout.output()).toContain("Results on Page");
  });
});

function createSearchClient(overrides: {
  searchProfiles: ApiClient["searchProfiles"];
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
    searchProfiles: overrides.searchProfiles,
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
