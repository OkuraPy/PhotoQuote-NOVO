// PhotoQuote v2 — design tokens (Emerald & Gold). Ported from the Claude Design handoff (styles/tokens.css).
import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  // surfaces
  bg: '#F7F8FA',
  bgWarm: '#F4F6F5',
  card: '#FFFFFF',
  card2: '#FBFCFD',
  border: '#E6E9EE',
  borderStrong: '#D7DCE3',

  // ink
  ink: '#0C1116',
  ink2: '#2A3340',
  muted: '#5B6573',
  faint: '#8A93A3',

  // brand
  primary: '#11705A',
  primary700: '#0B5544',
  primary600: '#0F6650',
  primaryTint: '#E5EFEA',
  primaryTint2: '#D6E7DF',
  onPrimary: '#FFFFFF',

  // accent (gold — sparingly)
  accent: '#C8A24B',
  accentInk: '#8A6A1F',
  accentTint: '#F6EFD9',
  accentBorder: '#EADCB4',

  // semantic
  success: '#1E9E6A',
  successTint: '#E2F3EB',
  warning: '#D9912B',
  warningTint: '#FAEFD7',
  error: '#D24B4B',
  errorTint: '#FBE7E7',
  info: '#2F6FED',
  infoTint: '#E6EEFD',

  chipBg: '#EEF1F4',
} as const;

// stage color + tint, keyed by the canonical stage label
export type Stage = 'Draft' | 'Quoted' | 'Sent' | 'Approved' | 'Invoiced' | 'Paid';
export const stageColors: Record<Stage, { c: string; t: string }> = {
  Draft: { c: '#8A93A3', t: '#EEF0F3' },
  Quoted: { c: '#2F6FED', t: '#E6EEFD' },
  Sent: { c: '#5B53D6', t: '#EAE8FB' },
  Approved: { c: '#0E9E8E', t: '#DEF4F1' },
  Invoiced: { c: '#D9912B', t: '#FAEFD7' },
  Paid: { c: '#1E9E6A', t: '#E2F3EB' },
};

export const radii = { sm: 10, r: 14, lg: 18, xl: 24, pill: 999 } as const;

// font family names exported by @expo-google-fonts/* (loaded in App entry)
export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  // numbers (tabular) — Space Grotesk
  num: 'SpaceGrotesk_500Medium',
  numSemibold: 'SpaceGrotesk_600SemiBold',
} as const;

// RN shadows (iOS shadow* + Android elevation), mirroring tokens.css --sh-*
export const shadow: Record<'sm' | 'card' | 'lg' | 'btn' | 'up', ViewStyle> = {
  sm: { shadowColor: '#0C1116', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  card: { shadowColor: '#0C1116', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  lg: { shadowColor: '#0C1116', shadowOpacity: 0.16, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  btn: { shadowColor: '#11705A', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  up: { shadowColor: '#0C1116', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: -10 }, elevation: 12 },
};

// common text helpers
export const text = {
  title: { fontFamily: fonts.extrabold, color: colors.ink, letterSpacing: -0.5 } as TextStyle,
  body: { fontFamily: fonts.semibold, color: colors.ink } as TextStyle,
  muted: { fontFamily: fonts.semibold, color: colors.muted } as TextStyle,
  num: { fontFamily: fonts.num, color: colors.ink } as TextStyle,
};
