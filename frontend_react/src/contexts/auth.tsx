import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getAccountInfoApi, loginApi } from "@/api/account";
import { TOKEN_KEY } from "@/lib/api";
import type { AccountInfo } from "@/types/api";

interface AuthUser {
  id: number;
  username: string;
  roles: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  isAdmin: boolean;
  login: (username: string, pass: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const UNAUTHORIZED_EVENT = "hui:unauthorized";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage.getItem(TOKEN_KEY)
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const bootstrapped = useRef(false);

  const applyAccount = useCallback((account: AccountInfo) => {
    setUser({
      id: account.id,
      username: account.username,
      roles: account.roles ?? [],
    });
  }, []);

  const refresh = useCallback(async () => {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setToken(null);
      setUser(null);
      setReady(true);
      return;
    }

    setToken(stored);
    try {
      const account = await getAccountInfoApi();
      applyAccount(account);
    } catch {
      window.localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setReady(true);
    }
  }, [applyAccount]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleUnauthorized = () => {
      window.localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    };

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () =>
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const login = useCallback(
    async (username: string, pass: string) => {
      const result = await loginApi({ username, pass });
      const accessToken = `${result.tokenType} ${result.accessToken}`;
      window.localStorage.setItem(TOKEN_KEY, accessToken);
      setToken(accessToken);

      const account = await getAccountInfoApi();
      applyAccount(account);
      setReady(true);
    },
    [applyAccount]
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      ready,
      isAdmin: Boolean(user?.roles.includes("admin")),
      login,
      logout,
      refresh,
    }),
    [user, token, ready, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}
