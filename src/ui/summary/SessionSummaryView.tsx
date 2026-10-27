import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { accelIn, ACCEL_UNIT_LABEL, speedIn, SPEED_UNIT_LABEL } from '@/core/units';
import type { Session, SessionSeries } from '@/models/session';
import { useSettings } from '@/storage/settingsStore';
import { LineChart } from '@/ui/components/LineChart';
import { ListGroup, ListRow } from '@/ui/components/List';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { MapLegend, SessionMap, useRouteRange } from '@/ui/components/SessionMap';
import { Panel } from '@/ui/components/Panel';
import { CountStat } from '@/ui/components/Stat';
import {
  formatAccel,
  formatDistance,
  formatDuration,
  formatNumber,
  formatSessionDate,
  formatSpeed,
  joinValue,
  QUALITY_LABEL,
} from '@/ui/format';
import type { MapFilter } from '@/ui/mapColors';
import { AppText } from '@/ui/theme/AppText';
import { colors, GUTTER, radii } from '@/ui/theme/tokens';

const FILTERS = [
  { value: 'route', label: 'Trajet' },
  { value: 'speed', label: 'Vitesse' },
  { value: 'g', label: 'Forces G' },
] as const satisfies readonly { value: MapFilter; label: string }[];

type Props = {
  session: Session;
  series: SessionSeries | null;
  onDelete?: () => void;
  onOpenMap?: () => void;
  /** Exports the raw data of this session (test drives). */
  onExport?: () => void;
};

function Appear({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.springify().damping(18).stiffness(150).delay(50 + 70 * index)}>{children}</Animated.View>
  );
}

