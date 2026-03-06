export default function Profile() {
  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-white/10 bg-[#11161d] p-8 shadow-[0_16px_50px_rgba(0,0,0,0.28)]">
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-cyan-300 text-2xl font-bold text-black">
            M
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
              Profil
            </p>
            <h1 className="mt-1 text-3xl font-bold text-white">Mon Profil</h1>
            <p className="mt-2 text-white/60">
              Personnalise ton identité, affiche tes stats et gère ton activité.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[24px] border border-white/8 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Infos joueur</h3>
          <p className="mt-3 text-sm text-white/60">
            Pseudo, avatar, bio, statut en ligne.
          </p>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Bibliothèque</h3>
          <p className="mt-3 text-sm text-white/60">
            Jeux installés, favoris, temps de jeu.
          </p>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Activité</h3>
          <p className="mt-3 text-sm text-white/60">
            Derniers lancements, patchs consultés, interactions sociales.
          </p>
        </div>
      </section>
    </div>
  );
}