import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { exportSession } from '@/dev/exportData';
import { log } from '@/dev/log';
import type { Session, SessionSeries } from '@/models/session';
import { useHighRefresh } from '@/sensors/display';
import { startLocationProbe } from '@/sensors/locationProbe';
import { locationLabel, motionLabel, usePermissions } from '@/sensors/permissions';
import type { CalibrationFailure } from '@/session/calibration';
import { startCalibration } from '@/session/calibrator';
import { startRecorder, type LiveSnapshot, type Recorder } from '@/session/recorder';
import { INITIAL_STATE, sessionReducer, type SessionState } from '@/session/sessionMachine';
import { saveRecording, sessions } from '@/storage/sessions';
import { useSettings } from '@/storage/settingsStore';
import { CalibrationRing, type RingState } from '@/ui/components/CalibrationRing';
import { GBall } from '@/ui/components/GBall';
import { ListGroup, ListRow } from '@/ui/components/List';
import { PrimaryButton } from '@/ui/components/PrimaryButton';
import { RecordingDot } from '@/ui/components/RecordingDot';
import { Stat } from '@/ui/components/Stat';
import { formatAccel, formatDuration, formatNumber, formatSpeed, joinValue } from '@/ui/format';
import { GlassSurface } from '@/ui/glass/GlassSurface';
import { haptic } from '@/ui/haptics';
import { SessionSummaryView } from '@/ui/summary/SessionSummaryView';
import { AppText } from '@/ui/theme/AppText';
import { colors, GUTTER, radii } from '@/ui/theme/tokens';
import { usePolled } from '@/ui/usePolled';

const KEEP_AWAKE_TAG = 'measure';

const FAILURE_TEXT: Record<CalibrationFailure | 'permission' | 'save' | 'sensor', string> = {
  unstable: 'Téléphone instable. Immobilisez le véhicule, coupez les vibrations si possible et vérifiez le support.',
  orientation: 'Montez le téléphone en portrait, écran face à vous.',
  sensor: 'Capteurs de mouvement incohérents. Réessayez.',
  permission: 'Autorisations manquantes.',
  save: 'Enregistrement impossible. Consultez le journal dans Réglages › Développement.',
};

/**
 * Insets from the root provider (window metrics). Inside a full-screen modal the
 * SafeAreaView component may measure itself wrongly, so padding is applied explicitly:
 * status bar + navigation bar (close button) on top, home indicator at the bottom.
 */
function ringState(state: SessionState): RingState {
  if (state.status === 'calibrating') return 'running';
  if (state.status === 'ready') return 'done';
  if (state.status === 'error') return 'error';
  return 'idle';
}

function useModalFrame() {
  const insets = useSafeAreaInsets();
  return { paddingTop: insets.top + 52, paddingBottom: insets.bottom };
}

const STEPS = ['Véhicule à l’arrêt', 'Téléphone fixé en portrait, écran face à vous', 'Ne plus toucher le téléphone'];

function gpsLabel(accuracy: number | null, ageMs: number | null, fixes: number): string {
  if (fixes === 0) return 'Recherche…';
  if (ageMs !== null && ageMs > 3000) return 'Signal perdu';
  return accuracy !== null ? `± ${formatNumber(accuracy, 0)} m` : 'OK';
}

