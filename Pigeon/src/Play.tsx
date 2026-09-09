import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { FaArrowLeft, FaCirclePlay, FaRotateLeft } from "react-icons/fa6";
import "./styles/play.css";
import { addRecentlyWatched, savePlaybackPosition, getPlaybackPosition, type PlaybackPosition, fetchTitleInfo, fetchSeasonInfo } from "./api";
import type { MediaDetails } from "./responses";

/**
 * Base URL of the home media server. If the router/host IP ever changes,
 * this is the only place that needs to be updated.
 */
const MEDIA_SERVER_URL = "https://cinesrc.st";

const HIDE_CONTROLS_AFTER_MS = 3500;
const POSITION_SAVE_INTERVAL_MS = 5000;

/**
 * `type` is passed as a prop from the route element (mirroring
 * EpisodeDetails/MovieDetails), since it's a separate route per type:
 *   path: "play/TV/:id/:season/:episode"    -> <Play type="tv" />
 *   path: "play/Movie/:id"                  -> <Play type="movie" />
 * The id/season/episode still come from the URL via useParams.
 */
interface PlayProps {
  type: "tv" | "movie";
}

type PlayState =
  | {
      type: "movie";
      id: string;
    }
  | {
      type: "tv";
      id: string;
      season: number;
      episode: number;
    };

interface ResumePromptState {
  show: boolean;
  position: PlaybackPosition;
  mediaTitle: string;
}

/** Reads and validates the route params, memoized so the returned object's
 * reference only changes when the underlying params actually change —
 * otherwise every re-render (e.g. from revealControls) would produce a new
 * object and re-trigger effects keyed off it, causing the fullscreen
 * flicker this was built to avoid. */
function usePlayState(type: "tv" | "movie"): PlayState | null {
  const { id, season, episode } = useParams<{
    id: string;
    season?: string;
    episode?: string;
  }>();

  return useMemo(() => {
    if (!id) return null;

    if (type === "movie") {
      return { type: "movie", id };
    }

    if (season && episode) {
      return { type: "tv", id, season: Number(season), episode: Number(episode) };
    }

    return null;
  }, [type, id, season, episode]);
}

/** Builds the embed URL for the media server based on the route params. */
function buildEmbedSrc(state: PlayState, startTime?: number): string {
  if (state.type === "movie") {
    const url = `${MEDIA_SERVER_URL}/embed/movie/${state.id}`;
    if (startTime !== undefined && startTime > 0) {
      return `${url}?t=${Math.floor(startTime)}&continueprompt=false`;
    }
    return url;
  }
  const url = `${MEDIA_SERVER_URL}/embed/tv/${state.id}?s=${state.season}&e=${state.episode}`;
  if (startTime !== undefined && startTime > 0) {
    return `${url}&t=${Math.floor(startTime)}&continueprompt=false`;
  }
  return url;
}

