import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GroceryItem, GroceryCategory } from '@t/index';

const STORAGE_KEY = 'courses:grocery_items';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

type UseGroceryListReturn = {
  items: GroceryItem[];
  isLoading: boolean;
  addItem: (name: string, category: GroceryCategory) => void;
  toggleItem: (id: string) => void;
  deleteItem: (id: string) => void;
  clearChecked: () => void;
  clearAll: () => void;
};

export function useGroceryList(): UseGroceryListReturn {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const itemsRef = useRef<GroceryItem[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            itemsRef.current = parsed;
            setItems(parsed);
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
    (updater: (prev: GroceryItem[]) => GroceryItem[]) => {
      const next = updater(itemsRef.current);
      itemsRef.current = next;
      setItems(next);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    },
    [],
  );

  const addItem = useCallback(
    (name: string, category: GroceryCategory) => {
      const item: GroceryItem = {
        id: generateId(),
        name: name.trim(),
        category,
        checked: false,
        createdAt: new Date().toISOString(),
      };
      persist((prev) => [...prev, item]);
    },
    [persist],
  );

  const toggleItem = useCallback(
    (id: string) => {
      persist((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, checked: !item.checked } : item,
        ),
      );
    },
    [persist],
  );

  const deleteItem = useCallback(
    (id: string) => {
      persist((prev) => prev.filter((item) => item.id !== id));
    },
    [persist],
  );

  const clearChecked = useCallback(() => {
    persist((prev) => prev.filter((item) => !item.checked));
  }, [persist]);

  const clearAll = useCallback(() => {
    persist(() => []);
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
