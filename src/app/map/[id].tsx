import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/storage/sessions';
import { useSettings } from '@/storage/settingsStore';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { MapLegend, SessionMap, useRouteRange } from '@/ui/components/SessionMap';
import { formatSpeed, joinValue } from '@/ui/format';
import { GlassSurface } from '@/ui/glass/GlassSurface';
import type { MapFilter } from '@/ui/mapColors';
import { AppText } from '@/ui/theme/AppText';
import { colors, GUTTER, radii } from '@/ui/theme/tokens';

const FILTERS = [
  { value: 'route', label: 'Trajet' },
  { value: 'speed', label: 'Vitesse' },
  { value: 'g', label: 'Forces G' },
] as const satisfies readonly { value: MapFilter; label: string }[];

/** Full-screen route map with floating glass controls. */
export default function MapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading } = useSession(id);
  const { speedUnit, accelUnit } = useSettings();
  const [filter, setFilter] = useState<MapFilter>('speed');
  const insets = useSafeAreaInsets();
  const series = data?.series ?? null;
  const range = useRouteRange(series, filter);
  const s = data?.session.summary;

  return (
    <View style={styles.root}>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel="Fermer" onPress={() => router.back()} />
      </Stack.Toolbar>
      {loading || !series ? (
        <View style={styles.center}>
          {loading ? <ActivityIndicator color={colors.textSecondary} /> : <AppText variant="subhead">Trajet indisponible.</AppText>}
        </View>
      ) : (
        <>
          <SessionMap
            series={series}
            filter={filter}
            style={StyleSheet.absoluteFill}
            edgePadding={{ top: insets.top + 60, right: 40, bottom: insets.bottom + 180, left: 40 }}
          />
          <View style={[styles.panelWrap, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
            <GlassSurface radius={radii.lg} style={styles.panel}>
              {s ? (
                <View style={styles.summary}>
                  <AppText variant="footnote" color={colors.textPrimary} weight="600">
                    Max {joinValue(formatSpeed(s.maxSpeed, speedUnit))}
                  </AppText>
                  <AppText variant="footnote">Moyenne {joinValue(formatSpeed(s.movingAvgSpeed, speedUnit))}</AppText>
                </View>
              ) : null}
              <SegmentedControl accessibilityLabel="Filtre de la carte" options={FILTERS} value={filter} onChange={setFilter} />
              <MapLegend filter={filter} range={range} speedUnit={speedUnit} accelUnit={accelUnit} />
            </GlassSurface>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelWrap: {
    position: 'absolute',
    left: GUTTER,
    right: GUTTER,
    bottom: 0,
  },
  panel: {
    padding: 14,
    gap: 12,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
