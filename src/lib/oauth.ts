import {
  OAUTH_CALLBACK_HOST,
  OAUTH_CALLBACK_PATH,
} from "./constants.js";

export type OAuthAuthorizationParams = {
  clientId: string;
  redirectUri: string;
  scope?: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod?: "S256";
  allowSignup?: boolean;
};

export type OAuthCallbackParams = {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
};

export function createLoopbackRedirectUri(
  port: number,
  callbackPath: string = OAUTH_CALLBACK_PATH,
): string {
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("Callback port must be a positive integer.");
  }

  const normalizedPath = normalizeCallbackPath(callbackPath);
  const redirectUrl = new URL(`http://${OAUTH_CALLBACK_HOST}:${port}`);

  redirectUrl.pathname = normalizedPath;

  return redirectUrl.toString();
}

export function buildGithubAuthorizationUrl(
  params: OAuthAuthorizationParams,
): string {
  const authorizationUrl = new URL("https://github.com/login/oauth/authorize");

  authorizationUrl.searchParams.set("client_id", params.clientId);
  authorizationUrl.searchParams.set("redirect_uri", params.redirectUri);
  authorizationUrl.searchParams.set("state", params.state);
  authorizationUrl.searchParams.set("code_challenge", params.codeChallenge);
  authorizationUrl.searchParams.set(
    "code_challenge_method",
    params.codeChallengeMethod ?? "S256",
  );

  if (params.scope) {
    authorizationUrl.searchParams.set("scope", params.scope);
  }

  if (params.allowSignup !== undefined) {
    authorizationUrl.searchParams.set(
      "allow_signup",
      String(params.allowSignup),
    );
  }

  return authorizationUrl.toString();
}

export function readOAuthCallbackParams(input: string | URL): OAuthCallbackParams {
  const callbackUrl = typeof input === "string" ? new URL(input) : input;

  return {
    code: callbackUrl.searchParams.get("code") ?? undefined,
    state: callbackUrl.searchParams.get("state") ?? undefined,
    error: callbackUrl.searchParams.get("error") ?? undefined,
    errorDescription:
      callbackUrl.searchParams.get("error_description") ?? undefined,
  };
}

export function assertOAuthState(
  expectedState: string,
  actualState: string | undefined,
): void {
  if (!actualState) {
    throw new Error("OAuth callback is missing state.");
  }

  if (actualState !== expectedState) {
    throw new Error("OAuth state mismatch.");
  }
}

function normalizeCallbackPath(callbackPath: string): string {
  if (callbackPath.length === 0) {
    throw new Error("Callback path cannot be empty.");
  }

  return callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
}
