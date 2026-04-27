import { describe, expect, it, vi } from "vitest";

import { runProfilesExportCommand } from "../../../src/commands/profiles/export.js";
import type { ApiClient } from "../../../src/lib/api-client.js";
import type { TokenManager } from "../../../src/lib/token-manager.js";
import {
  createStoredCredentials,
  createStringWriter,
} from "../../support/helpers.js";

describe("profiles export command", () => {
  it("exports csv data and reports the saved file details", async () => {
    const stdout = createStringWriter();
    const credentials = createStoredCredentials();
    const exportProfilesCsv = vi.fn(async () => "name,age\nAda,28\n");
    const saveCsv = vi.fn(async () => ({
      filename: "profiles-export-20250304-050607.csv",
      filePath: "C:\\exports\\profiles-export-20250304-050607.csv",
      rowCount: 1,
    }));

    await runProfilesExportCommand({
      format: "csv",
      country: "NG",
      stdout: stdout.writer,
      readStoredCredentials: async () => credentials,
      createClient: () =>
        createExportClient({
          exportProfilesCsv,
        }),
      createAuthTokenManager: () =>
        createPassthroughTokenManager(credentials),
      saveCsv,
    });

    expect(exportProfilesCsv).toHaveBeenCalledWith(
      {
        gender: undefined,
        country_id: "NG",
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
    expect(saveCsv).toHaveBeenCalledWith({
      csv: "name,age\nAda,28\n",
      cwd: undefined,
      now: undefined,
    });
    expect(stdout.output()).toContain(
      "Saved CSV export to C:\\exports\\profiles-export-20250304-050607.csv",
    );
    expect(stdout.output()).toContain("Rows: 1");
  });
});

function createExportClient(overrides: {
  exportProfilesCsv: ApiClient["exportProfilesCsv"];
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
    createProfile: async () => {
      throw new Error("Not implemented in test");
    },
    exportProfilesCsv: overrides.exportProfilesCsv,
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
