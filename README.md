# CFPS Preparation — Group D (cfps.infinitehse.com)

Next.js 14 + Supabase (`aihub` schema). No AI API is used.

## Environment variables (Vercel → Settings → Environment Variables)
| Name | Where to find it |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase → Project Settings → API → Project URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase → Project Settings → API → anon public key |

## Pages
- `/login` — email + one-time code
- `/` — dashboard (or access request if not yet approved)
- `/study-plan` — interactive blueprint study plan
- `/practice` — exam simulation 30/50/70/100, by domain, by chapter
- `/attempt/[id]` — timed runner; `/attempt/[id]/review` — results + explanations
- `/history` — my results
- `/admin` — approve access requests (admins listed in `aihub.cfps_admins`)
