import type { RemoteProfile } from "../services/profileRemote";

type Listener = (profile: RemoteProfile) => void;

let listeners: Listener[] = [];

export function subscribeProfile(listener: Listener) {
  listeners.push(listener);

  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function notifyProfileUpdate(profile: RemoteProfile) {
  listeners.forEach((listener) => listener(profile));
}