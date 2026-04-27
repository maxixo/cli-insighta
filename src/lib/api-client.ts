import {
  API_AUTH_TIMEOUT_MS,
  API_EXPORT_TIMEOUT_MS,
  API_PATHS,
  API_REQUEST_TIMEOUT_MS,
  PROFILE_API_VERSION,
  PROFILE_API_VERSION_HEADER,
} from "./constants.js";
import type {
  AuthSessionResponse,
  AuthSession,
  AuthStartData,
  AuthStartResponse,
  CreateProfileResponse,
  CurrentUserResponse,
  GetProfileResponse,
  GithubCallbackExchangeRequest,
  ListProfilesResponse,
  LogoutResponse,
  Profile,
  ProfileListParams,
  ProfileSearchParams,
  RefreshSessionResponse,
  RefreshedSession,
  SearchProfilesResponse,
  User,
} from "../types/api.js";

type FetchLike = typeof fetch;
type HeaderInput = Headers | Record<string, string> | Array<[string, string]>;
type QueryParams = Record<string, string | number | boolean | undefined>;

type ApiClientOptions = {
  baseUrl: string;
  fetchImpl?: FetchLike;
};

type RequestMethod = "GET" | "POST";

type RequestOptions = {
  method?: RequestMethod;
  body?: unknown;
  headers?: HeaderInput;
  bearerToken?: string;
  timeoutMs?: number;
  profileVersioned?: boolean;
  query?: QueryParams;
};

type ErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT_ERROR"
  | "INVALID_RESPONSE"
  | "HTTP_ERROR"
  | "API_ERROR";

export class ApiClientError extends Error {
  readonly code: ErrorCode;
  readonly statusCode?: number;
  readonly method: RequestMethod;
  readonly path: string;
  readonly responseBody?: string;

  constructor(input: {
    code: ErrorCode;
    message: string;
    method: RequestMethod;
    path: string;
    statusCode?: number;
    responseBody?: string;
    cause?: unknown;
  }) {
    super(input.message, input.cause ? { cause: input.cause } : undefined);
    this.name = "ApiClientError";
    this.code = input.code;
    this.method = input.method;
    this.path = input.path;
    this.statusCode = input.statusCode;
    this.responseBody = input.responseBody;
  }
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient(options: ApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    getBaseUrl(): string {
      return options.baseUrl;
    },

    async startGithubDeviceLogin(): Promise<AuthStartData> {
      const response = await requestJson<AuthStartResponse>(
        fetchImpl,
        options.baseUrl,
        API_PATHS.auth.start,
        {
          method: "POST",
          timeoutMs: API_AUTH_TIMEOUT_MS,
        },
      );

      return response.data;
    },

    async loginWithGithubCallback(
      input: GithubCallbackExchangeRequest,
    ): Promise<AuthSession> {
      const response = await requestJson<AuthSessionResponse>(
        fetchImpl,
        options.baseUrl,
        API_PATHS.auth.callback,
        {
          method: "POST",
          body: input,
          timeoutMs: API_AUTH_TIMEOUT_MS,
        },
      );

      return response.data;
    },

    async refreshSession(refreshToken: string): Promise<RefreshedSession> {
      const response = await requestJson<RefreshSessionResponse>(
        fetchImpl,
        options.baseUrl,
        API_PATHS.auth.refresh,
        {
          method: "POST",
          body: {
            refresh_token: refreshToken,
          },
          timeoutMs: API_AUTH_TIMEOUT_MS,
        },
      );

      return response.data;
    },

    async logoutSession(refreshToken: string): Promise<{ logged_out: boolean }> {
      const response = await requestJson<LogoutResponse>(
        fetchImpl,
        options.baseUrl,
        API_PATHS.auth.logout,
        {
          method: "POST",
          body: {
            refresh_token: refreshToken,
          },
          timeoutMs: API_AUTH_TIMEOUT_MS,
        },
      );

      return response.data;
    },

    async getCurrentUser(accessToken: string): Promise<User> {
      const response = await requestJson<CurrentUserResponse>(
        fetchImpl,
        options.baseUrl,
        API_PATHS.auth.me,
        {
          bearerToken: accessToken,
          timeoutMs: API_REQUEST_TIMEOUT_MS,
        },
      );

      return response.data;
    },

    async listProfiles(
      params: ProfileListParams,
      accessToken: string,
    ): Promise<ListProfilesResponse> {
      return requestJson<ListProfilesResponse>(
        fetchImpl,
        options.baseUrl,
        API_PATHS.profiles.list,
        {
          bearerToken: accessToken,
          profileVersioned: true,
          timeoutMs: API_REQUEST_TIMEOUT_MS,
          query: params,
        },
      );
    },

    async getProfile(id: string, accessToken: string): Promise<Profile> {
      const response = await requestJson<GetProfileResponse>(
        fetchImpl,
        options.baseUrl,
        `${API_PATHS.profiles.list}/${encodeURIComponent(id)}`,
        {
          bearerToken: accessToken,
          profileVersioned: true,
          timeoutMs: API_REQUEST_TIMEOUT_MS,
        },
      );

      return response.data;
    },

    async searchProfiles(
      query: string,
      params: ProfileSearchParams,
      accessToken: string,
    ): Promise<SearchProfilesResponse> {
      const searchParams = {
        ...params,
        q: query,
      };

      return requestJson<SearchProfilesResponse>(
        fetchImpl,
        options.baseUrl,
        API_PATHS.profiles.search,
        {
          bearerToken: accessToken,
          profileVersioned: true,
          timeoutMs: API_REQUEST_TIMEOUT_MS,
          query: searchParams,
        },
      );
    },

    async createProfile(name: string, accessToken: string): Promise<Profile> {
      const response = await requestJson<CreateProfileResponse>(
        fetchImpl,
        options.baseUrl,
        API_PATHS.profiles.list,
        {
          method: "POST",
          bearerToken: accessToken,
          profileVersioned: true,
          timeoutMs: API_REQUEST_TIMEOUT_MS,
          body: {
            name,
          },
        },
      );

      return response.data;
    },

    async exportProfilesCsv(
      params: ProfileListParams,
      accessToken: string,
    ): Promise<string> {
      return requestText(
        fetchImpl,
        options.baseUrl,
        API_PATHS.profiles.export,
        {
          bearerToken: accessToken,
          profileVersioned: true,
          timeoutMs: API_EXPORT_TIMEOUT_MS,
          query: {
            ...params,
            format: "csv",
          },
        },
      );
    },
  };
}

