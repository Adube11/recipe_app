// types/index.ts
/** Difficulty label shown on recipe cards and detail screens. */
export type Difficulty = 'facile' | 'moyen' | 'difficile';

export type Recipe = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  ingredients: string[];
  instructions: string[];
  createdAt: Date;
  /** Active preparation time in minutes (excluding resting/marinating). */
  prepTime: number;
  /** Cooking or baking time in minutes; 0 means no heat required. */
  cookTime: number;
  /** Subjective difficulty level set by the cook. */
  difficulty: Difficulty;
  /**
   * Per-serving macronutrient breakdown.
   *
   * Optional — only populated for recipes where nutritional data has been
   * calculated. Absent on Préparation base recipes (doughs, sauces) because
   * those are components of other dishes, not standalone servings.
   */
  nutrition?: {
    /** Kilocalories per serving. */
    kcal: number;
    /** Protein in grams per serving. */
    proteines: number;
    /** Carbohydrates in grams per serving. */
    glucides: number;
    /** Fat in grams per serving. */
    lipides: number;
  };
  /** UUID of the user who created this recipe; null for seeded/base recipes. */
  userId: string | null;
  /** Source of nutrition data; drives the AI badge in RecipeDetailScreen. */
  nutritionSource: 'manual' | 'ai_estimated' | null;
};

export type Category = {
  id: string;
  name: string;
};

export type RecipeDetailParams = { recipeId: string; recipeName: string };

export type RootStackParamList = {
  Summary: undefined;
  Category: { categoryId: string; categoryName: string };
  RecipeDetail: RecipeDetailParams;
  Compte: undefined;
  RecipeForm: { recipeId?: string };
};

export type AuthStackParamList = {
  Auth: undefined;
  MotDePasseOublie: undefined;
};

/**
 * Param list for the root bottom tab navigator.
 *
 * Each key is a tab name. Screens with no params use `undefined`.
 * The Recettes tab hosts the existing stack navigator rather than a
 * plain screen, so it carries no params of its own here.
 */
export type RootTabParamList = {
  Recettes: undefined;
  Planifier: undefined;
  Courses: undefined;
  Explorer: undefined;
};

/**
 * Param list for the Explorer nested stack.
 *
 * The search entry point carries no params. RecipeDetail reuses the same
 * shape as RootStackParamList so the detail screen renders identically
 * regardless of which tab the user navigated from.
 */
export type ExplorerStackParamList = {
  Explorer: undefined;
  Favoris: undefined;
  RecipeDetail: RecipeDetailParams;
  RecipeForm: { recipeId?: string };
};

export type GroceryCategory = 'viandes' | 'epicerie' | 'produits_frais';

export type GroceryItem = {
  id: string;
  name: string;
  category: GroceryCategory;
  checked: boolean;
  createdAt: string;
};
