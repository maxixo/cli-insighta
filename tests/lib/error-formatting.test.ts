import { describe, expect, it } from "vitest";

import { ApiClientError } from "../../src/lib/api-client.js";
import { CredentialsStoreError } from "../../src/lib/credentials-store.js";
import { formatError } from "../../src/lib/formatters/errors.js";

describe("error formatting", () => {
  it("includes HTTP status codes for HTTP client errors", () => {
    const error = new ApiClientError({
      code: "HTTP_ERROR",
      message: "Unauthorized",
      method: "GET",
      path: "/api/auth/me",
      statusCode: 401,
    });

    expect(formatError(error)).toBe("Unauthorized (HTTP 401)");
  });

  it("passes through credential store messages", () => {
    expect(
      formatError(
        new CredentialsStoreError(
          "INVALID_CREDENTIALS",
          "Stored credentials are invalid.",
        ),
      ),
    ).toBe("Stored credentials are invalid.");
  });

  it("falls back for unknown errors", () => {
    expect(formatError({})).toBe("An unexpected error occurred.");
  });
});
