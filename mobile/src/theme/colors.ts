// "Larder" design system — warm cream (light) and deep brown (dark), with a
// terracotta accent and a sage secondary. Both themes expose the exact same
// keys so components can read `c.<key>` regardless of mode.

export interface ThemeColors {
  bg: string;
  ink: string;
  accent: string;
  accentSoft: string;
  sage: string;
  sageSoft: string;
  gold: string;
  water: string;
  waterSoft: string;
  gray: string;
  grayMid: string;
  grayLight: string;
  grayMuted: string;
  border: string;
  surface: string;
  surfaceAlt: string;
  tabBg: string;
  warning: string;
  warningText: string;
  scrim: string;
  // Semantic states (success = "have it"/done, danger = remove/destructive).
  // Each theme supplies dark-appropriate values so these never stay bright.
  successBg: string;
  successText: string;
  successBorder: string;
  dangerBg: string;
  dangerText: string;
}

export const lightColors: ThemeColors = {
  bg: '#FBF7F1',
  ink: '#241B12',
  accent: '#C7613C',
  accentSoft: '#F7E9E0',
  sage: '#5E7150',
  sageSoft: '#E9EEE2',
  gold: '#D6982F',
  water: '#2F86D6',
  waterSoft: '#E2EFFB',
  gray: '#B6A993',
  grayMid: '#9C8F7C',
  grayLight: '#6F6356',
  grayMuted: '#8A7C68',
  border: '#EEE6D9',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F3EB',
  tabBg: '#F4EEE4',
  warning: '#FEF3C7',
  warningText: '#92400E',
  scrim: 'rgba(27,23,18,0.45)',
  successBg: '#F0FDF4',
  successText: '#16A34A',
  successBorder: '#BBF7D0',
  dangerBg: '#FEE2E2',
  dangerText: '#DC2626',
};

export const darkColors: ThemeColors = {
  bg: '#1A1510',
  ink: '#F2ECE3',
  accent: '#C7613C',
  accentSoft: '#33271F',
  sage: '#9DB488',
  sageSoft: '#20291B',
  gold: '#D6982F',
  water: '#5CA8EA',
  waterSoft: '#20303F',
  gray: '#A89C8A',
  grayMid: '#B0A491',
  grayLight: '#C6BCAD',
  grayMuted: '#A89C8A',
  border: '#37302A',
  surface: '#28221B',
  surfaceAlt: '#322B23',
  tabBg: '#1B1712',
  warning: '#37302A',
  warningText: '#F3D9A8',
  scrim: 'rgba(0,0,0,0.55)',
  successBg: '#1E2A1C',
  successText: '#8FBF7E',
  successBorder: '#2F4029',
  dangerBg: '#3A231F',
  dangerText: '#E8998C',
};

export const lightTints = ['#E9EEE2', '#F7E9E0', '#F3D9A8', '#F8F3EB', '#F4EEE4'];
export const darkTints = ['#20291B', '#33271F', '#28221B', '#322B23', '#2A231C'];

// Backwards-compatible default so any non-component module keeps working.
export const colors = lightColors;
export const tints = lightTints;
