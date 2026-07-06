import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

export type IconName =
  | 'link'
  | 'camera'
  | 'search'
  | 'cart'
  | 'calendar'
  | 'mic'
  | 'bulb'
  | 'heart'
  | 'grid'
  | 'profile'
  | 'plus'
  | 'scan'
  | 'receipt'
  | 'chevron-left'
  | 'chevron-down'
  | 'mail'
  | 'document'
  | 'shield'
  | 'sync'
  | 'instagram'
  | 'tiktok'
  | 'x'
  | 'logo'
  | 'barcode'
  | 'pencil'
  | 'apple';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  fill?: boolean;
}

export function Icon({ name, size = 22, color, fill = false }: Props) {
  const c = useTheme();
  const stroke = color ?? c.ink;
  const s = {
    stroke,
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {render(name, s, stroke, fill)}
    </Svg>
  );
}

function render(name: IconName, s: object, color: string, fill: boolean) {
  switch (name) {
    case 'apple':
      return (
        <Path
          d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.55 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.39-2.85 1.41-2.93-.03-.01-2.71-1.04-2.73-4.13Zm-2.45-7.34c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44Z"
          fill={color}
          stroke="none"
        />
      );
    case 'link':
      return (
        <>
          <Path d="M9 15l6-6" {...s} />
          <Path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1" {...s} />
          <Path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1" {...s} />
        </>
      );
    case 'camera':
      return (
        <>
          <Path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" {...s} />
          <Circle cx={12} cy={13} r={3.5} {...s} />
        </>
      );
    case 'search':
      return (
        <>
          <Circle cx={11} cy={11} r={6} {...s} />
          <Line x1={20} y1={20} x2={15.5} y2={15.5} {...s} />
        </>
      );
    case 'cart':
      return (
        <>
          <Path d="M3 4h2l2.2 11a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 7H6" {...s} />
          <Circle cx={9} cy={20} r={1.4} fill={color} stroke="none" />
          <Circle cx={18} cy={20} r={1.4} fill={color} stroke="none" />
        </>
      );
    case 'calendar':
      return (
        <>
          <Rect x={4} y={5} width={16} height={16} rx={2.5} {...s} />
          <Line x1={4} y1={9.5} x2={20} y2={9.5} {...s} />
          <Line x1={8} y1={3} x2={8} y2={6.5} {...s} />
          <Line x1={16} y1={3} x2={16} y2={6.5} {...s} />
        </>
      );
    case 'mic':
      return (
        <>
          <Rect x={9} y={3} width={6} height={11} rx={3} {...s} />
          <Path d="M6 11a6 6 0 0 0 12 0" {...s} />
          <Line x1={12} y1={17} x2={12} y2={21} {...s} />
          <Line x1={9} y1={21} x2={15} y2={21} {...s} />
        </>
      );
    case 'bulb':
      return (
        <>
          <Path d="M9 17a5.5 5.5 0 1 1 6 0c-.6.5-1 1.2-1 2v.5h-4V19c0-.8-.4-1.5-1-2Z" {...s} />
          <Line x1={10} y1={22} x2={14} y2={22} {...s} />
        </>
      );
    case 'heart':
      return (
        <Path
          d="M12 20.5C12 20.5 3.5 15.5 3.5 9.2C3.5 6.6 5.6 4.5 8.2 4.5C9.8 4.5 11.2 5.4 12 6.7C12.8 5.4 14.2 4.5 15.8 4.5C18.4 4.5 20.5 6.6 20.5 9.2C20.5 15.5 12 20.5 12 20.5Z"
          stroke={color}
          strokeWidth={1.9}
          strokeLinejoin="round"
          fill={fill ? color : 'none'}
        />
      );
    case 'grid':
      return (
        <>
          <Rect x={4} y={4} width={7} height={7} rx={1.5} {...s} />
          <Rect x={13} y={4} width={7} height={7} rx={1.5} {...s} />
          <Rect x={4} y={13} width={7} height={7} rx={1.5} {...s} />
          <Rect x={13} y={13} width={7} height={7} rx={1.5} {...s} />
        </>
      );
    case 'profile':
      return (
        <>
          <Circle cx={12} cy={9} r={3.5} {...s} />
          <Path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" {...s} />
        </>
      );
    case 'plus':
      return (
        <>
          <Line x1={12} y1={5} x2={12} y2={19} {...s} />
          <Line x1={5} y1={12} x2={19} y2={12} {...s} />
        </>
      );
    case 'scan':
      return (
        <>
          <Path d="M4 8V6a2 2 0 0 1 2-2h2" {...s} />
          <Path d="M16 4h2a2 2 0 0 1 2 2v2" {...s} />
          <Path d="M20 16v2a2 2 0 0 1-2 2h-2" {...s} />
          <Path d="M8 20H6a2 2 0 0 1-2-2v-2" {...s} />
          <Circle cx={12} cy={12} r={3} {...s} />
        </>
      );
    case 'receipt':
      return (
        <>
          <Path d="M5 3.5h14v17l-2.3-1.4-2.4 1.4-2.3-1.4-2.4 1.4-2.3-1.4L5 20.5V3.5Z" {...s} />
          <Line x1={8.5} y1={8} x2={15.5} y2={8} {...s} />
          <Line x1={8.5} y1={11.5} x2={15.5} y2={11.5} {...s} />
          <Line x1={8.5} y1={15} x2={13} y2={15} {...s} />
        </>
      );
    case 'chevron-left':
      return <Polyline points="15 5 8 12 15 19" {...s} />;
    case 'chevron-down':
      return <Polyline points="6 9 12 15 18 9" {...s} />;
    case 'mail':
      return (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={2.5} {...s} />
          <Polyline points="4 7 12 13 20 7" {...s} />
        </>
      );
    case 'document':
      return (
        <>
          <Path d="M7 3h7l4 4v14H7V3Z" {...s} />
          <Polyline points="14 3 14 7 18 7" {...s} />
          <Line x1={9.5} y1={12} x2={15} y2={12} {...s} />
          <Line x1={9.5} y1={15.5} x2={15} y2={15.5} {...s} />
        </>
      );
    case 'shield':
      return (
        <>
          <Path d="M12 3l7 3v5c0 4.2-2.9 7.4-7 8.5-4.1-1.1-7-4.3-7-8.5V6l7-3Z" {...s} />
          <Polyline points="9 12 11 14 15 10" {...s} />
        </>
      );
    case 'sync':
      return (
        <>
          <Path d="M4 12 a8 8 0 0 1 13.5 -5.8 L20 8" {...s} />
          <Polyline points="20 4 20 8 16 8" {...s} />
          <Path d="M20 12 a8 8 0 0 1 -13.5 5.8 L4 16" {...s} />
          <Polyline points="4 20 4 16 8 16" {...s} />
        </>
      );
    case 'instagram':
      return (
        <>
          <Rect x={4} y={4} width={16} height={16} rx={5} {...s} />
          <Circle cx={12} cy={12} r={3.5} {...s} />
          <Circle cx={16.5} cy={7.5} r={1.3} fill={color} />
        </>
      );
    case 'tiktok':
      return (
        <>
          <Path d="M14 4 v9.5 a3.5 3.5 0 1 1 -3.5 -3.5" {...s} />
          <Path d="M14 4 c.5 2.3 2 3.8 4.5 4" {...s} />
        </>
      );
    case 'x':
      return (
        <>
          <Line x1={5} y1={5} x2={19} y2={19} {...s} />
          <Line x1={19} y1={5} x2={5} y2={19} {...s} />
        </>
      );
    case 'barcode':
      return (
        <>
          <Line x1={4} y1={6} x2={4} y2={18} {...s} />
          <Line x1={7.5} y1={6} x2={7.5} y2={18} {...s} />
          <Line x1={11} y1={6} x2={11} y2={18} {...s} />
          <Line x1={14} y1={6} x2={14} y2={18} {...s} />
          <Line x1={17.5} y1={6} x2={17.5} y2={18} {...s} />
          <Line x1={20} y1={6} x2={20} y2={18} {...s} />
        </>
      );
    case 'pencil':
      return (
        <>
          <Path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" {...s} />
        </>
      );
    case 'logo':
      return (
        <>
          {/* bowl — half circle opening up */}
          <Path d="M3.5 12.5 H20.5 A8.5 8.5 0 0 1 3.5 12.5 Z" {...s} />
          {/* whisk balloon (teardrop) */}
          <Path d="M11 12.3 C8.4 9.8 8.4 5 11 2.6" {...s} />
          <Path d="M11 12.3 C13.6 9.8 13.6 5 11 2.6" {...s} />
          <Line x1={11} y1={12.3} x2={11} y2={2.6} {...s} />
          {/* handle */}
          <Line x1={11} y1={2.6} x2={14.8} y2={0.9} {...s} />
        </>
      );
    default:
      return null;
  }
}
