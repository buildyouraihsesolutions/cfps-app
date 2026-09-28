# CFPS Preparation — Group D (cfps.infinitehse.com)

Next.js 14 + Supabase (`aihub` schema). No AI API is used.

## Environment variables (Vercel → Settings → Environment Variables)
| Name | Where to find it |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase → Project Settings → API → Project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase → Project Settings → API → anon public key |
| SUPABASE_SERVICE_ROLE_KEY | Supabase → Project Settings → API → service_role key (secret) |
| HANDOUT_VERSION | `1` — increase when you replace the master handout |

## Pages
- `/login` — email + one-time code
- `/` — dashboard (or access request if not yet approved)
- `/study-plan` — interactive blueprint study plan
- `/handout` — personal stamped PDF (name + email on every page)
- `/practice` — exam simulation 30/50/70/100, by domain, by chapter
- `/attempt/[id]` — timed runner; `/attempt/[id]/review` — results + explanations
- `/history` — my results
- `/admin` — approve access requests (admins listed in `aihub.cfps_admins`)
