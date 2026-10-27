import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { AppText } from '@/ui/theme/AppText';
import { colors } from '@/ui/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export interface ChartSeries {
  values: ArrayLike<number>;
  color: string;
  dashed?: boolean;
  /** Soft gradient fill under the line (first series only looks best). */
  fill?: boolean;
}

type Props = {
  t: ArrayLike<number>;
  series: ChartSeries[];
  height?: number;
  /** Formats y-axis labels (already converted to the display unit). */
  format: (v: number) => string;
  /** Draws a baseline at 0 (for signed values like G). */
  zeroLine?: boolean;
  startLabel?: string;
  endLabel?: string;
  /** Delay before the lines draw themselves, ms. */
  delay?: number;
};

const MAX_POINTS = 300;
const PAD_Y = 6;
const DRAW_MS = 1100;

/** Keeps min and max of each bucket so peaks survive downsampling. */
function downsample(t: ArrayLike<number>, v: ArrayLike<number>): { t: number[]; v: number[] } {
  const n = v.length;
  if (n <= MAX_POINTS) return { t: Array.from(t), v: Array.from(v) };
  const buckets = MAX_POINTS / 2;
  const size = n / buckets;
  const ot: number[] = [];
  const ov: number[] = [];
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * size);
    const to = Math.min(n, Math.floor((b + 1) * size));
    let lo = from;
    let hi = from;
    for (let i = from; i < to; i++) {
      if (v[i] < v[lo]) lo = i;
      if (v[i] > v[hi]) hi = i;
    }
    for (const i of lo < hi ? [lo, hi] : [hi, lo]) {
      ot.push(t[i]);
      ov.push(v[i]);
    }
  }
  return { t: ot, v: ov };
}

/** A line that draws itself from left to right (stroke-dash reveal). */
function DrawnLine({ d, length, color, progress }: { d: string; length: number; color: string; progress: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.get()) }));
  return (
    <AnimatedPath
      animatedProps={props}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeDasharray={[length, length]}
    />
  );
}

function FadedPath({ d, progress, ...rest }: { d: string; progress: SharedValue<number> } & Record<string, unknown>) {
  const props = useAnimatedProps(() => ({ opacity: progress.get() }));
  return <AnimatedPath animatedProps={props} d={d} {...rest} />;
}

/** Minimal monochrome line chart (SVG) with a draw-in animation. */
export function LineChart({ t, series, height = 140, format, zeroLine, startLabel, endLabel, delay = 0 }: Props) {
  const [width, setWidth] = useState(0);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const n = t.length;

  let min = zeroLine ? 0 : Infinity;
  let max = zeroLine ? 0 : -Infinity;
  for (const s of series) {
    for (let i = 0; i < s.values.length; i++) {
      if (s.values[i] < min) min = s.values[i];
      if (s.values[i] > max) max = s.values[i];
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || n < 2) {
    min = 0;
    max = 1;
  }
  if (max - min < 1e-6) max = min + 1;

  const paths = useMemo(() => {
    if (width === 0) return [];
    const t0 = n > 0 ? t[0] : 0;
    const t1 = n > 1 ? t[n - 1] : 1;
    const x = (tv: number) => ((tv - t0) / (t1 - t0 || 1)) * width;
    const y = (v: number) => PAD_Y + (1 - (v - min) / (max - min)) * (height - 2 * PAD_Y);
    return series.map((s) => {
      const d = downsample(t, s.values);
      let length = 0;
      let px = 0;
      let py = 0;
      const pts = d.v.map((v, i) => {
        const X = x(d.t[i]);
        const Y = y(v);
        if (i > 0) length += Math.hypot(X - px, Y - py);
        px = X;
        py = Y;
        return `${i === 0 ? 'M' : 'L'}${X.toFixed(1)} ${Y.toFixed(1)}`;
      });
      const line = pts.join('');
      const base = zeroLine ? y(0) : height;
      const area = d.v.length > 1 ? `${line}L${x(d.t[d.t.length - 1]).toFixed(1)} ${base}L${x(d.t[0]).toFixed(1)} ${base}Z` : '';
      return { line, area, length: Math.ceil(length) + 2 };
    });
  }, [width, t, n, series, min, max, height, zeroLine]);

  useEffect(() => {
    if (width === 0 || reduceMotion) return;
    progress.set(0);
    progress.set(withDelay(delay, withTiming(1, { duration: DRAW_MS, easing: Easing.inOut(Easing.cubic) })));
  }, [width, series, delay, reduceMotion, progress]);

  const zeroY = PAD_Y + (1 - (0 - min) / (max - min)) * (height - 2 * PAD_Y);

  return (
    <View>
      <View style={styles.labels}>
        <AppText variant="caption">{format(max)}</AppText>
      </View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.textPrimary} stopOpacity={0.16} />
                <Stop offset="1" stopColor={colors.textPrimary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <Line key={f} x1={0} x2={width} y1={height * f} y2={height * f} stroke={colors.separator} strokeWidth={1} />
            ))}
            {zeroLine && min < 0 && max > 0 ? (
              <Line x1={0} x2={width} y1={zeroY} y2={zeroY} stroke={colors.textTertiary} strokeWidth={1} />
            ) : null}
            {series.map((s, i) =>
              s.fill && paths[i]?.area ? <FadedPath key={`a${i}`} d={paths[i].area} fill="url(#area)" progress={progress} /> : null,
            )}
            {series.map((s, i) =>
              !paths[i] ? null : s.dashed ? (
                <FadedPath
                  key={i}
                  d={paths[i].line}
                  progress={progress}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              ) : (
                <DrawnLine key={i} d={paths[i].line} length={paths[i].length} color={s.color} progress={progress} />
              ),
            )}
          </Svg>
        ) : null}
      </View>
      <View style={styles.footer}>
        <AppText variant="caption">{startLabel ?? ''}</AppText>
        <AppText variant="caption">{format(min)}</AppText>
        <AppText variant="caption">{endLabel ?? ''}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: {
    alignItems: 'flex-end',
    marginBottom: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
});
