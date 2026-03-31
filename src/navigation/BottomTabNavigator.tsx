import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { RootTabParamList } from '@t/index';
import { Colors } from '@constants/colors';
import { RecettesStack } from '@navigation/RecettesStack';
import { ExplorerStack } from '@navigation/ExplorerStack';
import PlanifierScreen from '@screens/PlanifierScreen';
import CoursesScreen from '@screens/CoursesScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

/** Maps each tab name to its filled and outline Ionicons icon names. */
const TAB_ICONS: Record<
  keyof RootTabParamList,
  { focused: React.ComponentProps<typeof Ionicons>['name']; unfocused: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  Recettes:  { focused: 'book',     unfocused: 'book-outline'     },
  Planifier: { focused: 'calendar', unfocused: 'calendar-outline' },
  Courses:   { focused: 'cart',     unfocused: 'cart-outline'     },
  Explorer:  { focused: 'search',   unfocused: 'search-outline'   },
};

/**
 * Root tab navigator for the app.
 *
 * The Recettes tab renders a nested stack navigator (RecettesStack) so the
 * existing category → recipe drill-down flow is preserved inside the tab
 * shell. The Explorer tab similarly uses ExplorerStack so that navigating
 * to a recipe detail from search keeps the back button inside the Explorer
 * tab. Planifier and Courses remain placeholder screens.
 *
 * Tab bar styling is applied once here via `screenOptions` so no individual
 * tab needs to repeat colours or border configuration.
 */
export const BottomTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const icons = TAB_ICONS[route.name];
        return {
          headerShown: false,
          tabBarActiveTintColor: Colors.sageDark,
          tabBarInactiveTintColor: Colors.textSecondary,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
          },
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? icons.focused : icons.unfocused}
              size={size}
              color={color}
            />
          ),
        };
      }}
    >
      <Tab.Screen name="Recettes"  component={RecettesStack}  />
      <Tab.Screen name="Planifier" component={PlanifierScreen} />
      <Tab.Screen name="Courses"   component={CoursesScreen}   />
      <Tab.Screen name="Explorer"  component={ExplorerStack}   />
    </Tab.Navigator>
  );
};
