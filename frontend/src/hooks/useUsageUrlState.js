import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

const DEFAULT_RANGE = "30D";

function parseGroupBy(value) {
  if (!value) return null;
  const [kind, ...rest] = value.split(":");
  if (!kind || rest.length === 0) return null;
  if (kind !== "tag" && kind !== "platform") return null;
  return { kind, key: rest.join(":") };
}

function serializeGroupBy(groupBy) {
  if (!groupBy) return null;
  return `${groupBy.kind}:${groupBy.key}`;
}

function parseFilter(value) {
  if (!value) return null;
  const [kind, key, ...rest] = value.split(":");
  if (!kind || !key || rest.length === 0) return null;
  if (kind !== "tag" && kind !== "platform") return null;
  const values = rest.join(":").split(",").filter(Boolean);
  if (values.length === 0) return null;
  return { kind, key, values };
}

function serializeFilter(filter) {
  return `${filter.kind}:${filter.key}:${filter.values.join(",")}`;
}

export default function useUsageUrlState(defaults) {
  const [params, setParams] = useSearchParams();

  const state = useMemo(() => {
    const scope = params.get("scope") === "ai" ? "ai" : "cloud";
    const range = params.get("range") || DEFAULT_RANGE;
    const groupBy = parseGroupBy(params.get("groupBy")) || defaults?.groupBy?.(scope) || null;
    const filters = params.getAll("f").map(parseFilter).filter(Boolean);
    const view = params.get("view") || defaults?.view?.(scope) || null;
    return { scope, range, groupBy, filters, view };
  }, [params, defaults]);

  const setScope = useCallback((next) => {
    setParams((prev) => {
      const np = new URLSearchParams(prev);
      np.set("scope", next);
      np.delete("groupBy");
      np.delete("view");
      np.delete("f");
      return np;
    });
  }, [setParams]);

  const setRange = useCallback((next) => {
    setParams((prev) => {
      const np = new URLSearchParams(prev);
      np.set("range", next);
      return np;
    });
  }, [setParams]);

  const setGroupBy = useCallback((next) => {
    setParams((prev) => {
      const np = new URLSearchParams(prev);
      if (next) np.set("groupBy", serializeGroupBy(next));
      else np.delete("groupBy");
      return np;
    });
  }, [setParams]);

  const setFilters = useCallback((nextFilters) => {
    setParams((prev) => {
      const np = new URLSearchParams(prev);
      np.delete("f");
      for (const f of nextFilters) np.append("f", serializeFilter(f));
      return np;
    });
  }, [setParams]);

  const setView = useCallback((viewId, preset) => {
    setParams((prev) => {
      const np = new URLSearchParams(prev);
      if (viewId) np.set("view", viewId);
      else np.delete("view");
      if (preset?.groupBy) np.set("groupBy", serializeGroupBy(preset.groupBy));
      np.delete("f");
      if (preset?.filters) for (const f of preset.filters) np.append("f", serializeFilter(f));
      return np;
    });
  }, [setParams]);

  return { ...state, setScope, setRange, setGroupBy, setFilters, setView };
}
