import { useEffect, useState } from "react";
import { getManifest } from "../services/github";
import type { ManifestData } from "../types/manifest";

export function useManifest() {
  const [manifest, setManifest] = useState<ManifestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getManifest();
        setManifest(data);
      } catch (err) {
        console.error(err);
        setError("Impossible de charger le manifest.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return { manifest, loading, error };
}