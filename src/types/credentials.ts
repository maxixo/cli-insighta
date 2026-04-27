import { z } from "zod";

export const storedCredentialUserSchema = z.object({
  id: z.string().min(1, "Credential user id is required."),
  github_id: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
}).strict();

export const storedCredentialsSchema = z.object({
  base_url: z.string().url("Stored base_url must be a valid URL."),
  token_type: z.literal("Bearer"),
  access_token: z.string().min(1, "Stored access_token is required."),
  refresh_token: z.string().min(1, "Stored refresh_token is required."),
  expires_at: z.string().datetime("Stored expires_at must be an ISO datetime."),
  user: storedCredentialUserSchema,
}).strict();

export type StoredCredentialUser = z.infer<typeof storedCredentialUserSchema>;
export type StoredCredentials = z.infer<typeof storedCredentialsSchema>;
