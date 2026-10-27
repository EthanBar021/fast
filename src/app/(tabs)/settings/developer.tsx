import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Share } from 'react-native';

import { simulateRecording, type SimulationOptions } from '@/core/simulate';
import { exportAll, exportLog } from '@/dev/exportData';
import { buildReport } from '@/dev/report';
import { clearLog, log } from '@/dev/log';
import type { GlassPreference } from '@/models/settings';
import { deleteSessions, saveRecording, sessions } from '@/storage/sessions';
import { resetSettings, updateSettings, useSettings } from '@/storage/settingsStore';
import { ListGroup, ListRow } from '@/ui/components/List';
import { SegmentedControl } from '@/ui/components/SegmentedControl';
import { TabScreen } from '@/ui/components/TabScreen';
import { Toggle } from '@/ui/components/Toggle';
import { formatNumber } from '@/ui/format';
import { haptic } from '@/ui/haptics';
import { nativeGlassAvailable, useGlassMode, useReduceTransparency } from '@/ui/glass/glassMode';

const GLASS_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'simulated', label: 'Simulé' },
  { value: 'opaque', label: 'Opaque' },
] as const satisfies readonly { value: GlassPreference; label: string }[];

const GLASS_MODE_LABEL = { native: 'natif', simulated: 'simulé', opaque: 'opaque' } as const;

const DEMOS: { label: string; detail: string; options: SimulationOptions }[] = [
  {
    label: 'Session de démo',
    detail: 'Départ arrêté jusqu’à ~100 km/h, freinage, virage gauche puis droite. GPS 1 Hz bruité.',
    options: { mountYaw: 0.35 },
  },
  {
    label: 'Démo : GPS dégradé',
    detail: 'Coupure GPS de 9 s, vitesses GPS invalides (dérivées des positions), précision ± 9 m.',
    options: { gpsGap: { from: 20_000, to: 29_000 }, invalidGpsSpeed: true, gpsNoiseM: 3 },
  },
  {
    label: 'Démo : téléphone monté de travers',
    detail: 'Téléphone tourné de 140° et axes inversés : teste l’alignement automatique par GPS.',
    options: { mountYaw: 2.45, mirrored: true },
  },
  {
    label: 'Démo : sans capteurs de mouvement',
    detail: 'Uniquement le GPS : la vitesse est interpolée, les forces G sont indisponibles.',
    options: { noMotion: true },
  },
];

