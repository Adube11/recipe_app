import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRecipeDetail } from '@hooks/useRecipes';
import { useRecipeUserData } from '@hooks/useRecipeUserData';
import { RootStackParamList } from '@t/index';
import { Colors } from '@constants/colors';
import { supabase } from '@services/supabase';
import NoteCard from '@components/NoteCard';

type Props = NativeStackScreenProps<RootStackParamList, 'RecipeDetail'>;

// ---------------------------------------------------------------------------
// Fraction helpers
// ---------------------------------------------------------------------------

/** Maps each Unicode vulgar fraction character to its decimal value. */
const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
};

/**
 * Converts a raw quantity token into a decimal number.
 *
 * Handles:
 *  - Integers and comma decimals (French format): "2", "1,5"
 *  - ASCII fractions: "1/2", "3/4"
 *  - Unicode vulgar fractions: "½", "¾"
 *  - Mixed whole + ASCII fraction: "1 1/2"
 *  - Mixed whole + Unicode fraction: "1 ¾"
 *
 * Returns null when the token contains no recognisable number.
 */
function parseQuantity(token: string): number | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  // --- Unicode vulgar fraction only (e.g. "½") ---
  if (UNICODE_FRACTIONS[trimmed] !== undefined) {
    return UNICODE_FRACTIONS[trimmed];
  }

  // --- Mixed whole + Unicode fraction (e.g. "1 ¾") ---
  for (const [glyph, val] of Object.entries(UNICODE_FRACTIONS)) {
    const mixedUnicode = new RegExp(`^(\\d+)\\s*${glyph}$`);
    const m = trimmed.match(mixedUnicode);
    if (m) return parseInt(m[1], 10) + val;
  }

  // --- Mixed whole + ASCII fraction (e.g. "1 1/2") ---
  const mixedAscii = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedAscii) {
    return (
      parseInt(mixedAscii[1], 10) +
      parseInt(mixedAscii[2], 10) / parseInt(mixedAscii[3], 10)
    );
  }

  // --- ASCII fraction only (e.g. "1/2") ---
  const asciiFraction = trimmed.match(/^(\d+)\/(\d+)$/);
  if (asciiFraction) {
    return parseInt(asciiFraction[1], 10) / parseInt(asciiFraction[2], 10);
  }

  // --- French comma decimal or plain integer (e.g. "1,5" or "200") ---
  const normalised = trimmed.replace(',', '.');
  const n = parseFloat(normalised);
  return isNaN(n) ? null : n;
}

/**
 * Rounds a scaled quantity to the nearest sensible cooking measure.
 *
 * Strategy:
 *  - If within floating-point noise of a whole number → whole number.
 *  - If within 0.05 of a common cooking fraction (¼ ⅓ ½ ⅔ ¾) → use that fraction.
 *  - Otherwise round to 1 decimal place.
 *
 * This prevents outputs like "1.9999" or "2.0000".
 */
function roundToNearestFraction(n: number): number {
  // Snap to whole number first (handles floating-point noise like 1.9999)
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 0.05) return rounded;

  // Snap to common cooking fractions within a ±0.05 tolerance
  const FRACTIONS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75];
  const floor = Math.floor(n);
  const frac = n - floor;
  for (const f of FRACTIONS) {
    if (Math.abs(frac - f) < 0.05) return floor + f;
  }

  // Fall back to 1 decimal place
  return Math.round(n * 10) / 10;
}

/**
 * Formats a decimal back into a display string.
 *
 * Whole numbers render without decimals.
 * Common fractions render as Unicode glyphs (½, ¼, ¾, ⅓, ⅔).
 * Everything else renders to 1 decimal place with a French comma.
 */
