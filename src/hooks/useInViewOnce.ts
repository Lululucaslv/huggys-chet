import { useEffect, useRef, useState } from "react";

export function useInViewOnce<T extends HTMLElement>(
  options: IntersectionObserverInit = { rootMargin: "0px 0px -10% 0px", threshold: 0.2 }
) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (!ref.current || seen) return;
    const node = ref.current;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSeen(true);
        io.disconnect();
      }
    }, options);
    io.observe(node);
    return () => io.disconnect();
  }, [seen, options]);

  return { ref, seen } as const;
}
