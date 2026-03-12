import { useEffect, useState } from "react";

const FALLBACK_COVER =
  "https://dummyimage.com/1280x720/11161d/ffffff&text=No+Cover";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
};

const memoryCache = new Map<string, string>();

export default function SmartCover({ src, alt, className }: Props) {
  const [resolvedSrc, setResolvedSrc] = useState<string>(FALLBACK_COVER);

  useEffect(() => {
    let cancelled = false;

    if (!src?.trim()) {
      setResolvedSrc(FALLBACK_COVER);
      return;
    }

    if (memoryCache.has(src)) {
      setResolvedSrc(memoryCache.get(src) ?? FALLBACK_COVER);
      return;
    }

    const image = new Image();

    image.onload = () => {
      if (cancelled) return;
      memoryCache.set(src, src);
      setResolvedSrc(src);
    };

    image.onerror = () => {
      if (cancelled) return;
      setResolvedSrc(FALLBACK_COVER);
    };

    image.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading="lazy"
      className={className}
      onError={(event) => {
        if (event.currentTarget.src !== FALLBACK_COVER) {
          event.currentTarget.src = FALLBACK_COVER;
        }
      }}
    />
  );
}
