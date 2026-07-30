import { SupplierShell } from "@/components/supplier/SupplierShell";
import type { ReactNode } from "react";

export default function SupplierLayout({ children }: { children: ReactNode }) {
  return <SupplierShell>{children}</SupplierShell>;
}
