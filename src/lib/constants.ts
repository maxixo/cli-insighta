export const CLI_NAME = "insighta";
export const CLI_DESCRIPTION =
  "Authenticate with Insighta and manage profiles from the terminal";
export const CLI_VERSION = "0.1.0";

export const DEFAULT_API_BASE_URL = "http://localhost:4000";
export const API_BASE_URL_ENV_VAR = "INSIGHTA_API_BASE_URL";
export const PROFILE_API_VERSION_HEADER = "X-API-Version";
export const PROFILE_API_VERSION = "1";
export const OAUTH_CALLBACK_HOST = "127.0.0.1";
export const OAUTH_CALLBACK_PATH = "/callback";
export const OAUTH_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
export const PKCE_CODE_VERIFIER_BYTE_LENGTH = 64;
export const API_REQUEST_TIMEOUT_MS = 15 * 1000;
export const API_EXPORT_TIMEOUT_MS = 60 * 1000;
export const API_AUTH_TIMEOUT_MS = 15 * 1000;
export const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

const AUTH_BASE_PATH = "/api/auth";
const PROFILES_BASE_PATH = "/api/profiles";

export const API_PATHS = {
  auth: {
    start: `${AUTH_BASE_PATH}/github/device-or-cli/start`,
    callback: `${AUTH_BASE_PATH}/github/callback`,
    refresh: `${AUTH_BASE_PATH}/refresh`,
    logout: `${AUTH_BASE_PATH}/logout`,
    me: `${AUTH_BASE_PATH}/me`,
  },
  profiles: {
    list: PROFILES_BASE_PATH,
    search: `${PROFILES_BASE_PATH}/search`,
    export: `${PROFILES_BASE_PATH}/export`,
  },
} as const;
