import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ACCEL_UNIT_LABEL, accelIn, SPEED_UNIT_LABEL, speedIn } from '@/core/units';
import { startLocationProbe, type LocationSnapshot } from '@/sensors/locationProbe';
import { startMotionProbe, type MotionSnapshot, type Vec3 } from '@/sensors/motionProbe';
import { locationLabel, motionLabel, usePermissions } from '@/sensors/permissions';
import { useSettings } from '@/storage/settingsStore';
import { ListGroup, ListRow } from '@/ui/components/List';
import { usePolled } from '@/ui/usePolled';
import { colors, GUTTER } from '@/ui/theme/tokens';

/** Requested DeviceMotion interval. The rate actually delivered is measured below. */
const REQUESTED_INTERVAL_MS = 10;
const KEEP_AWAKE_TAG = 'diagnostics';

type Probes = { motion: () => MotionSnapshot | null; location: () => LocationSnapshot | null };

function fmt(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);
}

function vec(v: Vec3 | null, convert: (n: number) => number, digits: number): string {
  if (!v) return '—';
  return [v.x, v.y, v.z].map((n) => fmt(convert(n), digits).padStart(6)).join('  ');
}

export default function DiagnosticsScreen() {
  const settings = useSettings();
  const { motion: motionPerm, location: locationPerm, requestMotion, requestLocation } = usePermissions();
  const motionGranted = motionPerm?.state === 'granted';
  const locationGranted = locationPerm?.state === 'granted';
  const [probes, setProbes] = useState<Probes | null>(null);

  // Sensors run only while this screen is focused.
  useFocusEffect(
    useCallback(() => {
      const motion = motionGranted ? startMotionProbe(REQUESTED_INTERVAL_MS) : null;
      const location = locationGranted ? startLocationProbe() : null;
      setProbes({ motion: () => motion?.snapshot() ?? null, location: () => location?.snapshot() ?? null });
      if (settings.keepAwake) activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      return () => {
        motion?.stop();
        location?.stop();
        deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      };
    }, [motionGranted, locationGranted, settings.keepAwake]),
  );

  const m = usePolled(probes?.motion ?? null);
  const l = usePolled(probes?.location ?? null);

  const accelUnit = ACCEL_UNIT_LABEL[settings.accelUnit];
  const toAccel = (n: number) => accelIn(settings.accelUnit, n);
  const accelDigits = settings.accelUnit === 'g' ? 3 : 2;
  const speedUnit = SPEED_UNIT_LABEL[settings.speedUnit];
  const speedValid = l?.speed !== null && l?.speed !== undefined && l.speed >= 0;

  return (
    <ScrollView
      style={styles.root}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      <ListGroup
        header="Mouvement · DeviceMotion"
        footer={`Intervalle demandé : ${REQUESTED_INTERVAL_MS} ms. La fréquence affichée est celle réellement reçue. L’unité des horodatages natifs n’est pas documentée par Expo : valeurs brutes.`}>
        <ListRow
          label="Autorisation"
          value={motionLabel(motionPerm)}
          onPress={motionGranted ? undefined : requestMotion}
          chevron={!motionGranted}
        />
        <ListRow label="Fréquence reçue" value={m?.rateHz ? `${fmt(m.rateHz, 0)} Hz` : '—'} />
        <ListRow label="Échantillons" value={m ? String(m.samples) : '—'} />
        <ListRow label="Intervalle signalé" value={m?.reportedIntervalMs ? `${fmt(m.reportedIntervalMs, 1)} ms` : '—'} />
        <ListRow label="Écart médian horodatage" value={fmt(m?.medianNativeDelta, 4)} />
        <ListRow label="Dernier horodatage" value={fmt(m?.lastNativeTimestamp, 3)} />
      </ListGroup>

      <ListGroup
        header={`Accélération (${accelUnit}) · x  y  z`}
        footer="Axes du téléphone en portrait : x vers la droite, y vers le haut, z sort de l’écran.">
        <ListRow label="Sans gravité" detail={vec(m?.acceleration ?? null, toAccel, accelDigits)} />
        <ListRow label="Avec gravité" detail={vec(m?.accelerationIncludingGravity ?? null, toAccel, accelDigits)} />
        <ListRow
          label="Rotation (brute) · α β γ"
          detail={
            m?.rotation
              ? [m.rotation.alpha, m.rotation.beta, m.rotation.gamma].map((n) => fmt(n, 3).padStart(7)).join('  ')
              : '—'
          }
        />
      </ListGroup>

      <ListGroup
        header="Localisation · GPS"
        footer="Mesure au premier plan uniquement. Les coordonnées ne sont ni affichées ni conservées. La fréquence GPS est souvent bien plus basse que celle des capteurs de mouvement.">
        <ListRow
          label="Autorisation"
          value={locationLabel(locationPerm)}
          onPress={locationGranted && locationPerm?.precise !== false ? undefined : requestLocation}
          chevron={!(locationGranted && locationPerm?.precise !== false)}
        />
        <ListRow
          label="Vitesse"
          value={
            !l || l.fixes === 0
              ? '—'
              : speedValid
                ? `${fmt(speedIn(settings.speedUnit, l.speed as number), 1)} ${speedUnit}`
                : 'Non fournie par iOS'
          }
        />
        <ListRow label="Précision horizontale" value={l?.accuracy != null ? `± ${fmt(l.accuracy, 0)} m` : '—'} />
        <ListRow label="Intervalle médian" value={l?.medianIntervalMs ? `${fmt(l.medianIntervalMs, 0)} ms` : '—'} />
        <ListRow label="Dernier point reçu" value={l?.ageMs != null ? `il y a ${fmt(l.ageMs / 1000, 1)} s` : '—'} />
        <ListRow label="Points reçus" value={l ? String(l.fixes) : '—'} />
        {l && l.fixes > 0 && l.ageMs !== null && l.ageMs > 10_000 ? (
          <ListRow
            label="Pas de nouveau point"
            detail="iOS n’envoie une position que lorsqu’il en calcule une nouvelle. À l’intérieur ou à l’arrêt, sans satellites, il se contente du Wi-Fi : points rares, précision faible, et pas de vitesse. Testez dehors, ciel dégagé, en roulant."
          />
        ) : null}
        {l?.error ? <ListRow label="Erreur" detail={l.error} /> : null}
      </ListGroup>
    </ScrollView>
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
    paddingBottom: 48,
    gap: 28,
  },
});
