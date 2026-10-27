import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { recentSummary } from '@/core/periodSummary';
import { locationLabel, motionLabel, usePermissions } from '@/sensors/permissions';
import { useSessionList } from '@/storage/sessions';
import { useSettings } from '@/storage/settingsStore';
import { FastLogo } from '@/ui/components/FastLogo';
import { ListGroup, ListRow } from '@/ui/components/List';
import { Panel } from '@/ui/components/Panel';
import { PrimaryButton } from '@/ui/components/PrimaryButton';
import { SessionRow } from '@/ui/components/SessionRow';
import { CountStat } from '@/ui/components/Stat';
import { TabScreen } from '@/ui/components/TabScreen';
import { formatAccel, formatDistance, formatDuration, formatNumber, formatSpeed } from '@/ui/format';
import { AppText } from '@/ui/theme/AppText';
import { colors } from '@/ui/theme/tokens';

function todayLabel(): string {
  const label = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Staggered spring entrance for dashboard blocks. */
function Appear({ index, children }: { index: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.springify().damping(18).stiffness(150).delay(60 + index * 70)}>
      {children}
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const { speedUnit, accelUnit } = useSettings();
  const { motion, location, requestMotion, requestLocation } = usePermissions();
  const { data: list } = useSessionList();
  const last = list?.[0];
  const month = recentSummary(list ?? []);
  const motionOk = motion?.state === 'granted';
  const locationOk = location?.state === 'granted' && location.precise !== false;
  const ready = motionOk && locationOk;

  return (
    <TabScreen>
      <Appear index={0}>
        <Panel style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <AppText variant="caption" style={styles.kicker}>
                {todayLabel()}
              </AppText>
              <AppText variant="title" style={styles.heroTitle}>
                {ready ? 'Prêt à rouler' : 'Presque prêt'}
              </AppText>
              <View style={styles.status}>
                <View style={[styles.statusDot, ready ? styles.statusOk : null]} />
                <AppText variant="footnote">{ready ? 'Capteurs et GPS autorisés' : 'Autorisations à accorder'}</AppText>
              </View>
            </View>
            <FastLogo size={84} />
          </View>
          <PrimaryButton label="Nouvelle mesure" onPress={() => router.push('/measure')} />
        </Panel>
      </Appear>

      {!ready ? (
        <Appear index={1}>
          <ListGroup header="Autorisations">
            {!motionOk ? <ListRow label="Mouvement" value={motionLabel(motion)} onPress={requestMotion} chevron /> : null}
            {!locationOk ? (
              <ListRow label="Localisation" value={locationLabel(location)} onPress={requestLocation} chevron />
            ) : null}
          </ListGroup>
        </Appear>
      ) : null}

      <Appear index={2}>
        <View>
          <AppText variant="footnote" style={styles.header}>
            30 derniers jours
          </AppText>
          <Panel style={styles.month}>
            {month.sessions === 0 ? (
              <AppText variant="subhead">Aucune mesure sur cette période.</AppText>
            ) : (
              <>
                <View style={styles.grid}>
                  <CountStat label="Sessions" target={month.sessions} format={(v) => ({ value: formatNumber(v, 0) })} style={styles.cell} delay={250} />
                  <CountStat label="Distance" target={month.distanceM} format={formatDistance} style={styles.cell} delay={300} />
                  <CountStat label="Au volant" target={month.movingTimeMs} format={(v) => ({ value: formatDuration(v) })} style={styles.cell} delay={350} />
                </View>
                <View style={styles.divider} />
                <View style={styles.grid}>
                  <CountStat label="Vitesse max" target={month.maxSpeed} format={(v) => formatSpeed(v, speedUnit)} style={styles.cell} delay={400} />
                  <CountStat label="Accél." target={month.peakAccel} format={(v) => formatAccel(v, accelUnit)} style={styles.cell} delay={450} />
                  <CountStat label="Freinage" target={month.peakBrake} format={(v) => formatAccel(v, accelUnit)} style={styles.cell} delay={500} />
                </View>
              </>
            )}
          </Panel>
        </View>
      </Appear>

      <Appear index={3}>
        <ListGroup header="Dernière session">
          {last ? (
            <SessionRow session={last} onPress={() => router.push(`/dashboard/session/${last.id}`)} />
          ) : (
            <ListRow label="Aucune session" />
          )}
        </ListGroup>
      </Appear>

      <Appear index={4}>
        <AppText variant="footnote" style={styles.safety}>
          Téléphone fixé, réglages à l’arrêt. Essais d’accélération sur circuit ou terrain fermé autorisé.
        </AppText>
      </Appear>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 18,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '700',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.textTertiary,
  },
  statusOk: {
    backgroundColor: colors.textPrimary,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 7,
  },
  month: {
    gap: 16,
  },
  grid: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  safety: {
    paddingHorizontal: 16,
  },
});
