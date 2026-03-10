import { useEffect, useState } from "react";
import { getCurrentUser } from "../services/auth";
import {
  getMyRemoteProfile,
  updateMyRemoteProfile,
} from "../services/profileRemote";
import { uploadAvatar, uploadBanner } from "../services/storage";
import { notifyProfileUpdate } from "../stores/profileStore";
import type { UserStatus } from "../types/profile";

type ProfileForm = {
  email: string;
  username: string;
  avatar_url: string;
  banner_url: string;
  bio: string;
  status: UserStatus;
};

const defaultProfile: ProfileForm = {
  email: "",
  username: "",
  avatar_url: "",
  banner_url: "",
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

export default function Profile() {
  const [profile, setProfile] = useState<ProfileForm>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setMessage(null);

        const data = await getMyRemoteProfile();

        setProfile({
          email: data.email,
          username: data.username,
          avatar_url: data.avatar_url,
          banner_url: data.banner_url,
          bio: data.bio,
          status: data.status,
        });
      } catch (error) {
        console.error(error);
        setMessage(
          error instanceof Error
            ? error.message
            : "Impossible de charger le profil."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, []);

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingAvatar(true);
      setMessage(null);

      const { data, error } = await getCurrentUser();
      if (error) throw error;
      if (!data.user) throw new Error("Utilisateur non connecté.");

      const url = await uploadAvatar(file, data.user.id);

      setProfile((prev) => ({
        ...prev,
        avatar_url: url,
      }));

      setMessage("Avatar chargé. N’oublie pas de sauvegarder.");
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Erreur upload avatar."
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleBannerUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingBanner(true);
      setMessage(null);

      const { data, error } = await getCurrentUser();
      if (error) throw error;
      if (!data.user) throw new Error("Utilisateur non connecté.");

      const url = await uploadBanner(file, data.user.id);

      setProfile((prev) => ({
        ...prev,
        banner_url: url,
      }));

      setMessage("Bannière chargée. N’oublie pas de sauvegarder.");
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Erreur upload bannière."
      );
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const updated = await updateMyRemoteProfile({
        username: profile.username,
        bio: profile.bio,
        status: profile.status,
        avatar_url: profile.avatar_url,
        banner_url: profile.banner_url,
      });

      setProfile({
        email: updated.email,
        username: updated.username,
        avatar_url: updated.avatar_url,
        banner_url: updated.banner_url,
        bio: updated.bio,
        status: updated.status,
      });

      notifyProfileUpdate(updated);
      setMessage("Profil synchronisé avec Supabase.");
    } catch (error: any) {
  console.error("PROFILE SAVE ERROR:", error);

  const detailedMessage =
    error?.message ||
    error?.error_description ||
    error?.details ||
    "Erreur lors de la sauvegarde.";

  setMessage(detailedMessage);
} finally {
      setSaving(false);
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
          {profile.banner_url ? (
            <img
              src={profile.banner_url}
              alt="Bannière profil"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#1b2940] via-[#131c29] to-[#0d1117]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#11161d] via-transparent to-transparent" />

          <label className="absolute right-4 top-4 cursor-pointer rounded-2xl border border-white/10 bg-black/35 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-black/45">
            {uploadingBanner ? "Upload..." : "Changer la bannière"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerUpload}
              disabled={uploadingBanner}
            />
          </label>
        </div>

        <div className="relative px-6 pb-6">
          <div className="-mt-14 flex flex-col gap-8 xl:flex-row">
            <div className="w-full max-w-sm rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
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
                  {uploadingAvatar ? "Upload..." : "Changer l’avatar"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                </label>

                <h2 className="mt-4 text-xl font-semibold text-white">
                  {profile.username || "Mon Profil"}
                </h2>

                <p className="mt-2 text-sm text-white/45">{profile.email}</p>

                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm text-white/70">
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
                Compte en ligne
              </p>
              <h1 className="mt-2 text-4xl font-bold text-white">Mon Profil</h1>
              <p className="mt-2 text-white/60">
                Ce profil est synchronisé avec ton compte Supabase.
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