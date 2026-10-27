import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors } from './tokens';

export type TextVariant = 'display' | 'largeTitle' | 'title' | 'body' | 'subhead' | 'footnote' | 'caption';

type Props = TextProps & {
  variant?: TextVariant;
  color?: string;
  /** Fixed-width digits so live numbers do not jitter. */
  numeric?: boolean;
  weight?: '400' | '500' | '600' | '700';
};

/** System font (SF Pro on iOS), sizes close to the iOS Dynamic Type defaults. */
export function AppText({ variant = 'body', color, numeric, weight, style, ...rest }: Props) {
  return (
    <Text
      style={[
        styles[variant],
        color ? { color } : null,
        weight ? { fontWeight: weight } : null,
        numeric ? styles.numeric : null,
        style,
      ]}
      maxFontSizeMultiplier={variant === 'display' ? 1.15 : 1.5}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  display: {
    color: colors.textPrimary,
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '700',
    letterSpacing: -2.4,
  },
  largeTitle: {
    color: colors.textPrimary,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  body: {
    color: colors.textPrimary,
    fontSize: 17,
    lineHeight: 22,
  },
  subhead: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 20,
  },
  footnote: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 16,
  },
  numeric: {
    fontVariant: ['tabular-nums'],
  },
});
