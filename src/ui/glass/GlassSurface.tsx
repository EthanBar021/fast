import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii } from '@/ui/theme/tokens';

import { useGlassMode } from './glassMode';

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** Native glass reacts to touches (iOS 26+). Use for buttons. */
  interactive?: boolean;
  /** Optional color tint, e.g. the accent for a primary control. */
  tintColor?: string;
};

/**
 * Single entry point for glass. Renders, in order of preference:
 * 1. native Liquid Glass (expo-glass-effect GlassView, iOS 26+);
 * 2. a simulated glass (blur + sheen + hairline) — an approximation, not the Apple material;
 * 3. an opaque surface (Reduce Transparency, or user preference).
 *
 * Do not animate `opacity` on this component or its parents: native glass stops
 * rendering at opacity 0 (documented expo-glass-effect limitation).
 */
export function GlassSurface({ children, style, radius = radii.lg, interactive = false, tintColor }: Props) {
  const mode = useGlassMode();
  const shape: ViewStyle = { borderRadius: radius, overflow: 'hidden' };

  if (mode === 'native') {
    return (
      <GlassView
        style={[shape, style]}
        glassEffectStyle="regular"
        colorScheme="dark"
        isInteractive={interactive}
        tintColor={tintColor}>
        {children}
      </GlassView>
    );
  }

  if (mode === 'simulated') {
    return (
      <View style={[shape, styles.hairline, style]}>
        <BlurView tint="systemChromeMaterialDark" intensity={55} style={StyleSheet.absoluteFill} />
        {tintColor ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor, opacity: 0.35 }]} />
        ) : null}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    );
  }

  return (
    <View style={[shape, styles.hairline, styles.opaque, tintColor ? { backgroundColor: tintColor } : null, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hairline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  opaque: {
    backgroundColor: colors.surfaceHigh,
  },
});
