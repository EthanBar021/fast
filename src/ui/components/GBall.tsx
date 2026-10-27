import { useEffect } from 'react';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';

import { STANDARD_GRAVITY } from '@/core/units';
import { colors } from '@/ui/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** m/s², positive = acceleration */
  long: number;
  /** m/s², positive = left */
  lat: number;
  size?: number;
  /** Scale of the outer ring, in g. */
  maxG?: number;
  /** Interval between value updates (ms); the dot glides over it. */
  updateMs?: number;
};

/**
 * Friction circle: the dot shows the current combined G (up = accelerating,
 * left = left turn). Values arrive ~10 times per second; the dot glides between
 * them on the UI thread so it moves smoothly.
 */
export function GBall({ long, lat, size = 150, maxG = 1, updateMs = 100 }: Props) {
  const r = size / 2 - 8;
  const c = size / 2;
  const k = r / (maxG * STANDARD_GRAVITY);
  let dx = -lat * k;
  let dy = -long * k;
  const d = Math.hypot(dx, dy);
  if (d > r) {
    dx = (dx / d) * r;
    dy = (dy / d) * r;
  }

  const x = useSharedValue(c);
  const y = useSharedValue(c);
  useEffect(() => {
    const cfg = { duration: updateMs + 20, easing: Easing.linear };
    x.set(withTiming(c + dx, cfg));
    y.set(withTiming(c + dy, cfg));
  }, [c, dx, dy, updateMs, x, y]);

  const dot = useAnimatedProps(() => ({ cx: x.get(), cy: y.get() }));
  const halo = useAnimatedProps(() => ({ cx: x.get(), cy: y.get() }));

  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} stroke={colors.textTertiary} strokeWidth={1} fill="none" />
      <Circle cx={c} cy={c} r={r / 2} stroke={colors.separator} strokeWidth={1} fill="none" />
      <Line x1={c - r} x2={c + r} y1={c} y2={c} stroke={colors.separator} strokeWidth={1} />
      <Line x1={c} x2={c} y1={c - r} y2={c + r} stroke={colors.separator} strokeWidth={1} />
      <AnimatedCircle animatedProps={halo} r={14} fill={colors.textPrimary} fillOpacity={0.12} />
      <AnimatedCircle animatedProps={dot} r={6.5} fill={colors.textPrimary} />
    </Svg>
  );
}
