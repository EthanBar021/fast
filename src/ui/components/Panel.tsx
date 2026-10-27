import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii } from '@/ui/theme/tokens';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Opaque content surface with a hairline that catches light on the top edge
 * and fades toward the bottom — depth without transparency.
 */
export function Panel({ children, style }: Props) {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']}
      locations={[0, 0.35, 1]}
      style={styles.border}>
      <View style={[styles.inner, style]}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  border: {
    borderRadius: radii.lg,
    padding: StyleSheet.hairlineWidth * 2,
  },
  inner: {
    borderRadius: radii.lg - 1,
    backgroundColor: colors.surface,
    padding: 18,
  },
});
