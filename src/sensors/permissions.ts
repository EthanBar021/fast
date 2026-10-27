import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export interface MotionPermission {
  state: PermissionState;
  canAskAgain: boolean;
}

export interface LocationPermission {
  state: PermissionState;
  canAskAgain: boolean;
  /** iOS "Precise Location". `null` when unknown (not granted, or not iOS). */
  precise: boolean | null;
}

function toState(status: string): PermissionState {
  return status === 'granted' || status === 'denied' ? status : 'undetermined';
}

async function readMotion(): Promise<MotionPermission> {
  const r = await DeviceMotion.getPermissionsAsync();
  return { state: toState(r.status), canAskAgain: r.canAskAgain };
}

async function readLocation(): Promise<LocationPermission> {
  const r = await Location.getForegroundPermissionsAsync();
  const state = toState(r.status);
  return {
    state,
    canAskAgain: r.canAskAgain,
    precise: state === 'granted' && r.ios ? r.ios.accuracy === 'full' : null,
  };
}

function readAll() {
  return Promise.all([readMotion(), readLocation()]);
}

/** Labels shown in lists. */
export function motionLabel(p: MotionPermission | null): string {
  if (!p) return '…';
  return p.state === 'granted' ? 'Autorisé' : p.state === 'denied' ? 'Refusé' : 'À autoriser';
}

export function locationLabel(p: LocationPermission | null): string {
  if (!p) return '…';
  if (p.state === 'granted') return p.precise === false ? 'Approximative' : 'Précise';
  return p.state === 'denied' ? 'Refusée' : 'À autoriser';
}

/**
 * Current permission state, refreshed when the app returns to the foreground
 * (the user may have changed it in iOS Settings).
 */
export function usePermissions() {
  const [motion, setMotion] = useState<MotionPermission | null>(null);
  const [location, setLocation] = useState<LocationPermission | null>(null);

  const refresh = useCallback(
    () =>
      readAll().then(
        ([m, l]) => {
          setMotion(m);
          setLocation(l);
        },
        (error: unknown) => console.warn('[permissions] lecture impossible', error),
      ),
    [],
  );

  useEffect(() => {
    let active = true;
    const load = () =>
      readAll().then(
        ([m, l]) => {
          if (!active) return;
          setMotion(m);
          setLocation(l);
        },
        (error: unknown) => console.warn('[permissions] lecture impossible', error),
      );
    load();
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') load();
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  /** Asks iOS when possible; otherwise opens the app's page in iOS Settings. */
  const requestMotion = useCallback(async () => {
    if (motion && motion.state !== 'granted' && !motion.canAskAgain) return Linking.openSettings();
    await DeviceMotion.requestPermissionsAsync();
    await refresh();
  }, [motion, refresh]);

  const requestLocation = useCallback(async () => {
    const blocked = location && location.state !== 'granted' && !location.canAskAgain;
    // Reduced accuracy can only be changed by the user in iOS Settings.
    if (blocked || location?.precise === false) return Linking.openSettings();
    await Location.requestForegroundPermissionsAsync();
    await refresh();
  }, [location, refresh]);

  return { motion, location, requestMotion, requestLocation, refresh };
}
