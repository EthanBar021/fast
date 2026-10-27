import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { getSettings } from '@/storage/settingsStore';
import { sessions } from '@/storage/sessions';
import { nativeGlassAvailable } from '@/ui/glass/glassMode';

import { formatLogEntry, getLogEntries } from './log';

/**
 * Plain-text bug report: device, settings, latest session summaries (no
 * coordinates) and the in-app log. Shared only when the user taps "Partager".
 */
export async function buildReport(): Promise<string> {
  const rn = Platform.constants as { reactNativeVersion?: { major: number; minor: number; patch: number } };
  const rnv = rn.reactNativeVersion;
  const lines: string[] = [
    `Fast ${Constants.expoConfig?.version ?? '?'} (bêta)`,
    `Appareil : ${Device.modelName ?? '?'} · ${Device.osName ?? Platform.OS} ${Device.osVersion ?? Platform.Version}`,
    `Expo SDK ${Constants.expoConfig?.sdkVersion ?? '?'} · React Native ${rnv ? `${rnv.major}.${rnv.minor}.${rnv.patch}` : '?'}`,
    `Liquid Glass natif : ${nativeGlassAvailable ? 'oui' : 'non'}`,
    `Réglages : ${JSON.stringify(getSettings())}`,
    '',
    '— Dernières sessions —',
  ];
  try {
    const list = (await sessions().list()).slice(0, 5);
    for (const s of list) {
      const { warnings, ...numbers } = s.summary;
      lines.push(`${new Date(s.startedAt).toISOString()} [${s.source}] ${JSON.stringify(numbers)}`);
      if (warnings.length) lines.push(`  ! ${warnings.join(' | ')}`);
    }
    if (list.length === 0) lines.push('(aucune)');
  } catch (e) {
    lines.push(`Lecture impossible : ${String(e)}`);
  }
  lines.push('', '— Journal —', ...getLogEntries().map(formatLogEntry));
  return lines.join('\n');
}
