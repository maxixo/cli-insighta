# Insighta CLI Implementation Plan

## Change Summary

- Breaks `cli-codex.md` into an incremental commit sequence.
- Orders work by dependency so each commit leaves the CLI in a coherent state.
- Defines the expected scope of each commit to reduce mixed concerns during implementation and review.

## Source Spec

- Primary reference: [cli-codex.md](/abs/path/C:/Users/HP/Documents/HNG/HNG14/cli-insighta/cli-codex.md)

## Commit Plan

### 1. `chore: scaffold insighta CLI package`

- Purpose:
  Initialize the standalone Node.js TypeScript ESM package and make `insighta` installable as a global CLI.
- Deliverables:
  - `package.json`
  - `tsconfig.json`
  - `src/bin/insighta.ts`
  - `src/cli.ts`
  - npm scripts for build, test, and dev execution
  - `bin` mapping for `insighta`
  - dependency installation and baseline project config
- Why first:
  Every later commit depends on package structure, module resolution, and executable entrypoints.
- Usage:

```json
{
  "bin": {
    "insighta": "./dist/bin/insighta.js"
  }
}
```

### 2. `feat: add core constants, config resolution, and API types`

- Purpose:
  Freeze the CLI's backend-facing contract and configuration precedence before command logic is added.
- Deliverables:
  - `src/lib/constants.ts`
  - `src/lib/config.ts`
  - `src/types/api.ts`
  - `src/types/credentials.ts`
  - config resolution for `--base-url`, env, stored credentials, and default fallback
- Why here:
  Commands, credential storage, and API transport all need shared types and config behavior.
- Usage:

```ts
const baseUrl = resolveBaseUrl({
  cliBaseUrl,
  envBaseUrl: process.env.INSIGHTA_API_BASE_URL,
  storedBaseUrl,
});
```

### 3. `feat: implement credential storage and validation`

- Purpose:
  Add persistent local session storage with schema validation and recovery guidance.
- Deliverables:
  - `src/lib/credentials-store.ts`
  - zod schema for stored credentials
  - create/read/write/delete helpers for `~/.insighta/credentials.json`
  - malformed-file error messaging
- Why here:
  Auth, token refresh, and protected commands need a reliable persisted session layer.
- Usage:

```ts
const credentials = await credentialsStore.read();
await credentialsStore.write(session);
await credentialsStore.delete();
```

### 4. `feat: add PKCE and OAuth callback server primitives`

- Purpose:
  Implement the low-level browser auth flow pieces without coupling them yet to the login command.
- Deliverables:
  - `src/lib/pkce.ts`
  - `src/lib/oauth.ts`
  - `src/lib/callback-server.ts`
  - state generation
  - code verifier and code challenge generation
  - localhost callback listener with timeout and one-shot shutdown behavior
- Why here:
  The login command should assemble tested primitives rather than own protocol details inline.
- Usage:

```ts
const { codeVerifier, codeChallenge } = createPkcePair();
const state = createOAuthState();
const callback = await startCallbackServer();
```

### 5. `feat: add base API client and error formatter`

- Purpose:
  Centralize HTTP transport, timeout handling, JSON parsing, and backend error propagation.
- Deliverables:
  - `src/lib/api-client.ts`
  - `src/lib/formatters/errors.ts`
  - helper methods for auth and profile endpoints
  - standard request timeout support
- Why here:
  Commands should call typed client methods instead of constructing ad hoc fetch requests.
- Usage:

```ts
const client = createApiClient({ baseUrl });
const user = await client.getCurrentUser();
```

### 6. `feat: add token manager for refresh and retry flow`

- Purpose:
  Handle access token expiry, refresh token rotation, and one-time retry on `401`.
- Deliverables:
  - `src/lib/token-manager.ts`
  - pre-request refresh with 60-second buffer
  - refresh endpoint integration
  - one retry path after unauthorized responses
  - persisted credential overwrite after successful refresh
- Why here:
  Protected commands should inherit auth behavior automatically rather than duplicate it.
- Usage:

```ts
const result = await tokenManager.withAuthenticatedRequest((accessToken) =>
  client.listProfiles(params, accessToken)
);
```

### 7. `feat: wire CLI command tree and global options`

- Purpose:
  Register the final CLI surface and shared options before adding each command implementation.
- Deliverables:
  - command registration in `src/cli.ts`
  - `login`, `logout`, `whoami`
  - `profiles list|get|search|create|export`
  - global `--base-url` support
- Why here:
  This creates the stable shell each feature commit plugs into.
- Usage:

```ts
program
  .name("insighta")
  .option("--base-url <url>")
  .command("login");
```

### 8. `feat: implement auth login flow`

- Purpose:
  Deliver the browser-based GitHub OAuth with PKCE flow end to end.
- Deliverables:
  - `src/commands/auth/login.ts`
  - browser launch using `open`
  - callback capture and state validation
  - backend token exchange
  - credential persistence
  - post-login user summary rendering
- Why here:
  Login depends on package setup, config, PKCE primitives, callback server, client transport, and credential writes.
