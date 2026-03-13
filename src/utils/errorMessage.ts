export function getSafeErrorMessage(
  error: unknown,
  fallback = "Une erreur est survenue."
): string {
  if (import.meta.env.DEV) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;

    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return fallback;
    }
  }

  return fallback;
}