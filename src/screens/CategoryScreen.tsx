import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRecipesByCategory } from '@hooks/useRecipes';
import { RootStackParamList, Recipe } from '@types/index';
import { Colors } from '@constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Category'>;

/**
 * Lists every recipe in the selected category.
 *
 * The card shows the recipe name and ingredient count as a lightweight
 * preview — enough to recognise a recipe without loading the full detail.
 *
 * While recipes are loading from Supabase an ActivityIndicator is shown
 * centred in the screen. If the fetch fails, a short error message is shown
 * in place of the list.
 */
const CategoryScreen: React.FC<Props> = ({ navigation, route }) => {
  const { categoryId } = route.params;
  const { recipes, loading, error } = useRecipesByCategory(categoryId);

  const renderRecipe = ({ item }: { item: Recipe }) => (
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
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.sageDark} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          Impossible de charger les recettes.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        renderItem={renderRecipe}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Pas de recettes dans cette catégorie
          </Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },
  /** Full-screen centred layout for loading and error states. */
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingTop: 16,
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
  emptyText: {
    textAlign: 'center',
    color: Colors.textPlaceholder,
    fontSize: 15,
    marginTop: 48,
  },
  errorText: {
    fontSize: 15,
    color: Colors.textPlaceholder,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

export default CategoryScreen;
