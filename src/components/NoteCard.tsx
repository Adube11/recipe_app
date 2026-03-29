import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Colors } from '@constants/colors';

interface NoteCardProps {
  note: string | null;
  loading: boolean;
  error: string | null;
  onSave: (content: string) => Promise<void>;
}

/**
 * Inline note card for a recipe detail screen.
 *
 * Handles four visual states in a single component so the calling screen
 * does not need to own any editing logic:
 *   - Loading: spinner while the initial note fetch is in flight.
 *   - Read (empty): tappable placeholder that invites the user to add a note.
 *   - Read (filled): truncated note text, tappable to enter edit mode.
 *   - Edit: full-height TextInput with Save and optional Delete buttons.
 *
 * The component owns a local `draft` string and a `saving` flag. `draft` is
 * pre-filled from the current `note` prop when editing begins so the user can
 * refine rather than retype. `saving` disables both buttons while the async
 * `onSave` call is in flight, preventing double-submissions.
 *
 * This is a client component (interactive text input + local editing state).
 */
const NoteCard: React.FC<NoteCardProps> = ({ note, loading, error, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  /**
   * Enters edit mode and pre-fills the draft with the current note content
   * (or an empty string if there is no note yet).
   */
  const handleStartEdit = () => {
    setDraft(note ?? '');
    setEditing(true);
  };

  /**
   * Calls `onSave` with the current draft, then exits edit mode on success.
   * Leaves the user in edit mode if the save fails so they can retry —
   * the error prop will update to surface the failure message.
   */
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false); // only on success
    } catch {
      // stay in edit mode — error prop will reflect failure
    } finally {
      setSaving(false);
    }
  };

  /**
   * Saves an empty string, which the hook interprets as a delete, then
   * exits edit mode.
   */
  const handleDelete = async () => {
    setSaving(true);
    await onSave('');
    setSaving(false);
    setEditing(false);
  };

  return (
    <View>
      {/* Section title — matches the uppercase pill labels used elsewhere on the screen. */}
      <Text style={styles.sectionLabel}>Notes</Text>

      <View style={styles.card}>
        {loading ? (
          <ActivityIndicator color={Colors.sageDark} />
        ) : editing ? (
          <>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              multiline
              autoFocus
              placeholder="Votre note..."
              placeholderTextColor={Colors.textSecondary}
            />
            <View style={styles.buttonRow}>
              {/* Left slot: Cancel + Delete (delete only shown when a note exists). */}
              <View style={styles.leftButtons}>
                <TouchableOpacity
                  onPress={() => {
                    setDraft(note ?? '');
                    setEditing(false);
                  }}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Annuler"
                >
                  <Text style={[styles.cancelButton, saving && styles.buttonDisabled]}>
                    Annuler
                  </Text>
                </TouchableOpacity>
                {note !== null && (
                  <TouchableOpacity
                    onPress={handleDelete}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel="Supprimer la note"
                  >
                    <Text style={[styles.deleteButton, saving && styles.buttonDisabled]}>
                      Supprimer
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Enregistrer la note"
              >
                <Text style={[styles.saveButton, saving && styles.buttonDisabled]}>
                  Enregistrer
                </Text>
              </TouchableOpacity>
            </View>
            {error !== null && <Text style={styles.errorText}>{error}</Text>}
          </>
        ) : note !== null ? (
          // Read state — filled note, truncated to 3 lines.
          <TouchableOpacity
            onPress={handleStartEdit}
            accessibilityRole="button"
            accessibilityLabel="Modifier la note"
          >
            <Text style={styles.noteText} numberOfLines={3}>
              {note}
            </Text>
          </TouchableOpacity>
        ) : (
          // Read state — empty, invites entry.
          <TouchableOpacity
            onPress={handleStartEdit}
            accessibilityRole="button"
            accessibilityLabel="Ajouter une note"
          >
            <Text style={styles.placeholder}>Ajouter une note...</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  /**
   * Section title — uppercase pill style matching `sectionLabel` in
   * RecipeDetailScreen so Notes feels native to the screen's design system.
   */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.headerGreen,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  /**
   * Card container — bordered surface that distinguishes the note block from
   * the page background without using a drop shadow, keeping it visually
   * lighter than the ingredient and step cards.
   */
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  noteText: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  placeholder: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  input: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  /**
   * Groups the Cancel and Delete buttons on the left side of the button row
   * so Enregistrer stays right-aligned regardless of which left buttons show.
   */
  leftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  /**
   * Annuler — muted colour so it reads as secondary next to Supprimer and
   * does not compete visually with Enregistrer.
   */
  cancelButton: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  deleteButton: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  saveButton: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.sageDark,
  },
  /** Dims both buttons while the async save is in flight. */
  buttonDisabled: {
    opacity: 0.4,
  },
  errorText: {
    fontSize: 12,
    color: Colors.accent,
    marginTop: 8,
  },
});

export default NoteCard;
