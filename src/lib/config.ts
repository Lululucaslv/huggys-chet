const VITE_MOCK = import.meta.env.VITE_MOCK as string | undefined;
const MODE = import.meta.env.MODE;
const isPreview = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

export const AppConfig = {
  MOCK: VITE_MOCK === "1" || MODE === "development" || isPreview,
};
