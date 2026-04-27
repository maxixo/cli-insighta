import { Command } from "commander";
import open from "open";
import ora from "ora";

import { createApiClient, type ApiClient } from "../../lib/api-client.js";
import { startCallbackServer } from "../../lib/callback-server.js";
import {
  OAUTH_CALLBACK_TIMEOUT_MS,
  PKCE_CODE_VERIFIER_BYTE_LENGTH,
} from "../../lib/constants.js";
import { readEnvBaseUrl, resolveConfig } from "../../lib/config.js";
import {
  CredentialsStoreError,
  readCredentials,
  writeCredentials,
} from "../../lib/credentials-store.js";
import { formatError } from "../../lib/formatters/errors.js";
import { assertOAuthState } from "../../lib/oauth.js";
import { createOAuthState, createPkcePair } from "../../lib/pkce.js";
import { createExpiresAt } from "../../lib/token-manager.js";
import type { AuthSession } from "../../types/api.js";
import type { StoredCredentials } from "../../types/credentials.js";

type OutputWriter = Pick<NodeJS.WriteStream, "write">;

type RunLoginCommandInput = {
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
  stdout?: OutputWriter;
  stderr?: OutputWriter;
  openBrowser?: (target: string) => Promise<unknown>;
  startServer?: typeof startCallbackServer;
  createClient?: (options: { baseUrl: string }) => ApiClient;
  readStoredCredentials?: typeof readCredentials;
  writeStoredCredentials?: typeof writeCredentials;
};

export function createLoginCommand(): Command {
  return new Command("login")
    .description("Authenticate with Insighta using GitHub OAuth")
    .action(async (_options, command) => {
      try {
        const globalOptions = command.optsWithGlobals() as {
          baseUrl?: string;
        };

        await runLoginCommand({
          baseUrl: globalOptions.baseUrl,
        });
      } catch (error) {
        process.exitCode = 1;
        process.stderr.write(`${formatError(error)}\n`);
      }
    });
}

export async function runLoginCommand(
  input: RunLoginCommandInput = {},
): Promise<void> {
  const stdout = input.stdout ?? process.stdout;
  const stderr = input.stderr ?? process.stderr;
  const openBrowser =
    input.openBrowser ?? ((target: string) => open(target));
  const startServer = input.startServer ?? startCallbackServer;
  const createClient = input.createClient ?? createApiClient;
  const readStoredCredentials = input.readStoredCredentials ?? readCredentials;
  const writeStoredCredentials = input.writeStoredCredentials ?? writeCredentials;
  const storedBaseUrl = await readStoredBaseUrl(readStoredCredentials);
  const resolvedConfig = resolveConfig({
    cliBaseUrl: input.baseUrl,
    envBaseUrl: readEnvBaseUrl(input.env),
    storedBaseUrl,
  });
  const client = createClient({
    baseUrl: resolvedConfig.baseUrl,
  });
  const callbackServer = await startServer({
    timeoutMs: OAUTH_CALLBACK_TIMEOUT_MS,
  });
  const spinner = ora();

  try {
    const state = createOAuthState();
    const { codeVerifier, codeChallenge } = createPkcePair(
      PKCE_CODE_VERIFIER_BYTE_LENGTH,
    );

    spinner.start("Preparing GitHub login...");
    const authStart = await client.startGithubDeviceLogin({
      state,
      redirect_uri: callbackServer.redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    spinner.stop();

    validateAuthStartResponse(authStart, state, callbackServer.redirectUri);

    try {
      await openBrowser(authStart.authorization_url);
    } catch (error) {
      stderr.write(
        `Failed to open the browser automatically. Open this URL manually:\n${authStart.authorization_url}\n`,
      );

      if (error instanceof Error && error.message.length > 0) {
        stderr.write(`${error.message}\n`);
      }
    }

    stdout.write("Complete authentication in your browser to continue.\n");
    const callback = await callbackServer.waitForCallback();
    assertOAuthState(authStart.state, callback.state);

    spinner.start("Completing login...");
    const session = await client.loginWithGithubCallback({
      code: callback.code,
      state: callback.state,
      code_verifier: codeVerifier,
      redirect_uri: authStart.redirect_uri,
    });
    const storedCredentials = await persistSession(
      session,
      resolvedConfig.baseUrl,
      writeStoredCredentials,
    );
    spinner.succeed("Login complete.");

    renderLoginSummary(stdout, storedCredentials);
  } catch (error) {
    spinner.stop();
    throw error;
  } finally {
    await callbackServer.close();
  }
}

async function readStoredBaseUrl(
  readStoredCredentials: typeof readCredentials,
): Promise<string | undefined> {
  try {
    const credentials = await readStoredCredentials();
    return credentials.base_url;
  } catch (error) {
    if (
      error instanceof CredentialsStoreError &&
      (error.code === "CREDENTIALS_NOT_FOUND" ||
        error.code === "INVALID_CREDENTIALS")
    ) {
      return undefined;
    }

    throw error;
  }
}

function validateAuthStartResponse(
  authStart: { state: string; redirect_uri: string },
  expectedState: string,
  expectedRedirectUri: string,
): void {
  if (authStart.state !== expectedState) {
    throw new Error("Auth start state mismatch.");
  }

  if (authStart.redirect_uri !== expectedRedirectUri) {
    throw new Error("Auth start redirect URI mismatch.");
  }
}

async function persistSession(
  session: AuthSession,
  baseUrl: string,
  writeStoredCredentials: typeof writeCredentials,
): Promise<StoredCredentials> {
  return writeStoredCredentials({
    base_url: baseUrl,
    token_type: session.token_type,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: createExpiresAt(session.expires_in),
    user: session.user,
  });
}

function renderLoginSummary(
  stdout: OutputWriter,
  credentials: StoredCredentials,
): void {
  const displayName =
    credentials.user.name ??
    credentials.user.username ??
    credentials.user.email ??
    credentials.user.id;

  stdout.write(`Signed in as ${displayName}\n`);

  if (credentials.user.username) {
    stdout.write(`GitHub username: ${credentials.user.username}\n`);
  }

  if (credentials.user.email) {
    stdout.write(`Email: ${credentials.user.email}\n`);
  }

  stdout.write(`Base URL: ${credentials.base_url}\n`);
  stdout.write(`Session expires: ${credentials.expires_at}\n`);
}
