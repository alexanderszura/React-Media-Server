import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import RootLayout from "./layouts/RootLayout";
import { SettingsProvider } from "./SettingsContext";
import NotFound from "./views/NotFound";
import MediaSearch from "./views/Search";
import TVDetails from "./views/TVDetails";
import MovieDetails from "./views/MovieDetails";
import { fetchSeasonInfo, fetchTitleInfo } from "./api";
import EpisodeDetails from "./views/EpisodeDetails";
import Play from "./Play";

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <NotFound />,
    children: [
      { index: true, path: "media-search", element: <MediaSearch /> },
      { path: "play/tv/:id/:season/:episode", element: <Play type={"tv"} />},
      { path: "play/movie/:id", element: <Play type={"movie"} />},
      { 
        path: "title/TV/:id",
        element: <TVDetails />,
        loader: async ({ params }) => {
          return await fetchTitleInfo("tv", Number(params.id));
        },
      },
      {
        path: "title/TV/:id/:season/:episode",
        element: <EpisodeDetails />,
        loader: async ({ params }) => {
          return await fetchSeasonInfo(Number(params.id), Number(params.season));
        },
      },
      { 
        path: "title/Movie/:id",
        element: <MovieDetails />,
        loader: async ({ params }) => {
          return await fetchTitleInfo("movie", Number(params.id));
        },
      },
    ],
  },
]);

const root = document.getElementById("root");

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SettingsProvider>
        <RouterProvider router={router} />
      </SettingsProvider>
    </React.StrictMode>
  );
} else {
  console.log("Failed to find root element to mount React app.");
}