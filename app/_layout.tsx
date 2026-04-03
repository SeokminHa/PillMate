import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MedicationProvider } from "@/contexts/MedicationContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { requestNotificationPermissions } from "@/lib/notifications";
import { ActivityIndicator, View } from "react-native";
import AuthScreen from "./auth";

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <ActivityIndicator size="large" color="#0D9488" />
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <MedicationProvider>
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add-medication"
          options={{
            presentation: "formSheet",
            sheetAllowedDetents: [0.92],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="take-photo"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="monthly-calendar"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="photo-archive"
          options={{ presentation: "modal", headerShown: false }}
        />
      </Stack>
    </MedicationProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      requestNotificationPermissions().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView>
          <KeyboardProvider>
            <LanguageProvider>
              <AuthProvider>
                <AppContent />
              </AuthProvider>
            </LanguageProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
