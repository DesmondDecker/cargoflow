/**
 * CargoFlow design tokens. Three-color brand: dark navy (structure/nav/
 * headers), orange (brand actions/highlights), white (content surfaces).
 * Attention-engine colors (urgent/attention/normal) are kept deliberately
 * separate from the brand orange so a status badge is never confused with
 * a primary button.
 */

export const colors = {
  // Brand
  navy: '#0B1F3A', // headers, nav bar, primary text on light surfaces
  navyLight: '#16305A',
  navyDark: '#071527',
  orange: '#F5820D', // primary actions, active states, brand accent
  orangeLight: '#FFA94D',
  orangeDark: '#C4650A',
  white: '#FFFFFF',

  // Neutrals
  background: '#F5F6F8',
  surface: '#FFFFFF',
  border: '#E4E7EC',
  textPrimary: '#101828',
  textSecondary: '#667085',
  textMuted: '#98A2B3',

  // Attention engine (status semantics — distinct from brand orange)
  urgent: '#D92D20',
  urgentBg: '#FEF3F2',
  attention: '#DC6803',
  attentionBg: '#FFFAEB',
  normal: '#12B76A',
  normalBg: '#ECFDF3',

  // Misc semantic
  info: '#175CD3',
  infoBg: '#EFF8FF',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: colors.navy },
  h2: { fontSize: 22, fontWeight: '700' as const, color: colors.navy },
  h3: { fontSize: 18, fontWeight: '600' as const, color: colors.navy },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.textPrimary },
  bodyMedium: { fontSize: 15, fontWeight: '600' as const, color: colors.textPrimary },
  caption: { fontSize: 13, fontWeight: '400' as const, color: colors.textSecondary },
  label: { fontSize: 12, fontWeight: '600' as const, color: colors.textSecondary, letterSpacing: 0.4 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
} as const;

export function attentionColor(level: 'urgent' | 'attention' | 'normal'): { fg: string; bg: string } {
  switch (level) {
    case 'urgent':
      return { fg: colors.urgent, bg: colors.urgentBg };
    case 'attention':
      return { fg: colors.attention, bg: colors.attentionBg };
    default:
      return { fg: colors.normal, bg: colors.normalBg };
  }
}
