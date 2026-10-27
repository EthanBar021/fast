import { NativeTabs } from 'expo-router/native-tabs';

import { colors } from '@/ui/theme/tokens';

/**
 * System tab bar (UITabBarController). On iOS 26+ it is rendered by iOS itself
 * with the real Liquid Glass material — no imitation involved.
 */
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.textPrimary} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Icon sf={{ default: 'gauge.with.needle', selected: 'gauge.with.needle.fill' }} />
        <NativeTabs.Trigger.Label>Accueil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" />
        <NativeTabs.Trigger.Label>Historique</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
        <NativeTabs.Trigger.Label>Réglages</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
