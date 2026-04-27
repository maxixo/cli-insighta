export type ApiSuccessResponse<TData> = {
  status: "success";
  data: TData;
  message?: string;
};

export type ApiErrorResponse = {
  status: "error";
  message: string;
  data?: unknown;
};

export type ApiResponse<TData> = ApiSuccessResponse<TData> | ApiErrorResponse;

export type TokenType = "Bearer";

export type User = {
  id: string;
  github_id?: string;
  username?: string;
  name?: string;
  email?: string;
};

export type AuthStartData = {
  authorization_url: string;
  state: string;
  redirect_uri: string;
};

export type AuthStartResponse = ApiSuccessResponse<AuthStartData>;

export type AuthStartRequest = {
  state: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method?: "S256";
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  token_type: TokenType;
  expires_in: number;
  user: User;
};

export type AuthSessionResponse = ApiSuccessResponse<AuthSession>;

export type RefreshedSession = {
  access_token: string;
  refresh_token: string;
  token_type: TokenType;
  expires_in: number;
};

export type RefreshSessionResponse = ApiSuccessResponse<RefreshedSession>;

export type RefreshTokenRequest = {
  refresh_token: string;
};

export type LogoutRequest = {
  refresh_token: string;
};

export type LogoutResponse = ApiSuccessResponse<{
  logged_out: boolean;
}>;

export type GithubCallbackExchangeRequest = {
  code: string;
  state: string;
  code_verifier: string;
  redirect_uri: string;
};

export type ProfileSortField = "age" | "created_at" | "gender_probability";
export type SortOrder = "asc" | "desc";

export type ProfileListParams = {
  gender?: string;
  country_id?: string;
  age_group?: string;
  min_age?: number;
  max_age?: number;
  sort_by?: ProfileSortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
};

export type ProfileSearchParams = ProfileListParams;

export type Profile = {
  id: string;
  name: string;
  gender?: string | null;
  gender_probability?: number | null;
  age?: number | null;
  age_group?: string | null;
  country_id?: string | null;
  country_name?: string | null;
  country_probability?: number | null;
  created_at: string;
};

export type PaginationLinks = {
  self: string;
  next: string | null;
  prev: string | null;
};

export type PaginatedProfilesResponse = {
  status: "success";
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  links: PaginationLinks;
  data: Profile[];
};

export type CurrentUserResponse = ApiSuccessResponse<User>;
export type ListProfilesResponse = PaginatedProfilesResponse;
export type SearchProfilesResponse = PaginatedProfilesResponse;

export type ProfileCreateRequest = {
  name: string;
};

export type CreateProfileResponse = ApiSuccessResponse<Profile>;
