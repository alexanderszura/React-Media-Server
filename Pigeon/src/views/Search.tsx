import { useState, useEffect } from "react";
import "../styles/search.css";
import { FaArrowLeftLong, FaArrowRightLong, FaClockRotateLeft } from "react-icons/fa6";
import * as API from "../api";
import * as response from "../responses.tsx"
import Keyboard from "../components/keyboardCard.tsx";
import { MediaCard } from "../components/mediaCard.tsx";
import { getRecentlyWatched } from "../api";
import type { RecentlyWatchedItem } from "../api";

export default function MediaSearch() {
    const [search, setSearch] = useState("");
    const [media, setMedia] = useState<response.MediaSearchResult[]>([]);
    const [page, setPage] = useState(0);
    const [recentlyWatched, setRecentlyWatched] = useState<RecentlyWatchedItem[]>([]);

    const maxTitlesPerPage = 15;
    const maxPages = Math.ceil(media.length / maxTitlesPerPage);

    useEffect(() => {
        setRecentlyWatched(getRecentlyWatched());
    }, []);

    async function updateSearch(value: string) {
        setSearch(value);

        if (value === "") {
            setMedia([]);
            setRecentlyWatched(getRecentlyWatched());
        } else {
            setMedia(await API.fetchSearchedMedia(value));
        }
    }

    function rightPage() {
        setPage((page + 1) % maxPages);
    }

    function leftPage() {
        setPage((page - 1) % maxPages);
    }

    const displayItems = search === "" ? recentlyWatched : media;
    const displayMaxPages = Math.ceil(displayItems.length / maxTitlesPerPage);
    const currentPageItems = displayItems.slice(page * maxTitlesPerPage, (page + 1) * maxTitlesPerPage);

    const renderItem = (item: response.MediaSearchResult | RecentlyWatchedItem) => {
        const isRecent = 'lastWatched' in item;
        const mediaItem = isRecent ? {
            id: item.id,
            media_type: item.media_type,
            title: item.title,
            poster_path: item.poster_path,
            release_date: item.release_date,
            vote_average: item.vote_average
        } : item;
        
        return (
            <MediaCard 
                key={item.id} 
                media={mediaItem as response.MediaSearchResult} 
                recentlyWatched={isRecent}
                playbackPosition={isRecent ? item : undefined}
            />
        );
    };

    return (
        <div className="search-view">
            <div className="search-panel">
                <h1 className="search-heading">Search TV & Movies</h1>
                <input
                    id="search"
                    className="search-input"
                    type="text"
                    data-autofocus
                    value={search}
                    autoComplete="off"
                    placeholder="Search TV & Movies"
                    onChange={async (e) => updateSearch(e.target.value)}
                />
                <Keyboard
                    keyCallback={(key) => updateSearch(search + key)}
                    delCallback={() => {
                        if (search.length > 0)
                            updateSearch(search.substring(0, search.length - 1))
                    }}
                    clearCallback={() => updateSearch("")}
                />
            </div>

            <div className="search-results">
                {displayItems.length === 0 ? (
                    <div className="search-empty">
                        {search === "" ? "Your recently watched will appear here" : "Start typing to find something to watch"}
                    </div>
                ) : (
                    <>
                        {search === "" && (
                            <div className="recently-watched-header">
                                <FaClockRotateLeft />
                                <span>Continue Watching</span>
                            </div>
                        )}
                        <div className="media-container">
                            {currentPageItems.map(renderItem)}
                        </div>

                        {displayMaxPages > 1 && (
                            <div className="page-button">
                                <button onClick={leftPage} disabled={page == 0}>
                                    <FaArrowLeftLong />
                                </button>
                                <button onClick={rightPage} disabled={page == displayMaxPages - 1}>
                                    <FaArrowRightLong />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}