export function AmgLogo({
  className = "h-9 w-auto",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/amg-logo.svg"
      alt="AMG"
      width={240}
      height={90}
      className={className}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
