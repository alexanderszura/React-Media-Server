import {
  type ApiMediaDetails,
  type MediaDetails,
  type MediaSearchResult,
  type SearchResponse,
  type SeasonDetails,
  type SeasonDetailsResponse,

  toMediaDetails,
  toMediaSearchResult,
  toSeasonDetails,
} from "./responses";

import { MOVIE_DB_API_KEY } from "./secrets";


// ============================================================
// Helpers
// ============================================================

function completeUrl(
  endpoint: string,
  params: Record<string, string | number> = {},
): string {
  const url = new URL(`${MEDIA_BASE_URL}/${endpoint}`);

  url.searchParams.set("api_key", MOVIE_DB_API_KEY);
  url.searchParams.set("language", "en-US");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function fetchJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}


// ============================================================
// Search
// ============================================================

const MEDIA_BASE_URL = "https://api.themoviedb.org/3";
const SEARCH_ENDPOINT = "search/multi";

export async function fetchSearchedMedia(
  query: string,
): Promise<MediaSearchResult[]> {
  const response = await fetchJson<SearchResponse>(
    completeUrl(SEARCH_ENDPOINT, { query }),
  );

  return response.results
    .filter(
      (result) =>
        result.media_type === "movie" ||
        result.media_type === "tv",
    )
    .map(toMediaSearchResult);
}


// ============================================================
// Media Details
// ============================================================

export async function fetchTitleInfo(
  mediaType: "movie" | "tv",
  id: number,
): Promise<MediaDetails> {
  const response = await fetchJson<ApiMediaDetails>(
    completeUrl(`${mediaType}/${id}`),
  );

  return toMediaDetails(response);
}

export function mediaImagePath(path: string | undefined | null, nullValue="noImage.jpg"): string {
  if (!path) {
    return nullValue;
  }

  return `https://image.tmdb.org/t/p/w500${path}`;
}

// ============================================================
// Season Details
// ============================================================

export async function fetchSeasonInfo(
  id: number,
  seasonNumber: number,
): Promise<SeasonDetails> {
  const response = await fetchJson<SeasonDetailsResponse>(
    completeUrl(`tv/${id}/season/${seasonNumber}`),
  );

  return toSeasonDetails(response);
}