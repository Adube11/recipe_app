### Structure

src/
├── screens/
│   ├── SummaryScreen.tsx (categories overview)
│   ├── CategoryScreen.tsx (recipes in category)
│   └── RecipeDetailScreen.tsx (full recipe view)
├── services/
│   └── recipeService.ts (CRUD, storage logic)
├── hooks/
│   └── useRecipes.ts (fetch/manage recipes)
├── types/
│   └── index.ts
├── navigation/
│   └── RootNavigator.tsx
└── App.tsx