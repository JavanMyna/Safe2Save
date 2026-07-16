const AUTH = (() => {
  const SYNTHETIC_DOMAIN = "@safe-to-save.local";

  function emailFromUsername(username) {
    return username.trim().toLowerCase() + SYNTHETIC_DOMAIN;
  }

  async function signup(username, password) {
    const { data, error } = await db.auth.signUp({
      email: emailFromUsername(username),
      password,
      options: {
        data: { username: username.trim() },
      },
    });

    if (error) {
      const msg = error.message || error.msg || error.error_description || JSON.stringify(error);
      if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("already been registered")) {
        throw new Error("Username already taken.");
      }
      throw new Error(msg || "Signup failed. Check your credentials.");
    }

    if (data.session) {
      await db.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }

    if (data.user) {
      const { error: pe } = await db.from("profiles").upsert({ id: data.user.id, username: username.trim() });
      if (pe) console.warn("Profile upsert:", pe.message);
      const { error: se } = await db.from("settings").upsert({ user_id: data.user.id, runway_days: 14, starting_daily_estimate: 0 });
      if (se) console.warn("Settings upsert:", se.message);
    }

    return data;
  }

  async function login(username, password) {
    const { data, error } = await db.auth.signInWithPassword({
      email: emailFromUsername(username),
      password,
    });

    if (error) {
      const msg = error.message || error.msg || error.error_description || JSON.stringify(error);
      if (msg.includes("Invalid login") || msg.includes("invalid")) {
        throw new Error("Invalid username or password.");
      }
      throw new Error(msg || "Login failed. Check your credentials.");
    }

    return data;
  }

  async function logout() {
    await db.auth.signOut();
  }

  async function getUser() {
    const {
      data: { user },
    } = await db.auth.getUser();
    return user;
  }

  async function getSession() {
    const {
      data: { session },
    } = await db.auth.getSession();
    return session;
  }

  /** Redirect to login if no active session */
  async function requireAuth() {
    const session = await getSession();
    if (!session) {
      window.location.replace("login.html");
      return null;
    }
    return session;
  }

  /** If already logged in on the auth page, redirect to dashboard */
  async function redirectIfAuthed() {
    const session = await getSession();
    if (session) {
      window.location.replace("dashboard.html");
    }
  }

  return { signup, login, logout, getUser, getSession, requireAuth, redirectIfAuthed };
})();