export function SessionSummaryView({ session, series, onDelete, onOpenMap, onExport }: Props) {
  const { speedUnit, accelUnit } = useSettings();
  const [filter, setFilter] = useState<MapFilter>('route');
  const range = useRouteRange(series, filter);
  const s = session.summary;
  const invalid = s.quality === 'invalid';
  const hasRoute = !!series && s.gpsFixes >= 2;
  const hasG = s.motionRateHz !== null && s.peakCombined > 0;
  const accel = (v: number) => joinValue(formatAccel(v, accelUnit));
  const duration = formatDuration(s.durationMs);

  // Stable references: charts animate when their data changes, not on every re-render.
  const speedSeries = useMemo(
    () => (series ? [{ values: series.speed.map((v) => speedIn(speedUnit, v)), color: colors.textPrimary, fill: true }] : []),
    [series, speedUnit],
  );
  const gSeries = useMemo(
    () =>
      series
        ? [
            { values: series.long.map((v) => accelIn(accelUnit, v)), color: colors.textPrimary },
            { values: series.lat.map((v) => accelIn(accelUnit, v)), color: colors.textSecondary, dashed: true },
          ]
        : [],
    [series, accelUnit],
  );

  const confirmDelete = () =>
    Alert.alert('Supprimer cette session ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: onDelete },
    ]);

  return (
    <ScrollView
      style={styles.root}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <Appear index={0}>
        <View style={styles.meta}>
          <AppText variant="footnote">{formatSessionDate(session.startedAt)}</AppText>
          <View style={styles.badges}>
            {session.source === 'demo' ? <Badge label="Démo" /> : null}
            <Badge label={`Qualité ${QUALITY_LABEL[s.quality].toLowerCase()}`} />
          </View>
        </View>
      </Appear>

      {invalid ? (
        <Appear index={1}>
          <ListGroup header="Mesure inexploitable">
            {s.warnings.map((w) => (
              <ListRow key={w} label={w} />
            ))}
          </ListGroup>
        </Appear>
      ) : (
        <>
          <Appear index={1}>
            <Panel style={styles.heroPanel}>
              <View style={styles.hero}>
                <CountStat label="Durée" target={s.durationMs} format={(v) => ({ value: formatDuration(v) })} size="hero" style={styles.flex} delay={150} />
                <CountStat label="Distance" target={s.distanceM} format={formatDistance} size="large" delay={220} />
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <CountStat label="Vitesse max" target={s.maxSpeed} format={(v) => formatSpeed(v, speedUnit)} size="large" style={styles.flex} delay={300} />
                <CountStat label="Moy. en mouvement" target={s.movingAvgSpeed} format={(v) => formatSpeed(v, speedUnit)} size="large" style={styles.flex} delay={360} />
              </View>
            </Panel>
          </Appear>

          {hasRoute && series ? (
            <Appear index={2}>
              <View style={styles.mapBlock}>
                <SessionMap series={series} filter={filter} interactive={false} style={styles.map} />
                <SegmentedControl accessibilityLabel="Filtre de la carte" options={FILTERS} value={filter} onChange={setFilter} />
                <MapLegend filter={filter} range={range} speedUnit={speedUnit} accelUnit={accelUnit} />
                {onOpenMap ? (
                  <ListGroup>
                    <ListRow label="Ouvrir la carte" icon="map" onPress={onOpenMap} chevron />
                  </ListGroup>
                ) : null}
              </View>
            </Appear>
          ) : null}

          {hasG ? (
            <Appear index={3}>
              <ListGroup header="Forces G" footer="Moyennes : valeur absolue moyenne pendant que le véhicule roule.">
                <ListRow label="Accélération max" value={accel(s.peakAccel)} />
                <ListRow label="Freinage max" value={accel(s.peakBrake)} />
                <ListRow label="Virage à gauche max" value={accel(s.peakLatLeft)} />
                <ListRow label="Virage à droite max" value={accel(s.peakLatRight)} />
                <ListRow label="Moyenne longitudinale" value={accel(s.meanAbsLong)} />
                <ListRow label="Moyenne latérale" value={accel(s.meanAbsLat)} />
              </ListGroup>
            </Appear>
          ) : null}

          {series ? (
            <Appear index={4}>
              <Panel style={styles.chartBlock}>
                <AppText variant="footnote" style={styles.chartTitle}>
                  Vitesse ({SPEED_UNIT_LABEL[speedUnit]})
                </AppText>
                <LineChart
                  t={series.t}
                  series={speedSeries}
                  format={(v) => formatNumber(v, 0)}
                  startLabel="0:00"
                  endLabel={duration}
                  delay={350}
                />
              </Panel>
              {hasG ? (
                <Panel style={styles.chartBlock}>
                  <AppText variant="footnote" style={styles.chartTitle}>
                    Forces G ({ACCEL_UNIT_LABEL[accelUnit]}) · longitudinal — latéral - -
                  </AppText>
                  <LineChart
                    t={series.t}
                    series={gSeries}
                    delay={500}
                    zeroLine
                    format={(v) => formatNumber(v, accelUnit === 'g' ? 2 : 1)}
                    startLabel="0:00"
                    endLabel={duration}
                  />
                </Panel>
              ) : null}
            </Appear>
          ) : null}

          {s.warnings.length > 0 ? (
            <ListGroup header="Avertissements">
              {s.warnings.map((w) => (
                <ListRow key={w} label={w} />
              ))}
            </ListGroup>
          ) : null}

          <ListGroup header="Détails">
            <ListRow label="Temps en mouvement" value={formatDuration(s.movingTimeMs)} />
            <ListRow label="Vitesse moyenne totale" value={joinValue(formatSpeed(s.avgSpeed, speedUnit))} />
            {hasG ? <ListRow label="G combiné max" value={accel(s.peakCombined)} /> : null}
            <ListRow label="Points GPS" value={String(s.gpsFixes)} />
            {s.gpsMedianIntervalMs !== null ? (
              <ListRow label="Intervalle GPS" value={`${formatNumber(s.gpsMedianIntervalMs / 1000, 1)} s`} />
            ) : null}
            {s.gpsMedianAccuracyM !== null ? (
              <ListRow label="Précision GPS" value={`± ${formatNumber(s.gpsMedianAccuracyM, 0)} m`} />
            ) : null}
            {s.motionRateHz !== null ? <ListRow label="Capteurs" value={`${formatNumber(s.motionRateHz, 0)} Hz`} /> : null}
            <ListRow label="Axes" value={s.alignment === 'gps' ? 'Alignés par GPS' : 'Supposés'} />
            {onExport ? <ListRow label="Exporter les données" icon="square.and.arrow.up" onPress={onExport} chevron /> : null}
          </ListGroup>
        </>
      )}

      {onDelete ? (
        <ListGroup>
          <ListRow label="Supprimer la session" destructive onPress={confirmDelete} />
        </ListGroup>
      ) : null}
    </ScrollView>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <AppText variant="caption" color={colors.textSecondary} weight="600">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: 8,
    paddingBottom: 56,
    gap: 28,
  },
  meta: {
    gap: 8,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
  },
  heroPanel: {
    gap: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  flex: {
    flex: 1,
  },
  mapBlock: {
    gap: 12,
  },
  map: {
    height: 260,
    borderRadius: radii.lg,
  },
  chartBlock: {
    gap: 6,
    marginBottom: 16,
  },
  chartTitle: {
    marginBottom: 2,
  },
});
