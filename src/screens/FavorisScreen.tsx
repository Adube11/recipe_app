import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ExplorerStackParamList, Recipe } from '@t/index';
import { Colors } from '@constants/colors';
import recipeService from '@services/recipeService';

type Props = NativeStackScreenProps<ExplorerStackParamList, 'Favoris'>;

const FavorisScreen: React.FC<Props> = ({ navigation }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  // Re-fetch every time the screen comes into focus so un-favoriting from
  // RecipeDetailScreen is reflected immediately when the user navigates back.
  // The cleanup fn sets `cancelled = true` so in-flight fetches don't call
  // setState after the screen blurs or unmounts.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      setLoading(true);
      recipeService.getFavoriteRecipes().then((data) => {
        if (!cancelled) {
          setRecipes(data);
          setLoading(false);
        }
      });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const renderItem = useCallback(
    ({ item }: { item: Recipe }) => {
      const totalTime = item.prepTime + item.cookTime;
      const categoryName = recipeService.getCategoryName(item.category);

      return (
        <TouchableOpacity
          style={styles.recipeCard}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${categoryName}${
            totalTime > 0 ? `, ${totalTime} minutes` : ''
          }`}
          onPress={() =>
            navigation.navigate('RecipeDetail', {
              recipeId: item.id,
              recipeName: item.name,
            })
          }
        >
          <View style={styles.cardBody}>
            <Text style={styles.recipeName}>{item.name}</Text>
            <Text style={styles.recipeMeta}>
              {categoryName}
              {totalTime > 0 ? ` · ${totalTime} min` : ''}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      );
    },
    [navigation],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={Colors.sageDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes favoris</Text>
      </View>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.sageDark} />
        </View>
      ) : recipes.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="heart-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>Aucun favori</Text>
          <Text style={styles.emptyHint}>
            Appuyez sur le cœur d'une recette pour la retrouver ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.sageDark,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  list: {
    paddingHorizontal: 20,
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
    borderLeftColor: Colors.accent,
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
  recipeName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  recipeMeta: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  chevron: {
    fontSize: 22,
    color: Colors.chevronGreen,
    lineHeight: 26,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: Colors.textPlaceholder,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default FavorisScreen;
