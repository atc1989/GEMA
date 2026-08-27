# GEMA — agent notes

Event / business spoke. **Identity spine** for GutGuard (Supabase Auth + OneGrinders). Lifestyle is the hub. Academy is the other spoke.

# One Account — read before every identity / auth / profile move

**Every session, and every time you start the next Change:**

1. Read `docs/obsidian/One Account/00 - Session gate.md`
2. Read `docs/obsidian/One Account/One Account.md` and confirm **Current change**
3. Read that Change note only
4. Then Tech Stack / Design System if the Change needs them (paths on Najee’s machine under `C:\Users\najee\OneDrive\Documents\GutGuard\`)
5. Do not skip Changes. Do not touch production Auth (~431 users) until Change 1 is proven on Staging.

Canonical Obsidian drop: `C:\Users\najee\OneDrive\Documents\GutGuard\One Account\`  
Do **not** edit `GutGuard Tech Stack/` or `GutGuard Design System/`.

This app’s existing Tailwind/shadcn stays **here only**. Do not copy it into Lifestyle or Academy.

Service role and `ONEGRINDERS_API_KEY`: server / Vercel only — never `NEXT_PUBLIC_`.
