import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, Polygon, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { arcPath, LOGO, needlePolygons, numerals, ticks, type Tick } from '@/ui/logoGeometry';
import { colors } from '@/ui/theme/tokens';

export const LOGO_RED = '#FF2D20';

const TICKS = ticks();
const NUMERALS = numerals();
const NEEDLE = needlePolygons();
const BEZEL_R = 97;
const BEZEL_C = 2 * Math.PI * BEZEL_R;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedText = Animated.createAnimatedComponent(SvgText);

/** Brightness of a dial element at fraction `f` while the dial "boots" (b: 0 → 1). */
function lit(b: number, f: number) {
  'worklet';
  const x = Math.min(1, Math.max(0, (b * 1.15 - f) / 0.12));
  return 0.1 + 0.9 * x;
}

type Props = {
  size: number;
  /** Needle position as a fraction of the dial (0 … 1). Rests at the limiter when omitted. */
  needle?: SharedValue<number>;
  /** Dial illumination sweep (0 = dark, 1 = fully lit). Fully lit when omitted. */
  boot?: SharedValue<number>;
  /** Shift light intensity (0 … 1). */
  shift?: SharedValue<number>;
};

function DialTick({ tick, index, boot }: { tick: Tick; index: number; boot: SharedValue<number> }) {
  const f = index / (TICKS.length - 1);
  const props = useAnimatedProps(() => ({ opacity: lit(boot.get(), f) }));
  return (
    <AnimatedLine
      animatedProps={props}
      x1={tick.x1}
      y1={tick.y1}
      x2={tick.x2}
      y2={tick.y2}
      stroke={tick.red ? LOGO_RED : tick.major ? colors.textPrimary : colors.textTertiary}
      strokeWidth={tick.major ? 2.6 : 1.1}
      strokeLinecap="round"
    />
  );
}

function DialNumeral({ n, index, boot }: { n: (typeof NUMERALS)[number]; index: number; boot: SharedValue<number> }) {
  const f = index / (NUMERALS.length - 1);
  const props = useAnimatedProps(() => ({ opacity: lit(boot.get(), f) }));
  return (
    <AnimatedText
      animatedProps={props}
      x={n.x}
      y={n.y}
      fontSize={11.5}
      fontWeight="600"
      textAnchor="middle"
      fill={n.red ? LOGO_RED : colors.textSecondary}>
      {n.label}
    </AnimatedText>
  );
}

/**
 * Tachometer logo. Static SVG layers animated on the UI thread through shared values:
 * dial illumination, needle, red-zone glow and shift light.
 */
export function FastLogo({ size, needle, boot, shift }: Props) {
  const restNeedle = useSharedValue(LOGO.needle);
  const fullyLit = useSharedValue(1);
  const off = useSharedValue(0);
  const n = needle ?? restNeedle;
  const b = boot ?? fullyLit;
  const s = shift ?? off;

  const bezelProps = useAnimatedProps(() => ({
    strokeDashoffset: BEZEL_C * (1 - Math.min(1, b.get() * 1.4)),
  }));
  const redZoneProps = useAnimatedProps(() => ({ opacity: lit(b.get(), LOGO.redline) }));
  // Red zone glows as the needle enters it, and flashes with the shift light.
  const glowProps = useAnimatedProps(() => {
    const inRed = Math.min(1, Math.max(0, (n.get() - (LOGO.redline - 0.06)) / 0.1));
    return { opacity: Math.min(1, 0.45 * inRed + 0.55 * s.get()) * lit(b.get(), 1) };
  });
  const shiftProps = useAnimatedProps(() => ({ opacity: s.get() }));
  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${LOGO.sweepDeg * n.get()}deg` }],
    opacity: Math.min(1, b.get() * 3),
  }));

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Logo Fast">
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id="face" cx="50%" cy="42%" r="58%">
            <Stop offset="0" stopColor="#1A1A1E" />
            <Stop offset="0.7" stopColor="#0A0A0C" />
            <Stop offset="1" stopColor="#040405" />
          </RadialGradient>
        </Defs>
        <Circle cx={LOGO.cx} cy={LOGO.cy} r={93} fill="url(#face)" />
        {/* Bezel drawn around the dial while it boots. */}
        <AnimatedCircle
          animatedProps={bezelProps}
          cx={LOGO.cx}
          cy={LOGO.cy}
          r={BEZEL_R}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={1.2}
          strokeDasharray={[BEZEL_C, BEZEL_C]}
          rotation={LOGO.startDeg}
          origin={`${LOGO.cx}, ${LOGO.cy}`}
        />
        {/* Red zone: soft glow layers under a crisp band. */}
        <AnimatedPath animatedProps={glowProps} d={arcPath(LOGO.redline, 1, LOGO.radius - 3)} stroke={LOGO_RED} strokeWidth={16} strokeOpacity={0.16} fill="none" />
        <AnimatedPath animatedProps={glowProps} d={arcPath(LOGO.redline, 1, LOGO.radius - 3)} stroke={LOGO_RED} strokeWidth={9} strokeOpacity={0.3} fill="none" />
        <AnimatedPath animatedProps={redZoneProps} d={arcPath(LOGO.redline, 1, LOGO.radius - 3)} stroke={LOGO_RED} strokeWidth={5} fill="none" />
        {TICKS.map((t, i) => (
          <DialTick key={i} tick={t} index={i} boot={b} />
        ))}
        {NUMERALS.map((num, i) => (
          <DialNumeral key={num.label} n={num} index={i} boot={b} />
        ))}
        <SvgText x={100} y={152} fontSize={6.5} fontWeight="600" letterSpacing={1.2} textAnchor="middle" fill={colors.textTertiary}>
          ×1000 TR/MIN
        </SvgText>
        {/* Shift light */}
        <Rect x={91} y={133} width={18} height={4} rx={2} fill="#26262A" />
        <AnimatedRect animatedProps={shiftProps} x={91} y={133} width={18} height={4} rx={2} fill={LOGO_RED} />
        <AnimatedRect animatedProps={shiftProps} x={86} y={130} width={28} height={10} rx={5} fill={LOGO_RED} fillOpacity={0.18} />
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, needleStyle]} pointerEvents="none">
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Polygon points={NEEDLE.body} fill={colors.textPrimary} />
          <Polygon points={NEEDLE.tip} fill={LOGO_RED} />
        </Svg>
      </Animated.View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Circle cx={LOGO.cx} cy={LOGO.cy} r={9.5} fill="#1C1C1F" stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
          <Circle cx={LOGO.cx} cy={LOGO.cy} r={3.4} fill={colors.textPrimary} />
        </Svg>
      </View>
    </View>
  );
}
