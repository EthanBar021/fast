import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { haptic } from '@/ui/haptics';
import { useSwipeTapGuard } from '@/ui/components/SwipeToDelete';
import { AppText } from '@/ui/theme/AppText';
import { colors, radii } from '@/ui/theme/tokens';

type GroupProps = {
  header?: string;
  footer?: string;
  children: ReactNode;
};

/** Inset grouped list section, as in the iOS Settings app. */
export function ListGroup({ header, footer, children }: GroupProps) {
  const rows = Children.toArray(children);
  return (
    <View>
      {header ? (
        <AppText variant="footnote" style={styles.header}>
          {header}
        </AppText>
      ) : null}
      <View style={styles.group}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View style={styles.separator} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <AppText variant="footnote" style={styles.footer}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

type RowProps = {
  label: string;
  icon?: SFSymbol;
  /** Secondary text under the label. */
  detail?: string;
  /** Value shown on the right. */
  value?: string;
  /** Right-side control (Switch…), replaces `value`. */
  accessory?: ReactNode;
  /** Full-width control under the label (segmented control…). */
  below?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
};

export function ListRow({ label, icon, detail, value, accessory, below, onPress, chevron, destructive }: RowProps) {
  const swipe = useSwipeTapGuard();
  const content = (
    <>
      <View style={styles.main}>
        {icon ? (
          <SymbolView name={icon} tintColor={colors.textSecondary} size={18} style={styles.icon} />
        ) : null}
        <View style={styles.text}>
          <AppText color={destructive ? colors.danger : undefined}>{label}</AppText>
          {detail ? <AppText variant="footnote">{detail}</AppText> : null}
        </View>
        {accessory ??
          (value ? (
            <AppText variant="body" color={colors.textSecondary} numeric>
              {value}
            </AppText>
          ) : null)}
        {chevron ? <SymbolView name="chevron.right" tintColor={colors.textTertiary} size={13} weight="semibold" /> : null}
      </View>
      {below ? <View style={styles.below}>{below}</View> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      // Inside a swipeable row, wait a bit before highlighting so a swipe does not flash.
      unstable_pressDelay={swipe ? 90 : undefined}
      onPress={() => {
        if (swipe?.consumeTap()) return;
        haptic('selection');
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}>
      {content}
    </Pressable>
  );
}

const ICON_SLOT = 28;

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 7,
  },
  footer: {
    color: colors.textTertiary,
    paddingHorizontal: 16,
    paddingTop: 7,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginLeft: 16,
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 13,
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: colors.surfaceHigh,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: ICON_SLOT,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  below: {
    marginTop: 12,
  },
});
