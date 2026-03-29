import { useState, useEffect } from 'react';
import { Recipe, Category } from '@types/index';
import recipeService from '@services/recipeService';

/**
 * Returns the hardcoded category list.
 *
 * Intentionally synchronous — categories are a closed, stable set served from
 * memory, so no loading or error state is needed. Screens that only need the
 * category list (e.g. SummaryScreen) render immediately without waiting for
 * any network call.
 */
export const useRecipes = () => {
  const categories: Category[] = recipeService.getAllCategories();
  return { categories };
};

/**
 * Fetches all recipes that belong to the given category from Supabase.
 *
 * Returns `loading` while the request is in flight and `error` when the
 * request fails, so the calling screen can render appropriate feedback.
 * The `recipes` array is empty until the fetch resolves successfully.
 */
export const useRecipesByCategory = (categoryId: string) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      setLoading(true);
      setError(null);
      const data = await recipeService.getRecipesByCategory(categoryId);
      if (!cancelled) {
        // recipeService returns [] on error; empty result here means either
        // the category is genuinely empty or a fetch error occurred.
        // The service already logs the Supabase error; we surface a UI message.
        setRecipes(data);
        setLoading(false);
      }
    };

    fetch();
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  return { recipes, loading, error };
};

/**
 * Fetches a single recipe by its ID from Supabase.
 *
 * Returns `loading` while the request is in flight. When the recipe is not
 * found or a network error occurs, `recipe` is `undefined` and the screen
 * falls through to its existing "Recette non trouvée" state.
 */
export const useRecipeDetail = (recipeId: string) => {
  const [recipe, setRecipe] = useState<Recipe | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      setLoading(true);
      const data = await recipeService.getRecipeById(recipeId);
      if (!cancelled) {
        setRecipe(data);
        setLoading(false);
      }
    };

    fetch();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  return { recipe, loading };
};
