import { SymbolView, type SFSymbol } from 'expo-symbols';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/ui/theme/AppText';
import { colors, radii } from '@/ui/theme/tokens';

import { PressableScale } from './PressableScale';

type Props = {
  label: string;
  onPress: () => void;
  icon?: SFSymbol;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Main call to action: plain white pill, black label. One per screen. */
export function PrimaryButton({ label, onPress, icon, disabled, style }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      feedback="impact"
      accessibilityLabel={label}
      style={[styles.button, style]}>
      <AppText color={colors.inverse} weight="600">
        {label}
      </AppText>
      {icon ? <SymbolView name={icon} tintColor={colors.inverse} size={15} weight="semibold" /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: radii.pill,
    backgroundColor: colors.textPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
