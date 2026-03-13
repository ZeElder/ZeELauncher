import { createBrowserRouter } from "react-router-dom";

import ShellLayout from "./layout/ShellLayout";
import AuthGate from "../components/AuthGate";

import Home from "../pages/Home";
import Games from "../pages/Games";
import GameDetails from "../pages/GameDetails";
import Profile from "../pages/Profile";
import Support from "../pages/Support";
import Login from "../pages/Login";
import Register from "../pages/Register";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/",
    element: (
      <AuthGate>
        <ShellLayout />
      </AuthGate>
    ),
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "games",
        element: <Games />,
      },
      {
        path: "games/:gameId",
        element: <GameDetails />,
      },
      {
        path: "profile",
        element: <Profile />,
      },
      {
        path: "support",
        element: <Support />,
      },
    ],
  },
]);