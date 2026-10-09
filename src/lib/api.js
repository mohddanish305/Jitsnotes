import { supabase } from './supabase';

const ADMIN_EMAIL = 'muhammeddanish305@gmail.com';

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

const normalizeYearValue = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const yearMatch = value.match(/year\s*(\d)/i);
    if (yearMatch) return Number(yearMatch[1]);
    const numericValue = Number(value);
    if (!Number.isNaN(numericValue)) return numericValue;
  }
  return null;
};

const normalizeSubjectRow = (subject) => {
  const yearValue = normalizeYearValue(subject.year ?? subject.year_id ?? subject.year_name);
  const thumbnailUrl = typeof subject.thumbnail_url === 'string' && subject.thumbnail_url.startsWith('http')
    ? subject.thumbnail_url
    : typeof subject.thumbnailUrl === 'string' && subject.thumbnailUrl.startsWith('http')
      ? subject.thumbnailUrl
      : null;

  return {
    ...subject,
    name: subject.subject_name ?? subject.name ?? '',
    subject_name: subject.subject_name ?? subject.name ?? '',
    short_name: subject.short_name ?? '',
    year: yearValue,
    year_id: yearValue,
    thumbnail_url: thumbnailUrl,
    pdf_url: subject.pdf_url ?? subject.pdfPath ?? subject.pdf_path ?? null,
  };
};

const normalizeSupabaseError = (error, fallbackMessage) => {
  const message = error?.message || fallbackMessage;

  if (/row-level security|permission denied|violates row-level security/i.test(message)) {
    return new Error('Permission denied. Please verify the admin RLS policy and your admin session.');
  }

  return error instanceof Error ? error : new Error(message);
};

const withTimeout = (promise, ms, label = 'operation') => {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`[auth] role fetch timeout (${label} timed out after ${ms}ms)`);
      err.isTimeout = true;
      reject(err);
    }, ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeoutPromise,
  ]);
};

const activeRoleRequests = new Map();

const getUserRole = async (user) => {
  if (!user?.id) {
    return { role: 'user', profile: null };
  }

  if (activeRoleRequests.has(user.id)) {
    console.log('[auth] deduplicating role fetch for user:', user.id);
    return activeRoleRequests.get(user.id);
  }

  const promise = (async () => {
    console.log('[auth] role fetch request started');
    try {
      const fetchUsers = async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();
          if (error) throw error;
          return { data, error: null };
        } catch (err) {
          const msg = err?.message || String(err);
          if (/row-level security|permission denied|violates row-level security/i.test(msg)) {
            console.warn('[auth] role fetch RLS error on users:', msg);
          } else {
            console.warn('[auth] role fetch database error on users:', msg);
          }
          return { data: null, error: err };
        }
      };

      const fetchProfiles = async () => {
        try {
          const { data, error } = await supabase
            .from('admin_profiles')
            .select('is_super_admin, is_active')
            .eq('id', user.id)
            .maybeSingle();
          if (error) throw error;
          return { data, error: null };
        } catch (err) {
          const msg = err?.message || String(err);
          if (/row-level security|permission denied|violates row-level security/i.test(msg)) {
            console.warn('[auth] role fetch RLS error on admin_profiles:', msg);
          } else {
            console.warn('[auth] role fetch database error on admin_profiles:', msg);
          }
          return { data: null, error: err };
        }
      };

      const queryPromise = Promise.all([fetchUsers(), fetchProfiles()]);

      const [userRes, profileRes] = await withTimeout(queryPromise, 8000, 'database role query');
      console.log('[auth] role fetch request completed');

      const userRow = userRes?.data;
      const profileRow = profileRes?.data;

      if (userRes?.error) {
        const msg = userRes.error?.message || String(userRes.error);
        if (/row-level security|permission denied/i.test(msg)) {
          console.warn('[auth] role fetch RLS error:', msg);
        } else {
          console.warn('[auth] role fetch database error:', msg);
        }
      }
      if (profileRes?.error) {
        const msg = profileRes.error?.message || String(profileRes.error);
        if (/row-level security|permission denied/i.test(msg)) {
          console.warn('[auth] role fetch RLS error:', msg);
        } else {
          console.warn('[auth] role fetch database error:', msg);
        }
      }

      // Check admin status from database records (Section 14: authenticated user ID -> admin_profiles -> role)
      const hasActiveAdminProfile = Boolean(profileRow && profileRow.is_active !== false);
      const isSuperProfile = Boolean(profileRow?.is_super_admin && profileRow?.is_active !== false);
      const isUserAdminRole = userRow?.role === 'admin';

      let determinedRole = 'user';
      if (profileRow && profileRow.is_active === false) {
        determinedRole = 'user';
      } else if (isSuperProfile || hasActiveAdminProfile || isUserAdminRole) {
        determinedRole = 'admin';
      }

      const roleResult = {
        role: determinedRole,
        profile: {
          id: user.id,
          role: determinedRole,
          is_super_admin: isSuperProfile,
          is_active: profileRow?.is_active ?? (determinedRole === 'admin'),
        },
      };

      console.log('[auth] role fetch result:', roleResult.role, {
        isSuper: isSuperProfile,
        isActive: profileRow?.is_active,
        userRole: userRow?.role,
      });

      // Background sync: ensure users table matches without blocking
      if (!userRow && determinedRole === 'admin') {
        (async () => {
          try {
            await supabase
              .from('users')
              .upsert(
                {
                  id: user.id,
                  email: user.email || '',
                  role: determinedRole,
                },
                { onConflict: 'id' }
              );
          } catch {
            // ignore
          }
        })();
      }

      return roleResult;
    } catch (err) {
      if (err?.isTimeout) {
        console.warn('[auth] role fetch timeout');
      } else {
        console.warn('[auth] role fetch database error:', err?.message || err);
      }
      throw err;
    }
  })();

  activeRoleRequests.set(user.id, promise);

  try {
    return await promise;
  } finally {
    activeRoleRequests.delete(user.id);
  }
};

