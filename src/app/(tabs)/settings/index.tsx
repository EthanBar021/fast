import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import type { AccelUnit, SpeedUnit } from '@/core/units';
import type { MotionRate } from '@/models/settings';
import { useHighRefresh } from '@/sensors/display';
import { locationLabel, motionLabel, usePermissions } from '@/sensors/permissions';
import { deleteSessions } from '@/storage/sessions';
import { updateSettings, useSettings } from '@/storage/settingsStore';
import { ListGroup, ListRow } from '@/ui/components/List';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { TabScreen } from '@/ui/components/TabScreen';
import { Toggle } from '@/ui/components/Toggle';
import { haptic } from '@/ui/haptics';

const SPEED_OPTIONS = [
  { value: 'kmh', label: 'km/h' },
  { value: 'mph', label: 'mph' },
] as const satisfies readonly { value: SpeedUnit; label: string }[];

const RATE_OPTIONS = [
  { value: '60', label: '60 Hz' },
  { value: '120', label: '120 Hz' },
] as const;

const ACCEL_OPTIONS = [
  { value: 'g', label: 'g' },
  { value: 'ms2', label: 'm/s²' },
] as const satisfies readonly { value: AccelUnit; label: string }[];

function confirmDeleteAll() {
  Alert.alert('Supprimer toutes les sessions ?', 'Cette action est définitive.', [
    { text: 'Annuler', style: 'cancel' },
    {
      text: 'Tout supprimer',
      style: 'destructive',
      onPress: () => {
        deleteSessions('all').then(() => haptic('success'));
      },
    },
  ]);
}

export default function SettingsScreen() {
  const settings = useSettings();
  const { motion, location, requestMotion, requestLocation } = usePermissions();
  const locationOk = location?.state === 'granted' && location.precise !== false;
  const highRefresh = useHighRefresh();

  return (
    <TabScreen>
      <ListGroup header="Unités">
        <ListRow
          label="Vitesse"
          below={
            <SegmentedControl
              accessibilityLabel="Unité de vitesse"
              options={SPEED_OPTIONS}
              value={settings.speedUnit}
              onChange={(speedUnit) => updateSettings({ speedUnit })}
            />
          }
        />
        <ListRow
          label="Accélération"
          below={
            <SegmentedControl
              accessibilityLabel="Unité d’accélération"
              options={ACCEL_OPTIONS}
              value={settings.accelUnit}
              onChange={(accelUnit) => updateSettings({ accelUnit })}
            />
          }
        />
      </ListGroup>

      <ListGroup header="Mesure">
        {highRefresh ? (
          <ListRow
            label="Fréquence"
            below={
              <SegmentedControl
                accessibilityLabel="Fréquence pendant la mesure"
                options={RATE_OPTIONS}
                value={String(settings.motionRateHz) as '60' | '120'}
                onChange={(v) => updateSettings({ motionRateHz: Number(v) as MotionRate })}
              />
            }
          />
        ) : null}
        <ListRow
          label="Écran toujours allumé"
          accessory={<Toggle value={settings.keepAwake} onChange={(keepAwake) => updateSettings({ keepAwake })} />}
        />
        <ListRow
          label="Retours haptiques"
          accessory={<Toggle value={settings.haptics} onChange={(haptics) => updateSettings({ haptics })} />}
        />
      </ListGroup>

      <ListGroup header="Autorisations">
        <ListRow
          label="Mouvement"
          value={motionLabel(motion)}
          onPress={motion?.state === 'granted' ? undefined : requestMotion}
          chevron={motion?.state !== 'granted'}
        />
        <ListRow
          label="Localisation"
          value={locationLabel(location)}
          onPress={locationOk ? undefined : requestLocation}
          chevron={!locationOk}
        />
      </ListGroup>

      <ListGroup header="Données">
        <ListRow label="Supprimer toutes les sessions" destructive onPress={confirmDeleteAll} />
      </ListGroup>

      <ListGroup>
        <ListRow label="Développement" icon="hammer" onPress={() => router.push('/settings/developer')} chevron />
      </ListGroup>

      <ListGroup header="À propos">
        <ListRow label="Version" value={`${Constants.expoConfig?.version ?? '—'} bêta`} />
      </ListGroup>
    </TabScreen>
  );
}
