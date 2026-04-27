import type {
  ListProfilesResponse,
  Profile,
  User,
} from "../../src/types/api.js";
import type { StoredCredentials } from "../../src/types/credentials.js";

type TestWriter = Pick<NodeJS.WriteStream, "write">;

export function createStringWriter(): {
  writer: TestWriter;
  output: () => string;
} {
  let value = "";

  return {
    writer: {
      write(chunk: string | Uint8Array) {
        value +=
          typeof chunk === "string"
            ? chunk
            : Buffer.from(chunk).toString("utf8");
        return true;
      },
    },
    output: () => value,
  };
}

export function createUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-123",
    github_id: "github-123",
    username: "octocat",
    name: "Example User",
    email: "user@example.com",
    ...overrides,
  };
}

export function createStoredCredentials(
  overrides: Partial<StoredCredentials> = {},
): StoredCredentials {
  const baseCredentials: StoredCredentials = {
    base_url: "https://api.example.com",
    token_type: "Bearer",
    access_token: "access-token",
    refresh_token: "refresh-token",
    expires_at: "2030-01-01T00:00:00.000Z",
    user: createUser(),
  };

  return {
    ...baseCredentials,
    ...overrides,
    user: overrides.user
      ? {
          ...baseCredentials.user,
          ...overrides.user,
        }
      : baseCredentials.user,
  };
}

export function createProfile(
  overrides: Partial<Profile> = {},
): Profile {
  return {
    id: "profile-123",
    name: "Ada Lovelace",
    gender: "female",
    gender_probability: 0.98,
    age: 28,
    age_group: "adult",
    country_id: "NG",
    country_name: "Nigeria",
    country_probability: 0.91,
    created_at: "2025-01-01T10:00:00.000Z",
    ...overrides,
  };
}

export function createProfilesResponse(
  overrides: Partial<ListProfilesResponse> = {},
): ListProfilesResponse {
  const data = overrides.data ?? [createProfile()];

  return {
    status: "success",
    page: 1,
    limit: 20,
    total: data.length,
    total_pages: 1,
    links: {
      self: "/api/profiles?page=1",
      next: null,
      prev: null,
    },
    ...overrides,
    data,
  };
}
