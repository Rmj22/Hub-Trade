import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, errMsg } from "../lib/api";
import { toast } from "sonner";

const AuthCtx = createContext(null);
const USER_CACHE_KEY = "ht:user";
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=unauth, obj=auth

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data));
      return data;
    } catch (e) {
      const cached = !e?.response ? JSON.parse(localStorage.getItem(USER_CACHE_KEY) || "null") : null;
      setUser(cached || false);
      return cached || false;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (email, password) => {
    try {
      await api.post("/auth/login", { email, password });
      return await refresh();
    } catch (e) { throw new Error(errMsg(e)); }
  };

  const register = async (payload) => {
    try {
      await api.post("/auth/register", payload);
      return await refresh();
    } catch (e) { throw new Error(errMsg(e)); }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); }
    catch (e) { toast.error(errMsg(e)); }
    localStorage.removeItem(USER_CACHE_KEY);
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, login, register, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}
