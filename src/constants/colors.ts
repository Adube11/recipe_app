/**
 * Central colour palette for the recipe app.
 *
 * Every colour used across screens and navigation lives here so that a
 * visual refresh never requires hunting through StyleSheet objects.
 * Names describe semantic role, not hex value, so callers stay readable.
 */
export const Colors = {
  /** Page and safe-area background — warm off-white with a green tint. */
  background: '#F4F7F2',

  /** Primary text — very dark forest green, near-black for readability. */
  textPrimary: '#1C2B18',

  /** Secondary / muted text — desaturated mid-green for counts and labels. */
  textMuted: '#6B7D67',

  /** Placeholder / empty-state text. */
  textPlaceholder: '#AAAAAA',

  /** Card surface — pure white so cards lift off the background. */
  cardBackground: '#FFFFFF',

  /** Left accent stripe on category and recipe cards. */
  accentGreen: '#87A96B',

  /** Header background and interactive controls (scaler buttons, pill). */
  headerGreen: '#5A7A4E',

  /** Tint colour for the navigation header icons and title. */
  headerTint: '#FFFFFF',

  /** Muted sage used for chevrons and disabled states. */
  chevronGreen: '#B5CCAA',

  /** Pill background behind the serving scaler. */
  pillBackground: '#E8F0E4',

  /** Horizontal rule between ingredient rows. */
  divider: '#F0EFEB',

  /** Shadow colour for card elevation on iOS. Always black — iOS composites this with opacity. */
  shadowBase: '#000000',

  /** Active tab icon and label — darker sage to meet contrast requirements against white. */
  sageDark: '#5A7A4E',

  /** Inactive tab icon and label — matches textMuted for visual consistency. */
  textSecondary: '#6B7D67',

  /** Tab bar and card surface — pure white to lift elements off the background. */
  surface: '#FFFFFF',

  /** Tab bar top border — light sage-tinted grey so the bar separates softly. */
  border: '#D0DECA',

  /** Warm terracotta used for the favourites heart icon when active. */
  accent: '#C4714A',
} as const;
