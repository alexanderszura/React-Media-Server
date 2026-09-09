import { useNavigate } from "react-router-dom";
import type { MediaSearchResult } from "../responses";
import { mediaImagePath } from "../api";
import { FaClockRotateLeft } from "react-icons/fa6";
import type { RecentlyWatchedItem } from "../api";
import "./mediaCard.css";

interface MediaCardProps {
  media: MediaSearchResult;
  recentlyWatched?: boolean;
  playbackPosition?: RecentlyWatchedItem;
}

export function MediaCard({ media, recentlyWatched = false, playbackPosition }: MediaCardProps) {
  const navigate = useNavigate();

  const imageUrl = mediaImagePath(media.poster_path);
  const typeLabel = media.media_type === "tv" ? "TV" : "Movie";

  const hasProgress = playbackPosition?.duration && playbackPosition.duration > 0;
  const currentTime = playbackPosition?.currentTime || 0;
  const duration = playbackPosition?.duration || 0;
  const progressPercent = hasProgress ? Math.min(100, Math.round(currentTime / duration * 100)) : 0;
  const isCompleted = playbackPosition?.completed;

  return (
    <div className={`item-card${recentlyWatched ? " item-card--recent" : ""}`}>
      <div
        className="item-card__poster"
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/title/${media.media_type}/${media.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            navigate(`/title/${media.media_type}/${media.id}`);
          }
        }}
      >
        <img src={imageUrl} alt={media.title} />
        <span className="item-card__type">{typeLabel}</span>
        {recentlyWatched && (
          <div className="item-card__recent-badge">
            <FaClockRotateLeft />
            <span>{isCompleted ? "Completed" : "Continue"}</span>
          </div>
        )}
      </div>
      <h3 className="item-card__title">{media.title}</h3>
      <p className="item-card__date">{media.release_date}</p>
      {hasProgress && (
        <div className="item-card__progress">
          <div className="item-card__progress-bar">
            <div 
              className={`item-card__progress-fill${isCompleted ? " item-card__progress-fill--completed" : ""}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="item-card__progress-text">
            {isCompleted ? "Completed" : `${progressPercent}% watched`}
          </span>
        </div>
      )}
    </div>
  );
}