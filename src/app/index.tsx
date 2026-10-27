import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getSettings } from '@/storage/settingsStore';
import { FastLogo } from '@/ui/components/FastLogo';
import { PrimaryButton } from '@/ui/components/PrimaryButton';
import { hapticTimeline } from '@/ui/haptics';
import { AppText } from '@/ui/theme/AppText';
import { colors, GUTTER } from '@/ui/theme/tokens';

/* ─── Arrival: ignition check ─────────────────────────────────────────────
   0 ms     dial lights up around the bezel (boot 0 → 1, 750 ms)
   300 ms   needle sweeps to the end of the dial…
   1020 ms  …and falls back to 0 (shift light blinks at the top)
   700 ms+  "Fast" rises letter by letter, then tagline and button        */
const BOOT_MS = 750;
const SWEEP_DELAY = 300;
const SWEEP_UP_MS = 720;
const SWEEP_DOWN_MS = 650;

/* ─── Launch: rev, limiter, dive into the dial (≈ 1.25 s) ─────────────── */
const REV_MS = 380;
const HITS = 5;
const HIT_DOWN = 40;
const HIT_UP = 46;
const LIMITER_MS = HITS * (HIT_DOWN + HIT_UP);
const ZOOM_AT = REV_MS + LIMITER_MS;
const ZOOM_MS = 470;
const NAVIGATE_AT = ZOOM_AT + ZOOM_MS - 70;
const LIMIT = 0.94;
const BOUNCE = 0.885;

const LETTERS = ['F', 'a', 's', 't'];

const letterIn = (i: number) =>
  new Keyframe({
    0: { transform: [{ translateY: 72 }] },
    100: { transform: [{ translateY: 0 }], easing: Easing.out(Easing.exp) },
  })
    .duration(700)
    .delay(700 + i * 55);

const fadeUp = (delay: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 14 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
  })
    .duration(600)
    .delay(delay);

export default function WelcomeScreen() {
  const { height, width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const showWelcome = getSettings().showWelcome;
  const boot = useSharedValue(reduceMotion ? 1 : 0);
  const needle = useSharedValue(0);
  const shift = useSharedValue(0);
  const zoom = useSharedValue(1);
  const logoOpacity = useSharedValue(1);
  const leave = useSharedValue(0);
  const [launching, setLaunching] = useState(false);
  const cancels = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (reduceMotion || !showWelcome) return;
    boot.set(withTiming(1, { duration: BOOT_MS, easing: Easing.out(Easing.quad) }));
    needle.set(
      withDelay(
        SWEEP_DELAY,
        withSequence(
          withTiming(1, { duration: SWEEP_UP_MS, easing: Easing.inOut(Easing.cubic) }),
          withTiming(0, { duration: SWEEP_DOWN_MS, easing: Easing.out(Easing.cubic) }),
        ),
      ),
    );
    shift.set(
      withDelay(
        SWEEP_DELAY + SWEEP_UP_MS - 140,
        withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 260 })),
      ),
    );
    cancels.current.push(
      hapticTimeline([
        { at: SWEEP_DELAY + SWEEP_UP_MS - 40, kind: 'soft' },
        { at: SWEEP_DELAY + SWEEP_UP_MS + SWEEP_DOWN_MS - 80, kind: 'light' },
      ]),
    );
  }, [boot, needle, shift, reduceMotion, showWelcome]);

  useEffect(() => () => cancels.current.forEach((c) => c()), []);

  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.get() }], opacity: logoOpacity.get() }));
  const leaveStyle = useAnimatedStyle(() => ({
    opacity: 1 - leave.get(),
    transform: [{ translateY: leave.get() * 24 }],
  }));

  // Read once at launch: toggling the setting later must not redirect this screen.
  if (!showWelcome) return <Redirect href="/dashboard" />;

  const launch = () => {
    if (launching) return;
    setLaunching(true);
    if (reduceMotion) {
      router.replace('/dashboard');
      return;
    }
    leave.set(withTiming(1, { duration: 260, easing: Easing.in(Easing.quad) }));

    // Rev up from wherever the needle is, then bounce on the limiter.
    const limiter = Array.from({ length: HITS }, () => [
      withTiming(BOUNCE, { duration: HIT_DOWN, easing: Easing.out(Easing.quad) }),
      withTiming(LIMIT, { duration: HIT_UP, easing: Easing.in(Easing.quad) }),
    ]).flat();
    needle.set(withSequence(withTiming(LIMIT, { duration: REV_MS, easing: Easing.in(Easing.cubic) }), ...limiter));
    shift.set(
      withDelay(
        REV_MS - 60,
        withRepeat(withSequence(withTiming(1, { duration: 30 }), withTiming(0.25, { duration: 56 })), HITS + 1, false),
      ),
    );

    // Haptics: engine rising, then the hard cut of each limiter hit.
    cancels.current.push(
      hapticTimeline([
        { at: 0, kind: 'light' },
        { at: 140, kind: 'light' },
        { at: 250, kind: 'impact' },
        { at: 330, kind: 'impact' },
        ...Array.from({ length: HITS }, (_, i) => ({ at: REV_MS + i * (HIT_DOWN + HIT_UP), kind: 'rigid' as const })),
        { at: ZOOM_AT + 40, kind: 'heavy' },
      ]),
    );

    // Dive into the hub while the dial dissolves.
    zoom.set(withDelay(ZOOM_AT, withTiming(11, { duration: ZOOM_MS, easing: Easing.in(Easing.cubic) })));
    logoOpacity.set(withDelay(ZOOM_AT + 110, withTiming(0, { duration: ZOOM_MS - 110, easing: Easing.in(Easing.quad) })));
    const timer = setTimeout(() => router.replace('/dashboard'), NAVIGATE_AT);
    cancels.current.push(() => clearTimeout(timer));
  };

  const logoSize = Math.min(width - 2 * GUTTER, Math.round(height * 0.44));
  const wordSize = 72;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.art}>
        <Animated.View style={logoStyle}>
          <FastLogo size={logoSize} needle={needle} boot={boot} shift={shift} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.copy, leaveStyle]}>
        <View style={[styles.wordmark, { height: wordSize * 1.05 }]} accessibilityRole="header" accessibilityLabel="Fast">
          {LETTERS.map((l, i) => (
            <Animated.View key={i} entering={reduceMotion ? undefined : letterIn(i)}>
              <AppText style={[styles.letter, { fontSize: wordSize, lineHeight: wordSize * 1.05 }]}>{l}</AppText>
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      {/* Two layers: entering (keyframe) and leaving (shared value) both animate opacity. */}
      <Animated.View style={leaveStyle}>
        <Animated.View style={styles.footer} entering={reduceMotion ? undefined : fadeUp(1150)}>
          <PrimaryButton label="Se lancer" onPress={launch} disabled={launching} />
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: GUTTER,
  },
  art: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  copy: {
    alignItems: 'center',
    marginBottom: 48,
  },
  wordmark: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  letter: {
    fontWeight: '800',
    letterSpacing: -2.5,
    color: colors.textPrimary,
  },
  footer: {
    paddingBottom: 12,
  },
});
