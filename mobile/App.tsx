import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { supabase } from './src/lib/supabase';
import { NavigationContainer, createNavigationContainerRef, useNavigation } from '@react-navigation/native';
import { useShareIntent } from 'expo-share-intent';
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
import { AIConsentScreen } from './src/screens/AIConsentScreen';
import { ProcessingScreen } from './src/screens/ProcessingScreen';
import { RecipeDetailScreen } from './src/screens/RecipeDetailScreen';
import { CookingModeScreen } from './src/screens/CookingModeScreen';
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

const navigationRef = createNavigationContainerRef<RootStackParamList>();

// When the app is opened via the iOS/Android share sheet, route the shared URL
// straight into the normal import flow (Processing → extract → ReviewImport →
// save), the same as pasting a link. Only mounted once the user is signed in and
// past the gates, so the extraction runs authenticated.
function ShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

  useEffect(() => {
    if (!hasShareIntent) return;
    const raw = (shareIntent.webUrl || shareIntent.text || '').trim();
    const url = /^https?:\/\//i.test(raw) ? raw : '';
    if (!url) {
      resetShareIntent();
      return;
    }
    // Navigation may not be mounted on the very first frame after a cold start.
    let tries = 0;
    const go = () => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Processing', { url });
        resetShareIntent();
      } else if (tries++ < 40) {
        setTimeout(go, 150);
      }
    };
    go();
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  return null;
}

// Paywall shown as a dismissable upsell (distinct from the hard subscription
// gate in Gate) — reached from the credits pill or when free imports run out.
function PaywallRoute() {
  const navigation = useNavigation();
  return <PaywallScreen onClose={() => navigation.goBack()} />;
}

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
        <Stack.Screen name="CookingMode" component={CookingModeScreen} />
        <Stack.Screen name="Paywall" component={PaywallRoute} options={{ presentation: 'modal' }} />
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

const AI_CONSENT_KEY = 'ai_consent_v1';

function Gate() {
  const { session, user, initializing } = useAuth();
  const { isLoading: premiumLoading } = usePremium();
  const c = useTheme();
  const [showAuth, setShowAuth] = React.useState(false);
  // null = still loading the stored flag, false = must consent, true = consented.
  const [consented, setConsented] = React.useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(AI_CONSENT_KEY)
      .then((v) => setConsented(v === 'true'))
      .catch(() => setConsented(false));
  }, []);

  const acceptConsent = () => {
    setConsented(true);
    AsyncStorage.setItem(AI_CONSENT_KEY, 'true').catch(() => {});
  };

  if (initializing || consented === null) {
    return (
      <View style={[styles.loading, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.ink} />
      </View>
    );
  }

  // AI consent (App Store 5.1.2) must precede any AI feature — gate everything.
  if (!consented) {
    return <AIConsentScreen onAgree={acceptConsent} />;
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

  // Freemium: everyone gets in and receives free import credits. The paywall
  // (3-day trial → subscription) is shown as an upsell when credits run out or
  // from the credits pill — not as a hard wall in front of the whole app.

  return (
    <AppProvider userId={user.id}>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
        <ShareIntentHandler />
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
