interface TopBarProps {
  onToggleFriends: () => void;
}

export default function TopBar({ onToggleFriends }: TopBarProps) {
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
          className="rounded-2xl border border-white/10 bg-white/8 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/12"
        >
          Amis
        </button>
      </div>
    </header>
  );
}