import { describe, expect, it, vi } from "vitest";

import { runLogoutCommand } from "../../../src/commands/auth/logout.js";
import { ApiClientError, type ApiClient } from "../../../src/lib/api-client.js";
import { CredentialsStoreError } from "../../../src/lib/credentials-store.js";
import {
  createStoredCredentials,
  createStringWriter,
} from "../../support/helpers.js";

describe("logout command", () => {
  it("reports when the user is already logged out", async () => {
    const stdout = createStringWriter();

    await runLogoutCommand({
      stdout: stdout.writer,
      readStoredCredentials: async () => {
        throw new CredentialsStoreError(
          "CREDENTIALS_NOT_FOUND",
          "Not logged in. Run insighta login.",
        );
      },
    });

    expect(stdout.output()).toBe("Already logged out.\n");
  });

  it("removes invalid local credentials without calling the API", async () => {
    const stdout = createStringWriter();
    const deleteStoredCredentials = vi.fn(async () => true);

    await runLogoutCommand({
      stdout: stdout.writer,
      readStoredCredentials: async () => {
        throw new CredentialsStoreError(
          "INVALID_CREDENTIALS",
          "Stored credentials are invalid.",
        );
      },
      deleteStoredCredentials,
    });

    expect(deleteStoredCredentials).toHaveBeenCalledTimes(1);
    expect(stdout.output()).toBe("Removed invalid local credentials.\n");
  });

  it("logs out successfully when the server accepts the refresh token", async () => {
    const stdout = createStringWriter();
    const credentials = createStoredCredentials();
    const logoutSession = vi.fn(async () => ({ logged_out: true }));
    const deleteStoredCredentials = vi.fn(async () => true);

    await runLogoutCommand({
      stdout: stdout.writer,
      readStoredCredentials: async () => credentials,
      deleteStoredCredentials,
      createClient: () =>
        createLogoutClient({
          logoutSession,
        }),
    });

    expect(logoutSession).toHaveBeenCalledWith("refresh-token");
    expect(deleteStoredCredentials).toHaveBeenCalledTimes(1);
    expect(stdout.output()).toBe("Logged out of Insighta.\n");
  });

  it("still clears local credentials when the server logout request fails", async () => {
    const stdout = createStringWriter();
    const stderr = createStringWriter();
    const deleteStoredCredentials = vi.fn(async () => true);

    await runLogoutCommand({
      stdout: stdout.writer,
      stderr: stderr.writer,
      readStoredCredentials: async () => createStoredCredentials(),
      deleteStoredCredentials,
      createClient: () =>
        createLogoutClient({
          logoutSession: vi.fn(async () => {
            throw new ApiClientError({
              code: "HTTP_ERROR",
              message: "Server error",
              method: "POST",
              path: "/api/auth/logout",
              statusCode: 500,
            });
          }),
        }),
    });

    expect(deleteStoredCredentials).toHaveBeenCalledTimes(1);
    expect(stdout.output()).toBe("Local credentials removed.\n");
    expect(stderr.output()).toContain(
      "Server logout request failed: Server error (HTTP 500)",
    );
  });
});

function createLogoutClient(overrides: {
  logoutSession: ApiClient["logoutSession"];
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
    logoutSession: overrides.logoutSession,
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
