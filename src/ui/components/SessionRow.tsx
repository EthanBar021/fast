import type { Session } from '@/models/session';
import { useSettings } from '@/storage/settingsStore';
import { formatDistance, formatDuration, formatSessionDate, formatSpeed, joinValue } from '@/ui/format';

import { ListRow } from './List';

/** One session in a list: date, then duration · distance · max speed. */
export function SessionRow({ session, onPress }: { session: Session; onPress: () => void }) {
  const { speedUnit } = useSettings();
  const s = session.summary;
  const detail =
    s.quality === 'invalid'
      ? 'Mesure inexploitable'
      : [
          formatDuration(s.durationMs),
          joinValue(formatDistance(s.distanceM)),
          `max ${joinValue(formatSpeed(s.maxSpeed, speedUnit))}`,
        ].join(' · ');
  return (
    <ListRow
      label={`${formatSessionDate(session.startedAt)}${session.source === 'demo' ? ' · Démo' : ''}`}
      detail={detail}
      onPress={onPress}
      chevron
    />
  );
}