/** New scenario noise on every generation. */
function randomSeed(): number {
  return Math.floor(Math.random() * 1e6);
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${formatNumber(b / 1024, 0)} Ko`;
  return `${formatNumber(b / 1024 / 1024, 1)} Mo`;
}

export default function DeveloperScreen() {
  const settings = useSettings();
  const glassMode = useGlassMode();
  const reduceTransparency = useReduceTransparency();
  const [stats, setStats] = useState<{ count: number; bytes: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      sessions().stats().then(setStats, () => setStats(null));
    }, []),
  );

  const generate = async (options: SimulationOptions) => {
    if (busy) return;
    setBusy(true);
    try {
      const { recording } = simulateRecording({ ...options, seed: randomSeed() });
      const session = await saveRecording(recording);
      haptic('success');
      setStats(await sessions().stats());
      router.push(`/history/${session.id}`);
    } catch (e) {
      log('error', 'dev', 'Génération de démo impossible', String(e));
      Alert.alert('Erreur', String(e));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    try {
      await Share.share({ message: await buildReport() });
    } catch (e) {
      log('error', 'dev', 'Partage du rapport impossible', String(e));
    }
  };

  const runExport = async (what: 'all' | 'log') => {
    if (busy) return;
    setBusy(true);
    try {
      if (what === 'all') {
        const n = await exportAll();
        if (n === 0) Alert.alert('Aucune vraie session', 'Le fichier ne contient que le journal.');
      } else {
        await exportLog();
      }
    } catch (e) {
      log('error', 'export', 'Export impossible', String(e));
      Alert.alert('Export impossible', String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <TabScreen>
      <ListGroup
        header="Tests en voiture"
        footer="Crée un fichier JSON (données brutes de l’accéléromètre, points GPS avec positions, calibration, résumé calculé et journal), puis ouvre la feuille de partage : AirDrop, Mail, Fichiers… Rien n’est envoyé sans votre choix. Les sessions de démo ne sont pas incluses. Chaque session peut aussi être exportée seule depuis son résumé (Détails › Exporter les données).">
        <ListRow label="Exporter toutes les sessions" icon="square.and.arrow.up" onPress={() => runExport('all')} chevron />
        <ListRow label="Exporter le journal seul" icon="doc.text" onPress={() => runExport('log')} chevron />
      </ListGroup>

      <ListGroup
        header="Capteurs"
        footer="La fréquence des capteurs se règle dans Réglages › Mesure (120 Hz seulement sur les iPhone à écran ProMotion). Elle n’est pas garantie : le diagnostic affiche la fréquence réellement reçue. Elle ne dépend pas techniquement de l’écran ; le réglage est limité aux écrans 120 Hz par choix de produit. Les chiffres à l’écran sont rafraîchis 10 fois par seconde pour rester lisibles.">
        <ListRow label="Diagnostic capteurs" onPress={() => router.push('/settings/diagnostics')} chevron />
      </ListGroup>

      <ListGroup
        header="Sessions de démo"
        footer="Sessions générées par simulation et passées dans le même calcul que les vraies mesures. Elles sont marquées « Démo » partout et ne sont jamais présentées comme de vraies mesures.">
        {DEMOS.map((d) => (
          <ListRow key={d.label} label={d.label} detail={d.detail} onPress={() => generate(d.options)} chevron />
        ))}
        <ListRow
          label="Supprimer les sessions de démo"
          destructive
          onPress={() =>
            deleteSessions('demo').then(async (n) => {
              setStats(await sessions().stats());
              Alert.alert('Sessions de démo', `${n} supprimée(s).`);
            })
          }
        />
      </ListGroup>

      <ListGroup header="Stockage" footer="Base SQLite locale (expo-sqlite). Séries à 10 Hz et points GPS bruts en blobs binaires.">
        <ListRow label="Sessions" value={stats ? String(stats.count) : '—'} />
        <ListRow label="Données de mesure" value={stats ? formatBytes(stats.bytes) : '—'} />
      </ListGroup>

      <ListGroup
        header="Apparence"
        footer="Onglets et barres utilisent le matériau système. Le réglage « Effets de verre » s’applique aux commandes flottantes (écran de mesure, carte plein écran).">
        <ListRow label="Liquid Glass natif" value={nativeGlassAvailable ? 'Disponible' : 'Indisponible'} />
        <ListRow label="Réduire la transparence (iOS)" value={reduceTransparency ? 'Activé' : 'Désactivé'} />
        <ListRow
          label="Effets de verre"
          detail={`Rendu actuel : ${GLASS_MODE_LABEL[glassMode]}`}
          below={
            <SegmentedControl
              accessibilityLabel="Effets de verre"
              options={GLASS_OPTIONS}
              value={settings.glass}
              onChange={(glass) => updateSettings({ glass })}
            />
          }
        />
        <ListRow
          label="Écran d’accueil au lancement"
          accessory={
            <Toggle value={settings.showWelcome} onChange={(showWelcome) => updateSettings({ showWelcome })} />
          }
        />
      </ListGroup>

      <ListGroup
        header="Journal"
        footer="Le journal garde les 1000 derniers événements sur le téléphone, même après fermeture de l’app : calibration, mesure (une ligne de suivi toutes les 10 s), calcul, erreurs. Le rapport texte contient l’appareil, les réglages, les résumés des 5 dernières sessions sans coordonnées, et le journal.">
        <ListRow label="Voir le journal" onPress={() => router.push('/settings/log')} chevron />
        <ListRow label="Partager un rapport texte" onPress={share} chevron />
        <ListRow label="Effacer le journal" onPress={clearLog} />
      </ListGroup>

      <ListGroup header="Système">
        <ListRow label="Appareil" value={Device.modelName ?? '—'} />
        <ListRow label="iOS" value={Device.osVersion ?? String(Platform.Version)} />
        <ListRow label="Expo SDK" value={Constants.expoConfig?.sdkVersion ?? '—'} />
      </ListGroup>

      <ListGroup>
        <ListRow
          label="Réinitialiser les réglages"
          destructive
          onPress={() =>
            Alert.alert('Réinitialiser les réglages ?', undefined, [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Réinitialiser', style: 'destructive', onPress: resetSettings },
            ])
          }
        />
      </ListGroup>
    </TabScreen>
  );
}
