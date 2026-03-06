import { createBrowserRouter } from "react-router-dom";
import ShellLayout from "./layout/ShellLayout";

import Home from "../pages/Home";
import Games from "../pages/Games";
import GameDetails from "../pages/GameDetails";
import Profile from "../pages/Profile";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <ShellLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "games", element: <Games /> },
      { path: "games/:gameId", element: <GameDetails /> },
      { path: "profile", element: <Profile /> },
    ],
  },
]);