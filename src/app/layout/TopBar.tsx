interface TopBarProps {
  onToggleFriends: () => void;
  unreadFriendsCount?: number;
}

export default function TopBar({
  onToggleFriends,
  unreadFriendsCount = 0,
}: TopBarProps) {
  const hasUnread = unreadFriendsCount > 0;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/8 bg-[#0b0f14]/80 px-8 py-5 backdrop-blur-xl">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
          Launcher
        </p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          Bienvenue sur ZeeLauncher
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onToggleFriends}
          className="relative rounded-2xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/12"
        >
          <span>Amis</span>

          {hasUnread && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-[0_8px_22px_rgba(239,68,68,0.35)]">
              {unreadFriendsCount > 99 ? "99+" : unreadFriendsCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}