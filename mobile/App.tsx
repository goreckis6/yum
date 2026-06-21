import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  useFonts,
  Newsreader_600SemiBold,
  Newsreader_700Bold,
} from '@expo-google-fonts/newsreader';
import {
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { MainNavigator } from './src/navigation/MainNavigator';
import { RootStackParamList } from './src/navigation/types';
import { ThemeProvider, useTheme, useThemeCtx } from './src/theme/ThemeContext';
import { I18nProvider } from './src/i18n/I18nContext';
import { ImportUrlScreen } from './src/screens/ImportUrlScreen';
import { ScanRecipeScreen } from './src/screens/ScanRecipeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ProcessingScreen } from './src/screens/ProcessingScreen';
import { RecipeDetailScreen } from './src/screens/RecipeDetailScreen';
import { ReviewImportScreen } from './src/screens/ReviewImportScreen';
import { EditRecipeScreen } from './src/screens/EditRecipeScreen';
import { ReceiptsScreen } from './src/screens/ReceiptsScreen';
import { ReceiptDetailScreen } from './src/screens/ReceiptDetailScreen';
import { ScanReceiptScreen } from './src/screens/ScanReceiptScreen';
import { ReviewReceiptScreen } from './src/screens/ReviewReceiptScreen';
import { Toast } from './src/components/Toast';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { ready, hasOnboarded, toast } = useApp();
  const c = useTheme();

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.ink} />
      </View>
    );
  }

  return (
    <>
      <Stack.Navigator
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}
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
        <Stack.Screen name="Receipts" component={ReceiptsScreen} />
        <Stack.Screen name="ReceiptDetail" component={ReceiptDetailScreen} />
        <Stack.Screen name="ScanReceipt" component={ScanReceiptScreen} />
        <Stack.Screen name="ReviewReceipt" component={ReviewReceiptScreen} />
      </Stack.Navigator>
      <Toast message={toast.message} visible={toast.visible} />
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Newsreader_600SemiBold,
    Newsreader_700Bold,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <ThemedStatusBar />
            <Gate />
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function ThemedStatusBar() {
  const { isDark } = useThemeCtx();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

function Gate() {
  const { session, user, initializing } = useAuth();
  const c = useTheme();

  if (initializing) {
    return (
      <View style={[styles.loading, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.ink} />
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
  },
});
