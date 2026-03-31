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
| `eas build --profile preview --platform ios` | iOS preview build (internal) |
| `eas build --profile preview --platform android` | Android preview build (APK) |
| `eas build --profile production --platform all` | Production build for both stores |
| `eas build:run -p ios` | Install latest iOS sim build |

No test infrastructure.

## Environment

`.env.local` requires:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Architecture

**Tabs:** Recettes / Planifier / Courses / Explorer

**Auth gate:** `RootNavigator` resolves session on mount via `onAuthStateChange` (INITIAL_SESSION); renders `AuthStack` (unauthenticated) or `BottomTabNavigator` (authenticated)

**Recettes stack:** `SummaryScreen` → `CategoryScreen` → `RecipeDetailScreen` | `RecipeFormScreen` (add/edit) | `CompteScreen` (account icon in `SummaryScreen` header)

**Explorer stack:** `ExplorerScreen` (hub: "Mes collections" + search) → `FavorisScreen` | `RecipeDetailScreen` | `RecipeFormScreen` (edit, owner only)

**Key files:**
- `App.tsx` — root (`GestureHandlerRootView` + `SafeAreaProvider`)
- `src/navigation/RootNavigator.tsx` — auth gate; owns `NavigationContainer`; renders `AuthStack` or `BottomTabNavigator`
- `src/navigation/BottomTabNavigator.tsx` — 4-tab navigator (authenticated only)
- `src/screens/AuthScreen.tsx` — sign-in / sign-up; Connexion/Inscription toggle; French errors
- `src/screens/CompteScreen.tsx` — shows signed-in email; sign out
- `src/services/supabase.ts` — singleton client; expo-secure-store session (chunking adapter); env var guard
- `src/services/recipeService.ts` — Supabase queries; maps snake_case → camelCase
- `src/hooks/useRecipes.ts` — recipe list hook
- `src/hooks/useRecipeUserData.ts` — per-recipe favorites + notes; optimistic updates
- `src/screens/RecipeFormScreen.tsx` — add/edit form; AI macro estimation via Edge Function
- `src/screens/FavorisScreen.tsx` — favorited recipes list; `useFocusEffect` re-fetch; navigates within `ExplorerStack`
- `src/constants/colors.ts` — all color tokens (`Colors.*`)
- `src/types/index.ts` — `Recipe`, `Category`, all nav param lists
- `supabase/functions/estimate-nutrition/index.ts` — Deno Edge Function; calls Gemini Flash; rate-limits 10 req/user/day via `ai_estimation_log`

**Data flow:**
- Recipe list: screen → `useRecipes` → `recipeService` → `supabase`
- User data: `RecipeDetailScreen` → `useRecipeUserData` → `supabase` (direct, no service layer)

**Data:** 5 hardcoded categories, 15+ recipes in `public.recipes` (seeded rows have `user_id = NULL`; user-added rows have `user_id` set). `nutrition_source` column (`'manual' | 'ai_estimated' | null`) drives AI badge display. `ai_estimation_log` table tracks per-user Gemini calls. Categories have no DB table.

## Path Aliases

| Alias | Path |
|---|---|
| `@components/*` | `src/components/*` |
| `@constants/*` | `src/constants/*` |
| `@hooks/*` | `src/hooks/*` |
| `@navigation/*` | `src/navigation/*` |
| `@screens/*` | `src/screens/*` |
| `@services/*` | `src/services/*` |
| `@t/*` | `src/types/*` |

## Product Constraints

- **Multi-user first** — every product decision must hold up when strangers use the same app, even though only one user exists today
- Session tokens stored in `expo-secure-store` (hardware-backed iOS Keychain / Android Keystore) with chunking adapter for 2 048-byte limit
- Notes and favorites are plaintext in Postgres — not E2E encrypted; acceptable for recipe data but must stay isolated by RLS
- Nutrition data for seeded recipes comes from the Nutritionist agent; user recipes use Gemini Flash via Supabase Edge Function
- Shared Gemini Flash API key in Supabase secrets — all users share the free-tier quota (1,500 req/day); rate-limited to 10 estimations/user/day via `ai_estimation_log`
- The developer uses Claude Code personally; end users will not have access to Claude Code or the Claude API

## Gotchas

- Use `getSession()` not `getUser()` in hooks — `getUser()` hits the network; `getSession()` reads local cache
- Categories are hardcoded in `recipeService.ts` — no `categories` table in Supabase
- Path aliases need both `tsconfig.json` (TS) and `babel.config.js` (Metro) in sync
- `Button`, `Card`, `Header` in `src/components/` are `<View />` stubs — not yet implemented
- `NoteCard` is fully implemented — inline note editor on `RecipeDetailScreen`
- `notes.recipe_id` and `favorites.recipe_id` are `uuid` type with `ON DELETE CASCADE` FK — cast from `text` in Phase 9 migration
- `RecipeFormScreen` uses stable `{ id, value }` list items (not index keys) for ingredient/instruction rows — prevents TextInput identity loss on delete
- `navigation.replace('RecipeDetail', ...)` after save, `popToTop()` after delete — keeps back stack clean
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
