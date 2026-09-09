import { useLoaderData, useNavigate } from "react-router-dom";
import { fetchSeasonInfo, mediaImagePath, getTVProgress, saveTVProgress, getPlaybackPosition } from "../api";
import type { MediaDetails, SeasonDetails, SeasonEpisode } from "../responses";
import { useEffect, useState, useMemo } from "react";
import { EpisodeCard } from "../components/episodeCard";
import { FaArrowLeft, FaCirclePlay, FaForward, FaRotateLeft } from "react-icons/fa6";
import "../styles/detail.css";

export default function TVDetails() {
    const titleInfo = useLoaderData() as MediaDetails;
    const navigate = useNavigate();
    
    // Get saved progress to determine initial season
    const savedProgress = getTVProgress(titleInfo.id);
    const initialSeason = savedProgress?.season ?? 1;
    
    const [season, setSeason] = useState<SeasonDetails | null>(null);
    const [seasonNumber, setSeasonNumber] = useState(initialSeason);

    // Load season data when seasonNumber changes
    useEffect(() => {
        const load = async () => {
            const seasonData = await fetchSeasonInfo(titleInfo.id, seasonNumber);
            setSeason(seasonData);
        };
        load();
    }, [titleInfo.id, seasonNumber]);

    const seasonCount = titleInfo.seasons?.length ?? 0;
    const image = mediaImagePath(titleInfo.poster_path ?? titleInfo.backdrop_path);

    // Helper to find or construct episode info
    const findOrConstructEpisode = useMemo(() => {
        return (seasonNum: number, episodeNum: number): SeasonEpisode | null => {
            if (season && season.season_number === seasonNum) {
                return season.episodes.find(e => e.episode_number === episodeNum) || null;
            }
            const seasons = titleInfo.seasons;
            if (!seasons) return null;
            const seasonInfo = seasons.find(s => s.season_number === seasonNum);
            if (!seasonInfo) return null;
            
            return {
                id: 0,
                episode_number: episodeNum,
                episode_type: 'standard',
                name: `Episode ${episodeNum}`,
                overview: '',
                runtime: undefined,
                season_number: seasonNum,
                show_id: titleInfo.id,
                still_path: null,
                vote_average: 0,
            };
        };
    }, [season, titleInfo]);

    // Get the next episode for a SPECIFIC season
    // Returns: { episode, isCurrent (in-progress), label }
    const getNextEpisodeForSeason = useMemo(() => {
        return (targetSeasonNum: number): { episode: SeasonEpisode | null; isCurrent: boolean; label: string } => {
            if (!titleInfo.seasons) return { episode: null, isCurrent: false, label: 'Next Episode' };
            
            const targetSeasonInfo = titleInfo.seasons.find(s => s.season_number === targetSeasonNum);
            if (!targetSeasonInfo) return { episode: null, isCurrent: false, label: 'Next Episode' };
            
            // Check each episode in this season for playback progress
            // Find the first episode that has progress but isn't completed
            for (let epNum = 1; epNum <= targetSeasonInfo.episode_count; epNum++) {
                const progress = getPlaybackPosition(titleInfo.id, "tv", targetSeasonNum, epNum);
                if (progress && progress.currentTime > 30 && !progress.completed) {
                    const ep = findOrConstructEpisode(targetSeasonNum, epNum);
                    if (ep) return { episode: ep, isCurrent: true, label: 'Continue Watching' };
                }
            }
            
            // No in-progress episode - find first unwatched episode in this season
            for (let epNum = 1; epNum <= targetSeasonInfo.episode_count; epNum++) {
                const progress = getPlaybackPosition(titleInfo.id, "tv", targetSeasonNum, epNum);
                if (!progress || !progress.completed) {
                    const ep = findOrConstructEpisode(targetSeasonNum, epNum);
                    if (ep) return { episode: ep, isCurrent: false, label: 'Next Episode' };
                }
            }
            
            // All episodes in this season completed - check next season
            let nextSeasonNum = targetSeasonNum + 1;
            const nextSeasonInfo = titleInfo.seasons.find(s => s.season_number === nextSeasonNum);
            if (!nextSeasonInfo) {
                // Last season - loop to first season
                nextSeasonNum = titleInfo.seasons[0]?.season_number ?? 1;
            }
            
            const firstEp = findOrConstructEpisode(nextSeasonNum, 1);
            if (firstEp) {
                const isNextSeason = nextSeasonNum !== targetSeasonNum;
                return { 
                    episode: firstEp, 
                    isCurrent: false, 
                    label: isNextSeason ? `Next Season (${titleInfo.seasons?.find(s => s.season_number === nextSeasonNum)?.name})` : 'Next Episode' 
                };
            }
            
            return { episode: null, isCurrent: false, label: 'Next Episode' };
        };
    }, [titleInfo, findOrConstructEpisode]);

    // Banner episode is based on CURRENTLY SELECTED SEASON (seasonNumber from dropdown)
    const { episode: bannerEpisode, isCurrent: isBannerCurrent, label: bannerLabel } = useMemo(() => {
        return getNextEpisodeForSeason(seasonNumber);
    }, [seasonNumber, getNextEpisodeForSeason]);

    // Check for saved playback position for the banner episode
    const bannerEpisodeProgress = bannerEpisode 
        ? getPlaybackPosition(titleInfo.id, "tv", bannerEpisode.season_number, bannerEpisode.episode_number)
        : null;

    const handleBannerClick = (e: React.MouseEvent, resume = false) => {
        e.stopPropagation();
        if (bannerEpisode) {
            saveTVProgress(titleInfo.id, bannerEpisode.season_number, bannerEpisode.episode_number, bannerEpisode.name);
            const url = `/play/TV/${titleInfo.id}/${bannerEpisode.season_number}/${bannerEpisode.episode_number}`;
            if (resume && bannerEpisodeProgress && !bannerEpisodeProgress.completed) {
                navigate(`${url}?resume=true`);
            } else {
                navigate(url);
            }
        }
    };

    const handleSeasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSeason = Number(e.target.value);
        setSeasonNumber(newSeason);
    };

    return (
        <div className="detail-view">
            <button
                className="back-button icon-button"
                onClick={() => navigate(-1)}
                aria-label="Go back"
            >
                <FaArrowLeft />
            </button>

            <div className="detail-poster">
                <img
                    src={image}
                    alt={titleInfo.title}
                />
            </div>

            <div className="detail-content">
                <div className="detail-header">
                    <h1 className="detail-title">{titleInfo.title}</h1>
                    <div className="detail-meta">
                        <span>{titleInfo.release_date?.split("-")[0]}</span>
                        <span>{titleInfo.genres?.map((g) => g.name).join(", ")}</span>
                        <span>{seasonCount} Season{seasonCount === 1 ? "" : "s"}</span>
                        <span>{Math.round(titleInfo.vote_average * 10) / 10}/10</span>
                    </div>
                </div>

                <p className="detail-overview">{titleInfo.overview}</p>

                <div className="episodes-header">
                    <h2>Episodes</h2>

                    <div className="select-wrapper">
                        <select
                            className="select"
                            value={seasonNumber}
                            onChange={handleSeasonChange}
                        >
                            {titleInfo.seasons?.map(s => (
                                <option key={s.season_number} value={s.season_number}>
                                    {s.name}
                                </option>
                            )) ?? []}
                        </select>
                    </div>
                </div>

                {bannerEpisode && (
                    <div className="next-episode-banner">
                        <div className="next-episode-info">
                            <span className="next-episode-label">
                                {bannerLabel}
                            </span>
                            <h3 className="next-episode-title">{bannerEpisode.name}</h3>
                            <div className="next-episode-meta">
                                <span>Season {bannerEpisode.season_number}</span>
                                <span>Episode {bannerEpisode.episode_number}</span>
                                {bannerEpisode.runtime && <span>{bannerEpisode.runtime} min</span>}
                            </div>
                            {bannerEpisodeProgress && bannerEpisodeProgress.currentTime > 0 && !bannerEpisodeProgress.completed && (
                                <div className="next-episode-progress">
                                    <div className="next-episode-progress-bar">
                                        <div 
                                            className="next-episode-progress-fill"
                                            style={{ width: `${Math.min(100, Math.round(bannerEpisodeProgress.currentTime / bannerEpisodeProgress.duration * 100))}%` }}
                                        />
                                    </div>
                                    <span className="next-episode-progress-text">
                                        {Math.round(bannerEpisodeProgress.currentTime / bannerEpisodeProgress.duration * 100)}% watched
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="next-episode-actions">
                            {bannerEpisodeProgress && bannerEpisodeProgress.currentTime > 0 && !bannerEpisodeProgress.completed ? (
                                <>
                                    <button
                                        className="next-episode-button next-episode-button--resume"
                                        onClick={(e) => handleBannerClick(e, true)}
                                        aria-label={`Resume episode: ${bannerEpisode.name}`}
                                    >
                                        <FaCirclePlay />
                                        <span>Resume</span>
                                    </button>
                                    <button
                                        className="next-episode-button next-episode-button--restart"
                                        onClick={(e) => handleBannerClick(e, false)}
                                        aria-label={`Play from beginning: ${bannerEpisode.name}`}
                                    >
                                        <FaRotateLeft />
                                        <span>Restart</span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="next-episode-button next-episode-button--play"
                                    onClick={(e) => handleBannerClick(e, false)}
                                    aria-label={`${isBannerCurrent ? 'Play' : 'Play next'} episode: ${bannerEpisode.name}`}
                                >
                                    <FaCirclePlay />
                                    {isBannerCurrent ? <span>Play</span> : <> <FaForward /> <span>Play</span> </>}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <h3> {season?.name} </h3>

                <div className="detail-meta">
                    <span>{season?.release_date?.split("-")[0]}</span>
                    <span>{season?.release_date}</span>
                    <span>{Math.round((season?.vote_average ?? 0) * 10) / 10}/10</span>
                </div>

                <p className="detail-overview">{season?.overview}</p>

                <div className="episodes-container">
                    {season == null ? (
                        <div className="loading-screen">
                            <span className="loading-spinner" />
                            Loading episodes...
                        </div>
                    ) : (
                        season.episodes.map((e) => (
                            <EpisodeCard 
                                key={e.id} 
                                episode={e} 
                                details={titleInfo} 
                                onWatch={(ep) => saveTVProgress(titleInfo.id, ep.season_number, ep.episode_number, ep.name)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}