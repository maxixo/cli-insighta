import type { TokenType, User } from "./api.js";

export type StoredCredentials = {
  base_url: string;
  token_type: TokenType;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user: User;
};
