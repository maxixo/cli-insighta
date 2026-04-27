import { ACCESS_TOKEN_REFRESH_BUFFER_MS } from "./constants.js";
import {
  deleteCredentials as deleteStoredCredentials,
  readCredentials as readStoredCredentials,
  writeCredentials as writeStoredCredentials,
  type CredentialsStoreOptions,
} from "./credentials-store.js";
import { ApiClientError, type ApiClient } from "./api-client.js";
import type { RefreshedSession } from "../types/api.js";
import type { StoredCredentials } from "../types/credentials.js";

type ReadCredentials = (
  options?: CredentialsStoreOptions,
) => Promise<StoredCredentials>;
type WriteCredentials = (
  credentials: StoredCredentials,
  options?: CredentialsStoreOptions,
) => Promise<StoredCredentials>;
type DeleteCredentials = (
  options?: CredentialsStoreOptions,
) => Promise<boolean>;

type TokenManagerOptions = {
  apiClient: ApiClient;
  credentialsStoreOptions?: CredentialsStoreOptions;
  refreshBufferMs?: number;
  now?: () => Date;
  readCredentials?: ReadCredentials;
  writeCredentials?: WriteCredentials;
  deleteCredentials?: DeleteCredentials;
};

type AuthenticatedRequestOptions = {
  credentials?: StoredCredentials;
};

type TokenManagerErrorCode =
  | "INVALID_EXPIRY"
  | "REFRESH_FAILED";

export class TokenManagerError extends Error {
  readonly code: TokenManagerErrorCode;

  constructor(code: TokenManagerErrorCode, message: string, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = "TokenManagerError";
    this.code = code;
  }
}

export function createTokenManager(options: TokenManagerOptions) {
  const refreshBufferMs =
    options.refreshBufferMs ?? ACCESS_TOKEN_REFRESH_BUFFER_MS;
  const now = options.now ?? (() => new Date());
  const readCredentials = options.readCredentials ?? readStoredCredentials;
  const writeCredentials = options.writeCredentials ?? writeStoredCredentials;
  const deleteCredentials = options.deleteCredentials ?? deleteStoredCredentials;

  return {
    async readStoredCredentials(): Promise<StoredCredentials> {
      return readCredentials(options.credentialsStoreOptions);
    },

    shouldRefresh(credentials: StoredCredentials): boolean {
      return shouldRefreshCredentials(credentials, now, refreshBufferMs);
    },

    async getValidCredentials(
      initialCredentials?: StoredCredentials,
    ): Promise<StoredCredentials> {
      const credentials =
        initialCredentials ??
        (await readCredentials(options.credentialsStoreOptions));

      if (!shouldRefreshCredentials(credentials, now, refreshBufferMs)) {
        return credentials;
      }

      return refreshStoredSession(credentials);
    },

    async refreshStoredSession(
      initialCredentials?: StoredCredentials,
    ): Promise<StoredCredentials> {
      const credentials =
        initialCredentials ??
        (await readCredentials(options.credentialsStoreOptions));

      return refreshStoredSession(credentials);
    },

    async withAuthenticatedRequest<T>(
      request: (
        accessToken: string,
        credentials: StoredCredentials,
      ) => Promise<T>,
      requestOptions: AuthenticatedRequestOptions = {},
    ): Promise<T> {
      let credentials = await this.getValidCredentials(
        requestOptions.credentials,
      );

      try {
        return await request(credentials.access_token, credentials);
      } catch (error) {
        if (!isUnauthorizedApiError(error)) {
          throw error;
        }

        credentials = await refreshAfterUnauthorized(credentials, error);

        return request(credentials.access_token, credentials);
      }
    },
  };

  async function refreshStoredSession(
    credentials: StoredCredentials,
  ): Promise<StoredCredentials> {
    let refreshedSession: RefreshedSession;

    try {
      refreshedSession = await options.apiClient.refreshSession(
        credentials.refresh_token,
      );
    } catch (error) {
      await deleteIfDefinitelyInvalid(error);
      throw new TokenManagerError(
        "REFRESH_FAILED",
        "Failed to refresh session. Run insighta login.",
        error,
      );
    }

    const nextCredentials = mergeRefreshedSession(
      credentials,
      refreshedSession,
      now,
      options.apiClient.getBaseUrl(),
    );

    return writeCredentials(nextCredentials, options.credentialsStoreOptions);
  }

  async function refreshAfterUnauthorized(
    credentials: StoredCredentials,
    originalError: unknown,
  ): Promise<StoredCredentials> {
    try {
      return await refreshStoredSession(credentials);
    } catch (refreshError) {
      throw new TokenManagerError(
        "REFRESH_FAILED",
        "Session expired and could not be refreshed. Run insighta login.",
        refreshError instanceof Error ? refreshError : originalError,
      );
    }
  }

  async function deleteIfDefinitelyInvalid(error: unknown): Promise<void> {
    if (!isUnauthorizedApiError(error)) {
      return;
    }

    await deleteCredentials(options.credentialsStoreOptions);
  }
}

export function shouldRefreshCredentials(
  credentials: StoredCredentials,
  now: () => Date = () => new Date(),
  refreshBufferMs: number = ACCESS_TOKEN_REFRESH_BUFFER_MS,
): boolean {
  const expiresAt = parseExpiry(credentials.expires_at);

  return expiresAt.getTime() - now().getTime() <= refreshBufferMs;
}

export function mergeRefreshedSession(
  credentials: StoredCredentials,
  refreshedSession: RefreshedSession,
  now: () => Date = () => new Date(),
  baseUrl: string = credentials.base_url,
): StoredCredentials {
  return {
    base_url: baseUrl,
    token_type: refreshedSession.token_type,
    access_token: refreshedSession.access_token,
    refresh_token: refreshedSession.refresh_token,
    expires_at: createExpiresAt(refreshedSession.expires_in, now),
    user: credentials.user,
  };
}

export function createExpiresAt(
  expiresInSeconds: number,
  now: () => Date = () => new Date(),
): string {
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new TokenManagerError(
      "INVALID_EXPIRY",
      "expires_in must be a positive number of seconds.",
    );
  }

  const expiresAtMs = now().getTime() + expiresInSeconds * 1000;

  return new Date(expiresAtMs).toISOString();
}

function parseExpiry(value: string): Date {
  const expiresAt = new Date(value);

  if (Number.isNaN(expiresAt.getTime())) {
    throw new TokenManagerError(
      "INVALID_EXPIRY",
      "Stored credentials have an invalid expires_at value.",
    );
  }

  return expiresAt;
}

function isUnauthorizedApiError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError && error.statusCode === 401;
}
