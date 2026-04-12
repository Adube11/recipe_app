import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '@constants/colors';
import { usePlanifier, MealSlot, PlannedMeal } from '@hooks/usePlanifier';
import recipeService from '@services/recipeService';
import { Recipe } from '@t/index';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_NAMES = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];

const SLOTS: MealSlot[] = ['dejeuner', 'diner', 'souper'];

const SLOT_LABELS: Record<MealSlot, string> = {
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
  souper: 'Souper',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Macros = {
  kcal: number;
  proteines: number;
  glucides: number;
  lipides: number;
};

/** Sums macros for a list of meals. Returns null when none have nutrition. */
function sumMacros(meals: PlannedMeal[]): Macros | null {
  const withNutrition = meals.filter((m) => m.nutrition);
  if (withNutrition.length === 0) return null;
  return withNutrition.reduce<Macros>(
    (acc, m) => ({
      kcal: acc.kcal + (m.nutrition?.kcal ?? 0),
      proteines: acc.proteines + (m.nutrition?.proteines ?? 0),
      glucides: acc.glucides + (m.nutrition?.glucides ?? 0),
      lipides: acc.lipides + (m.nutrition?.lipides ?? 0),
    }),
    { kcal: 0, proteines: 0, glucides: 0, lipides: 0 },
  );
}

// ---------------------------------------------------------------------------
// MacroPills — reusable inline component
// ---------------------------------------------------------------------------

const MacroPills = ({ macros }: { macros: Macros }) => (
  <View style={styles.macroPills}>
    <View style={styles.macroPill}>
      <Text style={styles.macroPillValue}>{macros.kcal}</Text>
      <Text style={styles.macroPillUnit}>kcal</Text>
    </View>
    <View style={styles.macroPill}>
      <Text style={styles.macroPillValue}>{macros.proteines}</Text>
      <Text style={styles.macroPillUnit}>prot.</Text>
    </View>
    <View style={styles.macroPill}>
      <Text style={styles.macroPillValue}>{macros.glucides}</Text>
      <Text style={styles.macroPillUnit}>gluc.</Text>
    </View>
    <View style={styles.macroPill}>
      <Text style={styles.macroPillValue}>{macros.lipides}</Text>
      <Text style={styles.macroPillUnit}>lip.</Text>
    </View>
  </View>
);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const PlanifierScreen = () => {
  const { meals, isLoading, addMeal, removeMeal, clearAll } = usePlanifier();

  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{
    dayIndex: number;
    slot: MealSlot;
  } | null>(null);

  const weeklyMacros = sumMacros(meals);

  /** Opens the recipe picker for a given day + slot. Lazy-loads recipe list. */
  const openPicker = useCallback(
    async (dayIndex: number, slot: MealSlot) => {
      setPickerTarget({ dayIndex, slot });
      setPickerVisible(true);
      if (allRecipes.length === 0) {
        setRecipesLoading(true);
        const data = await recipeService.getAllRecipes();
        setAllRecipes(
          data.filter((r) => r.category !== '4' && r.category !== '5'),
        );
        setRecipesLoading(false);
      }
    },
    [allRecipes.length],
  );

  const handlePickRecipe = useCallback(
    (recipe: Recipe) => {
      if (!pickerTarget) return;
      addMeal(pickerTarget.dayIndex, pickerTarget.slot, recipe);
      setPickerVisible(false);
      setPickerTarget(null);
    },
    [pickerTarget, addMeal],
  );

  const handleClearAll = useCallback(() => {
    Alert.alert('Tout effacer', 'Supprimer tous les repas planifiés ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: clearAll },
    ]);
  }, [clearAll]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.sageDark} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Planifier</Text>
        {meals.length > 0 && (
          <TouchableOpacity
            onPress={handleClearAll}
            accessibilityRole="button"
            accessibilityLabel="Tout effacer"
          >
            <Text style={styles.clearButton}>Tout effacer</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Weekly macro summary */}
        {weeklyMacros && (
          <View style={styles.weeklyCard}>
            <Text style={styles.weeklyTitle}>Total de la semaine</Text>
            <MacroPills macros={weeklyMacros} />
          </View>
        )}

        {/* Day cards: Dimanche (0) → Samedi (6) */}
        {Array.from({ length: 7 }, (_, dayIndex) => {
          const dayMeals = meals.filter((m) => m.dayIndex === dayIndex);
          const dayMacros = sumMacros(dayMeals);

          return (
            <View key={dayIndex} style={styles.dayCard}>
              {/* Day header */}
              <View style={styles.dayHeader}>
                <Text style={styles.dayName}>{DAY_NAMES[dayIndex]}</Text>
              </View>

              {/* Meal slots */}
              {SLOTS.map((slot, slotIndex) => {
                const slotMeals = dayMeals.filter((m) => m.slot === slot);
                const isLast = slotIndex === SLOTS.length - 1;
                return (
                  <View
                    key={slot}
                    style={[styles.slotRow, !isLast && styles.slotRowDivider]}
                  >
                    <Text style={styles.slotLabel}>{SLOT_LABELS[slot]}</Text>
                    <View style={styles.slotContent}>
                      {slotMeals.map((meal) => (
                        <View key={meal.id} style={styles.mealChip}>
                          <Text style={styles.mealChipName} numberOfLines={1}>
                            {meal.recipeName}
                          </Text>
                          <TouchableOpacity
                            onPress={() => removeMeal(meal.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Supprimer ${meal.recipeName}`}
                          >
                            <Ionicons
                              name="close"
                              size={13}
                              color={Colors.textMuted}
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => openPicker(dayIndex, slot)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ajouter pour ${SLOT_LABELS[slot]}`}
                      >
                        <Ionicons
                          name="add"
                          size={16}
                          color={Colors.headerGreen}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              {/* Daily macro totals */}
              {dayMacros && (
                <View style={styles.dayMacroRow}>
                  <MacroPills macros={dayMacros} />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Recipe picker modal */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerVisible(false)}
      >
        <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choisir une recette</Text>
            <TouchableOpacity
              onPress={() => setPickerVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {recipesLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.sageDark} />
            </View>
          ) : (
            <FlatList
              data={allRecipes}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.pickerList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  activeOpacity={0.75}
                  onPress={() => handlePickRecipe(item)}
                >
                  <Text style={styles.pickerItemName}>{item.name}</Text>
                  {item.nutrition && (
                    <Text style={styles.pickerItemKcal}>
                      {item.nutrition.kcal} kcal
                    </Text>
                  )}
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={Colors.chevronGreen}
                  />
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Header */
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
  clearButton: {
    fontSize: 14,
    color: Colors.accent,
    fontWeight: '500',
  },

  /* Scroll */
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  /* Weekly macro card */
  weeklyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: Colors.shadowBase,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  weeklyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.headerGreen,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  /* Macro pills */
  macroPills: {
    flexDirection: 'row',
    gap: 6,
  },
  macroPill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.pillBackground,
    borderRadius: 8,
    paddingVertical: 6,
  },
  macroPillValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  macroPillUnit: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },

  /* Day card */
  dayCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: Colors.shadowBase,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.pillBackground,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.headerGreen,
  },

  /* Slot rows */
  slotRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
  },
  slotRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  slotLabel: {
    width: 72,
    fontSize: 13,
    color: Colors.textMuted,
    paddingTop: 4,
    flexShrink: 0,
  },
  slotContent: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },

  /* Meal chip */
  mealChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.pillBackground,
    borderRadius: 20,
    paddingVertical: 4,
    paddingLeft: 10,
    paddingRight: 8,
    gap: 4,
    maxWidth: 200,
  },
  mealChipName: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '500',
    flexShrink: 1,
  },

  /* Add button */
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Day macro row */
  dayMacroRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },

  /* Modal */
  modal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pickerList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    shadowColor: Colors.shadowBase,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  pickerItemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  pickerItemKcal: {
    fontSize: 13,
    color: Colors.textMuted,
    marginRight: 8,
  },
});

export default PlanifierScreen;
