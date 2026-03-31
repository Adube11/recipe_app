import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList, Difficulty } from '@t/index';
import recipeService from '@services/recipeService';
import { supabase } from '@services/supabase';
import { Colors } from '@constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'RecipeForm'>;

/** Ingredient or instruction row with a stable identity independent of array index. */
type ListItem = { id: string; value: string };

const makeId = () => `${Date.now()}-${Math.random()}`;

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'facile', label: 'Facile' },
  { value: 'moyen', label: 'Moyen' },
  { value: 'difficile', label: 'Difficile' },
];

/**
 * Form screen for adding and editing user-authored recipes.
 *
 * Mode is derived from `route.params.recipeId`:
 *   - undefined → Add mode (blank form, "Enregistrer la recette")
 *   - string    → Edit mode (pre-populated, "Enregistrer les modifications")
 *
 * After a successful save, `navigation.replace('RecipeDetail', ...)` is called
 * so the back button skips the form and returns to the previous screen.
 * After delete, `navigation.popToTop()` returns to SummaryScreen.
 */
export default function RecipeFormScreen({ route, navigation }: Props) {
  const recipeId = route.params?.recipeId;
  const isEditMode = !!recipeId;
  const headerHeight = useHeaderHeight();

  // Categories are read once from the service (hardcoded, synchronous).
  const CATEGORIES = recipeService.getAllCategories();

  // ── Form state ──────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(CATEGORIES[0]?.id ?? '1');
  const [difficulty, setDifficulty] = useState<Difficulty>('facile');
  const [portions, setPortions] = useState('4');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [ingredients, setIngredients] = useState<ListItem[]>([
    { id: makeId(), value: '' },
  ]);
  const [instructions, setInstructions] = useState<ListItem[]>([
    { id: makeId(), value: '' },
  ]);
  const [kcal, setKcal] = useState('');
  const [proteines, setProteines] = useState('');
  const [glucides, setGlucides] = useState('');
  const [lipides, setLipides] = useState('');
  /**
   * True once the AI estimation button has been tapped successfully.
   * Resets to false if the user manually edits any nutrition field afterward,
   * so the badge only appears when the displayed values are genuinely AI-produced.
   */
  const [wasEstimated, setWasEstimated] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [loadingRecipe, setLoadingRecipe] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estimationError, setEstimationError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Load recipe in edit mode ─────────────────────────────────────────────
  useEffect(() => {
    if (!recipeId) return;
    let cancelled = false;

    recipeService.getRecipeById(recipeId).then((recipe) => {
      if (cancelled || !recipe) return;
      setName(recipe.name);
      setCategoryId(recipe.category);
      setDifficulty(recipe.difficulty);
      setPortions(String(recipe.quantity));
      setPrepTime(String(recipe.prepTime));
      setCookTime(String(recipe.cookTime));
      setIngredients(
        recipe.ingredients.length > 0
          ? recipe.ingredients.map((v, i) => ({ id: String(i), value: v }))
          : [{ id: makeId(), value: '' }],
      );
      setInstructions(
        recipe.instructions.length > 0
          ? recipe.instructions.map((v, i) => ({ id: String(i), value: v }))
          : [{ id: makeId(), value: '' }],
      );
      if (recipe.nutrition) {
        setKcal(String(recipe.nutrition.kcal));
        setProteines(String(recipe.nutrition.proteines));
        setGlucides(String(recipe.nutrition.glucides));
        setLipides(String(recipe.nutrition.lipides));
      }
      if (recipe.nutritionSource === 'ai_estimated') {
        setWasEstimated(true);
      }
      setLoadingRecipe(false);
    });

    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = useCallback(() => {
    const next: Record<string, string> = {};

    if (!name.trim()) {
      next.name = 'Le nom est requis';
    }
    const portionsNum = parseInt(portions, 10);
    if (!portions.trim() || isNaN(portionsNum) || portionsNum < 1) {
      next.portions = 'Entrez un nombre de portions valide';
    }
    const prepNum = parseInt(prepTime, 10);
    if (!prepTime.trim() || isNaN(prepNum) || prepNum < 0) {
      next.prepTime = 'Entrez un temps de préparation valide';
    }
    if (!ingredients.some((i) => i.value.trim())) {
      next.ingredients = 'Ajoutez au moins un ingrédient';
    }
    if (!instructions.some((i) => i.value.trim())) {
      next.instructions = 'Ajoutez au moins une étape';
    }
    // Require all-or-nothing for nutrition fields.
    const nutritionFields = [kcal, proteines, glucides, lipides];
    const filledCount = nutritionFields.filter((f) => f.trim()).length;
    if (filledCount > 0 && filledCount < 4) {
      next.nutrition =
        'Remplissez tous les champs nutritionnels ou laissez-les vides';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [
    name,
    portions,
    prepTime,
    ingredients,
    instructions,
    kcal,
    proteines,
    glucides,
    lipides,
  ]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);

    const allFilled = [kcal, proteines, glucides, lipides].every((f) =>
      f.trim(),
    );
    const nutritionSource: 'ai_estimated' | 'manual' | null = wasEstimated
      ? 'ai_estimated'
      : allFilled
      ? 'manual'
      : null;
    const nutrition = allFilled
      ? {
          kcal: parseInt(kcal, 10),
          proteines: parseInt(proteines, 10),
          glucides: parseInt(glucides, 10),
          lipides: parseInt(lipides, 10),
        }
      : undefined;

    const portionsNum = parseInt(portions, 10);
    const formData = {
      name: name.trim(),
      categoryId,
      difficulty,
      servings: portionsNum,
      prepTime: parseInt(prepTime, 10),
      cookTime: parseInt(cookTime, 10) || 0,
      ingredients: ingredients.map((i) => i.value).filter((v) => v.trim()),
      instructions: instructions.map((i) => i.value).filter((v) => v.trim()),
      nutrition,
      nutritionSource,
    };

    try {
      const saved =
        isEditMode && recipeId
          ? await recipeService.updateRecipe(recipeId, formData)
          : await recipeService.addRecipe(formData);

      if (saved) {
        navigation.replace('RecipeDetail', {
          recipeId: saved.id,
          recipeName: saved.name,
        });
      } else {
        setErrors({ save: 'Une erreur est survenue. Réessayez.' });
      }
    } catch {
      setErrors({ save: 'Une erreur est survenue. Réessayez.' });
    } finally {
      setSaving(false);
    }
  }, [
    validate,
    name,
    categoryId,
    difficulty,
    portions,
    prepTime,
    cookTime,
    ingredients,
    instructions,
    kcal,
    proteines,
    glucides,
    lipides,
    wasEstimated,
    isEditMode,
    recipeId,
    navigation,
  ]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!recipeId) return;
    Alert.alert(
      'Supprimer cette recette ?',
      'Cette action est irréversible. Vos notes et favoris associés seront également supprimés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const success = await recipeService.deleteRecipe(recipeId);
            if (success) {
              navigation.popToTop();
            } else {
              Alert.alert(
                'Erreur',
                'Impossible de supprimer la recette. Réessayez.',
              );
            }
          },
        },
      ],
    );
  }, [recipeId, navigation]);

  // ── AI Estimation ─────────────────────────────────────────────────────────
  const handleEstimate = useCallback(async () => {
    setEstimating(true);
    setEstimationError(null);

    try {
      const portionsNum = parseInt(portions, 10);
      const { data, error } = await supabase.functions.invoke(
        'estimate-nutrition',
        {
          body: {
            name: name.trim(),
            ingredients: ingredients
              .map((i) => i.value)
              .filter((v) => v.trim()),
            servings: portionsNum > 0 ? portionsNum : 1,
          },
        },
      );

      if (error) throw error;

      if (data?.error === 'RATE_LIMIT') {
        setEstimationError(
          "Quota d'estimation atteint pour aujourd'hui. Entrez les valeurs manuellement.",
        );
        return;
      }

      if (
        data?.kcal !== undefined &&
        data?.proteines !== undefined &&
        data?.glucides !== undefined &&
        data?.lipides !== undefined
      ) {
        setKcal(String(data.kcal));
        setProteines(String(data.proteines));
        setGlucides(String(data.glucides));
        setLipides(String(data.lipides));
        setWasEstimated(true);
        setErrors((prev) => {
          const next = { ...prev };
          delete next.nutrition;
          return next;
        });
      } else {
        setEstimationError(
          "L'estimation a retourné des données invalides. Réessayez.",
        );
      }
    } catch {
      setEstimationError(
        "L'estimation a échoué. Réessayez ou entrez les valeurs manuellement.",
      );
    } finally {
      setEstimating(false);
    }
  }, [name, ingredients, portions]);

  // ── Nutrition field helpers (reset wasEstimated on manual edit) ───────────
  const handleKcalChange = useCallback((v: string) => {
    setKcal(v);
    setWasEstimated(false);
  }, []);
  const handleProteinesChange = useCallback((v: string) => {
    setProteines(v);
    setWasEstimated(false);
  }, []);
  const handleGlucidesChange = useCallback((v: string) => {
    setGlucides(v);
    setWasEstimated(false);
  }, []);
  const handleLipidesChange = useCallback((v: string) => {
    setLipides(v);
    setWasEstimated(false);
  }, []);

  // ── Dynamic list helpers ──────────────────────────────────────────────────
  const updateIngredient = useCallback((id: string, value: string) => {
    setIngredients((prev) =>
      prev.map((item) => (item.id === id ? { ...item, value } : item)),
    );
  }, []);

  const addIngredient = useCallback(() => {
    setIngredients((prev) => [...prev, { id: makeId(), value: '' }]);
  }, []);

  const removeIngredient = useCallback((id: string) => {
    setIngredients((prev) =>
      prev.length > 1 ? prev.filter((item) => item.id !== id) : prev,
    );
  }, []);

  const updateInstruction = useCallback((id: string, value: string) => {
    setInstructions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, value } : item)),
    );
  }, []);

  const addInstruction = useCallback(() => {
    setInstructions((prev) => [...prev, { id: makeId(), value: '' }]);
  }, []);

  const removeInstruction = useCallback((id: string) => {
    setInstructions((prev) =>
      prev.length > 1 ? prev.filter((item) => item.id !== id) : prev,
    );
  }, []);

  // ── Loading state (edit mode fetching recipe) ────────────────────────────
  if (loadingRecipe) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.sageDark} />
        </View>
      </SafeAreaView>
    );
  }

  const canEstimate =
    name.trim().length > 0 && ingredients.some((i) => i.value.trim());

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Identité ─────────────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>IDENTITÉ</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nom de la recette *</Text>
            <TextInput
              style={[styles.input, !!errors.name && styles.inputError]}
              value={name}
              onChangeText={setName}
              placeholder="Ex : Poulet rôti aux herbes"
              placeholderTextColor={Colors.textPlaceholder}
              returnKeyType="next"
            />
            {!!errors.name && (
              <Text style={styles.errorText}>{errors.name}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Catégorie *</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.chip,
                    categoryId === cat.id && styles.chipActive,
                  ]}
                  onPress={() => setCategoryId(cat.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      categoryId === cat.id && styles.chipTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Difficulté *</Text>
            <View style={styles.segmented}>
              {DIFFICULTIES.map((d, i) => (
                <TouchableOpacity
                  key={d.value}
                  style={[
                    styles.segmentButton,
                    difficulty === d.value && styles.segmentButtonActive,
                    i === 0 && styles.segmentFirst,
                    i === DIFFICULTIES.length - 1 && styles.segmentLast,
                  ]}
                  onPress={() => setDifficulty(d.value)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      difficulty === d.value && styles.segmentTextActive,
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nombre de portions *</Text>
            <TextInput
              style={[
                styles.inputSmall,
                !!errors.portions && styles.inputError,
              ]}
              value={portions}
              onChangeText={setPortions}
              keyboardType="number-pad"
              placeholder="4"
              placeholderTextColor={Colors.textPlaceholder}
            />
            {!!errors.portions && (
              <Text style={styles.errorText}>{errors.portions}</Text>
            )}
          </View>

          {/* ── Temps ────────────────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
            TEMPS
          </Text>

          <View style={styles.timeRow}>
            <View style={[styles.field, styles.fieldHalf]}>
              <Text style={styles.fieldLabel}>Préparation (min) *</Text>
              <TextInput
                style={[styles.input, !!errors.prepTime && styles.inputError]}
                value={prepTime}
                onChangeText={setPrepTime}
                keyboardType="number-pad"
                placeholder="15"
                placeholderTextColor={Colors.textPlaceholder}
              />
              {!!errors.prepTime && (
                <Text style={styles.errorText}>{errors.prepTime}</Text>
              )}
            </View>
            <View style={[styles.field, styles.fieldHalf]}>
              <Text style={styles.fieldLabel}>Cuisson (min)</Text>
              <TextInput
                style={styles.input}
                value={cookTime}
                onChangeText={setCookTime}
                keyboardType="number-pad"
                placeholder="30"
                placeholderTextColor={Colors.textPlaceholder}
              />
            </View>
          </View>

          {/* ── Ingrédients ──────────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
            INGRÉDIENTS
          </Text>
          {!!errors.ingredients && (
            <Text style={[styles.errorText, styles.listError]}>
              {errors.ingredients}
            </Text>
          )}

          <View style={styles.dynamicList}>
            {ingredients.map((item) => (
              <View key={item.id} style={styles.dynamicRow}>
                <TextInput
                  style={[styles.dynamicInput, styles.flex]}
                  value={item.value}
                  onChangeText={(v) => updateIngredient(item.id, v)}
                  placeholder="Ingrédient"
                  placeholderTextColor={Colors.textPlaceholder}
                  returnKeyType="next"
                />
                {ingredients.length > 1 && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeIngredient(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Supprimer cet ingrédient"
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity
              style={styles.addRowButton}
              onPress={addIngredient}
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={Colors.accentGreen}
              />
              <Text style={styles.addRowText}>Ajouter un ingrédient</Text>
            </TouchableOpacity>
          </View>

          {/* ── Instructions ─────────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
            INSTRUCTIONS
          </Text>
          {!!errors.instructions && (
            <Text style={[styles.errorText, styles.listError]}>
              {errors.instructions}
            </Text>
          )}

          <View style={styles.dynamicList}>
            {instructions.map((item, index) => (
              <View key={item.id} style={styles.dynamicRow}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
                <TextInput
                  style={[
                    styles.dynamicInput,
                    styles.dynamicInputMultiline,
                    styles.flex,
                  ]}
                  value={item.value}
                  onChangeText={(v) => updateInstruction(item.id, v)}
                  placeholder={`Étape ${index + 1}`}
                  placeholderTextColor={Colors.textPlaceholder}
                  multiline
                  textAlignVertical="top"
                />
                {instructions.length > 1 && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeInstruction(item.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Supprimer cette étape"
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity
              style={styles.addRowButton}
              onPress={addInstruction}
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={Colors.accentGreen}
              />
              <Text style={styles.addRowText}>Ajouter une étape</Text>
            </TouchableOpacity>
          </View>

          {/* ── Nutrition ────────────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
            PROFIL NUTRITIONNEL (OPTIONNEL)
          </Text>

          {wasEstimated && (
            <View style={styles.aiBadge}>
              <Ionicons
                name="sparkles-outline"
                size={14}
                color={Colors.accentGreen}
              />
              <Text style={styles.aiBadgeText}>Estimé par IA</Text>
            </View>
          )}

          <View style={styles.nutritionGrid}>
            <View style={[styles.field, styles.fieldHalf]}>
              <Text style={styles.fieldLabel}>Calories (kcal)</Text>
              <TextInput
                style={[styles.input, estimating && styles.inputDisabled]}
                value={kcal}
                onChangeText={handleKcalChange}
                keyboardType="number-pad"
                placeholder="350"
                placeholderTextColor={Colors.textPlaceholder}
                editable={!estimating}
              />
            </View>
            <View style={[styles.field, styles.fieldHalf]}>
              <Text style={styles.fieldLabel}>Protéines (g)</Text>
              <TextInput
                style={[styles.input, estimating && styles.inputDisabled]}
                value={proteines}
                onChangeText={handleProteinesChange}
                keyboardType="number-pad"
                placeholder="25"
                placeholderTextColor={Colors.textPlaceholder}
                editable={!estimating}
              />
            </View>
            <View style={[styles.field, styles.fieldHalf]}>
              <Text style={styles.fieldLabel}>Glucides (g)</Text>
              <TextInput
                style={[styles.input, estimating && styles.inputDisabled]}
                value={glucides}
                onChangeText={handleGlucidesChange}
                keyboardType="number-pad"
                placeholder="40"
                placeholderTextColor={Colors.textPlaceholder}
                editable={!estimating}
              />
            </View>
            <View style={[styles.field, styles.fieldHalf]}>
              <Text style={styles.fieldLabel}>Lipides (g)</Text>
              <TextInput
                style={[styles.input, estimating && styles.inputDisabled]}
                value={lipides}
                onChangeText={handleLipidesChange}
                keyboardType="number-pad"
                placeholder="12"
                placeholderTextColor={Colors.textPlaceholder}
                editable={!estimating}
              />
            </View>
          </View>

          {!!errors.nutrition && (
            <Text style={[styles.errorText, styles.listError]}>
              {errors.nutrition}
            </Text>
          )}

          <TouchableOpacity
            style={[
              styles.estimateButton,
              (!canEstimate || estimating) && styles.estimateButtonDisabled,
            ]}
            onPress={handleEstimate}
            disabled={!canEstimate || estimating}
          >
            {estimating ? (
              <ActivityIndicator size="small" color={Colors.headerTint} />
            ) : (
              <Ionicons
                name="sparkles-outline"
                size={16}
                color={Colors.headerTint}
              />
            )}
            <Text style={styles.estimateButtonText}>
              {estimating
                ? 'Estimation en cours…'
                : wasEstimated
                ? "Ré-estimer avec l'IA"
                : "Estimer avec l'IA"}
            </Text>
          </TouchableOpacity>

          {!!estimationError && (
            <Text style={[styles.errorText, styles.listError]}>
              {estimationError}
            </Text>
          )}

          <Text style={styles.estimationNote}>
            L'estimation utilise le quota partagé de l'IA.
          </Text>

          {/* ── Save ─────────────────────────────────────────────────────── */}
          {!!errors.save && (
            <Text style={[styles.errorText, styles.saveError]}>
              {errors.save}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.headerTint} />
            ) : (
              <Text style={styles.saveButtonText}>
                {isEditMode
                  ? 'Enregistrer les modifications'
                  : 'Enregistrer la recette'}
              </Text>
            )}
          </TouchableOpacity>

          {/* ── Delete (edit mode only) ───────────────────────────────────── */}
          {isEditMode && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Text style={styles.deleteButtonText}>Supprimer la recette</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.headerGreen,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  sectionLabelSpaced: {
    marginTop: 28,
  },
  field: {
    marginBottom: 16,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  inputSmall: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    width: 100,
  },
  inputError: {
    borderColor: Colors.accent,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 12,
    color: Colors.accent,
    marginTop: 4,
  },
  listError: {
    marginTop: 0,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.pillBackground,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.headerGreen,
    borderColor: Colors.headerGreen,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.headerTint,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.pillBackground,
  },
  segmentButtonActive: {
    backgroundColor: Colors.headerGreen,
  },
  segmentFirst: {
    borderTopLeftRadius: 9,
    borderBottomLeftRadius: 9,
  },
  segmentLast: {
    borderTopRightRadius: 9,
    borderBottomRightRadius: 9,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  segmentTextActive: {
    color: Colors.headerTint,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dynamicList: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 16,
    shadowColor: Colors.shadowBase,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 8,
  },
  dynamicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 8,
  },
  dynamicInput: {
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 4,
    minHeight: 32,
  },
  dynamicInputMultiline: {
    minHeight: 56,
  },
  stepNumber: {
    width: 22,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accentGreen,
    lineHeight: 22,
    flexShrink: 0,
  },
  removeButton: {
    padding: 4,
    flexShrink: 0,
  },
  addRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  addRowText: {
    fontSize: 14,
    color: Colors.accentGreen,
    fontWeight: '500',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  aiBadgeText: {
    fontSize: 12,
    color: Colors.accentGreen,
    fontWeight: '500',
  },
  estimateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  estimateButtonDisabled: {
    backgroundColor: Colors.chevronGreen,
  },
  estimateButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.headerTint,
  },
  estimationNote: {
    fontSize: 12,
    color: Colors.textPlaceholder,
    textAlign: 'center',
    marginBottom: 28,
  },
  saveError: {
    marginTop: 0,
    textAlign: 'center',
    marginBottom: 8,
  },
  saveButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.chevronGreen,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.headerTint,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteButtonText: {
    fontSize: 15,
    color: Colors.accent,
    fontWeight: '500',
  },
});
