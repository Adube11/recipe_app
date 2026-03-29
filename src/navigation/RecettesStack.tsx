import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '@types/index';
import { Colors } from '@constants/colors';
import SummaryScreen from '@screens/SummaryScreen';
import CategoryScreen from '@screens/CategoryScreen';
import RecipeDetailScreen from '@screens/RecipeDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Shared header options applied to every screen in this stack.
 *
 * Extracted from the former RootNavigator so the same branding is
 * preserved now that the stack lives inside a tab.
 */
const STACK_SCREEN_OPTIONS = {
  headerStyle: { backgroundColor: Colors.headerGreen },
  headerTintColor: Colors.headerTint,
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 18 },
  headerShadowVisible: false,
} as const;

/**
 * Nested stack navigator for the Recettes tab.
 *
 * Isolating the recipe stack here means the back-navigation and header
 * behaviour of the drill-down flow (Summary → Category → RecipeDetail)
 * is fully contained within one tab and does not affect the others.
 */
export const RecettesStack = () => {
  return (
    <Stack.Navigator screenOptions={STACK_SCREEN_OPTIONS}>
      <Stack.Screen
        name="Summary"
        component={SummaryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Category"
        component={CategoryScreen}
        options={({ route }) => ({
          title: route.params?.categoryName || 'Catégories',
        })}
      />
      <Stack.Screen
        name="RecipeDetail"
        component={RecipeDetailScreen}
        options={({ route }) => ({ title: route.params.recipeName })}
      />
    </Stack.Navigator>
  );
};
