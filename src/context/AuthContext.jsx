import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { authApi } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const bootstrapCompleteRef = useRef(false);
  const sessionVersionRef = useRef(0);

  const currentUserRef = useRef(null);
  const currentIsAdminRef = useRef(null);

  useEffect(() => {
    currentUserRef.current = user;
    currentIsAdminRef.current = isAdmin;
  }, [user, isAdmin]);

  const withTimeout = async (promise, timeoutMs, label) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }
  };

  const resolveSessionUser = async (sessionUser, source) => {
    const currentVersion = ++sessionVersionRef.current;

    if (!sessionUser) {
      console.log("[auth] no session found");
      setUser(null);
      setIsAdmin(false);
      setRoleLoading(false);
      setLoading(false);
      setInitialized(true);
      return;
    }

    console.log("[auth] restoring session");
    const isSameUser = currentUserRef.current && currentUserRef.current.id === sessionUser.id;
    if (!isSameUser) {
      setLoading(true);
      setRoleLoading(true);
      setIsAdmin(null);
    }
    setUser(sessionUser);

    try {
      const { role } = await withTimeout(authApi.syncCurrentUserRole(sessionUser), 15000, `role sync (${source})`);

      if (currentVersion !== sessionVersionRef.current) {
        return;
      }

      const admin = role === "admin";
      setUser(sessionUser);
      setIsAdmin(admin);
      setRoleLoading(false);
      setLoading(false);
      setInitialized(true);

      if (admin) {
        console.log("[auth] session restored");
        console.log("[auth] admin verified");
      } else {
        console.log("[auth] session restored");
        console.log("[auth] admin check complete");
      }
    } catch (error) {
      console.error("[auth] role fetch failed:", error);
      if (currentVersion !== sessionVersionRef.current) {
        return;
      }

      setUser(sessionUser);
      setIsAdmin(currentIsAdminRef.current ?? false);
      setRoleLoading(false);
      setLoading(false);
      setInitialized(true);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        console.log("[auth] restoring session");
        const { data: { session }, error } = await withTimeout(supabase.auth.getSession(), 15000, "session bootstrap");

        if (error) {
          console.error("Auth bootstrap session error:", error);
        }

        if (!isMounted) return;

        bootstrapCompleteRef.current = true;
        await resolveSessionUser(session?.user ?? null, "bootstrap");
      } catch (error) {
        console.error("Auth bootstrap failed:", error);
        if (isMounted) {
          setUser(null);
          setIsAdmin(false);
          setRoleLoading(false);
          setInitialized(true);
          setLoading(false);
          bootstrapCompleteRef.current = true;
        }
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[auth:event]", event, session?.user?.email ?? null);

      if (!isMounted) return;

      if (!bootstrapCompleteRef.current) {
        return;
      }

      if (!session?.user) {
        setUser(null);
        setIsAdmin(false);
        setRoleLoading(false);
        setLoading(false);
        setInitialized(true);
        return;
      }

      await resolveSessionUser(session.user, `event:${event}`);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    const { error } = await authApi.signIn(email, password);
    if (error) {
      return { error };
    }

    const { data: { session } } = await supabase.auth.getSession();
    const signedInUser = session?.user ?? null;
    if (!signedInUser) {
      return { error: new Error("Unable to verify signed-in user.") };
    }

    setLoading(true);
    setRoleLoading(true);
    setInitialized(false);

    const { role } = await withTimeout(authApi.syncCurrentUserRole(signedInUser), 15000, "role sync (email login)");
    const admin = role === "admin";

    setUser(signedInUser);
    setIsAdmin(admin);
    setRoleLoading(false);
    setInitialized(true);
    setLoading(false);

    if (!admin) {
      await authApi.signOut();
      setUser(null);
      setIsAdmin(false);
      setRoleLoading(false);
      setInitialized(true);
      setLoading(false);
      return { error: new Error("Access denied. This login is for admins only.") };
    }

    console.log("[auth] session restored");
    console.log("[auth] admin verified");

    return { error: null };
  };

  const signInWithGoogle = async () => {
    const { error } = await authApi.signInWithGoogle();
    return { error };
  };

  const signOut = async () => {
    await authApi.signOut();
    setUser(null);
    setIsAdmin(false);
    setRoleLoading(false);
    setInitialized(true);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, roleLoading, initialized, sessionReady: initialized, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
