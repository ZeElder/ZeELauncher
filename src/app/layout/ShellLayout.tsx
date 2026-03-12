import { Outlet } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import SideNav from "./SideNav";
import TopBar from "./TopBar";
import FriendsPanel from "./FriendsPanel";
import {
  checkLauncherUpdate,
  downloadLauncherUpdate,
  installDownloadedLauncherUpdate,
  onLauncherUpdateProgress,
} from "../../services/updater";
import { clearGlobalToast, subscribeToast } from "../../stores/toastStore";
import {
  createFriendsPresence,
  getUnreadCounts,
  subscribeToIncomingMessages,
  type PresencePayload,
} from "../../services/chat";
import { getFriendsList } from "../../services/friends";
import { notifyUser } from "../../services/notifications";
import { getMyRemoteProfile } from "../../services/profileRemote";
import { subscribeProfile } from "../../stores/profileStore";
import type { UserStatus } from "../../types/profile";

type UpdateInfo = {
  version: string;
  versionId?: number;
  notes?: string;
  downloadUrl: string;
};

type PresenceMap = Record<string, PresencePayload>;

const IDLE_DELAY_MS = 5 * 60 * 1000;

export default function ShellLayout() {
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [activeConversationFriendId, setActiveConversationFriendId] = useState<
    string | null
  >(null);

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [presenceMap, setPresenceMap] = useState<PresenceMap>({});
  const [myAvailability, setMyAvailability] = useState<UserStatus>("En ligne");

  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateChecking, setUpdateChecking] = useState(true);
  const [updateDownloading, setUpdateDownloading] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  const [globalToast, setGlobalToast] = useState<string | null>(null);

  const baseAvailabilityRef = useRef<UserStatus>("En ligne");
  const idleTimeoutRef = useRef<number | null>(null);
  const presenceControllerRef = useRef<{
    updateAvailability: (next: UserStatus) => Promise<void>;
    destroy: () => Promise<void>;
  } | null>(null);

  const friendNamesRef = useRef<Record<string, string>>({});

  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCounts).reduce((sum, value) => sum + value, 0);
  }, [unreadCounts]);

  const refreshUnreadCounts = async () => {
    try {
      const next = await getUnreadCounts();
      setUnreadCounts(next);
    } catch (error) {
      console.error("Unread counter refresh failed:", error);
    }
  };

  const refreshFriendNames = async () => {
    try {
      const friends = await getFriendsList();
      friendNamesRef.current = Object.fromEntries(
        friends.map((friend) => [friend.userId, friend.username])
      );
    } catch (error) {
      console.error("Friends list refresh failed:", error);
    }
  };

  const applyAvailability = async (next: UserStatus) => {
    setMyAvailability(next);

    try {
      await presenceControllerRef.current?.updateAvailability(next);
    } catch (error) {
      console.error("Presence update failed:", error);
    }
  };

  const resetIdleTimer = () => {
    if (baseAvailabilityRef.current === "Hors ligne") {
      return;
    }

    if (idleTimeoutRef.current) {
      window.clearTimeout(idleTimeoutRef.current);
    }

    if (myAvailability !== "En ligne") {
      void applyAvailability("En ligne");
    }

    idleTimeoutRef.current = window.setTimeout(() => {
      if (baseAvailabilityRef.current === "Hors ligne") return;
      void applyAvailability("Inactive");
    }, IDLE_DELAY_MS);
  };

  useEffect(() => {
    let cancelled = false;

    const runUpdateCheck = async () => {
      try {
        const update = await checkLauncherUpdate();

        if (cancelled || !update) {
          return;
        }

        setUpdateInfo({
          version: update.version,
          versionId: update.versionId,
          notes: update.notes,
          downloadUrl: update.downloadUrl,
        });

        setUpdateDownloading(true);
        setUpdateProgress(0);

        await downloadLauncherUpdate(update.downloadUrl);
      } catch (error) {
        console.error("Silent launcher update failed:", error);
        setUpdateDownloading(false);
      } finally {
        if (!cancelled) {
          setUpdateChecking(false);
        }
      }
    };

    void runUpdateCheck();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      try {
        unlisten = await onLauncherUpdateProgress((event) => {
          setUpdateProgress(event.progress ?? 0);

          if (event.state === "downloading") {
            setUpdateDownloading(true);
            setUpdateReady(false);
          }

          if (event.state === "ready") {
            setUpdateDownloading(false);
            setUpdateReady(true);
            setUpdateProgress(100);
          }

          if (event.state === "launching") {
            setUpdateDownloading(false);
          }
        });
      } catch (error) {
        console.error("Updater event listen failed:", error);
      }
    };

    void setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToast((message) => {
      setGlobalToast(message);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!globalToast) return;

    const timeoutId = window.setTimeout(() => {
      clearGlobalToast();
      setGlobalToast(null);
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [globalToast]);

  useEffect(() => {
    let active = true;
    let profileUnsubscribe: (() => void) | null = null;

    const bootPresence = async () => {
      try {
        const me = await getMyRemoteProfile();

        if (!active) return;

        baseAvailabilityRef.current = me.status;
        setMyAvailability(me.status);

        const controller = await createFriendsPresence(me.status, (map) => {
          if (!active) return;
          setPresenceMap(map as PresenceMap);
        });

        presenceControllerRef.current = controller;

        profileUnsubscribe = subscribeProfile((profile) => {
          baseAvailabilityRef.current = profile.status;

          if (profile.status === "Hors ligne") {
            if (idleTimeoutRef.current) {
              window.clearTimeout(idleTimeoutRef.current);
            }
            void applyAvailability("Hors ligne");
            return;
          }

          void applyAvailability("En ligne");
          resetIdleTimer();
        });

        if (me.status !== "Hors ligne") {
          resetIdleTimer();
        }
      } catch (error) {
        console.error("Presence init failed:", error);
      }
    };

    void bootPresence();

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "focus",
    ];

    const onActivity = () => {
      if (baseAvailabilityRef.current === "Hors ligne") return;
      resetIdleTimer();
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, onActivity, { passive: true });
    });

    return () => {
      active = false;

      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current);
      }

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onActivity);
      });

      profileUnsubscribe?.();
      void presenceControllerRef.current?.destroy();
      presenceControllerRef.current = null;
    };
  }, [myAvailability]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => Promise<void>) | null = null;

    const bootSocial = async () => {
      await Promise.all([refreshUnreadCounts(), refreshFriendNames()]);

      cleanup = await subscribeToIncomingMessages((incoming) => {
        const chatAlreadyOpen =
          friendsOpen && activeConversationFriendId === incoming.sender_id;

        if (!chatAlreadyOpen) {
          setUnreadCounts((prev) => ({
            ...prev,
            [incoming.sender_id]: (prev[incoming.sender_id] ?? 0) + 1,
          }));

          const senderName =
            friendNamesRef.current[incoming.sender_id] ?? "Nouveau message";

          setGlobalToast(`Nouveau message de ${senderName}`);
          void notifyUser(senderName, incoming.content);
        } else {
          window.setTimeout(() => {
            void refreshUnreadCounts();
          }, 300);
        }

        if (active) {
          void refreshFriendNames();
        }
      });
    };

    void bootSocial();

    return () => {
      active = false;
      void cleanup?.();
    };
  }, [friendsOpen, activeConversationFriendId]);

  const handleInstallDownloadedUpdate = async () => {
    try {
      await installDownloadedLauncherUpdate();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Erreur installation mise à jour launcher"
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-black text-white">
      <SideNav />

      <div className="relative flex min-h-screen flex-1 flex-col">
        <TopBar
          onToggleFriends={() => setFriendsOpen(true)}
          unreadFriendsCount={totalUnreadCount}
        />

        {globalToast && (
          <div className="pointer-events-none fixed right-6 top-6 z-[70] max-w-[360px]">
            <div className="rounded-2xl border border-blue-400/20 bg-blue-500/15 px-4 py-3 text-sm text-blue-100 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              {globalToast}
            </div>
          </div>
        )}

        <main className="flex-1 p-6">
          {updateInfo && (
            <div className="mb-6 rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/70">
                    Mise à jour launcher
                  </p>

                  <h3 className="mt-2 text-xl font-bold text-white">
                    Nouvelle version disponible : {updateInfo.version}
                  </h3>

                  {typeof updateInfo.versionId !== "undefined" && (
                    <p className="mt-2 text-sm text-white/70">
                      ID de version : {updateInfo.versionId}
                    </p>
                  )}

                  {updateInfo.notes && (
                    <p className="mt-3 text-sm text-white/65">
                      {updateInfo.notes}
                    </p>
                  )}
                </div>

                <div className="flex min-w-[320px] flex-col gap-3">
                  {updateDownloading && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="mb-3 text-sm font-medium text-white/75">
                        Téléchargement automatique de la mise à jour...
                      </p>

                      <div className="mb-2 flex justify-between text-xs text-white/50">
                        <span>Progression</span>
                        <span>{updateProgress}%</span>
                      </div>

                      <div className="h-2 rounded-full bg-white/10">
                        <div
                          className="h-2 rounded-full bg-amber-400 transition-all"
                          style={{ width: `${updateProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {updateReady && (
                    <button
                      onClick={handleInstallDownloadedUpdate}
                      className="rounded-2xl bg-amber-500 px-5 py-3 font-semibold text-white transition hover:bg-amber-400"
                    >
                      Redémarrer pour mettre à jour
                    </button>
                  )}

                  {!updateDownloading && !updateReady && !updateChecking && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/65">
                      Mise à jour détectée. Le téléchargement n’a pas pu être finalisé automatiquement.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <Outlet />
        </main>
      </div>

      <FriendsPanel
        open={friendsOpen}
        onClose={() => setFriendsOpen(false)}
        presenceMap={presenceMap}
        myAvailability={myAvailability}
        unreadCounts={unreadCounts}
        onUnreadCountsChange={setUnreadCounts}
        onActiveConversationChange={setActiveConversationFriendId}
      />
    </div>
  );
}