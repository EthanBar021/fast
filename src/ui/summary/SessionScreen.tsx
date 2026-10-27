import { router } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { exportSession } from '@/dev/exportData';
import { deleteSession, useSession } from '@/storage/sessions';
import { AppText } from '@/ui/theme/AppText';
import { colors } from '@/ui/theme/tokens';

import { SessionSummaryView } from './SessionSummaryView';

/** Loads a stored session and shows its summary (used from the dashboard and the history). */
export function SessionScreen({ id }: { id: string | undefined }) {
  const { data, loading, error } = useSession(id);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }
  if (error || !data) {
    return (
      <View style={styles.center}>
        <AppText variant="subhead">{error ? 'Lecture impossible.' : 'Session introuvable.'}</AppText>
      </View>
    );
  }
  return (
    <SessionSummaryView
      session={data.session}
      series={data.series}
      onOpenMap={() => router.push(`/map/${data.session.id}`)}
      onExport={
        data.session.source === 'device'
          ? () => exportSession(data.session.id).catch((e: unknown) => Alert.alert('Export impossible', String(e)))
          : undefined
      }
      onDelete={async () => {
        await deleteSession(data.session.id);
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
