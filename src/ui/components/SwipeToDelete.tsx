import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { haptic } from '@/ui/haptics';
import { AppText } from '@/ui/theme/AppText';
import { colors, surfaceBackground } from '@/ui/theme/tokens';

/**
 * Lets a row know whether a tap should be ignored because the user was swiping,
 * or because the row is open (a tap then just closes it, as in iOS Mail).
 */
const SwipeContext = createContext<{ consumeTap: () => boolean } | null>(null);

export function useSwipeTapGuard() {
  return useContext(SwipeContext);
}

/** A tap released within this delay after a drag started is part of the swipe. */
const DRAG_GRACE_MS = 450;

type Props = {
  children: ReactNode;
  onDelete: () => void;
  confirmTitle: string;
  confirmMessage?: string;
  label?: string;
};

/** iOS-style swipe from right to left revealing a red "Supprimer" action, with confirmation. */
export function SwipeToDelete({ children, onDelete, confirmTitle, confirmMessage, label = 'Supprimer' }: Props) {
  const ref = useRef<SwipeableMethods>(null);
  const lastDragAt = useRef(0);
  const open = useRef(false);

  const guard = useMemo(
    () => ({
      consumeTap: () => {
        if (open.current) {
          ref.current?.close();
          return true;
        }
        return Date.now() - lastDragAt.current < DRAG_GRACE_MS;
      },
    }),
    [],
  );

  const markDrag = () => {
    lastDragAt.current = Date.now();
  };

  const confirm = () => {
    haptic('impact');
    Alert.alert(confirmTitle, confirmMessage ?? 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel', onPress: () => ref.current?.close() },
      { text: label, style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <SwipeContext.Provider value={guard}>
      <ReanimatedSwipeable
        ref={ref}
        friction={1.6}
        rightThreshold={44}
        overshootRight={false}
        containerStyle={styles.container}
        childrenContainerStyle={surfaceBackground}
        onSwipeableOpenStartDrag={markDrag}
        onSwipeableCloseStartDrag={markDrag}
        onSwipeableWillOpen={() => {
          open.current = true;
          haptic('selection');
        }}
        onSwipeableClose={() => {
          open.current = false;
        }}
        renderRightActions={() => (
          <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={confirm} style={styles.action}>
            <AppText color="#FFFFFF" weight="600">
              {label}
            </AppText>
          </Pressable>
        )}>
        {children}
      </ReanimatedSwipeable>
    </SwipeContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.danger,
  },
  action: {
    width: 104,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
});