- Usage:

```ts
await runLoginCommand({
  baseUrl,
});
```

### 9. `feat: implement auth logout and whoami commands`

- Purpose:
  Complete the auth command set with session deletion and current-user inspection.
- Deliverables:
  - `src/commands/auth/logout.ts`
  - `src/commands/auth/whoami.ts`
  - token refresh before `whoami`
  - user detail table rendering
- Why here:
  These commands are simpler once login, storage, and refresh logic exist.
- Usage:

```ts
await runLogoutCommand();
await runWhoAmICommand({ baseUrl });
```

### 10. `feat: add table and profile formatters`

- Purpose:
  Standardize CLI success output before adding the full profile command surface.
- Deliverables:
  - `src/lib/formatters/table.ts`
  - `src/lib/formatters/profile.ts`
  - shared rendering for profile rows, details, and pagination summaries
- Why here:
  Profile commands should reuse consistent output helpers instead of formatting inline.
- Usage:

```ts
renderProfilesTable(response.data);
renderProfileDetails(profile);
```

### 11. `feat: implement profiles list and get commands`

- Purpose:
  Add the first protected data retrieval commands using filters, auth, loaders, and tables.
- Deliverables:
  - `src/commands/profiles/list.ts`
  - `src/commands/profiles/get.ts`
  - query parameter mapping for list filters
  - pagination metadata output
  - loader lifecycle around requests
- Why here:
  `list` and `get` establish the pattern reused by the remaining profile commands.
- Usage:

```ts
await runProfilesListCommand({
  gender: "female",
  page: 1,
  limit: 20,
});
```

### 12. `feat: implement profiles search and create commands`

- Purpose:
  Add query-based lookup and profile creation with command-specific validation and messaging.
- Deliverables:
  - `src/commands/profiles/search.ts`
  - `src/commands/profiles/create.ts`
  - `q` query handling
  - `--name` enforcement
  - informational handling for `"Profile already exists"`
- Why here:
  These commands extend the same authenticated command path established by `list` and `get`.
- Usage:

```ts
await runProfilesSearchCommand("Ada");
await runProfilesCreateCommand({ name: "Ada Lovelace" });
```

### 13. `feat: implement CSV export command`

- Purpose:
  Add file output support for backend-generated CSV exports.
- Deliverables:
  - `src/commands/profiles/export.ts`
  - `src/lib/csv.ts`
  - timestamped filename generation
  - current-working-directory save behavior
  - export timeout handling
  - `--format csv` enforcement
- Why here:
  Export reuses list-style filters but adds filesystem output and longer-running request behavior.
- Usage:

```ts
await runProfilesExportCommand({
  format: "csv",
  country: "NG",
});
```

### 14. `feat: add CLI input validation and normalization`

- Purpose:
  Centralize user input checks so invalid flags fail before network requests are made.
- Deliverables:
  - validation for `gender`, `country`, `age-group`, `page`, `limit`, `min-age`, `max-age`, `sort-by`, and `order`
  - normalization to backend-compatible values
  - local rejection of `min-age > max-age`
- Why separate:
  Validation rules are easier to review and test when isolated from transport and command logic changes.
- Usage:

```ts
const params = validateAndNormalizeProfileFilters(rawOptions);
```

### 15. `test: cover auth, token refresh, profile commands, and export flow`

- Purpose:
  Lock in the behavior defined by the spec with unit, command, and integration-style tests.
- Deliverables:
  - unit tests for PKCE, credential store, token manager, query mapping, CSV naming, and error formatting
  - command tests for login, logout, whoami, list, get, search, create, and export
  - mock HTTP integration tests for refresh rotation and export persistence
- Why near the end:
  Most interfaces are stable by this point, which avoids rewriting test scaffolding repeatedly.
- Usage:

```sh
npm test
```

### 16. `chore: finalize help text, packaging, and install smoke checks`

- Purpose:
  Close the implementation with packaging validation and acceptance-criteria verification.
- Deliverables:
  - final help text review
  - install smoke test for `npm install -g .`
  - command discovery check for `insighta --help`
  - acceptance criteria pass-through against the spec
- Why last:
  Packaging and smoke checks only provide signal once the feature set is complete.
- Usage:

```sh
npm run build
npm install -g .
insighta --help
```

## Implementation Notes

- Keep each commit focused on one layer or behavior.
- Avoid mixing transport, formatting, and validation work in the same commit unless one directly blocks the other.
- If backend contracts change during implementation, update `src/types/api.ts` first, then adjust the affected command commits.
- Run tests starting with commit 15, but lightweight smoke checks should happen throughout earlier commits.

## Recommended Review Gates

- After commit 3:
  Confirm local credential format and recovery behavior.
- After commit 6:
  Confirm refresh semantics and retry policy.
- After commit 9:
  Confirm the full auth lifecycle is usable end to end.
- After commit 13:
  Confirm profile workflows are feature-complete.
- After commit 16:
  Confirm acceptance criteria and global installation behavior.
