import React, { useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ExplorerStackParamList, Recipe, Difficulty } from '@t/index';
import { Colors } from '@constants/colors';
import recipeService from '@services/recipeService';

type Props = NativeStackScreenProps<ExplorerStackParamList, 'Explorer'>;

/** The three difficulty values in display order. */
const DIFFICULTIES: Difficulty[] = ['facile', 'moyen', 'difficile'];

/**
 * Maps each difficulty value to its French display label.
 * Kept separate from the type so the labels can change without touching logic.
 */
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
};

/**
 * Normalises a string for case-insensitive, accent-tolerant matching.
 * NFD decomposition separates accent marks from base characters so that,
 * for example, "é" and "e" match the same query letter.
 */
const normalise = (str: string): string =>
  str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Returns true when the recipe matches the query string.
 *
 * Searches both the recipe name and every ingredient line so users can
 * discover recipes by ingredient (e.g. "poulet") as well as by title.
 */
const matchesQuery = (recipe: Recipe, query: string): boolean => {
  if (!query) return true;
  const needle = normalise(query);
  if (normalise(recipe.name).includes(needle)) return true;
  return recipe.ingredients.some((ing) => normalise(ing).includes(needle));
};

/**
 * Returns true when the recipe passes the active difficulty filter.
 *
 * An empty set means no filter is active — all difficulties pass.
 */
const matchesDifficulty = (
  recipe: Recipe,
  selected: Set<Difficulty>,
): boolean => selected.size === 0 || selected.has(recipe.difficulty);

/**
 * Full-text search screen for the Explorer tab.
 *
 * Filtering is derived directly from state on every render — no effect or
 * memo needed because the dataset is small (14 recipes) and the computation
 * is O(n * ingredients). If the dataset grows, useMemo would be the first
 * optimisation to add.
 *
 * Client component by necessity: the screen owns controlled input state and
 * responds to user interactions that cannot be handled in a static render.
 */
const ExplorerScreen: React.FC<Props> = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [selectedDifficulties, setSelectedDifficulties] = useState<
    Set<Difficulty>
  >(new Set());

  /**
   * All recipes loaded once on mount from Supabase. Stored in local state so
   * the component can re-render when the fetch resolves. `loading` gates the
   * spinner; the array starts empty and filters derive from it on every render.
   */
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const data = await recipeService.getAllRecipes();
      if (!cancelled) {
        setAllRecipes(data);
        setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Toggles one difficulty chip: adds if absent, removes if present. */
  const toggleDifficulty = (difficulty: Difficulty) => {
    setSelectedDifficulties((prev) => {
      const next = new Set(prev);
      if (next.has(difficulty)) {
        next.delete(difficulty);
      } else {
        next.add(difficulty);
      }
      return next;
    });
  };

  /** Derived filter result — recalculated on every render. */
  const results = allRecipes.filter(
    (r) => matchesQuery(r, query) && matchesDifficulty(r, selectedDifficulties),
  );

  const hasInput = query.length > 0 || selectedDifficulties.size > 0;

  const renderRecipe = useCallback(
    ({ item }: { item: Recipe }) => (
      <TouchableOpacity
        style={styles.recipeCard}
        activeOpacity={0.75}
        onPress={() =>
          navigation.navigate('RecipeDetail', {
            recipeId: item.id,
            recipeName: item.name,
          })
        }
      >
        <View style={styles.cardBody}>
          <Text style={styles.recipeName}>{item.name}</Text>
          <Text style={styles.ingredientCount}>
            {item.ingredients.length} ingrédients
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    ),
    [navigation],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Collections hub */}
      <Text style={styles.sectionLabel}>MES COLLECTIONS</Text>
      <TouchableOpacity
        style={styles.collectionRow}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('Favoris')}
        accessibilityRole="button"
        accessibilityLabel="Voir mes recettes favorites"
      >
        <Ionicons
          name="heart"
          size={18}
          color={Colors.accent}
          style={styles.collectionIcon}
        />
        <Text style={styles.collectionLabel}>Mes favoris</Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      {/* Search section */}
      <Text style={styles.sectionLabel}>RECHERCHER</Text>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une recette..."
          placeholderTextColor={Colors.textPlaceholder}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {/* Difficulty chips */}
      <View style={styles.chipsRow}>
        {DIFFICULTIES.map((d) => {
          const active = selectedDifficulties.has(d);
          return (
            <TouchableOpacity
              key={d}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.75}
              onPress={() => toggleDifficulty(d)}
              accessibilityRole="button"
              accessibilityLabel={`Filtrer par difficulté : ${DIFFICULTY_LABELS[d]}`}
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[styles.chipLabel, active && styles.chipLabelActive]}
              >
                {DIFFICULTY_LABELS[d]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Result count — visible only when results exist and the user is filtering */}
      {hasInput && results.length > 0 && (
        <Text style={styles.resultCount}>
          {results.length} recette{results.length > 1 ? 's' : ''}
        </Text>
      )}

      {/* Results area */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.sageDark} />
        </View>
      ) : !hasInput ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyPrompt}>
            Recherchez par nom ou ingrédient
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyPrompt}>Aucun résultat</Text>
          <Text style={styles.emptyHint}>
            Essayez un autre mot ou ajustez les filtres.
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderRecipe}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  /** Full-screen centred layout used while the initial recipe fetch is in flight. */
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Collections hub */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    shadowColor: Colors.shadowBase,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  collectionIcon: {
    marginRight: 10,
  },
  collectionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  /* Search bar */
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  searchInput: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  /* Difficulty chips */
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  chipActive: {
    backgroundColor: Colors.headerGreen,
    borderColor: Colors.headerGreen,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipLabelActive: {
    color: Colors.headerTint,
  },

  /* Result count */
  resultCount: {
    fontSize: 13,
    color: Colors.textMuted,
    paddingHorizontal: 20,
    marginBottom: 8,
  },

  /* Recipe list */
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  recipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingRight: 20,
    marginBottom: 14,
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accentGreen,
    shadowColor: Colors.shadowBase,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardBody: {
    flex: 1,
    paddingLeft: 20,
  },
  chevron: {
    fontSize: 22,
    color: Colors.chevronGreen,
    lineHeight: 26,
  },
  recipeName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  ingredientCount: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },

  /* Empty / default state */
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyPrompt: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: Colors.textPlaceholder,
    textAlign: 'center',
  },
});

export default ExplorerScreen;
