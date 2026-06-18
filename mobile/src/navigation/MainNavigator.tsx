import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AddSheet } from '../components/AddSheet';
import { BottomNav } from '../components/BottomNav';
import { useApp } from '../context/AppContext';
import { colors } from '../theme/colors';
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
  const [tab, setTab] = useState<MainTab>('recipes');
  const [addOpen, setAddOpen] = useState(false);

  return (
    <TabProvider setTab={setTab}>
    <View style={styles.shell}>
      <ScreenHost tab={tab} />

      <BottomNav
        active={tab}
        onRecipes={() => setTab('recipes')}
        onMeal={() => setTab('mealplan')}
        onGrocery={() => setTab('grocery')}
        onProfile={() => setTab('profile')}
        onAdd={() => setAddOpen(true)}
      />

      <AddSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onImportLink={() => {
          setAddOpen(false);
          navigation.navigate('ImportUrl');
        }}
        onScan={() => {
          setAddOpen(false);
          navigation.navigate('ScanRecipe');
        }}
      />
    </View>
    </TabProvider>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
});
