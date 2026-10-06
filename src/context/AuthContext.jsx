import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { authApi } from "../lib/api";
import { isInvitationFlow } from "../lib/authCallback";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // States: 'loading' | 'authenticated' | 'unauthenticated' | 'error'
  const [authStatus, setAuthStatus] = useState("loading");
  const [authLoading, setAuthLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleResolved, setRoleResolved] = useState(false);
  const [roleError, setRoleError] = useState(null);
  const [authError, setAuthError] = useState(null);

  const isBootstrapDoneRef = useRef(false);
  const bootstrapPromiseRef = useRef(null);
  const inFlightRolePromiseRef = useRef(null);
  const currentUserRef = useRef(null);
  const currentIsAdminRef = useRef(null);
  const invitationFlowActiveRef = useRef(isInvitationFlow());

  useEffect(() => {
    currentUserRef.current = user;
    currentIsAdminRef.current = isAdmin;
  }, [user, isAdmin]);

  // Centralized role resolver (Direct, non-competing, with timeout and error handling)
  const resolveRole = useCallback(async (sessionUser) => {
    if (!sessionUser) {
      setRole(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setRoleResolved(true);
      setRoleLoading(false);
      return { role: "user", isSuper: false };
    }

    // Deduplicate if already in flight for this user
    if (inFlightRolePromiseRef.current) {
      console.log("[auth] reusing in-flight role fetch promise");
      return inFlightRolePromiseRef.current;
    }

    console.log("[auth] role fetch started");
    setRoleLoading(true);
    setRoleError(null);

    const promise = (async () => {
      try {
        const { role: resolvedRole, profile } = await authApi.getUserRoleDirect(sessionUser);
        console.log("[auth] role fetch completed");
        const isSuper = Boolean(profile?.is_super_admin);
        const admin = resolvedRole === "admin";

        setRole(resolvedRole);
        setIsAdmin(admin);
        setIsSuperAdmin(isSuper);
        setRoleResolved(true);
        setRoleError(null);

        return { role: resolvedRole, isSuper };
      } catch (err) {
        console.error("[auth] role fetch error:", err);
        const isTimeout = err?.isTimeout || /timeout/i.test(err?.message || "");
        if (isTimeout) {
          console.warn("[auth] role fetch timeout");
        }
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setRoleError(errorObj);
        throw errorObj;
      } finally {
        console.log("[auth] role fetch finished");
        setRoleLoading(false);
        inFlightRolePromiseRef.current = null;
      }
    })();

    inFlightRolePromiseRef.current = promise;
    return promise;
  }, []);

  // Single Controlled Bootstrap
  const runBootstrap = useCallback(async () => {
    if (bootstrapPromiseRef.current) {
      console.log("[auth] bootstrap already in progress, awaiting existing promise");
      return bootstrapPromiseRef.current;
    }

    console.log("[auth] bootstrap started");
    setAuthLoading(true);
    setAuthStatus("loading");
    setAuthError(null);
    setRoleError(null);

    if (invitationFlowActiveRef.current) {
      console.log("[auth] bootstrap skipped - invitation flow active");
      isBootstrapDoneRef.current = true;
      setAuthStatus("unauthenticated");
      setAuthLoading(false);
      console.log("[auth] bootstrap completed");
      return;
    }

    console.log("[auth] bootstrap waiting");
    const promise = (async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("[auth] bootstrap session error:", sessionError);
          setAuthError(sessionError);
          setAuthStatus("error");
          return;
        }

        const initialSession = data?.session;
        if (!initialSession?.user) {
          console.log("[auth] no session");
          setUser(null);
          setRole(null);
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setAuthStatus("unauthenticated");
          setAuthError(null);
          console.log("[auth] bootstrap completed");
          return;
        }

        console.log("[auth] session found");
        setUser(initialSession.user);

        // Resolve role cleanly
        try {
          const { role: userRole, isSuper } = await resolveRole(initialSession.user);
          setUser(initialSession.user);
          setRole(userRole);
          setIsAdmin(userRole === "admin");
          setIsSuperAdmin(isSuper);
          setAuthStatus("authenticated");
          setAuthError(null);
        } catch (roleErr) {
          console.warn("[auth] bootstrap role resolution error:", roleErr);
          setAuthStatus("error");
          setAuthError(roleErr instanceof Error ? roleErr : new Error(String(roleErr)));
        }

        console.log("[auth] bootstrap completed");
      } catch (err) {
        console.error("[auth] bootstrap unexpected exception:", err);
        setAuthError(err instanceof Error ? err : new Error(String(err)));
        setAuthStatus("error");
      } finally {
        setAuthLoading(false);
        isBootstrapDoneRef.current = true;
        bootstrapPromiseRef.current = null;
      }
    })();

    bootstrapPromiseRef.current = promise;
    return promise;
  }, [resolveRole]);

  useEffect(() => {
    let isMounted = true;

    // 1. Run controlled bootstrap once on mount
    runBootstrap();

    // 2. Subscribe to auth state changes for subsequent events
    const { data: authListener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      console.log("[auth:event]", event, currentSession?.user?.email ?? null);
      if (!isMounted) return;

      if (invitationFlowActiveRef.current) {
        if (currentSession?.user) {
          setUser(currentSession.user);
        }
        return;
      }

      if (event === "SIGNED_OUT" || !currentSession?.user) {
        console.log("[auth] no session");
        setUser(null);
        setRole(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setAuthStatus("unauthenticated");
        setAuthLoading(false);
        setRoleLoading(false);
        setAuthError(null);
        setRoleError(null);
        return;
      }

      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setUser(currentSession.user);
        return;
      }

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        // If bootstrap already resolved for this exact user, don't duplicate role fetch
        if (currentUserRef.current?.id === currentSession.user.id && currentIsAdminRef.current !== null) {
          setUser(currentSession.user);
          return;
        }

        console.log("[auth] session found");
        setUser(currentSession.user);

        // CRITICAL: Asynchronously decouple role resolution with setTimeout(..., 0)
        // This lets Gotrue's synchronous internal event loop finish releasing the 'sb-...-auth-token' lock,
        // preventing the Gotrue lock deadlock when PostgREST queries supabase.from(...)!
        setTimeout(async () => {
          if (!isMounted) return;
          try {
            const { role: userRole, isSuper } = await resolveRole(currentSession.user);
            if (!isMounted) return;

            setUser(currentSession.user);
            setRole(userRole);
            setIsAdmin(userRole === "admin");
            setIsSuperAdmin(isSuper);
            setAuthStatus("authenticated");
            setAuthError(null);
          } catch (err) {
            console.error("[auth] onAuthStateChange role fetch error:", err);
            if (!isMounted) return;
            setAuthStatus("error");
            setAuthError(err instanceof Error ? err : new Error(String(err)));
          } finally {
            if (isMounted) {
              setAuthLoading(false);
            }
          }
        }, 0);
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [runBootstrap, resolveRole]);

  // Sign In handler for normal Admin Login
  const signIn = async (email, password) => {
    setAuthStatus("loading");
    setAuthError(null);

    const { error: signInError } = await authApi.signIn(email, password);
    if (signInError) {
      setAuthStatus("unauthenticated");
      return { error: signInError };
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const signedInUser = session?.user ?? null;

    if (sessionError || !signedInUser) {
      setAuthStatus("unauthenticated");
      return { error: sessionError || new Error("Unable to verify signed-in session.") };
    }

    setUser(signedInUser);
    const { role: userRole, isSuper } = await resolveRole(signedInUser);
    const admin = userRole === "admin";

    if (!admin) {
      await authApi.signOut();
      setUser(null);
      setRole(null);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setAuthStatus("unauthenticated");
      return { error: new Error("Access denied. This login is for administrators only.") };
    }

    setUser(signedInUser);
    setRole(userRole);
    setIsAdmin(true);
    setIsSuperAdmin(isSuper);
    setAuthStatus("authenticated");
    setAuthError(null);
    return { error: null };
  };

  const signInWithGoogle = async () => {
    const { error } = await authApi.signInWithGoogle();
    return { error };
  };

  const signOut = async () => {
    await authApi.signOut();
    setUser(null);
    setRole(null);
    setIsAdmin(false);
    setIsSuperAdmin(false);
    setAuthStatus("unauthenticated");
    setAuthError(null);
  };

  // Called after invitation activation or profile sync
  const refreshUserRole = async () => {
    try {
      invitationFlowActiveRef.current = false;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setUser(null);
        setRole(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setAuthStatus("unauthenticated");
        return false;
      }

      setUser(session.user);
      const { role: userRole, isSuper } = await resolveRole(session.user);
      const admin = userRole === "admin";

      setUser(session.user);
      setRole(userRole);
      setIsAdmin(admin);
      setIsSuperAdmin(isSuper);
      setAuthStatus("authenticated");
      setAuthError(null);
      return admin;
    } catch (err) {
      console.error("[auth] refreshUserRole exception:", err);
      return false;
    }
  };

  const initialized = authStatus !== "loading" && !roleLoading;

  const retryAuth = useCallback(async () => {
    console.log("[auth] retrying auth and role resolution");
    inFlightRolePromiseRef.current = null;
    bootstrapPromiseRef.current = null;
    setAuthError(null);
    setRoleError(null);
    return runBootstrap();
  }, [runBootstrap]);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        isSuperAdmin,
        authStatus,
        authLoading,
        roleLoading,
        roleResolved,
        roleError,
        authError,
        loading: authLoading || roleLoading,
        initialized,
        sessionReady: initialized,
        signIn,
        signInWithGoogle,
        signOut,
        refreshUserRole,
        retryAuth,
      }}
    >
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