const requireAdmin = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Admin authentication required.');
  }

  const { role } = await getUserRole(user);
  if (role !== 'admin') {
    throw new Error('Access denied. Admins only.');
  }
};

export const subjectsApi = {
  // Get all subjects, optionally filtered by year
  async getAll(year) {
    let query = supabase.from('subjects').select('*').eq('is_deleted', false);
    if (year !== undefined) {
      query = query.or(`year.eq.${year},year_id.eq.${year}`);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(normalizeSubjectRow);
  },

  // Get distinct years available
  async getYears() {
    const { data, error } = await supabase
      .from('subjects')
      .select('year_id')
      .eq('is_deleted', false)
      .order('year_id', { ascending: true });
    if (error) throw error;
    return [...new Set((data || []).map((s) => normalizeYearValue(s.year_id ?? s.year)).filter(Boolean))];
  },

  // Admin: Create subject
  async create(subject) {
    await requireAdmin();

    const payload = {
      ...subject,
      year_id: subject.year_id ?? subject.year,
      is_deleted: false,
      is_active: true,
    };
    delete payload.year;

    const { data, error } = await supabase.from('subjects').insert([payload]).select().single();
    if (error) throw normalizeSupabaseError(error, 'Failed to create subject.');
    return data;
  },

  // Admin: Update subject
  async update(id, updates) {
    await requireAdmin();

    const payload = {
      ...updates,
      year_id: updates.year_id ?? updates.year,
      is_deleted: false,
      is_active: true,
    };
    delete payload.year;

    const { data, error } = await supabase.from('subjects').update(payload).eq('id', id).select().single();
    if (error) throw normalizeSupabaseError(error, 'Failed to update subject.');
    return data;
  },

  // Admin: Delete subject (soft delete)
  async delete(id) {
    await requireAdmin();

    const { error } = await supabase.from('subjects').update({ is_deleted: true }).eq('id', id);
    if (error) throw normalizeSupabaseError(error, 'Failed to delete subject.');
  },
};

export const categoriesApi = {
  // Get all categories ordered by name
  async getAll() {
    const { data, error } = await supabase
      .from('document_categories')
      .select('id, name, slug, created_at')
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  // Find a category by name (case-insensitive and trimmed)
  async findByName(rawName) {
    const normalized = (rawName || '').trim().replace(/\s+/g, ' ');
    if (!normalized) return null;
    const { data, error } = await supabase
      .from('document_categories')
      .select('id, name, slug, created_at')
      .ilike('name', normalized);
    if (error) throw error;
    return (
      (data || []).find(
        (c) => c.name.trim().toLowerCase() === normalized.toLowerCase()
      ) || null
    );
  },

  // Create a new custom category (admin only)
  async create(rawName) {
    await requireAdmin();

    const normalized = (rawName || '').trim().replace(/\s+/g, ' ');
    if (!normalized) {
      throw new Error('Category name cannot be empty.');
    }

    // Check duplicate ignoring case and excess whitespace
    const existing = await this.findByName(normalized);
    if (existing) {
      const err = new Error(`Category "${existing.name}" already exists.`);
      err.existingCategory = existing;
      err.isDuplicate = true;
      throw err;
    }

    // Generate url-friendly slug
    const baseSlug =
      normalized
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'category';

    const { data: slugMatch } = await supabase
      .from('document_categories')
      .select('id, slug')
      .eq('slug', baseSlug)
      .maybeSingle();

    const finalSlug = slugMatch ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

    const { data, error } = await supabase
      .from('document_categories')
      .insert({
        name: normalized,
        slug: finalSlug,
      })
      .select('id, name, slug, created_at')
      .single();

    if (error) {
      if (error.code === '23505' || /unique|duplicate/i.test(error.message)) {
        const found = await this.findByName(normalized);
        const err = new Error(`Category "${found?.name || normalized}" already exists.`);
        err.existingCategory = found;
        err.isDuplicate = true;
        throw err;
      }
      throw normalizeSupabaseError(error, 'Failed to create category.');
    }

    return data;
  },
};

export const feedbackApi = {
  // Submit feedback (public)
  async submit(feedback) {
    const { data, error, status } = await supabase.from('feedback').insert([feedback]);
    if (error || (status && (status < 200 || status >= 300))) {
      throw error || new Error(`Failed to submit feedback (Status: ${status})`);
    }
    return { success: true, status: status || 201, data };
  },

  // Admin: Get all feedback
  async getAll() {
    await requireAdmin();

    const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
};

export const authApi = {
  // Sign in with email/password (Supabase Auth)
  async signIn(email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });
    return { error };
  },

  // Sign in with Google OAuth (Supabase Auth)
  async signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/admin`,
      },
    });

    return { error };
  },

  // Sign out
  async signOut() {
    await supabase.auth.signOut();
  },

  // Get current user
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  // Check if user is admin
  async isAdmin(userInput) {
    const resolvedUser = userInput ?? (await supabase.auth.getUser()).data?.user;
    if (!resolvedUser) return false;

    try {
      const { role } = await getUserRole(resolvedUser);
      console.log('[auth] user id:', resolvedUser.id);
      console.log('[auth] fetched role:', role);
      return role === 'admin';
    } catch (syncError) {
      console.error('Admin check failed:', syncError);
      return false;
    }
  },

  async syncCurrentUserRole(userInput) {
    const resolvedUser = userInput ?? (await supabase.auth.getUser()).data?.user;
    if (!resolvedUser) {
      return { user: null, role: 'user' };
    }

    try {
      const { role } = await getUserRole(resolvedUser);
      console.log('[auth] user id:', resolvedUser.id);
      console.log('[auth] fetched role:', role);
      return { user: resolvedUser, role };
    } catch (syncError) {
      console.error('Role sync failed:', syncError);
      return { user: resolvedUser, role: 'user' };
    }
  },

  async getUserRoleDirect(user) {
    if (!user) return { role: 'user', profile: null };
    return getUserRole(user);
  },
};

export const userApi = {
  // Create user profile after signup
  async createProfile(userId, email) {
    await supabase.from('users').upsert(
      { id: userId, email, role: normalizeEmail(email) === ADMIN_EMAIL ? 'admin' : 'user' },
      { onConflict: 'id' },
    );
  },

  // Get user profile
  async getProfile(userId) {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
    if (error) return null;
    return data;
  },
};