function formatQuantity(n: number): string {
  const floor = Math.floor(n);
  const frac = n - floor;

  // Whole number
  if (frac < 0.01) return String(floor);

  // Common fraction glyphs
  const GLYPH: [number, string][] = [
    [0.25, '¼'],
    [1 / 3, '⅓'],
    [0.5, '½'],
    [2 / 3, '⅔'],
    [0.75, '¾'],
  ];
  for (const [val, glyph] of GLYPH) {
    if (Math.abs(frac - val) < 0.05) {
      return floor === 0 ? glyph : `${floor} ${glyph}`;
    }
  }

  // 1 decimal place with French comma
  return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
}

// ---------------------------------------------------------------------------
// Core scaler
// ---------------------------------------------------------------------------

// --- Quantity regex token — built once at module scope ---
// Order matters: longer / more-specific patterns must come before shorter ones.
const _unicodeGlyphs = Object.keys(UNICODE_FRACTIONS).join('');
const _QTY =
  // mixed whole + unicode fraction: "1 ¾"
  `\\d+\\s*[${_unicodeGlyphs}]` +
  // mixed whole + ASCII fraction: "1 1/2"
  `|\\d+\\s+\\d+\\/\\d+` +
  // ASCII fraction: "1/2"
  `|\\d+\\/\\d+` +
  // unicode fraction alone: "½"
  `|[${_unicodeGlyphs}]` +
  // integer or French comma decimal: "200", "1,5"
  `|\\d+(?:,\\d+)?`;

/**
 * Matches "X à Y remainder" range patterns like "1 à 2 gousses".
 * Compiled once; no capture-group values depend on runtime state.
 */
const _rangeRe = new RegExp(
  `^(${_QTY})(\\s*[^\\dà½¼¾⅓⅔]*?)\\s*à\\s*(${_QTY})(.*)$`,
);

/**
 * Matches a leading quantity token followed by the rest of the string.
 * Compiled once; covers all supported quantity formats.
 */
const _leadingRe = new RegExp(`^(${_QTY})(.*)`);

/**
 * Scales a single French ingredient string by `ratio`.
 *
 * Handles every quantity pattern present in the app's data:
 *  - Integers, French comma decimals, ASCII fractions, Unicode fractions,
 *    mixed whole+fraction, tilde prefix, "X à Y" ranges, and
 *    "leading-qty (parenthetical)" dual-quantity strings.
 *
 * In the leadingMatch branch only, after computing the scaled value the
 * function applies bidirectional metric unit conversion: g↔kg and ml↔L.
 * This keeps quantities human-readable after large scaling — e.g. 2000 g
 * becomes 2 kg rather than an unwieldy gram count.
 *
 * Strings with no leading number are returned unchanged — this covers
 * free-text items like "Sel et poivre au goût" or "Tomates".
 */