async function requestJson<TResponse>(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const response = await performRequest(fetchImpl, baseUrl, path, options);
  const responseText = await response.text();
  const parsedBody = parseJsonBody(responseText, options.method ?? "GET", path);

  if (!response.ok) {
    throw createHttpError(response, options.method ?? "GET", path, responseText, parsedBody);
  }

  if (isApiErrorBody(parsedBody)) {
    throw new ApiClientError({
      code: "API_ERROR",
      message: parsedBody.message,
      method: options.method ?? "GET",
      path,
      statusCode: response.status,
      responseBody: responseText,
    });
  }

  return parsedBody as TResponse;
}

async function requestText(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<string> {
  const response = await performRequest(fetchImpl, baseUrl, path, options);
  const responseText = await response.text();

  if (!response.ok) {
    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(responseText) as unknown;
    } catch {
      parsedBody = undefined;
    }

    throw createHttpError(response, options.method ?? "GET", path, responseText, parsedBody);
  }

  return responseText;
}

async function performRequest(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  options: RequestOptions,
): Promise<Response> {
  const method = options.method ?? "GET";
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? API_REQUEST_TIMEOUT_MS;
  const url = createRequestUrl(baseUrl, path, options.query);
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  timeoutHandle.unref();

  try {
    return await fetchImpl(url, {
      method,
      headers: createHeaders({
        customHeaders: method === "GET" ? undefined : options.headers,
        bearerToken: options.bearerToken,
        profileVersioned: options.profileVersioned ?? false,
        hasJsonBody: options.body !== undefined,
      }),
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new ApiClientError({
        code: "TIMEOUT_ERROR",
        message: `Request timed out after ${timeoutMs}ms.`,
        method,
        path,
        cause: error,
      });
    }

    throw new ApiClientError({
      code: "NETWORK_ERROR",
      message: `Network request failed for ${method} ${path}.`,
      method,
      path,
      cause: error,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function createHeaders(input: {
  customHeaders?: HeaderInput;
  bearerToken?: string;
  profileVersioned: boolean;
  hasJsonBody: boolean;
}): Headers {
  const headers = new Headers(input.customHeaders);

  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  if (input.hasJsonBody && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (input.bearerToken) {
    headers.set("authorization", `Bearer ${input.bearerToken}`);
  }

  if (input.profileVersioned) {
    headers.set(PROFILE_API_VERSION_HEADER, PROFILE_API_VERSION);
  }

  return headers;
}

function createRequestUrl(
  baseUrl: string,
  path: string,
  query?: QueryParams,
): URL {
  const url = new URL(path, withTrailingSlash(baseUrl));

  if (!query) {
    return url;
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url;
}

function parseJsonBody(
  responseText: string,
  method: RequestMethod,
  path: string,
): unknown {
  if (responseText.trim() === "") {
    throw new ApiClientError({
      code: "INVALID_RESPONSE",
      message: `Expected JSON response body for ${method} ${path}.`,
      method,
      path,
      responseBody: responseText,
    });
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch (error) {
    throw new ApiClientError({
      code: "INVALID_RESPONSE",
      message: `Received invalid JSON from ${method} ${path}.`,
      method,
      path,
      responseBody: responseText,
      cause: error,
    });
  }
}

function createHttpError(
  response: Response,
  method: RequestMethod,
  path: string,
  responseText: string,
  parsedBody: unknown,
): ApiClientError {
  const message =
    isApiErrorBody(parsedBody)
      ? parsedBody.message
      : `Request failed with status ${response.status}.`;

  return new ApiClientError({
    code: isApiErrorBody(parsedBody) ? "API_ERROR" : "HTTP_ERROR",
    message,
    method,
    path,
    statusCode: response.status,
    responseBody: responseText,
  });
}

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function isApiErrorBody(value: unknown): value is { status: "error"; message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === "error" &&
    "message" in value &&
    typeof value.message === "string"
  );
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === "AbortError"
  );
}
