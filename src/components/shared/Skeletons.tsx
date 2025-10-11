export function LineSkeleton({
  w = "100%",
  h = 16,
  className = ""
}: {
  w?: string | number;
  h?: number;
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-700/50 ${className}`}
      style={{ width: w, height: h }}
    />
  );
}
