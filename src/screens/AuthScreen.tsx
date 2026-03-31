import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '@services/supabase';
import { AuthStackParamList } from '@t/index';
import { Colors } from '@constants/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Auth'>;

type Mode = 'connexion' | 'inscription';

type AuthError =
  | 'identifiants_incorrects'
  | 'email_existant'
  | 'mots_de_passe_differents'
  | 'champs_vides'
  | 'reseau'
  | 'generique';

const ERROR_MESSAGES: Record<AuthError, string> = {
  identifiants_incorrects:
    'Identifiants incorrects. Vérifiez votre email et mot de passe.',
  email_existant: 'Un compte existe déjà avec cet email.',
  mots_de_passe_differents: 'Les mots de passe ne correspondent pas.',
  champs_vides: 'Veuillez remplir tous les champs.',
  reseau: 'Impossible de se connecter. Vérifiez votre connexion.',
  generique: "Une erreur s'est produite. Réessayez.",
};

const AuthScreen: React.FC<Props> = ({ navigation }) => {
  const [mode, setMode] = useState<Mode>('connexion');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [confirmationPending, setConfirmationPending] = useState(false);

  const toggleMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setConfirmPassword('');
    setConfirmationPending(false);
  };

  const mapError = (message: string): AuthError => {
    const msg = message.toLowerCase();
    if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
      return 'identifiants_incorrects';
    }
    if (
      msg.includes('already registered') ||
      msg.includes('user already exists')
    ) {
      return 'email_existant';
    }
    if (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('timeout')
    ) {
      return 'reseau';
    }
    return 'generique';
  };

  const handleSubmit = async () => {
    setError(null);
    setConfirmationPending(false);

    if (!email.trim() || !password) {
      setError('champs_vides');
      return;
    }
    if (mode === 'inscription' && password !== confirmPassword) {
      setError('mots_de_passe_differents');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'connexion') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setError(mapError(signInError.message));
        }
        // On success, onAuthStateChange fires SIGNED_IN → RootNavigator handles redirect
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) {
          setError(mapError(signUpError.message));
        } else if (!data.session) {
          // Email confirmation is enabled in Supabase — user must verify before signing in
          setConfirmationPending(true);
        }
        // If data.session is non-null, onAuthStateChange fires SIGNED_IN automatically
      }
    } catch {
      setError('reseau');
    } finally {
      setLoading(false);
    }
  };

  const isConnexion = mode === 'connexion';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.headerGreen}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <Text style={styles.appName}>Mes Recettes</Text>
          <Text style={styles.subtitle}>
            {isConnexion ? 'Content de vous revoir.' : 'Créez votre compte.'}
          </Text>
        </View>

        <View style={styles.form}>
          {confirmationPending ? (
            <View style={styles.infoBanner}>
              <Text style={styles.infoText}>
                Un email de confirmation a été envoyé à {email.trim()}.{'\n'}
                Vérifiez votre boîte de réception pour activer votre compte.
              </Text>
            </View>
          ) : error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{ERROR_MESSAGES[error]}</Text>
              {error === 'email_existant' && (
                <TouchableOpacity onPress={() => toggleMode('connexion')}>
                  <Text style={styles.errorLink}>Se connecter</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
            placeholder="votre@email.com"
            placeholderTextColor={Colors.textPlaceholder}
          />

          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={isConnexion ? 'password' : 'newPassword'}
            autoComplete={isConnexion ? 'current-password' : 'new-password'}
            placeholder="••••••••"
            placeholderTextColor={Colors.textPlaceholder}
          />

          {isConnexion && (
            <TouchableOpacity
              style={styles.forgotLink}
              onPress={() => navigation.navigate('MotDePasseOublie')}
            >
              <Text style={styles.forgotLinkText}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
          )}

          {!isConnexion && (
            <>
              <Text style={styles.label}>Confirmer le mot de passe</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
                placeholder="••••••••"
                placeholderTextColor={Colors.textPlaceholder}
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.headerTint} />
            ) : (
              <Text style={styles.buttonText}>
                {isConnexion ? 'Se connecter' : 'Créer mon compte'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>
              {isConnexion ? 'Pas encore de compte ?' : 'Déjà un compte ?'}
            </Text>
            <TouchableOpacity
              onPress={() =>
                toggleMode(isConnexion ? 'inscription' : 'connexion')
              }
            >
              <Text style={styles.toggleLink}>
                {isConnexion ? 'Créer un compte' : 'Se connecter'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.headerGreen,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 36,
  },
  appName: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.headerTint,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
  },
  form: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  errorText: {
    fontSize: 14,
    color: '#B91C1C',
    lineHeight: 20,
  },
  errorLink: {
    fontSize: 14,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: 6,
  },
  infoBanner: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accentGreen,
  },
  infoText: {
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.3,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.headerTint,
    letterSpacing: 0.2,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -12,
    marginBottom: 20,
  },
  forgotLinkText: {
    fontSize: 13,
    color: Colors.sageDark,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  toggleText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  toggleLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.sageDark,
  },
});

export default AuthScreen;
