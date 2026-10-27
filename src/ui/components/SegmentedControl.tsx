import { Pressable, StyleSheet, View } from 'react-native';

import { haptic } from '@/ui/haptics';
import { AppText } from '@/ui/theme/AppText';
import { colors } from '@/ui/theme/tokens';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

/** iOS-style segmented control, neutral greys. */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  return (
    <View style={styles.track} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptic('selection');
              onChange(option.value);
            }}
            style={[styles.segment, selected ? styles.selected : null]}>
            <AppText variant="footnote" color={colors.textPrimary} weight={selected ? '600' : '500'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: 'rgba(118, 118, 128, 0.24)',
    borderRadius: 9,
    padding: 2,
  },
  segment: {
    flex: 1,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  selected: {
    backgroundColor: '#636366',
  },
});
