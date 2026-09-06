import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { useSpatialNavigation } from "../spatialNavigation";
import { useSettings } from "../SettingsContext";
import { useEffect } from "react";
import "../styles/theme.css";
import "../styles/layout.css";

export default function RootLayout() {
  useSpatialNavigation();
  const navigate = useNavigate();
  const { isLoaded } = useSettings();

  useEffect(() => {
    if (isLoaded) {
      navigate("/media-search", { replace: true });
    }
  }, [isLoaded, navigate]);

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <span className="app-nav__brand">
          Pigeon<span>.</span>
        </span>

        <div className="app-nav__links">
          <NavLink
            to="/media-search"
            className={({ isActive }) =>
              `app-nav__link${isActive ? " active" : ""}`
            }
          >
            <FaMagnifyingGlass />
            Search
          </NavLink>
        </div>
      </nav>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}