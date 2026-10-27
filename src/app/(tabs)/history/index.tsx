import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { deleteSession, useSessionList } from '@/storage/sessions';
import { ListGroup } from '@/ui/components/List';
import { SessionRow } from '@/ui/components/SessionRow';
import { SwipeToDelete } from '@/ui/components/SwipeToDelete';
import { TabScreen } from '@/ui/components/TabScreen';
import { AppText } from '@/ui/theme/AppText';
import { colors } from '@/ui/theme/tokens';

export default function HistoryScreen() {
  const { data: list, loading, error } = useSessionList();

  return (
    <TabScreen>
      {loading ? (
        <ActivityIndicator color={colors.textSecondary} style={styles.loader} />
      ) : error ? (
        <AppText variant="subhead">Impossible de lire l’historique.</AppText>
      ) : !list || list.length === 0 ? (
        <View style={styles.empty}>
          <SymbolView name="clock.arrow.circlepath" tintColor={colors.textTertiary} size={34} />
          <AppText weight="600">Aucune session</AppText>
          <AppText variant="subhead" style={styles.center}>
            Vos mesures terminées apparaîtront ici.
          </AppText>
        </View>
      ) : (
        <ListGroup>
          {list.map((session) => (
            <SwipeToDelete
              key={session.id}
              confirmTitle="Supprimer cette session ?"
              onDelete={() => deleteSession(session.id)}>
              <SessionRow session={session} onPress={() => router.push(`/history/${session.id}`)} />
            </SwipeToDelete>
          ))}
        </ListGroup>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 48,
  },
  empty: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 96,
    paddingHorizontal: 24,
  },
  center: {
    textAlign: 'center',
  },
});
