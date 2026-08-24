import { RiderShell } from "@/components/rider/RiderShell";
import type { ReactNode } from "react";

export default function RiderLayout({ children }: { children: ReactNode }) {
  return <RiderShell>{children}</RiderShell>;
}