export default function MeasureScreen() {
  const settings = useSettings();
  const { motion, location, requestMotion, requestLocation } = usePermissions();
  const [state, dispatch] = useReducer(sessionReducer, INITIAL_STATE);
  const highRefresh = useHighRefresh();
  const motionRate = highRefresh ? settings.motionRateHz : 60;
  const [progress, setProgress] = useState(0);
  const [restarts, setRestarts] = useState(0);
  const [result, setResult] = useState<{ session: Session; series: SessionSeries | null } | null>(null);
  const [liveRead, setLiveRead] = useState<(() => LiveSnapshot) | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const stopCalibrationRef = useRef<(() => void) | null>(null);
  const gpsProbeRef = useRef<ReturnType<typeof startLocationProbe> | null>(null);
  const readGps = useCallback(() => gpsProbeRef.current?.snapshot() ?? null, []);

  const permissionsOk = motion?.state === 'granted' && location?.state === 'granted';
  const preparing = state.status === 'idle' || state.status === 'calibrating' || state.status === 'ready' || state.status === 'error';

  // GPS warm-up while preparing, so a fix is available when the measurement starts.
  useEffect(() => {
    if (!permissionsOk || !preparing) return;
    const probe = startLocationProbe();
    gpsProbeRef.current = probe;
    return () => {
      probe.stop();
      gpsProbeRef.current = null;
    };
  }, [permissionsOk, preparing]);

  // Keep the screen on while calibrating and measuring.
  const awake = settings.keepAwake && (state.status === 'calibrating' || state.status === 'measuring' || state.status === 'ready');
  useEffect(() => {
    if (!awake) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [awake]);

  // Release sensors if the screen goes away.
  useEffect(
    () => () => {
      stopCalibrationRef.current?.();
      recorderRef.current?.cancel();
    },
    [],
  );

  const gps = usePolled(readGps, 2);
  const live = usePolled(liveRead, 10);

  const calibrate = useCallback(() => {
    stopCalibrationRef.current?.();
    setProgress(0);
    setRestarts(0);
    dispatch({ type: 'CALIBRATE' });
    stopCalibrationRef.current = startCalibration((status) => {
      if (status.phase === 'collecting') {
        setProgress(status.progress);
        setRestarts(status.restarts);
      } else if (status.phase === 'done') {
        stopCalibrationRef.current = null;
        haptic('success');
        dispatch({ type: 'CALIBRATED', calibration: status.result });
      } else {
        stopCalibrationRef.current = null;
        haptic('impact');
        dispatch({ type: 'CALIBRATION_FAILED', reason: status.reason });
      }
    });
  }, []);

  const start = useCallback(() => {
    if (state.status !== 'ready') return;
    const recorder = startRecorder(state.calibration, Math.round(1000 / motionRate));
    recorderRef.current = recorder;
    setLiveRead(() => recorder.live);
    haptic('impact');
    dispatch({ type: 'START', at: Date.now() });
  }, [state, motionRate]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    setLiveRead(null);
    const raw = recorder.stop();
    dispatch({ type: 'STOP' });
    haptic('success');
    // Let the "processing" state render before the synchronous computation.
    await new Promise((r) => setTimeout(r, 60));
    try {
      const session = await saveRecording({ ...raw, source: 'device' });
      dispatch({ type: 'SAVED', sessionId: session.id });
      setResult({ session, series: await sessions().getSeries(session.id) });
    } catch (e) {
      log('error', 'measure', 'Enregistrement impossible', String(e));
      dispatch({ type: 'FAIL', reason: 'save' });
    }
  }, []);

  const close = useCallback(() => {
    if (state.status === 'measuring') {
      Alert.alert('Annuler la mesure ?', 'Les données de cette mesure ne seront pas enregistrées.', [
        { text: 'Continuer', style: 'cancel' },
        {
          text: 'Annuler la mesure',
          style: 'destructive',
          onPress: () => {
            recorderRef.current?.cancel();
            recorderRef.current = null;
            setLiveRead(null);
            dispatch({ type: 'CANCEL' });
            router.back();
          },
        },
      ]);
      return;
    }
    stopCalibrationRef.current?.();
    router.back();
  }, [state.status]);

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" accessibilityLabel="Fermer" onPress={close} />
      </Stack.Toolbar>

      {state.status === 'finished' && result ? (
        <SessionSummaryView
          session={result.session}
          series={result.series}
          onOpenMap={() => router.push(`/map/${result.session.id}`)}
          onExport={() => exportSession(result.session.id).catch((e: unknown) => Alert.alert('Export impossible', String(e)))}
        />
      ) : state.status === 'finished' ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textSecondary} />
          <AppText variant="subhead">Calcul du trajet…</AppText>
        </View>
      ) : state.status === 'measuring' ? (
        <Measuring live={live} onStop={stop} />
      ) : (
        <Preparation
          state={state}
          progress={progress}
          restarts={restarts}
          permissionsOk={permissionsOk}
          motionValue={motionLabel(motion)}
          locationValue={locationLabel(location)}
          onRequestMotion={motion?.state === 'granted' ? undefined : requestMotion}
          onRequestLocation={location?.state === 'granted' ? undefined : requestLocation}
          gpsValue={gps ? gpsLabel(gps.accuracy, gps.ageMs, gps.fixes) : '…'}
          onCalibrate={calibrate}
          onStart={start}
        />
      )}
    </>
  );
}

type PreparationProps = {
  state: SessionState;
  progress: number;
  restarts: number;
  permissionsOk: boolean;
  motionValue: string;
  locationValue: string;
  onRequestMotion?: () => void;
  onRequestLocation?: () => void;
  gpsValue: string;
  onCalibrate: () => void;
  onStart: () => void;
};