export function scaleIngredient(ingredient: string, ratio: number): string {
  if (ratio === 1) return ingredient;

  let str = ingredient;
  let tilde = '';

  // --- Strip leading tilde ---
  if (str.startsWith('~')) {
    tilde = '~';
    str = str.slice(1);
  }

  // --- Range pattern: "X à Y remainder" ---
  // Matches things like "1 à 2 gousses", "2 à 3 c. à soupe", "800 g à 1 kg"
  // The second token may have a unit glued directly to it (e.g. "1 kg").
  // Range branch is left unchanged — no unit conversion applied here.
  const rangeMatch = str.match(_rangeRe);
  if (rangeMatch) {
    const [, rawA, midA, rawB, rest] = rangeMatch;
    const valA = parseQuantity(rawA);
    const valB = parseQuantity(rawB);
    if (valA !== null && valB !== null) {
      const scaledA = formatQuantity(roundToNearestFraction(valA * ratio));
      const scaledB = formatQuantity(roundToNearestFraction(valB * ratio));
      return `${tilde}${scaledA}${midA} à ${scaledB}${rest}`;
    }
  }

  // --- Leading quantity + optional parenthetical: "1 ¾ tasse (430 ml) de…" ---
  // Scale the leading number only; leave the parenthetical unchanged because
  // it becomes an approximation note after scaling.
  const leadingMatch = str.match(_leadingRe);
  if (leadingMatch) {
    const [, rawQty, rest] = leadingMatch;
    const val = parseQuantity(rawQty);
    if (val !== null) {
      let scaledVal = val * ratio;
      let displayRest = rest;

      // --- Bidirectional metric unit conversion ---
      // The unit must immediately follow the quantity token. We strip leading
      // whitespace from `rest` once and test with a word-boundary regex so that
      // words that start with a unit letter (e.g. "gousses", "litre") are not
      // mistakenly treated as a unit symbol.
      const trimmedRest = rest.trimStart();
      const leadingSpace = rest.length - trimmedRest.length; // 0 or 1
      const hasGrams = /^g(\s|$|[^a-zA-Z])/.test(trimmedRest);
      const hasKg = /^kg(\s|$|[^a-zA-Z])/.test(trimmedRest);
      const hasMl = /^ml(\s|$|[^a-zA-Z])/.test(trimmedRest);
      const hasL = /^L(\s|$|[^a-zA-Z])/.test(trimmedRest);

      if (hasGrams) {
        if (scaledVal >= 1000) {
          scaledVal = scaledVal / 1000;
          displayRest = ' '.repeat(leadingSpace) + 'kg' + trimmedRest.slice(1);
        }
      } else if (hasKg) {
        if (scaledVal < 1) {
          scaledVal = scaledVal * 1000;
          displayRest = ' '.repeat(leadingSpace) + 'g' + trimmedRest.slice(2);
        }
      } else if (hasMl) {
        if (scaledVal >= 1000) {
          scaledVal = scaledVal / 1000;
          displayRest = ' '.repeat(leadingSpace) + 'L' + trimmedRest.slice(2);
        }
      } else if (hasL) {
        if (scaledVal < 1) {
          scaledVal = scaledVal * 1000;
          displayRest = ' '.repeat(leadingSpace) + 'ml' + trimmedRest.slice(1);
        }
      }

      const scaled = formatQuantity(roundToNearestFraction(scaledVal));
      return `${tilde}${scaled}${displayRest}`;
    }
  }

  // --- No leading number found — return unchanged ---
  return ingredient;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Shared hit slop for the serving scaler buttons.
 *
 * Enlarges the touchable area beyond the visible glyph so the small − and +
 * targets are easy to tap without requiring pixel-perfect accuracy.
 */
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Full recipe view — name, interactive serving scaler, ingredients list,
 * and instructions.
 *
 * Sections use a pill-style label so the user can scan the structure at a
 * glance. Ingredients are rendered as individual rows; each row is tappable
 * while cooking to mark it as added. Checked rows fade to 40% opacity so
 * the user's eye naturally lands on what still needs to be done.
 *
 * Instructions are rendered as numbered, tappable step rows. Checking a step
 * fades it to 40% opacity (no strikethrough — intentionally different from
 * ingredients). The first unchecked step is passively highlighted with a
 * green left border, giving a subtle "you are here" cue. This border
 * disappears once all steps are checked (findIndex returns -1).
 *
 * The serving scaler adjusts ingredient quantities in real time via
 * `scaleIngredient`. Checked state for both ingredients and steps resets on
 * every serving change — done inline in the handler (not a useEffect) to
 * avoid a visual flash where checked rows briefly appear before being cleared.
 *
 * All state is local and intentionally ephemeral — it resets when navigating
 * away.
 */
const RecipeDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { recipeId } = route.params;
  const { recipe, loading } = useRecipeDetail(recipeId);
  const {
    isFavorited,
    favoriteWriting,
    toggleFavorite,
    note,
    noteLoading,
    noteError,
    saveNote,
  } = useRecipeUserData(recipeId);

  /** ID of the signed-in user — used to determine recipe ownership for edit. */
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user?.id ?? null);
    });
  }, []);

  /**
   * Current serving count. Initialised to the recipe's base quantity once
   * the recipe loads. Bounded [1, 20].
   */
  const [servings, setServings] = useState<number | null>(null);

  /**
   * Tracks which ingredient rows have been checked off. Keyed by array index
   * so that two identical ingredient strings in a recipe don't share state.
   */
  const [checked, setChecked] = useState<Set<number>>(new Set());

  /**
   * Tracks which instruction step rows have been checked off. Keyed by
   * zero-based array index, displayed as 1-indexed step numbers.
   */
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  /**
   * Toggles the checked state of a single ingredient row by its index.
   * useCallback avoids re-creating the function on every render.
   */
  const toggle = useCallback((index: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  /**
   * Toggles the checked state of a single instruction step row by its index.
   * Mirrors the same pattern as `toggle` for ingredients.
   */
  const toggleStep = useCallback((index: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  /**
   * Changes the serving count and immediately clears all checkboxes for both
   * ingredients and steps. Clearing happens here rather than in a useEffect
   * to prevent the brief visual flash that would occur if the state updates
   * ran in separate render cycles.
   */
  const changeServings = useCallback((delta: number, baseQuantity: number) => {
    setServings((prev) => {
      const current = prev ?? baseQuantity;
      const next = Math.min(20, Math.max(1, current + delta));
      return next === current ? current : next;
    });
    setChecked(new Set());
    setCheckedSteps(new Set());
  }, []);

  // Resolve the current serving count. Falls back to safe defaults when
  // recipe is not yet available so the memos below can run unconditionally.
  const currentServings = recipe ? servings ?? recipe.quantity : 1;
  const ratio = recipe ? currentServings / recipe.quantity : 1;
  const atMin = currentServings === 1;
  const atMax = currentServings === 20;

  // Derive the index of the first unchecked step. Memoised so the findIndex
  // scan only reruns when checkedSteps or the instruction list actually changes.
  const firstUncheckedStep = useMemo(() => {
    if (!recipe) return -1;
    return recipe.instructions.findIndex((_, i) => !checkedSteps.has(i));
  }, [checkedSteps, recipe]);

  const perServingNutrition = recipe?.nutrition ?? null;
  const isOwner = !!recipe?.userId && recipe.userId === currentUserId;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Custom header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={26} color={Colors.sageDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {recipe?.name ?? route.params.recipeName}
        </Text>
        <View style={styles.headerActions}>
          {isOwner && (
            <TouchableOpacity
              onPress={() => navigation.navigate('RecipeForm', { recipeId })}
              accessibilityRole="button"
              accessibilityLabel="Modifier la recette"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="create-outline"
                size={24}
                color={Colors.textSecondary}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={toggleFavorite}
            disabled={favoriteWriting}
            accessibilityRole="button"
            accessibilityLabel={
              isFavorited ? 'Retirer des favoris' : 'Ajouter aux favoris'
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorited ? Colors.accent : Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.errorContainer}>
          <ActivityIndicator size="large" color={Colors.sageDark} />
        </View>
      ) : !recipe ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Recette non trouvée</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Interactive serving scaler pill */}
          <View style={styles.metaPill}>
            <TouchableOpacity
              onPress={() => changeServings(-1, recipe.quantity)}
              disabled={atMin}
              accessibilityRole="button"
              accessibilityLabel="Réduire les portions"
              accessibilityState={{ disabled: atMin }}
              hitSlop={HIT_SLOP}
            >
              <Text
                style={[
                  styles.scalerButton,
                  atMin && styles.scalerButtonDisabled,
                ]}
              >
                −
              </Text>
            </TouchableOpacity>

            <Text style={styles.metaText}>
              {currentServings} portion{currentServings > 1 ? 's' : ''}
            </Text>

            <TouchableOpacity
              onPress={() => changeServings(1, recipe.quantity)}
              disabled={atMax}
              accessibilityRole="button"
              accessibilityLabel="Augmenter les portions"
              accessibilityState={{ disabled: atMax }}
              hitSlop={HIT_SLOP}
            >
              <Text
                style={[
                  styles.scalerButton,
                  atMax && styles.scalerButtonDisabled,
                ]}
              >
                +
              </Text>
            </TouchableOpacity>
          </View>

          {/* Nutrition card — rendered only when per-serving data is available */}
          {perServingNutrition !== null && (
            <View style={styles.nutritionCard}>
              <View style={styles.nutritionPills}>
                {/* KCAL */}
                <View style={styles.nutritionPill}>
                  <Text style={styles.nutritionLabel}>KCAL</Text>
                  <Text style={styles.nutritionValue}>
                    {perServingNutrition.kcal}
                  </Text>
                  <Text style={styles.nutritionUnit}>kcal</Text>
                </View>
                {/* PROT. */}
                <View style={styles.nutritionPill}>
                  <Text style={styles.nutritionLabel}>PROT.</Text>
                  <Text style={styles.nutritionValue}>
                    {perServingNutrition.proteines}
                  </Text>
                  <Text style={styles.nutritionUnit}>g</Text>
                </View>
                {/* GLUC. */}
                <View style={styles.nutritionPill}>
                  <Text style={styles.nutritionLabel}>GLUC.</Text>
                  <Text style={styles.nutritionValue}>
                    {perServingNutrition.glucides}
                  </Text>
                  <Text style={styles.nutritionUnit}>g</Text>
                </View>
                {/* LIP. */}
                <View style={styles.nutritionPill}>
                  <Text style={styles.nutritionLabel}>LIP.</Text>
                  <Text style={styles.nutritionValue}>
                    {perServingNutrition.lipides}
                  </Text>
                  <Text style={styles.nutritionUnit}>g</Text>
                </View>
              </View>
              <View style={styles.nutritionFootnoteRow}>
                <Text style={styles.nutritionFootnote}>Par portion</Text>
                {recipe.nutritionSource === 'ai_estimated' && (
                  <View style={styles.aiBadge}>
                    <Ionicons
                      name="sparkles-outline"
                      size={11}
                      color={Colors.accentGreen}
                    />
                    <Text style={styles.aiBadgeText}>Estimé par IA</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Per-recipe user note */}
          <NoteCard
            note={note}
            loading={noteLoading}
            error={noteError}
            onSave={saveNote}
          />

          {/* Ingredients section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Ingrédients</Text>
            <View style={styles.ingredientsList}>
              {recipe.ingredients.map((ingredient, index) => {
                const isChecked = checked.has(index);
                const displayText = scaleIngredient(ingredient, ratio);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.ingredientRow,
                      isChecked && styles.ingredientRowChecked,
                    ]}
                    onPress={() => toggle(index)}
                    activeOpacity={0.6}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                    accessibilityLabel={displayText}
                  >
                    {/* Checkbox indicator — filled green when checked, sage dot when not */}
                    {isChecked ? (
                      <View style={styles.checkboxFilled}>
                        <Text style={styles.checkmark}>✓</Text>
                      </View>
                    ) : (
                      <View style={styles.dot} />
                    )}
                    <Text
                      style={[
                        styles.ingredientText,
                        isChecked && styles.ingredientTextChecked,
                      ]}
                    >
                      {displayText}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Instructions section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Instructions</Text>
            <View style={styles.stepsList}>
              {recipe.instructions.map((step, index) => {
                const isChecked = checkedSteps.has(index);
                // The first unchecked step gets a passive left-border highlight so
                // the cook's eye is drawn to the current step without storing extra state.
                const isCurrentStep = index === firstUncheckedStep;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.stepRow,
                      isChecked && styles.stepRowChecked,
                      isCurrentStep && styles.stepRowCurrent,
                    ]}
                    onPress={() => toggleStep(index)}
                    activeOpacity={0.6}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                    accessibilityLabel={`Étape ${index + 1} : ${step}`}
                  >
                    {/* Step number — replaced by ✓ glyph when checked */}
                    <Text style={styles.stepNumber}>
                      {isChecked ? '✓' : `${index + 1}`}
                    </Text>
                    <Text style={styles.stepText}>{step}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.sageDark,
    marginHorizontal: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textPlaceholder,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.pillBackground,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
    marginBottom: 28,
    gap: 10,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.headerGreen,
    minWidth: 80,
    textAlign: 'center',
  },
  scalerButton: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.headerGreen,
    lineHeight: 20,
  },
  /**
   * Dimmed state for the − button at 1 portion and + button at 20 portions.
   * Opacity alone (rather than a colour change) keeps the pill visually
   * consistent — only the affordance fades, not the whole control.
   */
  scalerButtonDisabled: {
    opacity: 0.3,
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.headerGreen,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  ingredientsList: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: Colors.shadowBase,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  /**
   * Checked rows drop to 40% opacity so the eye skips past what's already
   * been added and lands on what remains. No border change needed — the
   * opacity shift alone communicates "done".
   */
  ingredientRowChecked: {
    opacity: 0.4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentGreen,
    marginTop: 6,
    marginRight: 12,
    flexShrink: 0,
  },
  /**
   * Filled green circle that replaces the dot when an ingredient is checked.
   * Sized to match the line-height anchor so it sits flush with the text cap.
   */
  checkboxFilled: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.accentGreen,
    marginRight: 10,
    marginTop: 1,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: Colors.headerTint,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  ingredientTextChecked: {
    textDecorationLine: 'line-through',
  },
  /**
   * Outer card that wraps the four nutrition pills and the footnote line.
   * Matches the visual weight of ingredient and step cards — same background,
   * radius, and shadow — so the block reads as part of the same design system.
   */
  nutritionCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 28,
    shadowColor: Colors.shadowBase,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  /**
   * Row that distributes the four pills evenly across the card width.
   * space-between gives symmetric outer gutters without extra padding.
   */
  nutritionPills: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  /**
   * Individual macro pill — column-stacked label, value, unit with a
   * pill-tinted background so each box lifts slightly off the card.
   */
  nutritionPill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.pillBackground,
    borderRadius: 10,
    paddingVertical: 8,
    marginHorizontal: 3,
  },
  /** Uppercase macro abbreviation — muted so value reads first. */
  nutritionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  /** Scaled integer value — primary weight so it anchors the pill visually. */
  nutritionValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  /** Unit beneath the value — muted, small, mirrors the label weight. */
  nutritionUnit: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  /**
   * Row that holds the "Par portion" footnote and the optional AI badge.
   */
  nutritionFootnoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  /**
   * Footnote below the pills clarifying that values are for the current
   * serving count, not a single serving — important since the scaler changes
   * the displayed numbers.
   */
  nutritionFootnote: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  aiBadgeText: {
    fontSize: 11,
    color: Colors.accentGreen,
    fontWeight: '500',
  },

  /**
   * Steps share the same card container style as the ingredients list so the
   * two sections feel visually consistent. Individual row styles diverge
   * intentionally: steps use opacity-only for checked state (no strikethrough)
   * and a number column instead of a dot/checkbox.
   */
  stepsList: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: Colors.shadowBase,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  /**
   * Checked steps fade to 40% — same signal as ingredients but deliberately
   * without strikethrough. Steps describe actions already taken; fading is
   * enough to push them into the visual background.
   */
  stepRowChecked: {
    opacity: 0.4,
  },
  /**
   * Passive left-border accent on the first unchecked step. The green border
   * alone is sufficient to signal "you are here" — no opacity reduction so
   * the current step stays visually distinct from already-checked (faded) steps.
   */
  stepRowCurrent: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.accentGreen,
    paddingLeft: 10,
  },
  /**
   * Fixed-width column so all step text lines up regardless of whether the
   * number is single or double digit. Shows the step number normally; swaps
   * to a ✓ glyph in the same green when checked.
   */
  stepNumber: {
    width: 24,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accentGreen,
    lineHeight: 22,
    flexShrink: 0,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
});

export default RecipeDetailScreen;
