import { Stack } from 'expo-router';

import { detailOptions, largeTitleOptions } from '@/ui/navigation';

export default function SettingsStack() {
  return (
    <Stack screenOptions={largeTitleOptions}>
      <Stack.Screen name="index" options={{ title: 'Réglages' }} />
      <Stack.Screen name="developer" options={{ title: 'Développement' }} />
      <Stack.Screen name="diagnostics" options={{ ...detailOptions, title: 'Diagnostic capteurs' }} />
      <Stack.Screen name="log" options={{ ...detailOptions, title: 'Journal' }} />
    </Stack>
  );
}
