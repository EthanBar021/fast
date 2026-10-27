import { Switch } from 'react-native';

import { haptic } from '@/ui/haptics';

/** Native switch with a selection haptic. */
export function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={(next) => {
        onChange(next);
        haptic('selection');
      }}
    />
  );
}
