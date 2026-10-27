import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { flushLog, log } from '@/dev/log';
import { colors } from '@/ui/theme/tokens';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.background, primary: colors.textPrimary },
};

/** Transparent native bar: only the system close button (Liquid Glass on iOS 26+) floats over the content. */
const modalOptions = {
  presentation: 'fullScreenModal' as const,
  headerShown: true,
  headerTransparent: true,
  title: '',
};

export default function RootLayout() {
  // Persist the log when leaving the app, so a test drive can be exported later.
  useEffect(() => {
    log('info', 'app', 'Ouverture');
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushLog();
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="measure" options={modalOptions} />
          <Stack.Screen name="map/[id]" options={modalOptions} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
