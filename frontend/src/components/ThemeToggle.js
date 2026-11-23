import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "hubtrade_theme";

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem(KEY) === "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(KEY, dark ? "dark" : "light");
  }, [dark]);
  return (
    <button
      data-testid="theme-toggle-btn"
      onClick={() => setDark((d) => !d)}
      className="p-2 rounded-md border border-border hover:bg-muted transition-colors"
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
