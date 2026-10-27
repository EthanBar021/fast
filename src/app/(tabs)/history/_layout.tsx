import { Stack } from 'expo-router';

import { detailOptions, largeTitleOptions } from '@/ui/navigation';

export default function HistoryStack() {
  return (
    <Stack screenOptions={largeTitleOptions}>
      <Stack.Screen name="index" options={{ title: 'Historique' }} />
      <Stack.Screen name="[id]" options={{ ...detailOptions, title: 'Session' }} />
    </Stack>
  );
}
