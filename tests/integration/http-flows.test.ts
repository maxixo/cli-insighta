import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runProfilesExportCommand } from "../../src/commands/profiles/export.js";
import { createApiClient } from "../../src/lib/api-client.js";
import { createTokenManager } from "../../src/lib/token-manager.js";
import {
  createStoredCredentials,
  createStringWriter,
} from "../support/helpers.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("http integration flows", () => {
  it("refreshes the token after a 401 and retries the profile request", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));

        if (url.pathname === "/api/profiles" && !url.searchParams.has("format")) {
          const authorization =
            init?.headers instanceof Headers
              ? init.headers.get("authorization")
              : new Headers(init?.headers).get("authorization");

          if (authorization === "Bearer access-token") {
            return new Response(
              JSON.stringify({
                status: "error",
                message: "Unauthorized",
              }),
              {
                status: 401,
                headers: {
                  "content-type": "application/json",
                },
              },
            );
          }

          return new Response(
            JSON.stringify({
              status: "success",
              page: 1,
              limit: 20,
              total: 1,
              total_pages: 1,
              links: {
                self: "/api/profiles?page=1",
                next: null,
                prev: null,
              },
              data: [
                {
                  id: "profile-123",
                  name: "Ada Lovelace",
                  created_at: "2025-01-01T10:00:00.000Z",
                },
              ],
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        if (url.pathname === "/api/auth/refresh") {
          return new Response(
            JSON.stringify({
              status: "success",
              data: {
                access_token: "fresh-access-token",
                refresh_token: "fresh-refresh-token",
                token_type: "Bearer",
                expires_in: 300,
              },
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          );
        }

        throw new Error(`Unexpected request: ${url.pathname}`);
      },
    );
    const client = createApiClient({
      baseUrl: "https://api.example.com",
      fetchImpl: fetchImpl as typeof fetch,
    });
    const initialCredentials = createStoredCredentials();
    let storedCredentials = initialCredentials;
    const tokenManager = createTokenManager({
      apiClient: client,
      writeCredentials: async (nextCredentials) => {
        storedCredentials = nextCredentials;
        return nextCredentials;
      },
      deleteCredentials: async () => true,
    });

    const response = await tokenManager.withAuthenticatedRequest(
      (accessToken) => client.listProfiles({ gender: "female" }, accessToken),
      {
        credentials: initialCredentials,
      },
    );

    expect(response.data[0]?.name).toBe("Ada Lovelace");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const firstRequestHeaders = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers);
    const retryRequestHeaders = new Headers(fetchImpl.mock.calls[2]?.[1]?.headers);

    expect(firstRequestHeaders.get("authorization")).toBe("Bearer access-token");
    expect(retryRequestHeaders.get("authorization")).toBe(
      "Bearer fresh-access-token",
    );
    expect(storedCredentials.access_token).toBe("fresh-access-token");
    expect(storedCredentials.refresh_token).toBe("fresh-refresh-token");
  });

  it("persists the exported csv response to disk", async () => {
    const cwd = await createTempDir();
    const stdout = createStringWriter();
    const credentials = createStoredCredentials();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));

      expect(url.pathname).toBe("/api/profiles/export");
      expect(url.searchParams.get("format")).toBe("csv");
      expect(url.searchParams.get("country_id")).toBe("NG");

      return new Response("name,age\nAda,28\nGrace,35\n", {
        status: 200,
        headers: {
          "content-type": "text/csv",
        },
      });
    });

    await runProfilesExportCommand({
      format: "csv",
      country: "NG",
      cwd,
      stdout: stdout.writer,
      now: createLocalDate,
      readStoredCredentials: async () => credentials,
      createClient: () =>
        createApiClient({
          baseUrl: "https://api.example.com",
          fetchImpl: fetchImpl as typeof fetch,
        }),
      createAuthTokenManager: ({ apiClient }) =>
        createTokenManager({
          apiClient,
          readCredentials: async () => credentials,
          writeCredentials: async (nextCredentials) => nextCredentials,
          deleteCredentials: async () => true,
        }),
    });

    const filePath = path.join(cwd, "profiles-export-20250304-050607.csv");

    await expect(readFile(filePath, "utf8")).resolves.toBe(
      "name,age\nAda,28\nGrace,35\n",
    );
    expect(stdout.output()).toContain(`Saved CSV export to ${filePath}`);
    expect(stdout.output()).toContain("Rows: 2");
  });
});

async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "insighta-http-"));
  tempDirectories.push(directory);
  return directory;
}

function createLocalDate(): Date {
  return new Date(2025, 2, 4, 5, 6, 7);
}
