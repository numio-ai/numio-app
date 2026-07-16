import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 767;
const query = `(max-width: ${MOBILE_BREAKPOINT}px)`;

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
