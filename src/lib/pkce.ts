import { createHash, randomBytes } from "node:crypto";

type PkcePair = {
  codeVerifier: string;
  codeChallenge: string;
};

export function createCodeVerifier(
  byteLength: number = 64,
): string {
  assertPositiveByteLength(byteLength);

  return toBase64Url(randomBytes(byteLength));
}

export function createCodeChallenge(codeVerifier: string): string {
  if (codeVerifier.length === 0) {
    throw new Error("PKCE code verifier cannot be empty.");
  }

  return toBase64Url(
    createHash("sha256").update(codeVerifier, "utf8").digest(),
  );
}

export function createPkcePair(byteLength?: number): PkcePair {
  const codeVerifier = createCodeVerifier(byteLength);

  return {
    codeVerifier,
    codeChallenge: createCodeChallenge(codeVerifier),
  };
}

export function createOAuthState(byteLength: number = 32): string {
  assertPositiveByteLength(byteLength);

  return toBase64Url(randomBytes(byteLength));
}

function toBase64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url");
}

function assertPositiveByteLength(byteLength: number): void {
  if (!Number.isInteger(byteLength) || byteLength <= 0) {
    throw new Error("Byte length must be a positive integer.");
  }
}
