import { describe, expect, it, vi } from "vitest";

import { ApiClientError, type ApiClient } from "../../src/lib/api-client.js";
import {
  TokenManagerError,
  createExpiresAt,
  createTokenManager,
  mergeRefreshedSession,
  shouldRefreshCredentials,
} from "../../src/lib/token-manager.js";
import { createStoredCredentials } from "../support/helpers.js";

describe("token manager", () => {
  it("calculates refresh eligibility using the configured buffer", () => {
    const now = () => new Date("2025-01-01T00:00:00.000Z");

    expect(
      shouldRefreshCredentials(
        createStoredCredentials({
          expires_at: "2025-01-01T00:00:30.000Z",
        }),
        now,
        60_000,
      ),
    ).toBe(true);
    expect(
      shouldRefreshCredentials(
        createStoredCredentials({
          expires_at: "2025-01-01T00:05:00.000Z",
        }),
        now,
        60_000,
      ),
    ).toBe(false);
  });

  it("merges refreshed session data while preserving the stored user", () => {
    const credentials = createStoredCredentials();

    expect(
      mergeRefreshedSession(
        credentials,
        {
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          token_type: "Bearer",
          expires_in: 300,
        },
        () => new Date("2025-01-01T00:00:00.000Z"),
        "https://override.example.com",
      ),
    ).toEqual({
      ...credentials,
      base_url: "https://override.example.com",
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      expires_at: "2025-01-01T00:05:00.000Z",
    });
  });

  it("refreshes an expired session before issuing the request", async () => {
    const credentials = createStoredCredentials({
      expires_at: "2025-01-01T00:00:10.000Z",
    });
    const refreshSession = vi.fn(async () => ({
      access_token: "fresh-access-token",
      refresh_token: "fresh-refresh-token",
      token_type: "Bearer" as const,
      expires_in: 120,
    }));
    const writeCredentials = vi.fn(async (nextCredentials) => nextCredentials);
    const request = vi.fn(async () => "ok");
    const tokenManager = createTokenManager({
      apiClient: createApiClientStub({
        refreshSession,
      }),
      now: () => new Date("2025-01-01T00:00:00.000Z"),
      writeCredentials,
    });

    const result = await tokenManager.withAuthenticatedRequest(request, {
      credentials,
    });

    expect(result).toBe("ok");
    expect(refreshSession).toHaveBeenCalledWith("refresh-token");
    expect(writeCredentials).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: "fresh-access-token",
        refresh_token: "fresh-refresh-token",
      }),
      undefined,
    );
    expect(request).toHaveBeenCalledWith(
      "fresh-access-token",
      expect.objectContaining({
        access_token: "fresh-access-token",
      }),
    );
  });

  it("retries once after an unauthorized response", async () => {
    const credentials = createStoredCredentials();
    const refreshSession = vi.fn(async () => ({
      access_token: "retried-access-token",
      refresh_token: "retried-refresh-token",
      token_type: "Bearer" as const,
      expires_in: 300,
    }));
    const request = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiClientError({
          code: "HTTP_ERROR",
          message: "Unauthorized",
          method: "GET",
          path: "/api/profiles",
          statusCode: 401,
        }),
      )
      .mockResolvedValueOnce("retried");
    const tokenManager = createTokenManager({
      apiClient: createApiClientStub({
        refreshSession,
      }),
      writeCredentials: async (nextCredentials) => nextCredentials,
    });

    const result = await tokenManager.withAuthenticatedRequest(request, {
      credentials,
    });

    expect(result).toBe("retried");
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenNthCalledWith(
      2,
      "retried-access-token",
      expect.objectContaining({
        access_token: "retried-access-token",
      }),
    );
  });

  it("deletes invalid credentials when refresh returns unauthorized", async () => {
    const credentials = createStoredCredentials({
      expires_at: "2025-01-01T00:00:10.000Z",
    });
    const deleteCredentials = vi.fn(async () => true);
    const tokenManager = createTokenManager({
      apiClient: createApiClientStub({
        refreshSession: vi.fn(async () => {
          throw new ApiClientError({
            code: "HTTP_ERROR",
            message: "Unauthorized",
            method: "POST",
            path: "/api/auth/refresh",
            statusCode: 401,
          });
        }),
      }),
      now: () => new Date("2025-01-01T00:00:00.000Z"),
      deleteCredentials,
    });

    await expect(
      tokenManager.getValidCredentials(credentials),
    ).rejects.toMatchObject({
      code: "REFRESH_FAILED",
      message: "Failed to refresh session. Run insighta login.",
    } satisfies Partial<TokenManagerError>);
    expect(deleteCredentials).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid expiry durations", () => {
    expect(() => createExpiresAt(0)).toThrowError(TokenManagerError);
    expect(() => createExpiresAt(Number.NaN)).toThrow(
      "expires_in must be a positive number of seconds.",
    );
  });
});

function createApiClientStub(overrides: {
  refreshSession?: ApiClient["refreshSession"];
} = {}): ApiClient {
  return {
    getBaseUrl: () => "https://api.example.com",
    startGithubDeviceLogin: async () => {
      throw new Error("Not implemented in test");
    },
    loginWithGithubCallback: async () => {
      throw new Error("Not implemented in test");
    },
    refreshSession:
      overrides.refreshSession ??
      (async () => {
        throw new Error("refreshSession not stubbed");
      }),
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
