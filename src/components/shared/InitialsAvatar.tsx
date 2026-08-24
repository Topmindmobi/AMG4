import { getInitials } from "@/lib/format";

/**
 * Round initials badge used in the admin/supplier/rider shell footers (and
 * the rider context card). `className` carries all sizing/color styling so
 * each caller keeps its exact existing look — this component only owns the
 * initials-from-name computation, not the visual design.
 */
export function InitialsAvatar({
  name,
  fallback,
  className,
}: {
  name: string | null | undefined;
  fallback: string;
  className: string;
}) {
  return <span className={className}>{getInitials(name, fallback)}</span>;
}
