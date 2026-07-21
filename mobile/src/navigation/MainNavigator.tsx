import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AddSheet } from '../components/AddSheet';
import { BottomNav } from '../components/BottomNav';
import { useApp } from '../context/AppContext';
import { usePremium } from '../context/PremiumContext';
import { useTheme } from '../theme/ThemeContext';
import { COVER_PRESETS } from '../components/CoverArt';
import { RootStackParamList } from './types';
import { GroceryScreen } from '../screens/GroceryScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MealPlanScreen } from '../screens/MealPlanScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { TabProvider } from './TabContext';
import { MainTab } from './types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function ScreenHost({ tab }: { tab: MainTab }) {
  switch (tab) {
    case 'mealplan':
      return <MealPlanScreen />;
    case 'grocery':
      return <GroceryScreen />;
    case 'profile':
      return <ProfileScreen />;
    default:
      return <HomeScreen />;
  }
}

export function MainNavigator() {
  const navigation = useNavigation<Nav>();
  const { showToast } = useApp();
  const { isPremium } = usePremium();
  const c = useTheme();
  const [tab, setTab] = useState<MainTab>('recipes');
  const [addOpen, setAddOpen] = useState(false);

  // Meal planner and grocery are premium-only. Free accounts get the paywall
  // instead of the tab; browsing recipes stays free.
  const gatedSetTab = (target: MainTab) => {
    if ((target === 'mealplan' || target === 'grocery') && !isPremium) {
      navigation.navigate('Paywall', { reason: 'upsell' });
      return;
    }
    setTab(target);
  };

  // Close the "paste a link" sheet whenever we navigate away from Main — e.g. a
  // share-sheet import (Instagram → YumiShare) opens Processing behind the sheet,
  // which otherwise stayed open over the running import.
  useEffect(() => {
    const unsub = navigation.addListener('blur', () => setAddOpen(false));
    return unsub;
  }, [navigation]);

  return (
    <TabProvider setTab={gatedSetTab}>
    <View style={[styles.shell, { backgroundColor: c.bg }]}>
      <ScreenHost tab={tab} />

      <BottomNav
        active={tab}
        onRecipes={() => setTab('recipes')}
        onMeal={() => gatedSetTab('mealplan')}
        onGrocery={() => gatedSetTab('grocery')}
        onProfile={() => setTab('profile')}
        onAdd={() => setAddOpen(true)}
      />

      <AddSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onOutOfCredits={() => navigation.navigate('Paywall', { reason: 'out_of_credits' })}
        onScan={() => { setAddOpen(false); navigation.navigate('ScanRecipe'); }}
        onScanBarcode={() => { setAddOpen(false); navigation.navigate('ScanBarcode'); }}
        onScanReceipt={() => {
          setAddOpen(false);
          if (!isPremium) navigation.navigate('Paywall', { reason: 'upsell' });
          else navigation.navigate('ScanReceipt');
        }}
        onRecipeReady={(draft) => { setAddOpen(false); navigation.navigate('ReviewImport', { draft }); }}
        onManualRecipe={() => {
          setAddOpen(false);
          navigation.navigate('ReviewImport', {
            manual: true,
            draft: {
              id: '',
              title: '',
              time: 30,
              servings: 4,
              rating: '0',
              app: 'manual',
              handle: '',
              tint: '#F97316',
              sourceTint: '#F97316',
              kcal: 0,
              p: 0,
              c: 0,
              f: 0,
              tags: [],
              ingredients: [],
              steps: [],
              cover: COVER_PRESETS[0].id,
            },
          });
        }}
      />
    </View>
    </TabProvider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
});
