# recipe-app

React Native (Expo) mobile recipe app in French. Supabase (Postgres) backend. Credentials in `.env.local` (gitignored).

## Commands

| Command | Purpose |
|---|---|
| `npm start` | Expo dev server |
| `npm run android` | Android |
| `npm run ios` | iOS |
| `npm run web` | Browser |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npx expo start --clear` | Clear Metro cache |

No test infrastructure.

## Environment

`.env.local` requires:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Architecture

**Tabs:** Recettes / Planifier / Courses / Explorer

**Recettes stack:** `SummaryScreen` → `CategoryScreen` → `RecipeDetailScreen`

**Explorer stack:** `ExplorerScreen` → `RecipeDetailScreen`

**Key files:**
- `App.tsx` — root (`GestureHandlerRootView` + `SafeAreaProvider`)
- `src/navigation/BottomTabNavigator.tsx` — 4-tab navigator
- `src/services/supabase.ts` — singleton client; AsyncStorage session; env var guard
- `src/services/recipeService.ts` — Supabase queries; maps snake_case → camelCase
- `src/hooks/useRecipes.ts` — recipe list hook
- `src/hooks/useRecipeUserData.ts` — per-recipe favorites + notes; optimistic updates
- `src/constants/colors.ts` — all color tokens (`Colors.*`)
- `src/types/index.ts` — `Recipe`, `Category`, all nav param lists

**Data flow:**
- Recipe list: screen → `useRecipes` → `recipeService` → `supabase`
- User data: `RecipeDetailScreen` → `useRecipeUserData` → `supabase` (direct, no service layer)

**Data:** 5 hardcoded categories, 15 recipes in `public.recipes`. Categories have no DB table.

## Path Aliases

| Alias | Path |
|---|---|
| `@components/*` | `src/components/*` |
| `@constants/*` | `src/constants/*` |
| `@hooks/*` | `src/hooks/*` |
| `@navigation/*` | `src/navigation/*` |
| `@screens/*` | `src/screens/*` |
| `@services/*` | `src/services/*` |
| `@types/*` | `src/types/*` |

## Product Constraints

- **Multi-user first** — every product decision must hold up when strangers use the same app, even though only one user exists today
- Session tokens stored in AsyncStorage — must migrate to `expo-secure-store` (hardware-backed) before multi-user launch
- Notes and favorites are plaintext in Postgres — not E2E encrypted; acceptable for recipe data but must stay isolated by RLS
- Nutrition data for seeded recipes comes from the Nutritionist agent; user recipes use Gemini Flash via Supabase Edge Function
- Shared Gemini Flash API key in Supabase secrets — all users share the free-tier quota (1,500 req/day); rate-limit per user in the Edge Function before launch
- The developer uses Claude Code personally; end users will not have access to Claude Code or the Claude API

## Gotchas

- Use `getSession()` not `getUser()` in hooks — `getUser()` hits the network; `getSession()` reads local cache
- Categories are hardcoded in `recipeService.ts` — no `categories` table in Supabase
- Path aliases need both `tsconfig.json` (TS) and `babel.config.js` (Metro) in sync
- `Button`, `Card`, `Header` in `src/components/` are `<View />` stubs — not yet implemented
- `NoteCard` is fully implemented — inline note editor on `RecipeDetailScreen`
- ESLint: warns on `console.log`, allows `any`; Prettier: 2-space, single quotes, 80-char

---

## Agent Pipelines

| Task | Pipeline |
|---|---|
| New feature (clear scope) | UX Advisor → Code Writer → Code Reviewer → Doc Keeper |
| New feature (fuzzy scope) | Product Advisor → UX Advisor → Code Writer → Code Reviewer → Doc Keeper |
| DB schema / migration | DB Advisor → Code Writer → Code Reviewer → Doc Keeper |
| Recipe | Cooking Chef → Nutritionist |
| Bug | Debugger → Code Writer (if fix needed) |
| Docs only | Doc Keeper |
| Phase kickoff | Check ROADMAP.md → appropriate pipeline |

**Plan mode:** `code-writer` and `cooking-chef` always plan first and wait for confirmation. All other agents deliver findings directly.
