import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@constants/colors';
import { useGroceryList } from '@hooks/useGroceryList';
import { GroceryCategory, GroceryItem } from '@t/index';

const CATEGORY_LABELS: Record<GroceryCategory, string> = {
  viandes: 'Viandes',
  epicerie: 'Épicerie',
  produits_frais: 'Produits frais',
};

const CATEGORIES: GroceryCategory[] = ['viandes', 'produits_frais', 'epicerie'];

const CoursesScreen = () => {
  const {
    items,
    isLoading,
    addItem,
    toggleItem,
    deleteItem,
    clearChecked,
    clearAll,
  } = useGroceryList();
  const [input, setInput] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<GroceryCategory>('epicerie');
  const inputRef = useRef<TextInput>(null);

  const hasChecked = useMemo(() => items.some((item) => item.checked), [items]);

  const sections = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        title: CATEGORY_LABELS[cat],
        key: cat,
        data: items.filter((item) => item.category === cat),
      })).filter((s) => s.data.length > 0),
    [items],
  );

  const handleAdd = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    await addItem(trimmed, selectedCategory);
    setInput('');
    inputRef.current?.focus();
  }, [input, selectedCategory, addItem]);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Tout effacer',
      'Supprimer tous les articles de votre liste ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Tout effacer', style: 'destructive', onPress: clearAll },
      ],
    );
  }, [clearAll]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    ),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: GroceryItem }) => (
      <Pressable
        style={styles.itemRow}
        onPress={() => toggleItem(item.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
      >
        <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
          {item.checked && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.itemText, item.checked && styles.itemTextChecked]}>
          {item.name}
        </Text>
        <TouchableOpacity
          onPress={() => deleteItem(item.id)}
          hitSlop={8}
          style={styles.deleteButton}
        >
          <Text style={styles.deleteButtonText}>×</Text>
        </TouchableOpacity>
      </Pressable>
    ),
    [toggleItem, deleteItem],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes courses</Text>
        <View style={styles.headerActions}>
          {hasChecked && (
            <TouchableOpacity onPress={clearChecked} hitSlop={8}>
              <Text style={styles.clearButton}>Effacer cochées</Text>
            </TouchableOpacity>
          )}
          {items.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} hitSlop={8}>
              <Text style={styles.clearAllButton}>Tout effacer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {isLoading ? null : sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Votre liste est vide</Text>
          </View>
        ) : (
          <SectionList
            style={styles.flex}
            sections={sections}
            keyExtractor={(item) => item.id}
            renderSectionHeader={renderSectionHeader}
            renderItem={renderItem}
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.listContent}
          />
        )}

        <SafeAreaView edges={['bottom']} style={styles.inputWrapper}>
          <View style={styles.chips}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.chip,
                  selectedCategory === cat && styles.chipActive,
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedCategory === cat && styles.chipTextActive,
                  ]}
                >
                  {CATEGORY_LABELS[cat]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Ajouter un article..."
              placeholderTextColor={Colors.textPlaceholder}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.addButton,
                !input.trim() && styles.addButtonDisabled,
              ]}
              onPress={handleAdd}
              disabled={!input.trim()}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
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
    gap: 16,
  },
  clearButton: {
    fontSize: 14,
    color: Colors.accent,
    fontWeight: '500',
  },
  clearAllButton: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  deleteButton: {
    paddingLeft: 12,
  },
  deleteButtonText: {
    fontSize: 20,
    color: Colors.chevronGreen,
    lineHeight: 22,
  },
  sectionHeader: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.chevronGreen,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accentGreen,
    borderColor: Colors.accentGreen,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  itemText: {
    fontSize: 16,
    color: Colors.textPrimary,
    flex: 1,
  },
  itemTextChecked: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  listContent: {
    paddingBottom: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textPlaceholder,
  },
  inputWrapper: {
    backgroundColor: Colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    shadowColor: Colors.shadowBase,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
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
    color: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.headerGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: Colors.chevronGreen,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 28,
  },
});

export default CoursesScreen;
