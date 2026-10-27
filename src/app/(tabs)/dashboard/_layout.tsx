import { Stack } from 'expo-router';

import { detailOptions, largeTitleOptions } from '@/ui/navigation';

export default function DashboardStack() {
  return (
    <Stack screenOptions={largeTitleOptions}>
      <Stack.Screen name="index" options={{ title: 'Fast' }} />
      <Stack.Screen name="session/[id]" options={{ ...detailOptions, title: 'Session' }} />
    </Stack>
  );
}