export default function Play({ type }: PlayProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const playState = usePlayState(type);

  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [resumePrompt, setResumePrompt] = useState<ResumePromptState | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [mediaTitle, setMediaTitle] = useState<string>("");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const positionSaveIntervalRef = useRef<number | null>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const hasShownResumePromptRef = useRef(false);
  const autoResumePositionRef = useRef<PlaybackPosition | null>(null);

  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const scheduleHide = () => {
    clearHideTimeout();
    hideTimeoutRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, HIDE_CONTROLS_AFTER_MS);
  };

  const revealControls = () => {
    setControlsVisible(true);
    scheduleHide();
  };

  // Send command to iframe
  const sendCommand = useCallback((command: string, args: unknown[] = []) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'cinesrc:command',
        command,
        args
      }, MEDIA_SERVER_URL);
    }
  }, []);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== MEDIA_SERVER_URL) return;
      
      const { type: msgType, ...data } = event.data;
      
      switch (msgType) {
        case 'cinesrc:ready':
          console.log('Player ready');
          // Get duration when player is ready
          sendCommand('getDuration');
          break;
        case 'cinesrc:timeupdate':
          setCurrentTime(data.currentTime);
          break;
        case 'cinesrc:loadedmetadata':
          setDuration(data.duration);
          break;
        case 'cinesrc:response':
          if (data.command === 'getDuration') {
            setDuration(data.result);
          } else if (data.command === 'getCurrentTime') {
            setCurrentTime(data.result);
          }
          break;
        case 'cinesrc:ended':
          // Mark as completed
          if (playState) {
            const completedPosition: PlaybackPosition = {
              id: Number(playState.id),
              mediaType: playState.type,
              season: playState.type === 'tv' ? playState.season : undefined,
              episode: playState.type === 'tv' ? playState.episode : undefined,
              currentTime: duration,
              duration,
              lastUpdated: Date.now(),
              completed: true
            };
            savePlaybackPosition(completedPosition);
          }
          break;
        case 'cinesrc:error':
          console.error('Player error:', data.error);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [playState, duration, sendCommand]);

  // Save playback position periodically
  useEffect(() => {
    if (!playState || duration === 0) return;

    const savePosition = () => {
      if (currentTime > 0 && currentTime !== lastSavedTimeRef.current) {
        const position: PlaybackPosition = {
          id: Number(playState.id),
          mediaType: playState.type,
          season: playState.type === 'tv' ? playState.season : undefined,
          episode: playState.type === 'tv' ? playState.episode : undefined,
          currentTime,
          duration,
          lastUpdated: Date.now(),
          completed: currentTime / duration >= 0.9
        };
        savePlaybackPosition(position);
        lastSavedTimeRef.current = currentTime;
      }
    };

    positionSaveIntervalRef.current = window.setInterval(savePosition, POSITION_SAVE_INTERVAL_MS);
    
    return () => {
      if (positionSaveIntervalRef.current) {
        window.clearInterval(positionSaveIntervalRef.current);
      }
      // Save final position on unmount
      savePosition();
    };
  }, [playState, currentTime, duration]);

  // Check for resume position on mount
  useEffect(() => {
    if (!playState || hasShownResumePromptRef.current) return;
    
    const savedPosition = getPlaybackPosition(
      Number(playState.id),
      playState.type,
      playState.type === 'tv' ? playState.season : undefined,
      playState.type === 'tv' ? playState.episode : undefined
    );

    if (savedPosition && savedPosition.currentTime > 30 && !savedPosition.completed) {
      // Check if we should auto-resume (via URL param) or show prompt
      const autoResume = searchParams.get('resume') === 'true';
      
      if (autoResume) {
        // Store position for embed URL
        autoResumePositionRef.current = savedPosition;
        hasShownResumePromptRef.current = true;
      } else {
        setResumePrompt({
          show: true,
          position: savedPosition,
          mediaTitle: mediaTitle || `Episode ${playState.type === 'tv' ? playState.episode : ''} ${playState.type === 'tv' ? `S${playState.season}` : ''}`.trim()
        });
        hasShownResumePromptRef.current = true;
      }
    } else {
      hasShownResumePromptRef.current = true;
    }
  }, [playState, mediaTitle, searchParams]);

  // Add to recently watched when playback starts (with full details including poster)
  useEffect(() => {
    if (!playState || !mediaTitle) return;
    
    const loadFullDetails = async () => {
      try {
        const details = await fetchTitleInfo(playState.type, Number(playState.id));
        const fullMediaInfo: MediaDetails = {
          id: details.id,
          title: mediaTitle,
          overview: details.overview,
          poster_path: details.poster_path,
          backdrop_path: details.backdrop_path,
          release_date: details.release_date,
          vote_average: details.vote_average,
          genres: details.genres,
          runtime: details.runtime
        };
        
        addRecentlyWatched(fullMediaInfo, playState.type, {
          currentTime,
          duration,
          completed: currentTime > 0 && duration > 0 && currentTime / duration >= 0.9,
          season: playState.type === 'tv' ? playState.season : undefined,
          episode: playState.type === 'tv' ? playState.episode : undefined
        });
      } catch (error) {
        console.error('Failed to fetch media details for recently watched:', error);
      }
    };
    
    loadFullDetails();
  }, [playState, mediaTitle, currentTime, duration]);

  // Auto-hide the back button/title overlay after a period of inactivity
  useEffect(() => {
    scheduleHide();
    return clearHideTimeout;
  }, []);

  // Fetch media title for recently watched
  useEffect(() => {
    if (!playState) return;
    
    const loadTitle = async () => {
      try {
        const details = await fetchTitleInfo(playState.type, Number(playState.id));
        if (playState.type === 'tv' && playState.season && playState.episode) {
          // For TV, find the specific episode title
          const seasonDetails = await fetchSeasonInfo(Number(playState.id), playState.season);
          const episode = seasonDetails.episodes.find(e => e.episode_number === playState.episode);
          if (episode) {
            setMediaTitle(`${details.title} - S${playState.season}E${playState.episode}: ${episode.name}`);
          } else {
            setMediaTitle(details.title);
          }
        } else {
          setMediaTitle(details.title);
        }
      } catch (error) {
        console.error('Failed to fetch media title:', error);
        setMediaTitle(`Unknown ${playState.type === 'tv' ? 'Show' : 'Movie'}`);
      }
    };
    
    loadTitle();
  }, [playState]);

  // Focus the back button as soon as the player is on screen
  useEffect(() => {
    if (!playState) return;
    const timer = window.setTimeout(() => backButtonRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [playState]);

  // Global shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      revealControls();

      switch (e.key) {
        case "Escape":
        case "BrowserBack":
          e.preventDefault();
          if (resumePrompt?.show) {
            setResumePrompt(null);
          } else {
            navigate(-1);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resumePrompt?.show, navigate]);

  if (!playState) {
    return <div className="loading-screen">Error: Invalid play URL</div>;
  }

  const embedSrc = buildEmbedSrc(playState, resumePrompt?.show ? undefined : (resumePrompt ? resumePrompt.position.currentTime : 0));

  const handleResume = () => {
    if (resumePrompt) {
      setResumePrompt(prev => prev ? { ...prev, show: false } : null);
    }
  };

  const handleRestart = () => {
    setResumePrompt(null);
    // Reload iframe from beginning
    if (iframeRef.current) {
      iframeRef.current.src = buildEmbedSrc(playState, 0);
    }
  };

  if (!playState) {
    return <div className="loading-screen">Error: Invalid play URL</div>;
  }

  return (
    <div
      className={`player${controlsVisible ? "" : " player--controls-hidden"}`}
      onMouseMove={revealControls}
    >
      {!iframeLoaded && (
        <div className="player__buffering">
          <span className="loading-spinner" />
          <p>Loading...</p>
        </div>
      )}

      <iframe
        ref={iframeRef}
        className="player__frame"
        src={embedSrc}
        width="100%"
        height="100%"
        frameBorder="0"
        allow="autoplay; picture-in-picture"
        onLoad={() => setIframeLoaded(true)}
      />

      <div className="player__scrim player__scrim--top" />

      <div className="player__top-bar">
        <button
          ref={backButtonRef}
          className="player__back-button"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <FaArrowLeft />
        </button>
      </div>

      {resumePrompt?.show && (
        <div className="resume-prompt-overlay">
          <div className="resume-prompt">
            <div className="resume-prompt-content">
              <h2>Resume Watching?</h2>
              <p className="resume-prompt-title">{resumePrompt.mediaTitle}</p>
              <div className="resume-prompt-time">
                <span>Last watched: {formatTime(resumePrompt.position.currentTime)}</span>
                <span>of {formatTime(resumePrompt.position.duration)}</span>
              </div>
            </div>
            <div className="resume-prompt-actions">
              <button
                className="resume-prompt-button resume-prompt-button--restart"
                onClick={handleRestart}
              >
                <FaRotateLeft />
                <span>Restart</span>
              </button>
              <button
                className="resume-prompt-button resume-prompt-button--resume"
                onClick={handleResume}
                autoFocus
              >
                <FaCirclePlay />
                <span>Resume</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}