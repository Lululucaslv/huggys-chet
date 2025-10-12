export const AppConfig = {
  MOCK: (import.meta.env.VITE_MOCK as string | undefined) === "1" || import.meta.env.MODE !== "production",
};
