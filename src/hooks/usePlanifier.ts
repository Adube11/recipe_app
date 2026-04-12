import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recipe } from '@t/index';

const STORAGE_KEY = 'planifier:meals';

export type MealSlot = 'dejeuner' | 'diner' | 'souper';

export type PlannedMeal = {
  id: string;
  /** Day of the week: 0 = Sunday, 6 = Saturday (matches JS Date.getDay()). */
  dayIndex: number;
  slot: MealSlot;
  recipeId: string;
  recipeName: string;
  nutrition?: {
    kcal: number;
    proteines: number;
    glucides: number;
    lipides: number;
  };
};

type UsePlanifierReturn = {
  meals: PlannedMeal[];
  isLoading: boolean;
  addMeal: (dayIndex: number, slot: MealSlot, recipe: Recipe) => Promise<void>;
  removeMeal: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
};

export function usePlanifier(): UsePlanifierReturn {
  const [meals, setMeals] = useState<PlannedMeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const mealsRef = useRef<PlannedMeal[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            mealsRef.current = parsed;
            setMeals(parsed);
          } catch {
            setMeals([]);
          }
        }
      })
      .catch(() => {
        setMeals([]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const persist = useCallback(
    async (updater: (prev: PlannedMeal[]) => PlannedMeal[]) => {
      const next = updater(mealsRef.current);
      mealsRef.current = next;
      setMeals(next);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Write failed — in-memory state is already updated
      }
    },
    [],
  );

  const addMeal = useCallback(
    async (dayIndex: number, slot: MealSlot, recipe: Recipe) => {
      const meal: PlannedMeal = {
        id: crypto.randomUUID(),
        dayIndex,
        slot,
        recipeId: recipe.id,
        recipeName: recipe.name,
        nutrition: recipe.nutrition,
      };
      await persist((prev) => [...prev, meal]);
    },
    [persist],
  );

  const removeMeal = useCallback(
    async (id: string) => {
      await persist((prev) => prev.filter((m) => m.id !== id));
    },
    [persist],
  );

  const clearAll = useCallback(async () => {
    await persist(() => []);
  }, [persist]);

  return { meals, isLoading, addMeal, removeMeal, clearAll };
}
