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

const MEDIA_BASE_URL = "https://api.themoviedb.org/3";
const SEARCH_ENDPOINT = "search/multi";
const PUBLIC_API_KEY = "54e00466a09676df57ba51c4ca30b1a6";

// ============================================================
// Helpers
// ============================================================

function completeUrl(
  endpoint: string,
  params: Record<string, string | number> = {},
): string {
  const url = new URL(`${MEDIA_BASE_URL}/${endpoint}`);

  url.searchParams.set("api_key", PUBLIC_API_KEY);
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

// ============================================================
// Local Storage
// ============================================================

// Recently Watched - last 10 media items
export interface RecentlyWatchedItem {
  id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path?: string | null;
  release_date?: string | null;
  vote_average?: number;
  lastWatched: number;
  // Playback progress
  currentTime?: number;
  duration?: number;
  completed?: boolean;
  season?: number;
  episode?: number;
}

export const addRecentlyWatched = (mediaItem: MediaDetails, mediaType: "movie" | "tv", playbackPosition?: { currentTime: number; duration: number; completed: boolean; season?: number; episode?: number }) => {
  const existing = JSON.parse(localStorage.getItem('recentlyWatched') || '[]') as RecentlyWatchedItem[];
  
  const newItem: RecentlyWatchedItem = {
    id: mediaItem.id,
    media_type: mediaType,
    title: mediaItem.title,
    poster_path: mediaItem.poster_path,
    release_date: mediaItem.release_date,
    vote_average: mediaItem.vote_average,
    lastWatched: Date.now(),
    currentTime: playbackPosition?.currentTime,
    duration: playbackPosition?.duration,
    completed: playbackPosition?.completed,
    season: playbackPosition?.season,
    episode: playbackPosition?.episode
  };

  // Filter out duplicates and keep top 10 recent entries
  const updated = [
    newItem,
    ...existing.filter((item: RecentlyWatchedItem) => item.id !== mediaItem.id)
  ].slice(0, 10);

  localStorage.setItem('recentlyWatched', JSON.stringify(updated));
};

export const getRecentlyWatched = (): RecentlyWatchedItem[] => {
  return JSON.parse(localStorage.getItem('recentlyWatched') || '[]') as RecentlyWatchedItem[];
};

// TV Progress - save last watched season/episode
export interface TVProgress {
  showId: number;
  season: number;
  episode: number;
  episodeName: string;
  lastWatched: number;
}

export const saveTVProgress = (showId: number, season: number, episode: number, episodeName: string) => {
  const existing = JSON.parse(localStorage.getItem('tvProgress') || '[]') as TVProgress[];
  
  const newProgress: TVProgress = {
    showId,
    season,
    episode,
    episodeName,
    lastWatched: Date.now()
  };

  const updated = [
    newProgress,
    ...existing.filter((item: TVProgress) => item.showId !== showId)
  ];

  localStorage.setItem('tvProgress', JSON.stringify(updated));
};

export const getTVProgress = (showId: number): TVProgress | undefined => {
  const all = JSON.parse(localStorage.getItem('tvProgress') || '[]') as TVProgress[];
  return all.find(item => item.showId === showId);
};

export const getAllTVProgress = (): TVProgress[] => {
  return JSON.parse(localStorage.getItem('tvProgress') || '[]') as TVProgress[];
};

// Playback Position - save resume time for movies and episodes
export interface PlaybackPosition {
  id: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  currentTime: number;
  duration: number;
  lastUpdated: number;
  completed: boolean;
}

export const savePlaybackPosition = (position: PlaybackPosition) => {
  const existing = JSON.parse(localStorage.getItem('playbackPositions') || '[]') as PlaybackPosition[];
  
  // Mark as completed if watched 90% or more
  const isCompleted = position.currentTime / position.duration >= 0.9;
  
  const newPosition: PlaybackPosition = {
    ...position,
    completed: isCompleted,
    lastUpdated: Date.now()
  };

  const updated = [
    newPosition,
    ...existing.filter((item: PlaybackPosition) => 
      !(item.id === position.id && item.mediaType === position.mediaType && item.season === position.season && item.episode === position.episode)
    )
  ];

  localStorage.setItem('playbackPositions', JSON.stringify(updated));
};

export const getPlaybackPosition = (id: number, mediaType: "movie" | "tv", season?: number, episode?: number): PlaybackPosition | undefined => {
  const all = JSON.parse(localStorage.getItem('playbackPositions') || '[]') as PlaybackPosition[];
  return all.find(item => 
    item.id === id && 
    item.mediaType === mediaType && 
    item.season === season && 
    item.episode === episode
  );
};
