import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '@/ui/theme/AppText';
import { colors } from '@/ui/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export type RingState = 'idle' | 'running' | 'done' | 'error';

type Props = {
  state: RingState;
  /** 0 … 1 while running. */
  progress: number;
  size?: number;
};

const STROKE = 4;
const CHECK = 'M 40 52 L 48 60 L 63 43';
const CHECK_LEN = 36;

/** Circular calibration progress: fills while the phone is still, turns into a check mark. */
export function CalibrationRing({ state, progress, size = 168 }: Props) {
  const reduceMotion = useReducedMotion();
  const r = (size - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const fill = useSharedValue(0);
  const check = useSharedValue(0);
  const pop = useSharedValue(1);
  const breathe = useSharedValue(1);

  useEffect(() => {
    const target = state === 'done' ? 1 : state === 'running' ? progress : 0;
    fill.set(withTiming(target, { duration: state === 'running' ? 140 : 380, easing: Easing.out(Easing.quad) }));
    check.set(state === 'done' ? withDelay(220, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) })) : 0);
    if (state === 'done' && !reduceMotion) {
      pop.set(withDelay(200, withSequence(withSpring(1.08, { damping: 8, stiffness: 260 }), withSpring(1, { damping: 14 }))));
    }
  }, [state, progress, fill, check, pop, reduceMotion]);

  // Slow breathing while waiting for the user, so the screen does not feel frozen.
  useEffect(() => {
    if (state !== 'idle' || reduceMotion) {
      breathe.set(withTiming(1, { duration: 200 }));
      return;
    }
    breathe.set(withRepeat(withSequence(withTiming(1.035, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true));
  }, [state, breathe, reduceMotion]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - fill.get()) }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: CHECK_LEN * (1 - check.get()) }));
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() * breathe.get() }] }));

  const color = state === 'error' ? colors.danger : colors.textPrimary;

  return (
    <Animated.View style={[{ width: size, height: size }, scaleStyle]}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceHigh} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          animatedProps={ringProps}
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[c, c]}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        {state === 'done' ? (
          <Svg width={size * 0.5} height={size * 0.5} viewBox="25 25 50 50">
            <AnimatedPath
              animatedProps={checkProps}
              d={CHECK}
              stroke={colors.textPrimary}
              strokeWidth={4.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={[CHECK_LEN, CHECK_LEN]}
            />
          </Svg>
        ) : state === 'running' ? (
          <AppText numeric style={styles.percent}>
            {Math.round(progress * 100)}
            <AppText variant="subhead"> %</AppText>
          </AppText>
        ) : (
          <SymbolView
            name={state === 'error' ? 'exclamationmark' : 'iphone.gen3'}
            tintColor={state === 'error' ? colors.danger : colors.textSecondary}
            size={size * 0.26}
            weight="light"
          />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '200',
    letterSpacing: -1,
  },
});
