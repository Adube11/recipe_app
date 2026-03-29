import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ExplorerStackParamList } from '@types/index';
import { Colors } from '@constants/colors';
import ExplorerScreen from '@screens/ExplorerScreen';
import RecipeDetailScreen from '@screens/RecipeDetailScreen';

const Stack = createNativeStackNavigator<ExplorerStackParamList>();

/**
 * Shared header options applied to every screen in this stack.
 *
 * Mirrors STACK_SCREEN_OPTIONS in RecettesStack so both stacks share
 * the same visual header branding without importing from each other.
 */
const STACK_SCREEN_OPTIONS = {
  headerStyle: { backgroundColor: Colors.headerGreen },
  headerTintColor: Colors.headerTint,
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 18 },
  headerShadowVisible: false,
} as const;

/**
 * Nested stack navigator for the Explorer tab.
 *
 * Isolating this stack means the search screen and the recipe detail it
 * opens stay fully contained within the Explorer tab — the back button
 * returns to the search results rather than jumping to a different tab.
 */
export const ExplorerStack = () => {
  return (
    <Stack.Navigator screenOptions={STACK_SCREEN_OPTIONS}>
      <Stack.Screen
        name="Explorer"
        component={ExplorerScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RecipeDetail"
        component={RecipeDetailScreen}
        options={({ route }) => ({ title: route.params.recipeName })}
      />
    </Stack.Navigator>
  );
};
