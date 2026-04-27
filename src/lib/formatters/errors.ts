import { CallbackServerError } from "../callback-server.js";
import { CredentialsStoreError } from "../credentials-store.js";
import { ApiClientError } from "../api-client.js";

export function formatError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return formatApiClientError(error);
  }

  if (error instanceof CredentialsStoreError) {
    return error.message;
  }

  if (error instanceof CallbackServerError) {
    return error.message;
  }

  if (isNodeError(error) && typeof error.message === "string") {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

export function formatApiClientError(error: ApiClientError): string {
  switch (error.code) {
    case "TIMEOUT_ERROR":
      return error.message;
    case "NETWORK_ERROR":
      return error.message;
    case "INVALID_RESPONSE":
      return error.message;
    case "API_ERROR":
      return error.message;
    case "HTTP_ERROR":
      return error.statusCode === undefined
        ? error.message
        : `${error.message} (HTTP ${error.statusCode})`;
    default:
      return error.message;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "message" in error;
}
