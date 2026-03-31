# ROADMAP

## Status legend
- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[defer]` intentionally postponed

---

## Completed

### Phase A — Foundation
- [x] Update data model with `prepTime`, `cookTime`, `difficulty` fields
- [x] Populate all existing recipes with the new fields
- [x] Fix `SummaryScreen` hero title duplication

### Phase B — Cooking screen interactions
- [x] Ingredient checkboxes while cooking (local state, resets on navigate away)
- [x] Serving size scaler (parses French ingredient strings, scales inline quantities)
- [x] Unit conversion after scaling (1000 ml → 1 L, 1000 g → 1 kg, etc.)
- [x] Migrate `instructions` field to `string[]` — update `types/index.ts`, all recipes, all rendering code
- [x] Instruction step checkboxes (local state, resets on navigate away)

### Phase 1 — Visual Refresh
- [x] Apply full color palette consistently across all screens
- [x] Replace hardcoded colors with semantic tokens (`Colors.*`)
- [x] Apply `--sage-dark` to native navigation header (background + white title text)
- [x] Increase visual hierarchy on RecipeDetailScreen — recipe name as headline
- [x] Style "Portions" as badge/pill
- [x] Increase line height on instructions for readability while cooking
- [x] Unify font sizes across cards
- [x] Add subtle drop shadow to all cards
- [x] Add right-arrow chevron to category and recipe cards
- [x] Add accent left border on cards using `--sage`
- [x] Wrap each ingredient in a cleaner row layout with a bullet styled in `--sage`
- [x] Add visual divider between Ingredients and Instructions sections
- [x] Style section titles with `--sage-dark`

### Phase 2 — Navigation foundation
- [x] Add bottom tab bar: Recettes / Planifier / Courses / Explorer
- [x] Placeholder screens for Planifier, Courses, Explorer tabs

### Phase 3 — No-backend features
- [x] Improve Chef and Nutritionist agents with accurate macro reference documentation
- [x] Profil nutritionnel: static macro data (kcal, protéines, glucides, lipides) per recipe, displayed on RecipeDetailScreen, scales with serving scaler
- [x] Explorer tab: search across all recipes

### Phase 4 — Supabase foundation
- [x] Set up Supabase project
- [x] Design database schema (`notes`, `favorites`, `meal_plans`, `cooking_history`, `recipes`) with RLS policies
- [x] Connect React Native app to Supabase (`supabase.ts` singleton, AsyncStorage session persistence)
- [x] Rewrite `recipeService.ts` as fully async with Supabase queries
- [x] Seed all 15 recipes into `public.recipes`; delete `Data.ts`
- [x] All screens updated with loading states and `ActivityIndicator`
- [x] Auth UI — Supabase auth client configured; sign in / sign up screen built (Phase 8)

### Phase 5 — First persistence features
- [x] Notes personnelles — inline card on RecipeDetailScreen (below nutrition), tap-to-edit, Supabase persistence, Annuler / Supprimer / Enregistrer
- [x] Favoris — heart icon in RecipeDetailScreen header, optimistic toggle, Supabase persistence
- [x] Phase 5 features unblocked by Phase 8 auth — notes and favorites are now user-testable

### Recipe additions (2026-03-22)
- [x] Salade caprese — légumineuses updated to 2 cups; nutrition corrected to cooked-basis values
- [x] Salade de betteraves — légumineuses updated to 2 cups; nutrition corrected to cooked-basis values
- [x] Pizza pepperoni added (id: 15, category: Souper) — total recipes now 15

---

## Phase 6 — Standalone Build (Install on Device) ✓
*Goal: install the app directly on iPhone and Pixel — no Metro server, no QR code scan.*

- [x] Install and configure EAS CLI
- [x] Create `eas.json` with a `preview` profile: internal distribution
- [x] Android — APK built and installed on Pixel
- [x] iOS — build installed on iPhone
- [x] App runs standalone (no Metro dependency)

---

## Phase 7 — Courses ✓

- [x] Manual grocery list with add / check off / clear checked
- [x] Category grouping (viandes, épicerie, produits frais)
- [x] AsyncStorage only — grocery lists are intentionally local and never synced to the database

---

## Phase 8 — Auth UI ✓
*Prerequisite for all user-generated content. Treat as multi-user from day one — decisions here must hold up when strangers use the same app.*

- [x] Sign in / sign up screen (email + password via Supabase Auth) — `AuthScreen.tsx`, Connexion/Inscription toggle, French errors, textContentType/autoComplete, email confirmation handling
- [x] Persistent session — `expo-secure-store` with chunking adapter (2 048-byte iOS limit); replaces AsyncStorage in `supabase.ts`
- [x] Sign out — `CompteScreen.tsx` (email display + Se déconnecter), reached via account icon in `SummaryScreen` header
- [x] Full lockout gate — `RootNavigator` resolves session via `onAuthStateChange` INITIAL_SESSION; neutral splash during load; BottomTabNavigator only renders for authenticated sessions
- [x] RLS policies verified production-ready — no schema changes required
- [x] "Mot de passe oublié" — `MotDePasseOublieScreen`, email input, `resetPasswordForEmail`, confirmation state
- [x] Rate-limit Gemini Flash Edge Function per user (10 estimations/user/day via `ai_estimation_log`)

---

## Phase 9 — User recipes ✓

### Add recipe
- [x] "Ajouter une recette" form (name, category, servings, ingredients, instructions, difficulty, prep/cook time)
- [x] Macro estimation: "Estimer" button → Supabase Edge Function → Gemini Flash free tier → pre-fills 4 macro fields
- [x] `sparkles-outline` AI badge + "Estimé par IA" label on nutrition card for AI-estimated macros (not shown on base/seeded recipes)
- [x] Macros are optional — if "Estimer" not tapped, recipe saves without nutrition data
- [x] User can manually correct AI-estimated values before saving
- [x] `nutrition_source: 'manual' | 'ai_estimated' | null` column on `public.recipes` — drives AI badge display; do not infer from `user_id`
- [x] Recipe updates use UPSERT (not delete+insert) — preserves UUID so linked notes and favorites survive

### Edit & delete
- [x] Edit recipe (user-owned only — base/seeded recipes are read-only)
- [x] Delete recipe (user-owned only — with confirmation; `notes` and `favorites` cascade via FK `ON DELETE CASCADE`)

### Explorer
- [x] Explorer search includes user-added recipes alongside base recipes

---

## Phase 10 — CI/CD

### CI (GitHub Actions)
- [x] Lint on every PR and push to `main` (`npm run lint`)
- [x] TypeScript type-check on every PR and push to `main` (`npx tsc --noEmit`)
- [ ] (Optional) Expo export dry-run to catch bundler errors early

### CD (EAS)
- [x] EAS Build on merge to `main` — `preview` profile for both platforms (internal distribution APK + iOS)
- [x] EAS Submit — push production builds to Google Play and App Store on version tag (`v*`)
- [ ] Store credentials and `EXPO_TOKEN` in GitHub Actions secrets (manual step — add to repo secrets)

---

## Phase 11 — Planifier + Historique
*Requires auth (Phase 8) — meal plans are user-owned.*

- [ ] Planifier screen: week view, assign recipes to days and meal slots (déjeuner / dîner / souper)
- [ ] Historique de cuisine: last cooked date per recipe, surfaced in Planifier as a hint
- [ ] `meal_plans` and `cooking_history` tables already exist in Supabase with RLS

---

## Phase 12 — Favoris screen ✓

- [x] Dedicated `FavorisScreen` surfacing all favorited recipes, sorted by most recently favorited
- [x] Entry point: "Mes collections" hub section in `ExplorerScreen` above search (Explorer tab is now a hub for less-frequent features)
- [x] `useFocusEffect` re-fetch — un-favoriting on `RecipeDetailScreen` reflects immediately on back-navigation
- [x] Empty state (heart icon + message), loading state (`ActivityIndicator`)
- [x] `recipeService.getFavoriteRecipes` — joins `favorites` → `recipes` in one query, ordered by `favorites.created_at` DESC

---

## Phase 13 — Engineering cleanup
- [ ] Implement `Card`, `Button`, `Header` component stubs and replace ad-hoc styles across screens
- [ ] Ingredient grouping on RecipeDetailScreen (by type: viandes, épicerie, produits frais)

## Deferred (do early — low effort, high safety)
- [ ] Generate Supabase TypeScript types (`npx supabase gen types`) and thread `Database` type through `supabase.ts` — unblocks type-safe queries across the entire data layer

---

## Deferred
- Recipe images — too heavy for DB; deferred indefinitely
- Recipe sharing between users — out of scope for personal app

---

## Color palette

| Token              | Hex       | Usage                                              |
|--------------------|-----------|---------------------------------------------------|
| `--sage`           | `#87A96B` | Primary brand color, ingredient bullets, accents   |
| `--sage-light`     | `#B5CCAA` | Subtle tints, borders, dividers                    |
| `--sage-dark`      | `#5A7A4E` | Navigation header background, section titles       |
| `--background`     | `#F4F7F2` | Screen backgrounds (off-white with a green tint)   |
| `--surface`        | `#FFFFFF` | Card backgrounds                                   |
| `--text-primary`   | `#1C2B18` | Main body text (near-black with a green undertone) |
| `--text-secondary` | `#6B7D67` | Secondary info (recipe count, ingredient count)    |
| `--text-on-dark`   | `#FFFFFF` | Text on `--sage-dark` header                       |
| `--accent`         | `#C4714A` | Buttons, CTAs, interactive highlights (terracotta) |
| `--border`         | `#D0DECA` | Card borders, section dividers                     |
