"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/commerce/client";
// Live units per item from the store's stock. `null` while loading or when
// the store cannot answer: the checkout confirms availability again anyway.
export function useAvailability(ids: string[]) {
  const key = [...ids].sort().join(",");
  const [units, setUnits] = useState<Record<string, number> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!key) return;
    let active = true;
    api<{ units: Record<string, number> }>(
      `/api/availability/?ids=${encodeURIComponent(key)}`,
    ).then((result) => {
      if (!active) return;
      if (result.ok) setUnits(result.data.units);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [key]);
  return { units, failed };
}
