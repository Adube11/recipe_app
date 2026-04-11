import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useRecipes } from '@hooks/useRecipes';
import recipeService from '@services/recipeService';
import { RootStackParamList, Category } from '@t/index';
import { Colors } from '@constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Summary'>;

/**
 * Entry screen of the app — displays every category as a tappable card.
 *
 * The large hero title establishes visual hierarchy before the list begins.
 * Each card shows the category name and recipe count so the user knows what
 * to expect before drilling in.
 *
 * Recipe counts are loaded once via useEffect into a map keyed by category ID.
 * While counts are loading, "—" is shown in place of the number so the cards
 * render immediately without waiting for the async fetch to complete.
 */
const SummaryScreen: React.FC<Props> = ({ navigation }) => {
  const { categories } = useRecipes();

  /**
   * Map from category ID to recipe count. Populated by a single pass that
   * fetches all recipes once and groups them client-side, avoiding N separate
   * network calls (one per category).
   */
  const [countMap, setCountMap] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const loadCounts = async () => {
        const allRecipes = await recipeService.getAllRecipes();
        if (cancelled) return;

        const map: Record<string, number> = {};
        for (const recipe of allRecipes) {
          map[recipe.category] = (map[recipe.category] ?? 0) + 1;
        }
        setCountMap(map);
      };

      loadCounts();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const renderCategory = useCallback(
    ({ item }: { item: Category }) => {
      const count = countMap[item.id];
      return (
        <TouchableOpacity
          style={styles.categoryCard}
          activeOpacity={0.75}
          onPress={() =>
            navigation.navigate('Category', {
              categoryId: item.id,
              categoryName: item.name,
            })
          }
        >
          <View style={styles.cardBody}>
            <Text style={styles.categoryName}>{item.name}</Text>
            <Text style={styles.recipeCount}>
              {count !== undefined ? `${count} recettes` : '—'}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      );
    },
    [countMap, navigation],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mes recettes</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('RecipeForm', {})}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Ajouter une recette"
            >
              <Ionicons name="add-outline" size={26} color={Colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Compte')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Mon compte"
            >
              <Ionicons
                name="person-circle-outline"
                size={26}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={renderCategory}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  /**
   * SafeAreaView carries the background so the status bar area matches
   * the screen colour on both iOS notch and Android cutout devices.
   */
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingRight: 20,
    marginBottom: 14,
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accentGreen,
    /** Subtle elevation so cards lift slightly off the background. */
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
  categoryName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  recipeCount: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
});

export default SummaryScreen;
