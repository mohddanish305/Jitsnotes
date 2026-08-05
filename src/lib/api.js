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
  const driveLink = subject.drive_link ?? subject.driveLink ?? subject.pdf_url ?? subject.pdfPath ?? '';
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
    drive_link: driveLink,
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

const activeRoleRequests = new Map();

const getUserRole = async (user) => {
  if (!user?.id) {
    return { role: 'user', profile: null };
  }

  if (activeRoleRequests.has(user.id)) {
    return activeRoleRequests.get(user.id);
  }

  const promise = (async () => {
    const readRole = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        throw error;
      }

      return data?.role || 'user';
    };

    try {
      const role = await readRole();
      return { role, profile: { id: user.id, role } };
    } catch (error) {
      const missingRow = error?.code === 'PGRST116' || /no rows|single result/i.test(error?.message || '');

      if (!missingRow) {
        throw error;
      }

      const role = normalizeEmail(user.email) === ADMIN_EMAIL ? 'admin' : 'user';
      const { error: upsertError } = await supabase.from('users').upsert(
        {
          id: user.id,
          email: user.email || '',
          role,
        },
        { onConflict: 'id' },
      );

      if (upsertError) {
        throw upsertError;
      }

      const syncedRole = await readRole();
      return { role: syncedRole, profile: { id: user.id, role: syncedRole } };
    }
  })();

  activeRoleRequests.set(user.id, promise);

  try {
    return await promise;
  } finally {
    activeRoleRequests.delete(user.id);
  }
};

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
    if (timeoutId) window.clearTimeout(timeoutId);
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

export const resourcesApi = {
  // Get all resources
  async getAll() {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Admin: Create resource
  async create(resource) {
    await requireAdmin();
    const payload = {
      ...resource,
      is_deleted: false,
    };
    const { data, error } = await supabase.from('resources').insert([payload]).select().single();
    if (error) throw normalizeSupabaseError(error, 'Failed to create resource.');
    return data;
  },

  // Admin: Update resource
  async update(id, updates) {
    await requireAdmin();
    const payload = {
      ...updates,
      is_deleted: false,
    };
    const { data, error } = await supabase.from('resources').update(payload).eq('id', id).select().single();
    if (error) throw normalizeSupabaseError(error, 'Failed to update resource.');
    return data;
  },

  // Admin: Delete resource (soft delete)
  async delete(id) {
    await requireAdmin();
    const { error } = await supabase.from('resources').update({ is_deleted: true }).eq('id', id);
    if (error) throw normalizeSupabaseError(error, 'Failed to delete resource.');
  },
};
