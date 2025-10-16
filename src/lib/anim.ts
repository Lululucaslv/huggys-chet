import { Variants } from "framer-motion";

export const springSm = { type: "spring", stiffness: 400, damping: 30 } as const;
export const springMd = { type: "spring", stiffness: 260, damping: 24 } as const;

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(2px)" },
  show:   { opacity: 1, y: 0, filter: "blur(0)" }
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1 }
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show:   { opacity: 1, scale: 1 }
};

export const stagger = (staggerChildren = 0.08, delayChildren = 0) => ({
  hidden: {},
  show: {
    transition: { staggerChildren, delayChildren }
  }
});

export const slideInX = (dx = 24): Variants => ({
  hidden: { opacity: 0, x: dx },
  show:   { opacity: 1, x: 0 }
});

export const slideInY = (dy = 24): Variants => ({
  hidden: { opacity: 0, y: dy },
  show:   { opacity: 1, y: 0 }
});

export const shouldReduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
