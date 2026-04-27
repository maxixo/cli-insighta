import type { ListProfilesResponse, Profile } from "../../types/api.js";
import { renderKeyValueTable, renderTable } from "./table.js";

type PaginatedProfileSummary = Pick<
  ListProfilesResponse,
  "page" | "limit" | "total" | "total_pages" | "links" | "data"
>;

const PROFILE_TABLE_HEAD = [
  "ID",
  "Name",
  "Gender",
  "Gender %",
  "Age",
  "Age Group",
  "Country",
  "Country %",
  "Created At",
] as const;

export function renderProfilesTable(profiles: readonly Profile[]): string {
  if (profiles.length === 0) {
    return "No profiles found.";
  }

  return renderTable({
    head: PROFILE_TABLE_HEAD,
    rows: profiles.map((profile) => [
      profile.id,
      profile.name,
      formatProfileText(profile.gender),
      formatProbability(profile.gender_probability),
      formatNullableNumber(profile.age),
      formatProfileText(profile.age_group),
      formatCountry(profile),
      formatProbability(profile.country_probability),
      formatTimestamp(profile.created_at),
    ]),
  });
}

export function renderProfileDetails(profile: Profile): string {
  return renderKeyValueTable([
    ["ID", profile.id],
    ["Name", profile.name],
    ["Gender", formatProfileText(profile.gender)],
    ["Gender Probability", formatProbability(profile.gender_probability)],
    ["Age", formatNullableNumber(profile.age)],
    ["Age Group", formatProfileText(profile.age_group)],
    ["Country Code", formatProfileText(profile.country_id)],
    ["Country Name", formatProfileText(profile.country_name)],
    ["Country Probability", formatProbability(profile.country_probability)],
    ["Created At", formatTimestamp(profile.created_at)],
  ]);
}

export function renderPaginationSummary(
  response: PaginatedProfileSummary,
): string {
  return renderKeyValueTable([
    ["Page", response.page],
    ["Limit", response.limit],
    ["Results on Page", response.data.length],
    ["Total Results", response.total],
    ["Total Pages", response.total_pages],
    ["Self", response.links.self],
    ["Next", response.links.next],
    ["Previous", response.links.prev],
  ]);
}

function formatCountry(profile: Profile): string {
  if (profile.country_id && profile.country_name) {
    return `${profile.country_id} (${profile.country_name})`;
  }

  return formatProfileText(profile.country_id ?? profile.country_name);
}

function formatProbability(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(2)}%`;
}

function formatNullableNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return String(value);
}

function formatProfileText(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  return value;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
}
