import React from "react";

const STORAGE_KEY = "numio_theme";

export const ThemeContext = React.createContext({
  dark: false,
  setDark: () => {},
});

export function ThemeProvider({ children }) {
  const [dark, setDarkState] = React.useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "dark";
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
    } catch (_) {}
  }, [dark]);

  const setDark = React.useCallback((value) => {
    setDarkState(Boolean(value));
  }, []);

  return (
    <ThemeContext.Provider value={{ dark, setDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return React.useContext(ThemeContext);
}
