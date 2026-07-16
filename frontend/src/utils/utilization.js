/**
 * Utilization color scale helpers.
 * 0-30%: red (underutilized), 31-60%: orange, 61-80%: green, 81-100%: blue
 */
export function getUtilClass(percent) {
  if (percent == null) return "util-low";
  if (percent <= 30) return "util-low";
  if (percent <= 60) return "util-moderate";
  if (percent <= 80) return "util-healthy";
  return "util-high";
}

export function getUtilBarClass(percent) {
  return getUtilClass(percent).replace("util-", "util-bar-");
}
