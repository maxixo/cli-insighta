# Insighta CLI Plan

## Summary

Build a standalone Node.js CLI package in `cli-insighta` that installs globally as `insighta` via npm and talks to the existing backend over HTTP. The CLI will implement GitHub OAuth with PKCE through a browser-based login flow, persist credentials in `~/.insighta/credentials.json`, attach bearer tokens to every API request, auto-refresh access tokens when possible, and render profile results in terminal tables with loaders.

This plan is intentionally CLI-only. Because the current backend in `../api` does not yet implement auth or CSV export endpoints, the CLI plan freezes the backend contract it depends on and treats those endpoints as required external assumptions.

## Package Structure

Create a standalone TypeScript ESM package with this shape:

- `package.json`
- `tsconfig.json`
- `src/bin/insighta.ts`
- `src/cli.ts`
- `src/commands/auth/login.ts`
- `src/commands/auth/logout.ts`
- `src/commands/auth/whoami.ts`
- `src/commands/profiles/list.ts`
- `src/commands/profiles/get.ts`
- `src/commands/profiles/search.ts`
- `src/commands/profiles/create.ts`
- `src/commands/profiles/export.ts`
- `src/lib/config.ts`
- `src/lib/constants.ts`
- `src/lib/credentials-store.ts`
- `src/lib/oauth.ts`
- `src/lib/pkce.ts`
- `src/lib/callback-server.ts`
- `src/lib/api-client.ts`
- `src/lib/token-manager.ts`
- `src/lib/formatters/table.ts`
- `src/lib/formatters/profile.ts`
- `src/lib/formatters/errors.ts`
- `src/lib/csv.ts`
- `src/types/api.ts`
- `src/types/credentials.ts`
- `tests/...`

## Runtime And Packaging Decisions

- Use Node.js 22.x to stay aligned with the backend repo.
- Use TypeScript + ESM.
- Use `commander` for command parsing.
- Use native `fetch` from Node 22 for HTTP.
- Use `ora` for loaders.
- Use `cli-table3` for structured tables.
- Use `picocolors` only for restrained status/error emphasis.
- Use `open` to launch the GitHub auth URL in the default browser.
- Use `zod` to validate local credential file shape and environment config.
- Use `csv-stringify` or a minimal custom CSV serializer with fixed column order.
- Configure `package.json` with a `bin` entry so `npm install -g .` exposes `insighta`.

## CLI Command Contract

### Auth Commands

#### `insighta login`

Behavior:

1. Generate `state`, `code_verifier`, and derived `code_challenge`.
2. Start a temporary local HTTP server bound to `127.0.0.1` on a chosen port.
3. Build the backend auth-start URL or direct browser URL, depending on backend design.
4. Open the browser to begin GitHub OAuth.
5. Receive callback on `http://127.0.0.1:<port>/callback`.
6. Validate `state`.
7. Send `code`, `code_verifier`, `redirect_uri`, and `state` to the backend token-exchange endpoint.
8. Persist returned credentials.
9. Print authenticated user summary.

Failure handling:

- If browser launch fails, print the full URL and keep the local server waiting.
- If callback times out, shut down the server and show retry guidance.
- If state mismatches, reject the flow and do not store credentials.
- If backend exchange fails, show backend error clearly.

#### `insighta logout`

Behavior:

- Delete `~/.insighta/credentials.json`.
- If no credential file exists, report already logged out.
- Do not call a backend revoke endpoint in this phase.

#### `insighta whoami`

Behavior:

- Read stored credentials.
- Refresh access token first if expired or near expiry.
- Call backend `GET /api/v1/auth/me`.
- Render current user details as a small table.

### Profile Commands

#### `insighta profiles list`

Supported flags:

- `--gender <value>`
- `--country <code>`
- `--age-group <value>`
- `--min-age <number>`
- `--max-age <number>`
- `--sort-by <age|created_at|gender_probability>`
- `--order <asc|desc>`
- `--page <number>`
- `--limit <number>`

Mapping:

- `--country` maps to backend `country_id`
- `--age-group` maps to backend `age_group`
- `--min-age` maps to backend `min_age`
- `--max-age` maps to backend `max_age`
- `--sort-by` maps to backend `sort_by`

Behavior:

- Require valid credentials.
- Show loader while fetching.
- Call `GET /api/v1/profiles`.
- Render result rows as a table plus pagination metadata.

#### `insighta profiles get <id>`

Behavior:

- Call `GET /api/v1/profiles/:id`.
- Render a two-column key/value table.

#### `insighta profiles search "<query>"`

Behavior:

