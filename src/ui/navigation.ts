import { Platform } from 'react-native';

import { colors } from './theme/tokens';

/** iOS 26+ renders transparent bars with its own scroll-edge effect (Liquid Glass). */
const IOS_26 = Platform.OS === 'ios' && parseFloat(String(Platform.Version)) >= 26;

/**
 * Native stack header with an iOS large title that collapses on scroll.
 * Fully native (UINavigationBar), so the animation is driven by iOS, not JS.
 */
export const largeTitleOptions = {
  headerShown: true,
  headerLargeTitle: true,
  headerTransparent: true,
  headerBlurEffect: IOS_26 ? undefined : ('systemChromeMaterialDark' as const),
  headerShadowVisible: false,
  headerLargeTitleShadowVisible: false,
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { color: colors.textPrimary },
  headerLargeTitleStyle: { color: colors.textPrimary },
  headerBackButtonDisplayMode: 'minimal' as const,
  contentStyle: { backgroundColor: colors.background },
};

/** Same bar for pushed detail screens, with a small title. */
export const detailOptions = { ...largeTitleOptions, headerLargeTitle: false };
