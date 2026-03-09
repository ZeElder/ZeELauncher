import { useEffect, useState } from "react";
import { getUserProfile, saveUserProfile } from "../services/profile";
import type { UserProfile, UserStatus } from "../types/profile";

const defaultProfile: UserProfile = {
  username: "",
  avatarUrl: "",
  bannerUrl: "",
  bio: "",
  status: "En ligne",
};

const statusOptions: UserStatus[] = ["En ligne", "Inactive", "Hors ligne"];

function getStatusDotClass(status: UserStatus) {
  switch (status) {
    case "En ligne":
      return "bg-green-400";
    case "Inactive":
      return "bg-amber-400";
    case "Hors ligne":
      return "bg-zinc-500";
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Impossible de lire le fichier."));
      }
    };

    reader.onerror = () => reject(new Error("Erreur lecture fichier."));
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await getUserProfile();
        setProfile(data);
      } catch (error) {
        console.error(error);
        setMessage("Impossible de charger le profil.");
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await saveUserProfile(profile);
      setMessage("Profil sauvegardé avec succès.");
    } catch (error) {
      console.error(error);
      setMessage("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const dataUrl = await fileToDataUrl(file);
      setProfile((prev) => ({
        ...prev,
        avatarUrl: dataUrl,
      }));
    } catch (error) {
      console.error(error);
      setMessage("Impossible de charger l’avatar.");
    }
  };

  const handleBannerUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const dataUrl = await fileToDataUrl(file);
      setProfile((prev) => ({
        ...prev,
        bannerUrl: dataUrl,
      }));
    } catch (error) {
      console.error(error);
      setMessage("Impossible de charger la bannière.");
    }
  };

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-white/70">
        Chargement du profil...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#11161d] shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
        <div className="relative h-56 overflow-hidden">
          {profile.bannerUrl ? (
            <img
              src={profile.bannerUrl}
              alt="Bannière profil"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#1b2940] via-[#131c29] to-[#0d1117]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#11161d] via-transparent to-transparent" />

          <label className="absolute right-4 top-4 cursor-pointer rounded-2xl border border-white/10 bg-black/35 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-black/45">
            Changer la bannière
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerUpload}
            />
          </label>
        </div>

        <div className="relative px-6 pb-6">
          <div className="-mt-14 flex flex-col gap-8 xl:flex-row">
            <div className="w-full max-w-sm rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.username}
                      className="h-28 w-28 rounded-full object-cover ring-4 ring-[#11161d]"
                    />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-blue-400/80 to-cyan-300/80 text-3xl font-bold text-black ring-4 ring-[#11161d]">
                      {profile.username?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}

                  <span
                    className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-[#11161d] ${getStatusDotClass(
                      profile.status
                    )}`}
                    title={profile.status}
                  />
                </div>

                <label className="mt-4 cursor-pointer rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">
                  Changer l’avatar
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </label>

                <h2 className="mt-4 text-xl font-semibold text-white">
                  {profile.username || "Mon Profil"}
                </h2>

                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm text-white/70">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${getStatusDotClass(
                      profile.status
                    )}`}
                  />
                  {profile.status}
                </div>

                <p className="mt-4 text-sm leading-6 text-white/60">
                  {profile.bio || "Aucune bio définie."}
                </p>
              </div>
            </div>

            <div className="flex-1 rounded-[24px] border border-white/10 bg-white/5 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/30">
                Compte local
              </p>
              <h1 className="mt-2 text-4xl font-bold text-white">Mon Profil</h1>
              <p className="mt-2 text-white/60">
                Personnalise ton profil local avant la future connexion en ligne.
              </p>

              <div className="mt-8 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">
                    Pseudo
                  </label>
                  <input
                    value={profile.username}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        username: e.target.value,
                      }))
                    }
                    placeholder="Ton pseudo"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/30"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">
                    Statut
                  </label>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {statusOptions.map((status) => {
                      const active = profile.status === status;

                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() =>
                            setProfile((prev) => ({
                              ...prev,
                              status,
                            }))
                          }
                          className={[
                            "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                            active
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-white/10 bg-black/20 text-white/70 hover:bg-white/5",
                          ].join(" ")}
                        >
                          <span
                            className={`h-3 w-3 rounded-full ${getStatusDotClass(
                              status
                            )}`}
                          />
                          <span className="text-sm font-medium">{status}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">
                    Bio
                  </label>
                  <textarea
                    value={profile.bio}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        bio: e.target.value,
                      }))
                    }
                    rows={5}
                    placeholder="Parle un peu de toi..."
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/30"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-2xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Sauvegarde..." : "Sauvegarder"}
                  </button>

                  {message && (
                    <p className="text-sm text-white/65">{message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}