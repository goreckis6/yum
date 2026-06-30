import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from './src/lib/supabase';
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
import { PremiumProvider, usePremium } from './src/context/PremiumContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
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
import { ScanBarcodeScreen } from './src/screens/ScanBarcodeScreen';
import { PantryScreen } from './src/screens/PantryScreen';
import { ScanReceiptScreen } from './src/screens/ScanReceiptScreen';
import { ReviewReceiptScreen } from './src/screens/ReviewReceiptScreen';
import { Toast } from './src/components/Toast';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { ready, toast } = useApp();
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
        initialRouteName="Main"
      >
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
        <Stack.Screen name="ScanBarcode" component={ScanBarcodeScreen} />
        <Stack.Screen name="Pantry" component={PantryScreen} />
        <Stack.Screen name="ReviewReceipt" component={ReviewReceiptScreen} />
      </Stack.Navigator>
      <Toast message={toast.message} visible={toast.visible} />
    </>
  );
}

export default function App() {
  // Handle OAuth deep link callback (exp://IP:PORT/--/auth/callback?code=...)
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url.includes('auth/callback')) return;
      const queryStr = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
      const code = new URLSearchParams(queryStr).get('code');
      if (code) {
        console.log('[OAuth] deep link code received, exchanging...');
        await supabase.auth.exchangeCodeForSession(code);
      }
    };

    // App opened via deep link while closed
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });

    // App foregrounded via deep link while running
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

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
            <PremiumProvider>
              <ThemedStatusBar />
              <Gate />
            </PremiumProvider>
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
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const c = useTheme();
  const [showAuth, setShowAuth] = React.useState(false);

  if (initializing) {
    return (
      <View style={[styles.loading, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.ink} />
      </View>
    );
  }

  if (!session || !user) {
    if (!showAuth) {
      return <OnboardingScreen onDone={() => setShowAuth(true)} />;
    }
    return <AuthScreen onBack={() => setShowAuth(false)} />;
  }

  // Logged in but still resolving subscription state.
  if (premiumLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.ink} />
      </View>
    );
  }

  // Everything is behind the subscription — gate the whole app.
  if (!isPremium) {
    return <PaywallScreen />;
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
