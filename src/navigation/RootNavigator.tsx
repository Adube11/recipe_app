import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { BottomTabNavigator } from '@navigation/BottomTabNavigator';

/**
 * Root navigation shell for the recipe app.
 *
 * Owns the single NavigationContainer (there must only ever be one)
 * and delegates all tab and stack structure to BottomTabNavigator.
 * Keeping this file minimal makes it easy to add a linking config,
 * a theme, or deep-link handling here without touching navigator logic.
 */
export const RootNavigator = () => {
  return (
    <NavigationContainer>
      <BottomTabNavigator />
    </NavigationContainer>
  );
};