function Preparation(p: PreparationProps) {
  const { state } = p;
  const frame = useModalFrame();
  return (
    <View style={[styles.root, frame]}>
      <View style={styles.body}>
        <Animated.View style={styles.ringWrap} entering={FadeIn.duration(500)}>
          <CalibrationRing state={ringState(state)} progress={p.progress} />
        </Animated.View>

        <View style={styles.heading}>
          <AppText variant="largeTitle" accessibilityRole="header" style={styles.centerText}>
            {state.status === 'ready' ? 'Prêt' : 'Calibration'}
          </AppText>
          <AppText variant="subhead" style={styles.centerText} color={state.status === 'error' ? colors.textPrimary : undefined}>
            {state.status === 'ready'
              ? `Inclinaison ${formatNumber(state.calibration.tiltDeg, 0)}°. Recalibrez si vous déplacez le téléphone.`
              : state.status === 'calibrating'
                ? p.restarts > 0
                  ? 'Mouvement détecté, nouvelle tentative…'
                  : 'Ne touchez plus le téléphone…'
                : state.status === 'error'
                  ? FAILURE_TEXT[state.reason]
                  : 'Deux secondes d’immobilité suffisent.'}
          </AppText>
        </View>

        {!p.permissionsOk ? (
          <ListGroup header="Autorisations requises">
            <ListRow label="Mouvement" value={p.motionValue} onPress={p.onRequestMotion} chevron={!!p.onRequestMotion} />
            <ListRow label="Localisation" value={p.locationValue} onPress={p.onRequestLocation} chevron={!!p.onRequestLocation} />
          </ListGroup>
        ) : (
          <ListGroup>
            {state.status === 'ready' ? null : STEPS.map((s, i) => <ListRow key={s} label={`${i + 1}.  ${s}`} />)}
            <ListRow label="GPS" value={p.gpsValue} />
          </ListGroup>
        )}

      </View>

      <View style={styles.footer}>
        {state.status === 'ready' ? (
          <>
            <PrimaryButton label="Démarrer la mesure" onPress={p.onStart} />
            <Pressable onPress={p.onCalibrate} style={styles.secondary} accessibilityRole="button">
              <AppText color={colors.textSecondary}>Recalibrer</AppText>
            </Pressable>
          </>
        ) : (
          <PrimaryButton
            label={state.status === 'error' ? 'Réessayer' : 'Calibrer'}
            onPress={p.onCalibrate}
            disabled={!p.permissionsOk || state.status === 'calibrating'}
          />
        )}
      </View>
    </View>
  );
}

function Measuring({ live, onStop }: { live: LiveSnapshot | null; onStop: () => void }) {
  const { speedUnit, accelUnit } = useSettings();
  const speed = live?.speed != null ? formatSpeed(live.speed, speedUnit) : { value: '—', unit: formatSpeed(0, speedUnit).unit };
  const accel = (v: number) => joinValue(formatAccel(v, accelUnit));
  const gps = live ? gpsLabel(live.gpsAccuracy, live.gpsAgeMs, live.gpsFixes) : '…';
  const frame = useModalFrame();

  return (
    <View style={[styles.root, frame]}>
      <View style={styles.liveTop}>
        <GlassSurface radius={radii.pill} style={styles.pill}>
          <RecordingDot />
          <AppText variant="footnote" color={colors.textPrimary} numeric weight="600">
            {formatDuration(live?.elapsedMs ?? 0)}
          </AppText>
          <AppText variant="footnote">· GPS {gps}</AppText>
        </GlassSurface>
      </View>

      <Animated.View style={styles.liveBody} entering={FadeIn.duration(450)}>
        <View style={styles.speed}>
          <AppText numeric style={styles.speedValue} adjustsFontSizeToFit numberOfLines={1}>
            {speed.value}
          </AppText>
          <AppText variant="title" color={colors.textSecondary}>
            {speed.unit}
          </AppText>
        </View>

        <View style={styles.gRow}>
          <GBall long={live?.long ?? 0} lat={live?.lat ?? 0} size={140} />
          <View style={styles.gStats}>
            <Stat label="Longitudinal" value={formatAccel(live?.long ?? 0, accelUnit).value} unit={formatAccel(0, accelUnit).unit} />
            <Stat label="Latéral" value={formatAccel(Math.abs(live?.lat ?? 0), accelUnit).value} unit={formatAccel(0, accelUnit).unit} />
          </View>
        </View>

        <ListGroup>
          <ListRow label="Pic accélération" value={accel(live?.peakAccel ?? 0)} />
          <ListRow label="Pic freinage" value={accel(live?.peakBrake ?? 0)} />
          <ListRow label="Pic latéral" value={accel(live?.peakLat ?? 0)} />
        </ListGroup>
        {live && live.tiltDriftDeg > 8 ? (
          <AppText variant="footnote" color={colors.textPrimary}>
            Téléphone déplacé : les forces G seront moins fiables.
          </AppText>
        ) : null}
      </Animated.View>

      <View style={styles.footer}>
        <PrimaryButton label="Terminer" onPress={onStop} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: GUTTER,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
  },
  heading: {
    gap: 4,
    paddingHorizontal: 4,
  },
  ringWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  centerText: {
    textAlign: 'center',
  },
  footer: {
    gap: 6,
    paddingBottom: 12,
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  liveTop: {
    alignItems: 'center',
    paddingTop: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  liveBody: {
    flex: 1,
    justifyContent: 'center',
    gap: 28,
  },
  speed: {
    alignItems: 'center',
  },
  speedValue: {
    fontSize: 120,
    lineHeight: 128,
    fontWeight: '200',
    letterSpacing: -5,
  },
  gRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  gStats: {
    flex: 1,
    gap: 16,
  },
});