- Call `GET /api/v1/profiles/search?q=...`.
- Support optional pagination and sort flags if backend allows them.
- Render table output matching `profiles list`.

#### `insighta profiles create --name "<name>"`

Behavior:

- Require `--name`.
- Call `POST /api/v1/profiles` with `{ name }`.
- Render created or reused profile details.
- If backend returns `"Profile already exists"`, surface that as an informational status.

#### `insighta profiles export --format csv`

Supported in this phase:

- `--format csv` only
- Reuse the same filter and sort flags as `profiles list`

Behavior:

- Require `--format csv`; reject any other value.
- Call backend `GET /api/v1/profiles/export.csv` with equivalent query params.
- Save output into the current working directory.
- Use filename format `profiles-export-YYYYMMDD-HHmmss.csv`.
- Print saved path and row count if count can be derived.

## Backend Contract Assumptions

The CLI depends on these endpoints existing. They are not implemented in the current backend repo and must be treated as external prerequisites.

### Required Auth Endpoints

#### `POST /api/v1/auth/github/device-or-cli/start` or equivalent start endpoint

Recommended response:

```json
{
  "status": "success",
  "data": {
    "authorization_url": "https://github.com/login/oauth/authorize?...",
    "state": "opaque-state",
    "redirect_uri": "http://127.0.0.1:47123/callback"
  }
}
```

Alternative allowed design:
The CLI may construct the GitHub authorization URL locally if backend and client IDs and redirect rules are intentionally public. If not, the backend should provide the URL.

#### `POST /api/v1/auth/github/callback`

Request body:

```json
{
  "code": "github-auth-code",
  "state": "opaque-state",
  "code_verifier": "pkce-secret",
  "redirect_uri": "http://127.0.0.1:47123/callback"
}
```

Response body:

```json
{
  "status": "success",
  "data": {
    "access_token": "opaque-access-token",
    "refresh_token": "opaque-refresh-token",
    "token_type": "Bearer",
    "expires_in": 900,
    "user": {
      "id": "user-id",
      "github_id": "12345",
      "username": "octocat",
      "name": "The User",
      "email": "user@example.com"
    }
  }
}
```

#### `POST /api/v1/auth/refresh`

Request body:

```json
{
  "refresh_token": "opaque-refresh-token"
}
```

Response body:

```json
{
  "status": "success",
  "data": {
    "access_token": "new-access-token",
    "refresh_token": "new-refresh-token",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

#### `GET /api/v1/auth/me`

Response body:

```json
{
  "status": "success",
  "data": {
    "id": "user-id",
    "github_id": "12345",
    "username": "octocat",
    "name": "The User",
    "email": "user@example.com"
  }
}
```

### Required Export Endpoint

#### `GET /api/v1/profiles/export.csv`

- Protected with bearer auth.
- Accepts the same filters and sort params as `GET /api/v1/profiles`.
- Returns `text/csv; charset=utf-8`.
- Returns attachment filename header.
- Uses fixed columns:
  `id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability,created_at`

## Credential Storage Design

Store JSON at `~/.insighta/credentials.json` with shape:

```json
{
  "base_url": "http://localhost:4000",
  "token_type": "Bearer",
  "access_token": "opaque-access-token",
  "refresh_token": "opaque-refresh-token",
  "expires_at": "2026-04-27T10:15:30.000Z",
  "user": {
    "id": "user-id",
    "github_id": "12345",
    "username": "octocat",
    "name": "The User",
    "email": "user@example.com"
  }
}
```

Rules:

- Create `~/.insighta` if missing.
- Write file with restricted permissions where supported.
- Never log tokens.
- Fail fast on malformed JSON with a clear re-login instruction.

## Token Management Rules

- Every API request uses `Authorization: Bearer <access_token>`.
- Before a request, if `expires_at` is in the past or within a 60-second buffer, refresh first.
- If a request returns `401`, attempt one refresh and retry once.
- If refresh fails, delete credentials only if they are definitely invalid; otherwise keep them and instruct the user to re-login.
- Refresh success must overwrite both access and refresh tokens because rotation is assumed.

## OAuth And PKCE Flow Details

### PKCE Generation

- `code_verifier`: cryptographically random high-entropy string.
- `code_challenge`: `BASE64URL(SHA256(code_verifier))`
- `state`: separate random opaque value.

### Callback Server

- Bind to `127.0.0.1`, not `0.0.0.0`.
- Default to a random free port.
- Callback path is fixed: `/callback`.
- After one successful callback or terminal failure, shut down immediately.
- Return a minimal browser page: success message or failure message.

### Timeouts

- Browser auth wait timeout: 5 minutes.
- Local callback server timeout: 5 minutes.
- Backend exchange timeout: 15 seconds.
- Standard API request timeout: 15 seconds.
- Export timeout: 60 seconds.

## Output And UX Rules

- Show a loader for network operations: login exchange, refresh, list, get, search, create, export.
- Stop the loader before printing tables or errors.
- Use structured tables, not raw JSON, for normal success output.
- Use stderr for errors.
- Error messages must preserve backend `message` when available.
- For validation errors on flags, print the exact invalid flag and expected values.
- For missing auth, print: `Not logged in. Run insighta login.`

## Validation Rules

### CLI Input Validation

- `gender`: allow values the backend supports, normalized to lowercase.
- `country`: uppercase two-letter country code.
- `age-group`: normalize to backend-supported values.
- `min-age`, `max-age`, `page`, `limit`: integers only.
- Reject `min-age > max-age` locally before calling backend.
- `order`: only `asc` or `desc`.
- `sort-by`: only backend-supported sort fields.

### Credential Validation

- Validate credential file on load with `zod`.
- If invalid, instruct user to run `insighta logout` then `insighta login`.

## Environment And Config

Support these configuration sources, in precedence order:

1. CLI flag `--base-url`
2. Env var `INSIGHTA_API_BASE_URL`
3. Stored `base_url` from credentials
4. Default `http://localhost:4000`

