import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { MainNavigator } from './src/navigation/MainNavigator';
import { RootStackParamList } from './src/navigation/types';
import { colors } from './src/theme/colors';
import { ImportUrlScreen } from './src/screens/ImportUrlScreen';
import { ScanRecipeScreen } from './src/screens/ScanRecipeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ProcessingScreen } from './src/screens/ProcessingScreen';
import { RecipeDetailScreen } from './src/screens/RecipeDetailScreen';
import { ReviewImportScreen } from './src/screens/ReviewImportScreen';
import { EditRecipeScreen } from './src/screens/EditRecipeScreen';
import { Toast } from './src/components/Toast';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { ready, hasOnboarded, toast } = useApp();

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  return (
    <>
      <Stack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
        initialRouteName={hasOnboarded ? 'Main' : 'Onboarding'}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Main" component={MainNavigator} />
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
        <Stack.Screen name="ImportUrl" component={ImportUrlScreen} />
        <Stack.Screen name="ScanRecipe" component={ScanRecipeScreen} />
        <Stack.Screen name="Processing" component={ProcessingScreen} />
        <Stack.Screen name="ReviewImport" component={ReviewImportScreen} />
        <Stack.Screen name="EditRecipe" component={EditRecipeScreen} />
      </Stack.Navigator>
      <Toast message={toast.message} visible={toast.visible} />
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function Gate() {
  const { session, user, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  if (!session || !user) {
    return <AuthScreen />;
  }

  return (
    <AppProvider userId={user.id}>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
