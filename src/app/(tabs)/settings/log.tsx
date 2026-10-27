import { useSyncExternalStore } from 'react';
import { StyleSheet } from 'react-native';

import { formatLogEntry, getLogEntries, subscribeLog } from '@/dev/log';
import { ListGroup, ListRow } from '@/ui/components/List';
import { TabScreen } from '@/ui/components/TabScreen';
import { AppText } from '@/ui/theme/AppText';
import { colors } from '@/ui/theme/tokens';

let cache: { length: number; last: unknown; list: ReturnType<typeof getLogEntries> } = { length: -1, last: null, list: [] };

/** Stable snapshot (new array only when entries change). */
function snapshot() {
  const entries = getLogEntries();
  const last = entries[entries.length - 1] ?? null;
  if (entries.length !== cache.length || last !== cache.last) cache = { length: entries.length, last, list: [...entries] };
  return cache.list;
}

export default function LogScreen() {
  const entries = useSyncExternalStore(subscribeLog, snapshot);
  return (
    <TabScreen>
      {entries.length === 0 ? (
        <AppText variant="subhead">Journal vide.</AppText>
      ) : (
        <ListGroup>
          {[...entries].reverse().map((e, i) => (
            <ListRow
              key={`${e.at}-${i}`}
              label={`${e.tag} · ${e.message}`}
              detail={formatLogEntry(e)}
              icon={e.level === 'error' ? 'xmark.octagon' : e.level === 'warn' ? 'exclamationmark.triangle' : undefined}
            />
          ))}
        </ListGroup>
      )}
      <AppText variant="caption" style={styles.note} color={colors.textTertiary}>
        {entries.length} entrée(s)
      </AppText>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  note: {
    textAlign: 'center',
  },
});
