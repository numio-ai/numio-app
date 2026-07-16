/**
 * Hook returning "when was this data source last synced?" for a given
 * data source. Consumed by dashboard widget freshness labels.
 *
 * Pulls from the shared IngestionStatusContext so every widget on a page
 * shares one backing fetch. Derivation rules live in
 * src/lib/ingestionStatus.js so they stay consistent with the top-bar
 * pill and the Data Ingestion page.
 */
import { useMemo } from "react";
import { useIngestionStatus } from "../context/IngestionStatusContext";
import { freshnessForSource } from "../lib/ingestionStatus";

export default function useIngestionFreshness(dataSource) {
  const { statuses, loading, error } = useIngestionStatus();
  const freshness = useMemo(() => freshnessForSource(statuses, dataSource), [statuses, dataSource]);
  return { ...freshness, loading, error };
}
