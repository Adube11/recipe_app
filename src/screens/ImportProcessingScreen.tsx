import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@t/index';
import { supabase } from '@services/supabase';
import { useImportJob } from '@hooks/useImportJob';
import { Colors } from '@constants/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ImportProcessing'>;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export default function ImportProcessingScreen({ route, navigation }: Props) {
  const { url } = route.params;
  const [jobId, setJobId] = useState<string | null>(null);
  const [manualCaption, setManualCaption] = useState('');
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<'fetching' | 'generating'>('fetching');

  const { status, result, errorCode, errorMessage } = useImportJob(jobId);

  const startImport = async (caption?: string) => {
    setSubmitting(true);
    setShowPasteInput(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        navigation.popToTop();
        return;
      }

      const body: Record<string, string> = { source_url: url };
      if (caption) body.caption = caption;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/import-instagram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.status === 429) {
        Alert.alert(
          'Limite atteinte',
          'Vous avez atteint la limite de 3 imports par jour.',
          [{ text: 'OK', onPress: () => navigation.popToTop() }],
        );
        return;
      }
      if (!res.ok || !data.jobId) {
        Alert.alert(
          'Erreur',
          data.error ?? "Impossible de démarrer l'import.",
          [{ text: 'Retour', onPress: () => navigation.popToTop() }],
        );
        return;
      }
      setJobId(data.jobId);
    } catch {
      Alert.alert('Erreur', 'Impossible de contacter le serveur.', [
        { text: 'Retour', onPress: () => navigation.popToTop() },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    startImport();
  }, []);

  useEffect(() => {
    if (status === 'processing') setPhase('generating');
  }, [status]);

  useEffect(() => {
    if (status === 'done' && result) {
      navigation.replace('ImportReview', { jobId: jobId! });
    }
    if (status === 'error') {
      if (errorCode === 'INSTAGRAM_PRIVATE' || errorCode === 'EMPTY_CAPTION') {
        setShowPasteInput(true);
      }
    }
  }, [status, result, errorCode, jobId, navigation]);

  const handleCancel = async () => {
    if (jobId) await supabase.from('import_jobs').delete().eq('id', jobId);
    navigation.popToTop();
  };

  if (submitting && !jobId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accentGreen} />
        </View>
      </SafeAreaView>
    );
  }

  if (showPasteInput) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <Text style={styles.title}>Collez la légende</Text>
          <Text style={styles.subtitle}>
            La légende n'a pas pu être récupérée automatiquement. Ouvrez le post
            Instagram, copiez la légende et collez-la ici.
          </Text>
          <TextInput
            style={styles.captionInput}
            multiline
            placeholder="Collez la légende Instagram ici…"
            placeholderTextColor={Colors.textPlaceholder}
            value={manualCaption}
            onChangeText={setManualCaption}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              manualCaption.trim().length < 10 && styles.btnDisabled,
            ]}
            onPress={() => startImport(manualCaption.trim())}
            disabled={manualCaption.trim().length < 10 || submitting}
          >
            <Text style={styles.primaryBtnText}>Générer la recette</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <Text style={styles.title}>
            {errorCode === 'NOT_A_RECIPE' ? 'Pas une recette' : 'Erreur'}
          </Text>
          <Text style={styles.subtitle}>
            {errorMessage ?? "Une erreur est survenue lors de l'import."}
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.popToTop()}
          >
            <Text style={styles.primaryBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <ActivityIndicator
          size="large"
          color={Colors.accentGreen}
          style={styles.spinner}
        />
        <Text style={styles.title}>
          {phase === 'fetching'
            ? 'Récupération de la légende…'
            : 'Génération de la recette…'}
        </Text>
        <Text style={styles.hint}>
          Vous pouvez fermer l'app — nous sauvegarderons votre progression.
        </Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelBtnText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: { marginBottom: 24 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  hint: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 32,
  },
  captionInput: {
    width: '100%',
    height: 160,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.cardBackground,
    marginBottom: 16,
  },
  primaryBtn: {
    backgroundColor: Colors.sageDark,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelBtn: { padding: 12 },
  cancelBtnText: { color: Colors.textMuted, fontSize: 15 },
});
