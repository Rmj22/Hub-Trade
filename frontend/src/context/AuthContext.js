import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, errMsg } from "../lib/api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=unauth, obj=auth

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch {
      setUser(false);
      return false;
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
    try { await api.post("/auth/logout"); } catch {}
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, login, register, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}
