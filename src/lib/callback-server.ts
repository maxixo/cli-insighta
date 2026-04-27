import http, {
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import {
  OAUTH_CALLBACK_HOST,
  OAUTH_CALLBACK_PATH,
  OAUTH_CALLBACK_TIMEOUT_MS,
} from "./constants.js";
import {
  createLoopbackRedirectUri,
  readOAuthCallbackParams,
} from "./oauth.js";

export type CallbackServerErrorCode =
  | "LISTEN_FAILED"
  | "TIMEOUT"
  | "CALLBACK_ERROR"
  | "INVALID_CALLBACK";

export class CallbackServerError extends Error {
  readonly code: CallbackServerErrorCode;

  constructor(code: CallbackServerErrorCode, message: string, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = "CallbackServerError";
    this.code = code;
  }
}

export type OAuthCallback = {
  url: string;
  code: string;
  state: string;
};

export type StartCallbackServerOptions = {
  host?: string;
  port?: number;
  callbackPath?: string;
  timeoutMs?: number;
};

export type CallbackServer = {
  host: string;
  port: number;
  callbackPath: string;
  redirectUri: string;
  waitForCallback: () => Promise<OAuthCallback>;
  close: () => Promise<void>;
};

type HandleRequestInput = {
  request: IncomingMessage;
  response: ServerResponse<IncomingMessage>;
  callbackPath: string;
  settleSuccess: (callback: OAuthCallback) => void;
  settleFailure: (error: CallbackServerError, statusCode: number) => void;
};

type Deferred<TValue> = {
  promise: Promise<TValue>;
  resolve: (value: TValue | PromiseLike<TValue>) => void;
  reject: (reason?: unknown) => void;
};

export async function startCallbackServer(
  options: StartCallbackServerOptions = {},
): Promise<CallbackServer> {
  const host = options.host ?? OAUTH_CALLBACK_HOST;
  const requestedPort = options.port ?? 0;
  const callbackPath = normalizeCallbackPath(
    options.callbackPath ?? OAUTH_CALLBACK_PATH,
  );
  const timeoutMs = options.timeoutMs ?? OAUTH_CALLBACK_TIMEOUT_MS;
  const deferred = createDeferred<OAuthCallback>();
  let isSettled = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const server = http.createServer((request, response) => {
    void handleRequest({
      request,
      response,
      callbackPath,
      settleSuccess: (value) => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        clearCallbackTimeout(timeoutHandle);
        deferred.resolve(value);
        void closeServer(server);
      },
      settleFailure: (error, statusCode) => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        clearCallbackTimeout(timeoutHandle);
        sendHtml(response, statusCode, buildFailureHtml(error.message));
        deferred.reject(error);
        void closeServer(server);
      },
    });
  });

  await listen(server, host, requestedPort);

  const address = server.address();

  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new CallbackServerError(
      "LISTEN_FAILED",
      "OAuth callback server did not expose a TCP address.",
    );
  }

  timeoutHandle = setTimeout(() => {
    if (isSettled) {
      return;
    }

    isSettled = true;
    deferred.reject(
      new CallbackServerError(
        "TIMEOUT",
        "Timed out waiting for OAuth callback.",
      ),
    );
    void closeServer(server);
  }, timeoutMs);
  timeoutHandle.unref();

  return {
    host,
    port: address.port,
    callbackPath,
    redirectUri: createLoopbackRedirectUri(address.port, callbackPath),
    waitForCallback: () => deferred.promise,
    close: async () => {
      clearCallbackTimeout(timeoutHandle);

      if (!isSettled) {
        isSettled = true;
      }

      await closeServer(server);
    },
  };
}

async function handleRequest(input: HandleRequestInput): Promise<void> {
  const requestUrl = new URL(
    input.request.url ?? "/",
    `http://${input.request.headers.host ?? OAUTH_CALLBACK_HOST}`,
  );

  if (requestUrl.pathname !== input.callbackPath) {
    sendHtml(input.response, 404, buildFailureHtml("Route not found."));
    return;
  }

  const callbackParams = readOAuthCallbackParams(requestUrl);

  if (callbackParams.error) {
    input.settleFailure(
      new CallbackServerError(
        "CALLBACK_ERROR",
        callbackParams.errorDescription
          ? `${callbackParams.error}: ${callbackParams.errorDescription}`
          : callbackParams.error,
      ),
      400,
    );
    return;
  }

  if (!callbackParams.code || !callbackParams.state) {
    input.settleFailure(
      new CallbackServerError(
        "INVALID_CALLBACK",
        "OAuth callback is missing required query parameters.",
      ),
      400,
    );
    return;
  }

  sendHtml(input.response, 200, buildSuccessHtml());
  input.settleSuccess({
    url: requestUrl.toString(),
    code: callbackParams.code,
    state: callbackParams.state,
  });
}

function buildSuccessHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Insighta Login Complete</title>
  </head>
  <body>
    <main>
      <h1>Login complete</h1>
      <p>You can return to the Insighta CLI.</p>
    </main>
  </body>
</html>`;
}

function buildFailureHtml(message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Insighta Login Failed</title>
  </head>
  <body>
    <main>
      <h1>Login failed</h1>
      <p>${escapeHtml(message)}</p>
    </main>
  </body>
</html>`;
}

function sendHtml(
  response: ServerResponse<IncomingMessage>,
  statusCode: number,
  html: string,
): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(html);
}

async function listen(
  server: http.Server,
  host: string,
  port: number,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(
        new CallbackServerError(
          "LISTEN_FAILED",
          `Failed to start OAuth callback server on ${host}:${port}.`,
          error,
        ),
      );
    };

    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

async function closeServer(server: http.Server): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function clearCallbackTimeout(
  timeoutHandle: ReturnType<typeof setTimeout> | undefined,
): void {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }
}

function createDeferred<TValue>(): Deferred<TValue> {
  let resolve!: Deferred<TValue>["resolve"];
  let reject!: Deferred<TValue>["reject"];

  const promise = new Promise<TValue>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function normalizeCallbackPath(callbackPath: string): string {
  if (callbackPath.length === 0) {
    throw new Error("Callback path cannot be empty.");
  }

  return callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
