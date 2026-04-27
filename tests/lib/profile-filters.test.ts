import { describe, expect, it } from "vitest";

import {
  buildProfileListParams,
  validateAndNormalizeProfileFilters,
} from "../../src/lib/profile-filters.js";

describe("profile filters", () => {
  it("normalizes filter aliases into backend-compatible values", () => {
    const normalized = validateAndNormalizeProfileFilters({
      gender: " FEMALE ",
      country: "ng",
      ageGroup: "young adult",
      minAge: "18",
      maxAge: "35",
      sortBy: "gender-probability",
      order: "DESC",
      page: "2",
      limit: "50",
    });

    expect(normalized).toEqual({
      gender: "female",
      country: "NG",
      ageGroup: "young_adult",
      minAge: 18,
      maxAge: 35,
      sortBy: "gender_probability",
      order: "desc",
      page: 2,
      limit: 50,
    });
    expect(buildProfileListParams(normalized)).toEqual({
      gender: "female",
      country_id: "NG",
      age_group: "young_adult",
      min_age: 18,
      max_age: 35,
      sort_by: "gender_probability",
      order: "desc",
      page: 2,
      limit: 50,
    });
  });

  it("rejects age ranges where min-age is greater than max-age", () => {
    expect(() =>
      validateAndNormalizeProfileFilters({
        minAge: "50",
        maxAge: "20",
      }),
    ).toThrow("Invalid age range: --min-age cannot be greater than --max-age.");
  });

  it("rejects invalid country codes", () => {
    expect(() =>
      validateAndNormalizeProfileFilters({
        country: "NGA",
      }),
    ).toThrow(
      "Invalid value for --country: expected a two-letter country code.",
    );
  });
});
