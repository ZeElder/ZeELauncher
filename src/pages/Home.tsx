import { useEffect, useMemo, useState } from "react";
import { getManifest, getNews, getPatchNotes } from "../services/github";
import type { ManifestData } from "../types/manifest";
import type { NewsItem } from "../types/news";
import type { PatchNoteItem } from "../types/patchnotes";

export default function Home() {
  const [manifest, setManifest] = useState<ManifestData | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [patches, setPatches] = useState<PatchNoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHome = async () => {
      try {
        setLoading(true);
        setError(null);

        const [manifestData, newsData, patchData] = await Promise.all([
          getManifest(),
          getNews(),
          getPatchNotes(),
        ]);

        setManifest(manifestData);
        setNews(newsData.news);

        const sortedPatches = [...patchData.patches].sort((a, b) =>
          b.version.localeCompare(a.version, undefined, { numeric: true })
        );

        setPatches(sortedPatches.slice(0, 5));
      } catch (err) {
        console.error("Home page error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger l’accueil."
        );
      } finally {
        setLoading(false);
      }
    };

    loadHome();
  }, []);

  const latestGameCount = useMemo(() => manifest?.games.length ?? 0, [manifest]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-white/70">
        Chargement de l’accueil...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-6 text-white">
        {error}
      </div>
    );
  }

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
            Bienvenue sur {manifest?.launcher.name ?? "ZeELauncher"}
          </h1>

          <p className="mt-4 max-w-2xl text-white/65">
            Gère tes jeux, suis leurs mises à jour, consulte les dernières annonces
            et accède rapidement à ta bibliothèque.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/35">
                Version launcher
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {manifest?.launcher.version ?? "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/35">
                Jeux disponibles
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {latestGameCount}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="rounded-[24px] border border-white/10 bg-[#11161d] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30">
                News
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Dernières annonces
              </h2>
            </div>

            <div className="space-y-4">
              {news.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/60">
                  Aucune news disponible.
                </div>
              )}

              {news.map((item, index) => (
                <article
                  key={`${item.title}-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/[0.07]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">
                      {item.title}
                    </h3>
                    <span className="text-sm text-white/35">{item.date}</span>
                  </div>

                  <p className="mt-3 text-sm leading-7 text-white/65">
                    {item.content}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[24px] border border-white/10 bg-[#11161d] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30">
                Patch
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white">
                Patch notes récentes
              </h2>
            </div>

            <div className="space-y-4">
              {patches.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/60">
                  Aucune patch note récente.
                </div>
              )}

              {patches.map((patch, index) => (
                <article
                  key={`${patch.game}-${patch.version}-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-white/35">{patch.game}</p>
                      <h3 className="mt-1 text-lg font-semibold text-white">
                        Version {patch.version}
                      </h3>
                    </div>

                    <span className="text-sm text-white/35">{patch.date}</span>
                  </div>

                  <ul className="mt-4 space-y-2 text-sm text-white/65">
                    {patch.notes.slice(0, 3).map((note, i) => (
                      <li key={i}>• {note}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}