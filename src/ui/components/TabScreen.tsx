import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { colors, GUTTER } from '@/ui/theme/tokens';

/**
 * Scroll container under a native large-title header. Must be the screen's root
 * scroll view so iOS can collapse the title and handle insets (header + tab bar).
 */
export function TabScreen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.root}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: 8,
    paddingBottom: 48,
    gap: 28,
  },
});
