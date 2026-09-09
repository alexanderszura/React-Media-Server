import { Outlet, NavLink } from "react-router-dom";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { useSpatialNavigation } from "../spatialNavigation";
import "../styles/theme.css";
import "../styles/layout.css";

export default function RootLayout() {
  useSpatialNavigation();

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <span className="app-nav__brand">
          Pigeon<span>.</span>
        </span>

        <div className="app-nav__links">
          <NavLink
            to="/search"
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