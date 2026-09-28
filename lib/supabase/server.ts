import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'aihub' },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* called from a Server Component — middleware refreshes the session */
          }
        },
      },
    }
  );
}

export type Ctx = {
  userId: string;
  email: string;
  isStudent: boolean;
  isAdmin: boolean;
};

/** Signed-in user + access flags. Returns null when signed out. */
export async function getContext(): Promise<Ctx | null> {
  const sb = supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const [st, ad] = await Promise.all([sb.rpc('cfps_is_student'), sb.rpc('cfps_is_admin')]);
  return {
    userId: data.user.id,
    email: (data.user.email ?? '').toLowerCase(),
    isStudent: st.data === true,
    isAdmin: ad.data === true,
  };
}
