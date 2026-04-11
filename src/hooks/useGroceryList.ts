import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GroceryItem, GroceryCategory } from '@t/index';

const STORAGE_KEY = 'courses:grocery_items';

type UseGroceryListReturn = {
  items: GroceryItem[];
  isLoading: boolean;
  addItem: (name: string, category: GroceryCategory) => Promise<void>;
  toggleItem: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  clearChecked: () => Promise<void>;
  clearAll: () => Promise<void>;
};

export function useGroceryList(): UseGroceryListReturn {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setItems(JSON.parse(raw));
          } catch {
            setItems([]);
          }
        }
      })
      .catch(() => {
        setItems([]);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const persist = useCallback(
    async (updater: (prev: GroceryItem[]) => GroceryItem[]) => {
      let next: GroceryItem[] = [];
      setItems((prev) => {
        next = updater(prev);
        return next;
      });
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Write failed — in-memory state is already updated; next launch will see stale data
      }
    },
    [],
  );

  const addItem = useCallback(
    async (name: string, category: GroceryCategory) => {
      const item: GroceryItem = {
        id: crypto.randomUUID(),
        name: name.trim(),
        category,
        checked: false,
        createdAt: new Date().toISOString(),
      };
      await persist((prev) => [...prev, item]);
    },
    [persist],
  );

  const toggleItem = useCallback(
    async (id: string) => {
      await persist((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, checked: !item.checked } : item,
        ),
      );
    },
    [persist],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      await persist((prev) => prev.filter((item) => item.id !== id));
    },
    [persist],
  );

  const clearChecked = useCallback(async () => {
    await persist((prev) => prev.filter((item) => !item.checked));
  }, [persist]);

  const clearAll = useCallback(async () => {
    await persist(() => []);
  }, [persist]);

  return {
    items,
    isLoading,
    addItem,
    toggleItem,
    deleteItem,
    clearChecked,
    clearAll,
  };
}
