import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Polyline, type Region } from 'react-native-maps';

import type { AccelUnit, SpeedUnit } from '@/core/units';
import type { SessionSeries } from '@/models/session';
import { formatAccel, formatSpeed, joinValue } from '@/ui/format';
import { colorRoute, G_STOPS, gradientOf, ROUTE_COLOR, SPEED_STOPS, type LatLng, type MapFilter } from '@/ui/mapColors';
import { AppText } from '@/ui/theme/AppText';

type Props = {
  series: SessionSeries;
  filter: MapFilter;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Extra padding when fitting the route (e.g. under floating controls). */
  edgePadding?: { top: number; right: number; bottom: number; left: number };
};

/** Region framing all coordinates, used as the initial camera of a remounted map. */
function boundsRegion(coordinates: LatLng[]): Region | undefined {
  if (coordinates.length === 0) return undefined;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const c of coordinates) {
    minLat = Math.min(minLat, c.latitude);
    maxLat = Math.max(maxLat, c.latitude);
    minLon = Math.min(minLon, c.longitude);
    maxLon = Math.max(maxLon, c.longitude);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.004, (maxLat - minLat) * 1.5),
    longitudeDelta: Math.max(0.004, (maxLon - minLon) * 1.5),
  };
}

/**
 * Apple Maps in dark mode with the muted map style, POIs hidden.
 * Not a fully custom style (that would need Google Maps / Mapbox and a development build).
 */
export function SessionMap({ series, filter, interactive = true, style, edgePadding }: Props) {
  const ref = useRef<MapView>(null);
  const route = useMemo(() => colorRoute(series, filter), [series, filter]);
  const padding = edgePadding ?? { top: 40, right: 40, bottom: 40, left: 40 };

  // Last camera position, so a remounted map (filter change) opens where the user left it.
  const [savedRegion, setSavedRegion] = useState<Region | null>(null);

  const fit = () => {
    if (savedRegion || route.coordinates.length < 2) return;
    ref.current?.fitToCoordinates(route.coordinates, { edgePadding: padding, animated: false });
  };

  return (
    <View style={[styles.root, style]}>
      {/*
        Remounted on each filter change. On iOS, react-native-maps only draws the
        overlays present when the map is created reliably; overlays swapped later
        on the same map stayed invisible until the next redraw (the first tap on
        "Vitesse"/"Forces G" showed nothing).
      */}
      <MapView
        key={filter}
        ref={ref}
        initialRegion={savedRegion ?? boundsRegion(route.coordinates)}
        onRegionChangeComplete={setSavedRegion}
        style={StyleSheet.absoluteFill}
        userInterfaceStyle="dark"
        mapType="mutedStandard"
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsCompass={false}
        pitchEnabled={false}
        rotateEnabled={interactive}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        onMapReady={fit}>
        {route.coordinates.length < 2 ? null : route.segments ? (
          // One single-color polyline per segment: colors are set on creation and update reliably.
          route.segments.map((segment, i) => (
            <Polyline
              key={`${filter}-${i}`}
              coordinates={segment.coordinates}
              strokeColor={segment.color}
              strokeWidth={4}
              lineCap="round"
              lineJoin="round"
            />
          ))
        ) : (
          <Polyline
            key="route"
            coordinates={route.coordinates}
            strokeColor={ROUTE_COLOR}
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>
    </View>
  );
}

type LegendProps = { filter: MapFilter; range: [number, number] | null; speedUnit: SpeedUnit; accelUnit: AccelUnit };

export function MapLegend({ filter, range, speedUnit, accelUnit }: LegendProps) {
  if (filter === 'route' || !range) return null;
  const gradient = gradientOf(filter === 'speed' ? SPEED_STOPS : G_STOPS);
  const fmt = (v: number) => (filter === 'speed' ? joinValue(formatSpeed(v, speedUnit)) : joinValue(formatAccel(v, accelUnit)));
  return (
    <View style={styles.legend}>
      <AppText variant="caption">{fmt(range[0])}</AppText>
      <LinearGradient
        colors={gradient.colors as [string, string, ...string[]]}
        locations={gradient.locations as [number, number, ...number[]]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bar} />
      <AppText variant="caption">{filter === 'speed' ? `${fmt(range[1])}+` : fmt(range[1])}</AppText>
    </View>
  );
}

export function useRouteRange(series: SessionSeries | null, filter: MapFilter) {
  return useMemo(() => (series ? colorRoute(series, filter).range : null), [series, filter]);
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    backgroundColor: '#0B0B0D',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
});
