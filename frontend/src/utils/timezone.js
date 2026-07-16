const STORAGE_KEY = "numio.profile.timezone";

export function getSavedTimeZone() {
  if (typeof window === "undefined") return { mode: "auto", zone: "" };
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { mode: "auto", zone: "" };
    return JSON.parse(stored);
  } catch (err) {
    return { mode: "auto", zone: "" };
  }
}

export function saveTimeZonePreference(mode, zone) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mode, zone })
    );
  } catch (err) {
    // ignore
  }
}

export function resolveTimeZone(mode, zone) {
  if (mode === "manual" && zone) return zone;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (err) {
    return "UTC";
  }
}

export function getTimeOfDay(timeZone) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone,
    });
    const hour = Number(formatter.format(new Date()));
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 18) return "afternoon";
    return "evening";
  } catch (err) {
    return "morning";
  }
}
