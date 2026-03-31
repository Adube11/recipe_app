import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@services/supabase';
import { BottomTabNavigator } from '@navigation/BottomTabNavigator';
import AuthScreen from '@screens/AuthScreen';
import MotDePasseOublieScreen from '@screens/MotDePasseOublieScreen';
import { AuthStackParamList } from '@t/index';
import { Colors } from '@constants/colors';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Root navigation shell.
 *
 * On mount, resolves the stored session from expo-secure-store. During
 * that async window, a neutral splash is shown to avoid a flash of the
 * auth screen for already-signed-in users.
 *
 * The onAuthStateChange listener keeps the gate in sync for the lifetime
 * of the app — handles token expiry, sign-out, and sign-in from any screen.
 */
export const RootNavigator = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <View style={styles.splash} />;
  }

  return (
    <NavigationContainer>
      {session ? (
        <BottomTabNavigator />
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Auth" component={AuthScreen} />
          <AuthStack.Screen
            name="MotDePasseOublie"
            component={MotDePasseOublieScreen}
          />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
