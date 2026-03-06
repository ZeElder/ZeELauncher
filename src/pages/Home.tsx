export default function Home() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#162031] via-[#111722] to-[#0d1117] p-8 shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
        <div className="absolute right-0 top-0 h-52 w-52 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300/70">
            Accueil
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
            Un launcher moderne pour tes jeux indépendants.
          </h1>
          <p className="mt-4 max-w-2xl text-white/65">
            Gère tes jeux, suis leurs mises à jour, lance-les rapidement et garde
            un accès simple à ton profil et à ta liste d'amis.
          </p>

          <div className="mt-6 flex gap-3">
            <button className="rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400">
              Explorer les jeux
            </button>
            <button className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition hover:bg-white/10">
              Voir le profil
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-[24px] border border-white/8 bg-white/5 p-6">
          <p className="text-sm text-white/40">News</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Dernières annonces</h3>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Mets ici les annonces du launcher, les sorties à venir ou les nouveaux jeux disponibles.
          </p>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-white/5 p-6">
          <p className="text-sm text-white/40">Patch</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Patch notes récentes</h3>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Affiche ici les dernières mises à jour des jeux installés.
          </p>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-white/5 p-6">
          <p className="text-sm text-white/40">Profil</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Activité joueur</h3>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Résume ici l'activité récente, les heures jouées et les succès futurs.
          </p>
        </div>
      </section>
    </div>
  );
}