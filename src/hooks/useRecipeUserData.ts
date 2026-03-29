import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@services/supabase';

/**
 * Shape of everything the hook exposes to the calling screen.
 *
 * Split into separate loading/writing flags so the UI can distinguish
 * "initial data is still arriving" from "a write is in flight" — they
 * require different visual responses (skeleton vs. disabled button).
 */
export interface RecipeUserData {
  isFavorited: boolean;
  /** True while the initial favourite row is being fetched. */
  favoriteLoading: boolean;
  /** True while a toggle write is in flight — use to disable the button. */
  favoriteWriting: boolean;
  toggleFavorite: () => void;
  note: string | null;
  /** True while the initial note row is being fetched. */
  noteLoading: boolean;
  noteError: string | null;
  saveNote: (content: string) => Promise<void>;
}

/**
 * Loads and manages per-user favourites and notes for a single recipe.
 *
 * Designed around a "no session → graceful no-op" contract: if the user is
 * not authenticated, all data fields return their empty defaults and all
 * write operations silently do nothing. This lets the screen render normally
 * without guarding every call site.
 *
 * Optimistic updates are used for favourites so the heart icon responds
 * instantly. On write failure the optimistic state is reverted.
 */
export function useRecipeUserData(recipeId: string): RecipeUserData {
  const [userId, setUserId] = useState<string | null>(null);

  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(true);
  const [favoriteWriting, setFavoriteWriting] = useState(false);

  const [note, setNote] = useState<string | null>(null);
  const [noteLoading, setNoteLoading] = useState(true);
  const [noteError, setNoteError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Resolve the current user once on mount.
  // All data fetching is gated behind a non-null userId.
  //
  // Uses getSession() instead of getUser() to read from the AsyncStorage
  // cache rather than making a network round-trip on every mount.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const id = data.session?.user?.id ?? null;
      setUserId(id);
      if (!id) {
        // No session — flip both loading flags off so the UI doesn't hang.
        setFavoriteLoading(false);
        setNoteLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Fetch favourite and note in parallel once the userId is known.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!userId || !recipeId) return;

    let cancelled = false;

    const fetchFavorite = async (uid: string, rid: string) => {
      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', uid)
        .eq('recipe_id', rid)
        .maybeSingle();
      if (error) throw error;
      return data !== null;
    };

    const fetchNote = async (uid: string, rid: string) => {
      const { data, error } = await supabase
        .from('notes')
        .select('content')
        .eq('user_id', uid)
        .eq('recipe_id', rid)
        .maybeSingle();
      if (error) throw error;
      return data?.content ?? null;
    };

    Promise.all([fetchFavorite(userId, recipeId), fetchNote(userId, recipeId)])
      .then(([favorited, noteContent]) => {
        if (cancelled) return;
        setIsFavorited(favorited);
        setNote(noteContent);
        setFavoriteLoading(false);
        setNoteLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Leave data as defaults (false / null); flip loading flags off so
        // the UI doesn't hang on an indefinite spinner.
        setFavoriteLoading(false);
        setNoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, recipeId]);

  // -------------------------------------------------------------------------
  // Toggle favourite with optimistic update.
  //
  // The optimistic flip happens before the write so the icon responds
  // immediately. If the write fails the flag is reverted to its pre-tap value.
  // -------------------------------------------------------------------------
  const toggleFavorite = useCallback(() => {
    if (!userId || !recipeId || favoriteWriting) return;

    const previous = isFavorited;
    setIsFavorited(!previous);
    setFavoriteWriting(true);

    const write = async () => {
      let error;
      if (!previous) {
        // Was not favourited — insert a new row.
        ({ error } = await supabase
          .from('favorites')
          .insert({ user_id: userId, recipe_id: recipeId }));
      } else {
        // Was favourited — remove the row.
        ({ error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', userId)
          .eq('recipe_id', recipeId));
      }

      if (error) {
        // Revert optimistic state on failure.
        setIsFavorited(previous);
      }
      setFavoriteWriting(false);
    };

    write();
  }, [userId, recipeId, isFavorited, favoriteWriting]);

  // -------------------------------------------------------------------------
  // Save (or delete) the note for this recipe.
  //
  // Three branches:
  //   1. Empty content + no existing note → skip the round-trip entirely.
  //   2. Empty content + existing note    → DELETE the row.
  //   3. Non-empty content                → upsert (insert or overwrite).
  // -------------------------------------------------------------------------
  const saveNote = useCallback(
    async (content: string) => {
      if (!userId || !recipeId) return;

      const trimmed = content.trim();

      // Branch 1: no-op.
      if (trimmed === '' && note === null) return;

      setNoteError(null);

      try {
        if (trimmed === '') {
          // Branch 2: delete existing note.
          const { error } = await supabase
            .from('notes')
            .delete()
            .eq('user_id', userId)
            .eq('recipe_id', recipeId);
          if (error) throw error;
          setNote(null);
        } else {
          // Branch 3: upsert — the conflict target is (user_id, recipe_id).
          const { error } = await supabase.from('notes').upsert(
            { user_id: userId, recipe_id: recipeId, content: trimmed },
            { onConflict: 'user_id,recipe_id' },
          );
          if (error) throw error;
          setNote(trimmed);
        }
      } catch (err) {
        setNoteError("Impossible d'enregistrer — réessayer");
        throw err;
      }
    },
    [userId, recipeId, note],
  );

  return {
    isFavorited,
    favoriteLoading,
    favoriteWriting,
    toggleFavorite,
    note,
    noteLoading,
    noteError,
    saveNote,
  };
}
