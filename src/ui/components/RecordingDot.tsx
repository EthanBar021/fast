import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/ui/theme/tokens';

/** Red "recording" dot with a slow expanding pulse. */
export function RecordingDot() {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), -1, false));
  }, [pulse, reduceMotion]);

  const ring = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.get()),
    transform: [{ scale: 1 + pulse.get() * 1.6 }],
  }));

  return (
    <View style={styles.box}>
      <Animated.View style={[styles.dot, styles.ring, ring]} />
      <View style={styles.dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.live,
  },
  ring: {
    position: 'absolute',
  },
});
