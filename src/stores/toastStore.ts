type ToastListener = (message: string | null) => void;

let listeners: ToastListener[] = [];

export function subscribeToast(listener: ToastListener) {
  listeners.push(listener);

  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function notifyGlobalToast(message: string) {
  listeners.forEach((listener) => listener(message));
}

export function clearGlobalToast() {
  listeners.forEach((listener) => listener(null));
}