This lets the CLI work locally and against deployed environments.

## Testing Plan

### Unit Tests

- PKCE helper generates valid verifier and challenge pairs.
- State generator returns unique opaque values.
- Credential store reads, writes, validates, and deletes correctly.
- Token manager refreshes before expiry and retries once on `401`.
- Query-param mapper converts CLI flags to backend params correctly.
- CSV filename generator produces expected timestamped names.
- Error formatter maps API, network, and file-system failures into clear messages.

### Command Tests

- `login` succeeds when callback and backend exchange succeed.
- `login` fails on state mismatch.
- `login` fails cleanly on callback timeout.
- `logout` removes credentials.
- `whoami` refreshes expired token before request.
- `profiles list` renders table and pagination metadata.
- `profiles get` renders a detail table.
- `profiles search` sends `q` correctly.
- `profiles create` posts the name and handles existing-profile response.
- `profiles export --format csv` saves file in current working directory.

### Integration-Style Tests With Mock HTTP

- Auth callback exchange returns credentials and writes the credential file.
- Expired access token triggers refresh, rotates stored tokens, and retries original request.
- Refresh failure produces re-login guidance.
- Export response body is written unchanged as CSV.

## Acceptance Criteria

- `npm install -g .` exposes `insighta` globally.
- `insighta --help` works from any directory.
- `insighta login`, `logout`, and `whoami` work with the assumed backend auth contract.
- All profile commands send bearer tokens automatically.
- Expired access tokens are refreshed automatically when possible.
- Results render as tables with loaders during fetches.
- CSV export saves to the current working directory with a timestamped filename.
- Missing or invalid credentials produce clear recovery instructions.

## Important Public Interfaces

### CLI Surface

- `insighta login`
- `insighta logout`
- `insighta whoami`
- `insighta profiles list [flags]`
- `insighta profiles get <id>`
- `insighta profiles search "<query>"`
- `insighta profiles create --name "<name>"`
- `insighta profiles export --format csv [filters]`

### Local Credential Type

```ts
type StoredCredentials = {
  base_url: string;
  token_type: 'Bearer';
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user: {
    id: string;
    github_id?: string;
    username?: string;
    name?: string;
    email?: string;
  };
};
```

### API Client Surface

- `loginWithGithubCallback(input): Promise<AuthSession>`
- `refreshSession(refreshToken): Promise<RefreshedSession>`
- `getCurrentUser(): Promise<User>`
- `listProfiles(params): Promise<PaginatedProfiles>`
- `getProfile(id): Promise<Profile>`
- `searchProfiles(query, params): Promise<PaginatedProfiles>`
- `createProfile(name): Promise<ProfileCreateResponse>`
- `exportProfilesCsv(params): Promise<string | Buffer>`

## Explicit Assumptions And Defaults

- The CLI is a new standalone package in the empty `cli-insighta` folder.
- Global install target is npm, not `npx`-only and not a native binary.
- Login uses browser-based GitHub OAuth with PKCE and a temporary localhost callback server.
- Backend auth and export endpoints do not exist yet in `../api`; the CLI plan assumes they will exist with the contracts above.
- `logout` is local credential removal only in this phase.
- Protected profile routes require bearer auth on every request.
- CSV export is delegated to the backend endpoint rather than rebuilding from paginated JSON client-side.
- The current backend profile query semantics remain unchanged.
