import { useEffect, useState } from "react";

let _state = {
  state: "active",
  activeRuleCount: 7,
  pausedAll: false,
};
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn(_state);
}

export function setAutopilotPausedAll(paused) {
  if (_state.pausedAll === paused) return;
  _state = { ..._state, pausedAll: paused };
  emit();
}

export function setActiveRuleCount(n) {
  if (_state.activeRuleCount === n) return;
  _state = { ..._state, activeRuleCount: n };
  emit();
}

export default function useAutopilotStatus() {
  const [snapshot, setSnapshot] = useState(_state);
  useEffect(() => {
    const fn = (next) => setSnapshot(next);
    listeners.add(fn);
    fn(_state);
    return () => listeners.delete(fn);
  }, []);
  return snapshot;
}
