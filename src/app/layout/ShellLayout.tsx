import { Outlet } from "react-router-dom";
import { useState } from "react";
import SideNav from "./SideNav";
import TopBar from "./TopBar";
import FriendsPanel from "./FriendsPanel";

export default function ShellLayout() {
  const [friendsOpen, setFriendsOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-black text-white">
      <SideNav />

      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar onToggleFriends={() => setFriendsOpen(true)} />

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>

      <FriendsPanel
        open={friendsOpen}
        onClose={() => setFriendsOpen(false)}
      />
    </div>
  );
}