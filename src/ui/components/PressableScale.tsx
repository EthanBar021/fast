import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic, type HapticKind } from '@/ui/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Haptic fired on press; `false` disables it. */
  feedback?: HapticKind | false;
};

/** Pressable with a subtle scale-down (skipped when Reduce Motion is on) and optional haptic. */
export function PressableScale({ children, style, feedback = 'selection', onPress, disabled, ...rest }: Props) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={() => {
        if (!reduceMotion) scale.set(withSpring(0.96, SPRING));
      }}
      onPressOut={() => scale.set(withSpring(1, SPRING))}
      onPress={(event) => {
        if (feedback) haptic(feedback);
        onPress?.(event);
      }}
      style={[animatedStyle, disabled ? { opacity: 0.5 } : null, style]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
