import { Recipe, Category } from '@t/index';
import { supabase } from '@services/supabase';

/**
 * Hardcoded category list. Categories are a closed, stable set defined by the
 * app's data model — fetching them from Supabase would add a network round-trip
 * with no benefit while they remain static.
 */
const CATEGORIES: Category[] = [
  { id: '1', name: 'Déjeuner' },
  { id: '2', name: 'Dîner' },
  { id: '3', name: 'Souper' },
  { id: '4', name: 'Dessert' },
  { id: '5', name: 'Préparation' },
];

/**
 * Shape of a recipe row as it comes back from Supabase.
 * DB columns are snake_case; the TypeScript `Recipe` type uses camelCase.
 * This type is used only inside the service to make the mapping explicit.
 */
type DbRecipe = {
  id: string;
  name: string;
  category_id: string;
  quantity: number;
  ingredients: string[];
  instructions: string[];
  created_at: string;
  prep_time: number;
  cook_time: number;
  difficulty: 'facile' | 'moyen' | 'difficile';
  nutrition: Recipe['nutrition'] | null;
  user_id: string | null;
  nutrition_source: 'manual' | 'ai_estimated' | null;
};

/** Data shape accepted by addRecipe and updateRecipe. */
export type RecipeFormData = {
  name: string;
  categoryId: string;
  difficulty: 'facile' | 'moyen' | 'difficile';
  servings: number;
  prepTime: number;
  cookTime: number;
  ingredients: string[];
  instructions: string[];
  nutrition?: {
    kcal: number;
    proteines: number;
    glucides: number;
    lipides: number;
  };
  nutritionSource: 'manual' | 'ai_estimated' | null;
};

/**
 * Maps a raw Supabase row to the app's `Recipe` type.
 *
 * All snake_case → camelCase conversions live here so no other layer of the
 * app needs to know about the DB column names.
 */
function mapRow(row: DbRecipe): Recipe {
  return {
    id: row.id,
    name: row.name,
    category: row.category_id,
    quantity: row.quantity,
    ingredients: row.ingredients,
    instructions: row.instructions,
    createdAt: new Date(row.created_at),
    prepTime: row.prep_time,
    cookTime: row.cook_time,
    difficulty: row.difficulty,
    nutrition: row.nutrition ?? undefined,
    userId: row.user_id,
    nutritionSource: row.nutrition_source,
  };
}

class RecipeService {
  /**
   * Fetches every recipe from Supabase ordered by name.
   *
   * Returns an empty array on error rather than throwing, so callers can
   * render a graceful empty/error state without try-catch at every call site.
   */
  getAllRecipes = async (): Promise<Recipe[]> => {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .order('name');
    if (error) {
      console.error('recipeService.getAllRecipes:', error.message);
      return [];
    }
    return (data as DbRecipe[]).map(mapRow);
  };

  /**
   * Returns the hardcoded category list synchronously.
   *
   * Synchronous on purpose — categories never change at runtime and screens
   * that only need the category list (e.g. SummaryScreen) should not have
   * to await a network call to render the top-level navigation.
   */
  getAllCategories = (): Category[] => {
    return CATEGORIES;
  };

  /**
   * Fetches recipes that belong to a single category from Supabase.
   *
   * Filters server-side so only the relevant rows travel over the wire,
   * keeping the payload small regardless of how large the recipe table grows.
   */
  getRecipesByCategory = async (categoryId: string): Promise<Recipe[]> => {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('category_id', categoryId)
      .order('name');
    if (error) {
      console.error('recipeService.getRecipesByCategory:', error.message);
      return [];
    }
    return (data as DbRecipe[]).map(mapRow);
  };

  /**
   * Fetches a single recipe by its primary key.
   *
   * Returns `undefined` when the row does not exist or an error occurs, which
   * matches the previous synchronous API so call sites need no changes.
   */
  getRecipeById = async (recipeId: string): Promise<Recipe | undefined> => {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single();
    if (error) {
      console.error('recipeService.getRecipeById:', error.message);
      return undefined;
    }
    return mapRow(data as DbRecipe);
  };

  /**
   * Looks up a category name by ID from the local hardcoded list.
   *
   * Kept synchronous because categories are still hardcoded — no reason to
   * pay an async cost for a local lookup.
   */
  getCategoryName = (categoryId: string): string => {
    const category = CATEGORIES.find((cat) => cat.id === categoryId);
    return category?.name || 'Inconnue';
  };

  /**
   * Inserts a new user-authored recipe. Returns the created recipe or null on
   * failure. The user_id is resolved from the active session inside this method
   * so call sites don't need to manage auth state.
   */
  addRecipe = async (data: RecipeFormData): Promise<Recipe | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return null;

    const { data: row, error } = await supabase
      .from('recipes')
      .insert({
        name: data.name,
        category_id: data.categoryId,
        difficulty: data.difficulty,
        quantity: data.servings,
        prep_time: data.prepTime,
        cook_time: data.cookTime,
        ingredients: data.ingredients,
        instructions: data.instructions,
        nutrition: data.nutrition ?? null,
        nutrition_source: data.nutritionSource,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('recipeService.addRecipe:', error.message);
      return null;
    }
    return mapRow(row as DbRecipe);
  };

  /**
   * Updates an existing user-owned recipe by ID. Uses UPDATE (not upsert) so
   * the row UUID is preserved — linked notes and favorites survive the edit.
   * Returns the updated recipe or null on failure.
   */
  updateRecipe = async (
    id: string,
    data: RecipeFormData,
  ): Promise<Recipe | null> => {
    const { data: row, error } = await supabase
      .from('recipes')
      .update({
        name: data.name,
        category_id: data.categoryId,
        difficulty: data.difficulty,
        quantity: data.servings,
        prep_time: data.prepTime,
        cook_time: data.cookTime,
        ingredients: data.ingredients,
        instructions: data.instructions,
        nutrition: data.nutrition ?? null,
        nutrition_source: data.nutritionSource,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('recipeService.updateRecipe:', error.message);
      return null;
    }
    return mapRow(row as DbRecipe);
  };

  /**
   * Fetches all recipes the current user has favorited, ordered by most
   * recently favorited. Uses a join so only one network round-trip is needed.
   * Rows whose recipe was deleted (should not happen due to CASCADE, but
   * defensive) are filtered out before mapping.
   */
  getFavoriteRecipes = async (): Promise<Recipe[]> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return [];

    const { data, error } = await supabase
      .from('favorites')
      .select('recipe_id, created_at, recipes(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('recipeService.getFavoriteRecipes:', error.message);
      return [];
    }

    return (
      data as unknown as Array<{
        recipe_id: string;
        created_at: string;
        recipes: DbRecipe | null;
      }>
    )
      .filter((row) => row.recipes != null)
      .map((row) => mapRow(row.recipes as DbRecipe));
  };

  /**
   * Deletes a user-owned recipe and its linked notes and favorites.
   *
   * Explicit deletes for the current user's notes/favorites run first. If the
   * FK CASCADE migration has been applied, the recipe delete also cascades to
   * any other users' linked rows. Returns true on success.
   */
  deleteRecipe = async (id: string): Promise<boolean> => {
    await supabase.from('notes').delete().eq('recipe_id', id);
    await supabase.from('favorites').delete().eq('recipe_id', id);

    const { error } = await supabase.from('recipes').delete().eq('id', id);
    if (error) {
      console.error('recipeService.deleteRecipe:', error.message);
      return false;
    }
    return true;
  };
}

export default new RecipeService();
