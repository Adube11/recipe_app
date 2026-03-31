import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@services/supabase';
import { Colors } from '@constants/colors';

const CompteScreen: React.FC = () => {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
    });
  }, []);

  const handleSignOut = async () => {
    setSignOutError(false);
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLoading(false);
      setSignOutError(true);
      return;
    }
    // On success, onAuthStateChange fires SIGNED_OUT → RootNavigator handles redirect
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        <View style={styles.emailCard}>
          <Text style={styles.emailLabel}>Connecté en tant que</Text>
          <Text style={styles.emailValue}>{email ?? '…'}</Text>
        </View>

        {signOutError && (
          <Text style={styles.errorText}>
            Impossible de se déconnecter. Réessayez.
          </Text>
        )}

        <TouchableOpacity
          style={[styles.signOutButton, loading && styles.signOutDisabled]}
          onPress={handleSignOut}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={Colors.headerTint} />
          ) : (
            <Text style={styles.signOutText}>Se déconnecter</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  emailCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  emailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  emailValue: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  signOutButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  signOutDisabled: {
    opacity: 0.6,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.headerTint,
  },
  errorText: {
    fontSize: 14,
    color: '#B91C1C',
    marginBottom: 12,
    textAlign: 'center',
  },
});

export default CompteScreen;
