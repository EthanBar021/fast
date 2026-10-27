import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useCountUp } from '@/ui/useCountUp';
import { AppText } from '@/ui/theme/AppText';
import { colors } from '@/ui/theme/tokens';

type Size = 'hero' | 'large' | 'medium';

type Props = {
  label: string;
  value: string;
  unit?: string;
  size?: Size;
  style?: StyleProp<ViewStyle>;
};

const SIZES = { hero: 60, large: 34, medium: 26 } as const;
/** Big numbers are light, small ones heavier, like an instrument cluster. */
const WEIGHTS = { hero: '200', large: '300', medium: '400' } as const;

/** A number with its unit and a small caps label. Tabular digits, so live numbers do not jitter. */
export function Stat({ label, value, unit, size = 'medium', style }: Props) {
  const fontSize = SIZES[size];
  return (
    <View style={style}>
      <AppText variant="caption" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.row}>
        <AppText
          numeric
          style={{ fontSize, lineHeight: fontSize * 1.08, fontWeight: WEIGHTS[size], letterSpacing: -fontSize * 0.035 }}
          adjustsFontSizeToFit
          numberOfLines={1}>
          {value}
        </AppText>
        {unit ? (
          <AppText variant="footnote" color={colors.textSecondary} style={styles.unit}>
            {unit}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

type CountProps = Omit<Props, 'value' | 'unit'> & {
  /** Raw value; animated toward it on change. */
  target: number;
  format: (v: number) => { value: string; unit?: string };
  delay?: number;
};

/** Stat whose number counts up when it appears or changes. */
export function CountStat({ target, format, delay = 0, ...rest }: CountProps) {
  const v = useCountUp(target, 1000, delay);
  const f = format(v);
  return <Stat {...rest} value={f.value} unit={f.unit} />;
}

const styles = StyleSheet.create({
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontWeight: '600',
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  unit: {
    fontWeight: '500',
  },
});
