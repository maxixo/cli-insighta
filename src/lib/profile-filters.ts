import type {
  ProfileListParams,
  ProfileSortField,
  SortOrder,
} from "../types/api.js";

const PROFILE_SORT_FIELDS = [
  "age",
  "created_at",
  "gender_probability",
] as const satisfies readonly ProfileSortField[];

const PROFILE_SORT_FIELD_ALIASES = {
  age: "age",
  created_at: "created_at",
  "created-at": "created_at",
  gender_probability: "gender_probability",
  "gender-probability": "gender_probability",
} as const satisfies Record<string, ProfileSortField>;

const PROFILE_ORDER_VALUES = ["asc", "desc"] as const satisfies readonly SortOrder[];

const PROFILE_GENDER_VALUES = [
  "female",
  "male",
  "nonbinary",
  "unknown",
] as const;

const PROFILE_AGE_GROUP_VALUES = [
  "child",
  "teen",
  "young_adult",
  "adult",
  "senior",
] as const;

const PROFILE_AGE_GROUP_ALIASES = {
  child: "child",
  children: "child",
  teen: "teen",
  teens: "teen",
  teenager: "teen",
  teenagers: "teen",
  young_adult: "young_adult",
  "young-adult": "young_adult",
  "young adult": "young_adult",
  adult: "adult",
  adults: "adult",
  senior: "senior",
  seniors: "senior",
} as const;

export type RawProfileFilterOptions = {
  gender?: string;
  country?: string;
  ageGroup?: string;
  minAge?: string | number;
  maxAge?: string | number;
  sortBy?: string;
  order?: string;
  page?: string | number;
  limit?: string | number;
};

export type NormalizedProfileFilterOptions = {
  gender?: string;
  country?: string;
  ageGroup?: string;
  minAge?: number;
  maxAge?: number;
  sortBy?: ProfileSortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
};

export function validateAndNormalizeProfileFilters(
  rawOptions: RawProfileFilterOptions,
): NormalizedProfileFilterOptions {
  const normalizedOptions: NormalizedProfileFilterOptions = {
    gender: normalizeGender(rawOptions.gender),
    country: normalizeCountry(rawOptions.country),
    ageGroup: normalizeAgeGroup(rawOptions.ageGroup),
    minAge: parseIntegerOption("min-age", rawOptions.minAge),
    maxAge: parseIntegerOption("max-age", rawOptions.maxAge),
    sortBy: normalizeSortBy(rawOptions.sortBy),
    order: normalizeOrder(rawOptions.order),
    page: parseIntegerOption("page", rawOptions.page),
    limit: parseIntegerOption("limit", rawOptions.limit),
  };

  if (
    normalizedOptions.minAge !== undefined &&
    normalizedOptions.maxAge !== undefined &&
    normalizedOptions.minAge > normalizedOptions.maxAge
  ) {
    throw new Error(
      "Invalid age range: --min-age cannot be greater than --max-age.",
    );
  }

  return normalizedOptions;
}

export function buildProfileListParams(
  options: NormalizedProfileFilterOptions,
): ProfileListParams {
  return {
    gender: options.gender,
    country_id: options.country,
    age_group: options.ageGroup,
    min_age: options.minAge,
    max_age: options.maxAge,
    sort_by: options.sortBy,
    order: options.order,
    page: options.page,
    limit: options.limit,
  };
}

function normalizeGender(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (
    PROFILE_GENDER_VALUES.includes(
      normalizedValue as (typeof PROFILE_GENDER_VALUES)[number],
    )
  ) {
    return normalizedValue;
  }

  throw new Error(
    `Invalid value for --gender: expected one of ${PROFILE_GENDER_VALUES.join(", ")}.`,
  );
}

function normalizeCountry(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim().toUpperCase();

  if (/^[A-Z]{2}$/u.test(normalizedValue)) {
    return normalizedValue;
  }

  throw new Error(
    "Invalid value for --country: expected a two-letter country code.",
  );
}

function normalizeAgeGroup(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim().toLowerCase().replace(/\s+/gu, " ");
  const mappedValue =
    PROFILE_AGE_GROUP_ALIASES[
      normalizedValue as keyof typeof PROFILE_AGE_GROUP_ALIASES
    ];

  if (mappedValue) {
    return mappedValue;
  }

  throw new Error(
    `Invalid value for --age-group: expected one of ${PROFILE_AGE_GROUP_VALUES.join(", ")}.`,
  );
}

function normalizeSortBy(
  value: string | undefined,
): ProfileSortField | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim().toLowerCase();
  const mappedValue =
    PROFILE_SORT_FIELD_ALIASES[
      normalizedValue as keyof typeof PROFILE_SORT_FIELD_ALIASES
    ];

  if (mappedValue) {
    return mappedValue;
  }

  throw new Error(
    `Invalid value for --sort-by: expected one of ${PROFILE_SORT_FIELDS.join(", ")}.`,
  );
}

function normalizeOrder(value: string | undefined): SortOrder | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (PROFILE_ORDER_VALUES.includes(normalizedValue as SortOrder)) {
    return normalizedValue as SortOrder;
  }

  throw new Error(
    `Invalid value for --order: expected one of ${PROFILE_ORDER_VALUES.join(", ")}.`,
  );
}

function parseIntegerOption(
  optionName: string,
  value: string | number | undefined,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`Invalid value for --${optionName}: expected an integer.`);
    }

    return value;
  }

  if (!/^-?\d+$/u.test(value)) {
    throw new Error(`Invalid value for --${optionName}: expected an integer.`);
  }

  return Number.parseInt(value, 10);
}
