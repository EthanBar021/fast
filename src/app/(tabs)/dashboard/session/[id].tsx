import { useLocalSearchParams } from 'expo-router';

import { SessionScreen } from '@/ui/summary/SessionScreen';

export default function DashboardSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionScreen id={id} />;
}
