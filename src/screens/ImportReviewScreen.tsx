import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@t/index';
import { supabase } from '@services/supabase';
import recipeService from '@services/recipeService';
import { Colors } from '@constants/colors';
import type { ImportJobResult } from '@hooks/useImportJob';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportReview'>;

type ListItem = { id: string; value: string };

const CATEGORIES = [
  { id: '1', name: 'Déjeuner' },
  { id: '2', name: 'Dîner' },
  { id: '3', name: 'Souper' },
  { id: '4', name: 'Dessert' },
  { id: '5', name: 'Préparation' },
];

const DIFFICULTY_OPTIONS: Array<'facile' | 'moyen' | 'difficile'> = [
  'facile',
  'moyen',
  'difficile',
];

function makeItems(values: string[]): ListItem[] {
  return values.map((v, i) => ({ id: `item_${i}`, value: v }));
}

export default function ImportReviewScreen({ route, navigation }: Props) {
  const { jobId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [lowConfidence, setLowConfidence] = useState<string[]>([]);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [difficulty, setDifficulty] = useState<
    'facile' | 'moyen' | 'difficile'
  >('moyen');
  const [servings, setServings] = useState(2);
  const [prepTime, setPrepTime] = useState(0);
  const [cookTime, setCookTime] = useState(0);
  const [ingredients, setIngredients] = useState<ListItem[]>([]);
  const [instructions, setInstructions] = useState<ListItem[]>([]);
  const [macros, setMacros] = useState<ImportJobResult['macros'] | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('source_url, result')
        .eq('id', jobId)
        .single();

      if (error || !data?.result) {
        Alert.alert('Erreur', 'Impossible de charger la recette.', [
          { text: 'Retour', onPress: () => navigation.popToTop() },
        ]);
        return;
      }

      const r = data.result as ImportJobResult;
      setSourceUrl(data.source_url ?? '');
      setLowConfidence(r.low_confidence_fields ?? []);
      setName(r.name ?? '');
      setDifficulty(r.difficulty ?? 'moyen');
      setServings(r.servings ?? 2);
      setPrepTime(r.prep_time ?? 0);
      setCookTime(r.cook_time ?? 0);
      setIngredients(makeItems(r.ingredients ?? []));
      setInstructions(makeItems(r.instructions ?? []));
      setMacros(r.macros ?? null);
      setLoading(false);
    };
    load();
  }, [jobId, navigation]);

  const isLowConfidence = (field: string) => lowConfidence.includes(field);

  const updateIngredient = useCallback((id: string, value: string) => {
    setIngredients((prev) =>
      prev.map((item) => (item.id === id ? { ...item, value } : item)),
    );
  }, []);

  const updateInstruction = useCallback((id: string, value: string) => {
    setInstructions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, value } : item)),
    );
  }, []);

  const handleSave = async () => {
    if (!categoryId) {
      Alert.alert('Catégorie requise', 'Veuillez sélectionner une catégorie.');
      return;
    }
    setSaving(true);
    try {
      const recipe = await recipeService.addRecipe({
        name,
        categoryId,
        difficulty,
        servings,
        prepTime,
        cookTime,
        ingredients: ingredients.map((i) => i.value).filter(Boolean),
        instructions: instructions.map((i) => i.value).filter(Boolean),
        nutrition: macros ?? undefined,
        nutritionSource: 'ai_estimated',
        sourceUrl,
      });

      await supabase.from('import_jobs').delete().eq('id', jobId);

      if (recipe) {
        navigation.replace('RecipeDetail', {
          recipeId: recipe.id,
          recipeName: recipe.name,
        });
      } else {
        Alert.alert('Erreur', "Impossible d'enregistrer la recette.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAbandon = () => {
    Alert.alert('Abandonner', 'Voulez-vous abandonner cet import ?', [
      { text: 'Continuer', style: 'cancel' },
      {
        text: 'Abandonner',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('import_jobs').delete().eq('id', jobId);
          navigation.popToTop();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accentGreen} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            ✦ Importé depuis Instagram — vérifiez chaque champ
          </Text>
        </View>

        <SectionHeader label="Nom" isAI lowConf={isLowConfidence('name')} />
        <TextInput
          style={[styles.input, isLowConfidence('name') && styles.inputWarn]}
          value={name}
          onChangeText={setName}
          placeholder="Nom de la recette"
          placeholderTextColor={Colors.textPlaceholder}
        />

        <SectionHeader label="Catégorie" isAI={false} lowConf={false} />
        <View style={styles.chips}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.chip, categoryId === cat.id && styles.chipActive]}
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

        <SectionHeader
          label="Difficulté"
          isAI
          lowConf={isLowConfidence('difficulty')}
        />
        <View style={styles.chips}>
          {DIFFICULTY_OPTIONS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.chip, difficulty === d && styles.chipActive]}
              onPress={() => setDifficulty(d)}
            >
              <Text
                style={[
                  styles.chipText,
                  difficulty === d && styles.chipTextActive,
                ]}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionHeader label="Détails" isAI lowConf={false} />
        <View style={styles.row}>
          <LabeledInput
            label="Portions"
            value={String(servings)}
            onChangeText={(v) => setServings(parseInt(v) || 1)}
            keyboardType="number-pad"
          />
          <LabeledInput
            label="Prép. (min)"
            value={String(prepTime)}
            onChangeText={(v) => setPrepTime(parseInt(v) || 0)}
            keyboardType="number-pad"
            lowConf={isLowConfidence('prep_time')}
          />
          <LabeledInput
            label="Cuisson (min)"
            value={String(cookTime)}
            onChangeText={(v) => setCookTime(parseInt(v) || 0)}
            keyboardType="number-pad"
            lowConf={isLowConfidence('cook_time')}
          />
        </View>

        <SectionHeader
          label="Ingrédients"
          isAI
          lowConf={isLowConfidence('ingredients')}
        />
        {ingredients.map((item, idx) => (
          <TextInput
            key={item.id}
            style={[
              styles.input,
              isLowConfidence('ingredients') && styles.inputWarn,
            ]}
            value={item.value}
            onChangeText={(v) => updateIngredient(item.id, v)}
            placeholder={`Ingrédient ${idx + 1}`}
            placeholderTextColor={Colors.textPlaceholder}
          />
        ))}

        <SectionHeader
          label="Instructions"
          isAI
          lowConf={isLowConfidence('instructions')}
        />
        {instructions.map((item, idx) => (
          <TextInput
            key={item.id}
            style={[
              styles.input,
              styles.instructionInput,
              isLowConfidence('instructions') && styles.inputWarn,
            ]}
            value={item.value}
            onChangeText={(v) => updateInstruction(item.id, v)}
            placeholder={`Étape ${idx + 1}`}
            placeholderTextColor={Colors.textPlaceholder}
            multiline
            textAlignVertical="top"
          />
        ))}

        {macros && (
          <View style={styles.macrosBox}>
            <Text style={styles.macrosTitle}>
              ✦ Macros estimés par IA (par portion)
            </Text>
            <Text style={styles.macrosText}>
              {macros.kcal} kcal · {macros.proteines}g prot · {macros.glucides}g
              gluc · {macros.lipides}g lip
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.abandonBtn} onPress={handleAbandon}>
          <Text style={styles.abandonBtnText}>Abandonner</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  label,
  isAI,
  lowConf,
}: {
  label: string;
  isAI: boolean;
  lowConf: boolean;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {isAI && <Text style={styles.aiBadge}>✦ IA</Text>}
      {lowConf && <Text style={styles.warnBadge}>⚠</Text>}
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  keyboardType,
  lowConf,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'number-pad';
  lowConf?: boolean;
}) {
  return (
    <View style={styles.labeledInput}>
      <Text style={styles.labeledInputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, lowConf && styles.inputWarn]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  banner: {
    backgroundColor: Colors.pillBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accentGreen,
  },
  bannerText: { fontSize: 13, color: Colors.sageDark, fontWeight: '600' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 6,
    gap: 6,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  aiBadge: { fontSize: 12, color: Colors.sageDark, fontWeight: '600' },
  warnBadge: { fontSize: 13, color: Colors.accent },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.cardBackground,
    marginBottom: 6,
  },
  inputWarn: { borderColor: Colors.accent },
  instructionInput: { minHeight: 72 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: Colors.cardBackground,
  },
  chipActive: {
    backgroundColor: Colors.sageDark,
    borderColor: Colors.sageDark,
  },
  chipText: { fontSize: 14, color: Colors.textPrimary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10 },
  labeledInput: { flex: 1 },
  labeledInputLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  macrosBox: {
    backgroundColor: Colors.pillBackground,
    borderRadius: 10,
    padding: 12,
    marginTop: 20,
    marginBottom: 4,
  },
  macrosTitle: {
    fontSize: 12,
    color: Colors.sageDark,
    fontWeight: '600',
    marginBottom: 4,
  },
  macrosText: { fontSize: 14, color: Colors.textPrimary },
  saveBtn: {
    backgroundColor: Colors.sageDark,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  abandonBtn: { alignItems: 'center', padding: 12 },
  abandonBtnText: { color: Colors.accent, fontSize: 15 },
});
