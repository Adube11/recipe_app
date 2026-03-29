import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@constants/colors';

/**
 * Placeholder for the meal-planning tab.
 *
 * Renders a centred "coming soon" message so the tab is navigable
 * without exposing unfinished functionality to the user.
 */
const PlanifierScreen = () => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.heading}>Planifier</Text>
      <Text style={styles.subtitle}>Bientôt disponible</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.sageDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});

export default PlanifierScreen;
