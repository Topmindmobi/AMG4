"use client";

import { useEffect, useState } from "react";
import { SupplierAddressesManager } from "@/components/supplier/SupplierAddressesManager";
import { useAuth } from "@/lib/auth-context";
import { getDemoSuppliers } from "@/lib/store/demo-store";
import type { Town } from "@/lib/types";

export default function SupplierAddressesPage() {
  const { supplierId } = useAuth();
  const [town, setTown] = useState<Town | null>(null);

  useEffect(() => {
    if (!supplierId) return;
    void Promise.resolve().then(() => {
      const s = getDemoSuppliers().find((x) => x.id === supplierId);
      setTown(s?.town ?? null);
    });
  }, [supplierId]);

  if (!supplierId) return null;

  return (
    <div>
      <h1 className="font-display text-3xl text-charcoal">Addresses</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Add warehouse, shop, and pickup locations with street details and a Google
        Maps pin. Distance from your default address to the AMG hub affects
        estimated transport cost — and which supplier wins the best-value deal.
      </p>
      <div className="mt-8">
        <SupplierAddressesManager supplierId={supplierId} defaultTown={town} />
      </div>
    </div>
  );
}
