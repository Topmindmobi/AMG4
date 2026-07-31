import { getDemoDropoffPoints, getDemoRiders } from "@/lib/store/demo-store";
import { isDemoMode } from "@/lib/supabase/config";
import type { DropoffPoint, Rider, Town } from "@/lib/types";

export async function listDropoffPoints(town: Town): Promise<DropoffPoint[]> {
  if (isDemoMode()) return getDemoDropoffPoints(town);

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data } = await supabase
    .from("dropoff_points")
    .select("*")
    .eq("town", town)
    .order("name");
  return (data as DropoffPoint[]) ?? [];
}

export async function listRiders(town: Town): Promise<Rider[]> {
  if (isDemoMode()) return getDemoRiders(town);

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data } = await supabase
    .from("riders")
    .select("*")
    .eq("town", town)
    .eq("active", true)
    .order("name");
  return (data as Rider[]) ?? [];
}
