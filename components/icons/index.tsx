import type { ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Stop as GradientStop,
} from "react-native-svg";

import { COLORS } from "../../constants/theme";

// Iconsax icons, lifted directly from the stembits Figma file so they match
// what the designer placed rather than approximating with a generic icon font.
//
// Generated, but committed as source and safe to hand-edit. Each icon defaults
// to the size Figma drew it at; pass `size` to override. Colour is a single
// prop because every icon in the set is monochrome line art.
export type IconProps = {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/** Shape of every icon below -- use this when an icon is passed as data. */
export type IconComponent = ComponentType<IconProps>;

const DEFAULT_COLOR = COLORS.text;

export function ArrowRight({ size = 20, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <G>
        <Path d="M7.425 16.6L12.8583 11.1667C13.5 10.525 13.5 9.475 12.8583 8.83333L7.425 3.4" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function ArrowLeft({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <G>
        <Path d="M15 19.92L8.48 13.4C7.71 12.63 7.71 11.37 8.48 10.6L15 4.08" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function Bluetooth({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <G>
        <Path d="M4.7002 15.5332L14.9918 6.0999C15.4168 5.70824 15.4085 5.08323 14.9585 4.70823L11.7502 2.03323C10.9169 1.34157 10.2335 1.65824 10.2335 2.74157V17.2582C10.2335 18.3416 10.9169 18.6582 11.7502 17.9666L14.9585 15.2916C15.4085 14.9166 15.4168 14.2916 14.9918 13.8999L4.7002 4.46655" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function USBDevice({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <G>
        <Path d="M8.33317 14.1251H5.17484C2.3665 14.1251 1.6665 13.4251 1.6665 10.6167V5.61673C1.6665 2.8084 2.3665 2.1084 5.17484 2.1084H13.9498C16.7582 2.1084 17.4582 2.8084 17.4582 5.61673" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M8.3335 17.8917V14.125" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M1.6665 10.7917H8.33317" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M5.6167 17.8916H8.33337" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M18.3336 10.6666V15.425C18.3336 17.4 17.8419 17.8916 15.8669 17.8916H12.9086C10.9336 17.8916 10.4419 17.4 10.4419 15.425V10.6666C10.4419 8.69162 10.9336 8.19995 12.9086 8.19995H15.8669C17.8419 8.19995 18.3336 8.69162 18.3336 10.6666Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M14.3706 15.2084H14.3781" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function Metromone({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <G>
        <Path d="M15.8914 4.1249C19.1998 7.43324 19.1414 12.8332 15.7248 16.0749C12.5664 19.0665 7.44143 19.0665 4.27477 16.0749C0.849765 12.8332 0.791422 7.43324 4.10809 4.1249C7.35809 0.866569 12.6414 0.866569 15.8914 4.1249Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M13.1998 13.3916C11.4331 15.0583 8.56644 15.0583 6.80811 13.3916" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function Pad({ size = 20, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <G>
        <Path d="M10.8749 16.1833C10.4249 16.1833 9.94991 16.1417 9.43324 16.0583L5.52491 15.4417C4.29157 15.25 3.34157 14.9083 2.63324 14.4083C0.808241 13.1417 0.916575 10.9667 1.14991 9.44167L1.76657 5.53333C2.33324 1.95 4.18324 0.608335 7.76657 1.16667L11.6749 1.78334C13.5166 2.075 15.9916 2.81667 16.1499 5.925C16.1832 6.45834 16.1499 7.06667 16.0332 7.78334L15.4249 11.6917C14.9416 14.75 13.5166 16.1833 10.8749 16.1833ZM6.27491 2.29167C4.29157 2.29167 3.39157 3.3 2.99991 5.73334L2.38324 9.64167C1.99991 12.1 2.69991 12.9333 3.34991 13.3917C3.89991 13.7833 4.67491 14.05 5.71657 14.2083L9.62491 14.825C12.5332 15.2833 13.7332 14.4083 14.1916 11.4917L14.7999 7.58334C14.8999 6.95834 14.9332 6.43334 14.8999 5.99167V5.98333C14.8082 4.23334 13.8166 3.375 11.4749 3.00834L7.57491 2.4C7.09157 2.325 6.66657 2.29167 6.27491 2.29167Z" fill={color} />
        <Path d="M12.2335 18.9585C11.5252 18.9585 10.7252 18.8085 9.80021 18.5001L6.04188 17.2501C3.90021 16.5418 2.74188 15.5251 2.39188 14.0418C2.33354 13.7918 2.43354 13.5251 2.65021 13.3835C2.86688 13.2418 3.15021 13.2418 3.35854 13.3918C3.90854 13.7835 4.67521 14.0501 5.71688 14.2085L9.62521 14.8251C12.5335 15.2835 13.7335 14.4085 14.1919 11.4918L14.8002 7.58345C14.9002 6.95845 14.9335 6.43345 14.9002 5.99179C14.8919 5.77512 15.0002 5.55845 15.1919 5.43345C15.3835 5.30845 15.6252 5.30012 15.8252 5.40845C18.0585 6.60012 18.6502 8.50845 17.6835 11.4251L16.4335 15.1835C15.8419 16.9501 15.0669 18.0335 13.9835 18.5751C13.4585 18.8335 12.8835 18.9585 12.2335 18.9585ZM4.77521 15.3001C5.17521 15.5668 5.70854 15.8251 6.43354 16.0668L10.1919 17.3168C11.6252 17.7918 12.6502 17.8335 13.4169 17.4585C14.1835 17.0751 14.7669 16.2251 15.2419 14.7918L16.4919 11.0335C17.1752 8.96679 16.9085 7.86679 16.1169 7.12512C16.1002 7.33345 16.0669 7.55012 16.0335 7.78345L15.4252 11.6918C14.8585 15.2751 13.0085 16.6168 9.42521 16.0668L5.51688 15.4501C5.25854 15.4001 5.00854 15.3501 4.77521 15.3001Z" fill={color} />
        <Path d="M6.8665 8.09995C5.72484 8.09995 4.7915 7.16662 4.7915 6.02495C4.7915 4.88328 5.72484 3.94995 6.8665 3.94995C8.00817 3.94995 8.9415 4.88328 8.9415 6.02495C8.9415 7.16662 8.00817 8.09995 6.8665 8.09995ZM6.8665 5.20828C6.4165 5.20828 6.0415 5.57495 6.0415 6.03328C6.0415 6.49162 6.40817 6.85828 6.8665 6.85828C7.3165 6.85828 7.6915 6.49162 7.6915 6.03328C7.6915 5.57495 7.3165 5.20828 6.8665 5.20828Z" fill={color} />
      </G>
    </Svg>
  );
}

export function Loop({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <G>
        <Path d="M9.1 12V10.52C9.1 8.61 10.45 7.84 12.1 8.79L13.38 9.53L14.66 10.27C16.31 11.22 16.31 12.78 14.66 13.73L13.38 14.47L12.1 15.21C10.45 16.16 9.1 15.38 9.1 13.48V12Z" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function PhoneVibration({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <G>
        {/* Phone body */}
        <Path
          d="M10 3H14C15.1046 3 16 3.89543 16 5V19C16 20.1046 15.1046 21 14 21H10C8.89543 21 8 20.1046 8 19V5C8 3.89543 8.89543 3 10 3Z"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Home indicator */}
        <Path d="M11 18H13" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        {/* Vibration waves - left */}
        <Path d="M5 8.5C4.2 9.9 4.2 14.1 5 15.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        <Path d="M2.5 6C1 9 1 15 2.5 18" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        {/* Vibration waves - right */}
        <Path d="M19 8.5C19.8 9.9 19.8 14.1 19 15.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
        <Path d="M21.5 6C23 9 23 15 21.5 18" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </G>
    </Svg>
  );
}

export function ShieldSecurity({ size = 20, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <G>
        <Path d="M8.74167 1.85833L4.58333 3.425C3.625 3.78333 2.84167 4.91667 2.84167 5.93333V12.125C2.84167 13.1083 3.49167 14.4 4.28333 14.9917L7.86667 17.6667C9.04167 18.55 10.975 18.55 12.15 17.6667L15.7333 14.9917C16.525 14.4 17.175 13.1083 17.175 12.125V5.93333C17.175 4.90833 16.3917 3.775 15.4333 3.41667L11.275 1.85833C10.5667 1.6 9.43333 1.6 8.74167 1.85833Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M10 10.4167C10.9205 10.4167 11.6667 9.67047 11.6667 8.75C11.6667 7.82953 10.9205 7.08333 10 7.08333C9.07952 7.08333 8.33333 7.82953 8.33333 8.75C8.33333 9.67047 9.07952 10.4167 10 10.4167Z" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M10 10.4167V12.9167" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function DocumentText({ size = 20, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <G>
        <Path d="M17.5 5.83333V14.1667C17.5 16.6667 16.25 18.3333 13.3333 18.3333H6.66667C3.75 18.3333 2.5 16.6667 2.5 14.1667V5.83333C2.5 3.33333 3.75 1.66667 6.66667 1.66667H13.3333C16.25 1.66667 17.5 3.33333 17.5 5.83333Z" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12.0833 3.75V5.41667C12.0833 6.33333 12.8333 7.08333 13.75 7.08333H15.4167" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M6.66667 10.8333H10" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M6.66667 14.1667H13.3333" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function Information({ size = 20, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <G>
        <Path d="M8.95833 2.04167C9.54167 1.55 10.4833 1.55 11.05 2.04167L12.3667 3.16667C12.6167 3.375 13.0917 3.55 13.425 3.55H14.8417C15.725 3.55 16.45 4.275 16.45 5.15833V6.575C16.45 6.90833 16.625 7.375 16.8333 7.625L17.9583 8.94167C18.45 9.525 18.45 10.4667 17.9583 11.0333L16.8333 12.35C16.625 12.6 16.45 13.0667 16.45 13.4V14.8167C16.45 15.7 15.725 16.425 14.8417 16.425H13.425C13.0917 16.425 12.625 16.6 12.375 16.8083L11.0583 17.9333C10.475 18.425 9.53333 18.425 8.96667 17.9333L7.65 16.8083C7.4 16.6 6.925 16.425 6.6 16.425H5.14167C4.25833 16.425 3.53333 15.7 3.53333 14.8167V13.3917C3.53333 13.0667 3.36667 12.5917 3.15833 12.35L2.03333 11.025C1.55 10.45 1.55 9.51667 2.03333 8.94167L3.15833 7.61667C3.36667 7.36667 3.53333 6.9 3.53333 6.575V5.16667C3.53333 4.28333 4.25833 3.55833 5.14167 3.55833H6.58333C6.91667 3.55833 7.38333 3.38333 7.63333 3.175L8.95833 2.04167Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M10 6.775V10.8" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9.99542 13.3333H10.0029" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function Flash({ size = 20, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <G>
        <Path d="M5.075 11.0667H7.65V17.0667C7.65 18.4667 8.40833 18.75 9.33333 17.7L15.6417 10.5333C16.4167 9.65833 16.0917 8.93333 14.9167 8.93333H12.3417V2.93333C12.3417 1.53333 11.5833 1.25 10.6583 2.3L4.35 9.46667C3.58333 10.35 3.90833 11.0667 5.075 11.0667Z" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function NotificationBing({ size = 20, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <G>
        <Path d="M10 5.36667V8.14167" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" />
        <Path d="M10.0167 1.66667C6.95 1.66667 4.46667 4.15 4.46667 7.21667V8.96667C4.46667 9.53333 4.23333 10.3833 3.94167 10.8667L2.88333 12.6333C2.23333 13.725 2.68333 14.9417 3.88333 15.3417C7.86667 16.6667 12.175 16.6667 16.1583 15.3417C17.2833 14.9667 17.7667 13.65 17.1583 12.6333L16.1 10.8667C15.8083 10.3833 15.575 9.525 15.575 8.96667V7.21667C15.5667 4.16667 13.0667 1.66667 10.0167 1.66667Z" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" />
        <Path d="M12.775 15.6833C12.775 17.2083 11.525 18.4583 10 18.4583C9.24167 18.4583 8.54167 18.1417 8.04167 17.6417C7.54167 17.1417 7.225 16.4417 7.225 15.6833" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} />
        <Path opacity={0} d="M19.5 0.5V19.5H0.5V0.5H19.5Z" stroke={color} />
      </G>
    </Svg>
  );
}

export function VolumeHigh({ size = 20, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <G>
        <Path d="M1.66667 8.33333V11.6667C1.66667 13.3333 2.5 14.1667 4.16667 14.1667H5.35833C5.66667 14.1667 5.975 14.2583 6.24167 14.4167L8.675 15.9417C10.775 17.2583 12.5 16.3 12.5 13.825V6.175C12.5 3.69167 10.775 2.74167 8.675 4.05833L6.24167 5.58333C5.975 5.74167 5.66667 5.83333 5.35833 5.83333H4.16667C2.5 5.83333 1.66667 6.66667 1.66667 8.33333Z" stroke={color} strokeWidth={1.5} />
        <Path d="M15 6.66667C16.4833 8.64167 16.4833 11.3583 15 13.3333" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M16.525 4.58333C18.9333 7.79167 18.9333 12.2083 16.525 15.4167" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function ProfileCircle({ size = 20, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <G>
        <Path d="M10.1 10.65C10.0417 10.6417 9.96667 10.6417 9.9 10.65C8.43333 10.6 7.26667 9.4 7.26667 7.925C7.26667 6.41667 8.48333 5.19167 10 5.19167C11.5083 5.19167 12.7333 6.41667 12.7333 7.925C12.725 9.4 11.5667 10.6 10.1 10.65Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M15.6167 16.15C14.1333 17.5083 12.1667 18.3333 10 18.3333C7.83333 18.3333 5.86667 17.5083 4.38333 16.15C4.46667 15.3667 4.96667 14.6 5.85833 14C8.14167 12.4833 11.875 12.4833 14.1417 14C15.0333 14.6 15.5333 15.3667 15.6167 16.15Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 10C18.3333 5.39763 14.6024 1.66667 10 1.66667C5.39763 1.66667 1.66667 5.39763 1.66667 10C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function AddCircle({ size = 36, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none" style={style}>
      <G>
        <Path d="M18 3C9.735 3 3 9.735 3 18C3 26.265 9.735 33 18 33C26.265 33 33 26.265 33 18C33 9.735 26.265 3 18 3ZM24 19.125H19.125V24C19.125 24.615 18.615 25.125 18 25.125C17.385 25.125 16.875 24.615 16.875 24V19.125H12C11.385 19.125 10.875 18.615 10.875 18C10.875 17.385 11.385 16.875 12 16.875H16.875V12C16.875 11.385 17.385 10.875 18 10.875C18.615 10.875 19.125 11.385 19.125 12V16.875H24C24.615 16.875 25.125 17.385 25.125 18C25.125 18.615 24.615 19.125 24 19.125Z" fill={color} />
      </G>
    </Svg>
  );
}

export function MinusCircle({ size = 36, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none" style={style}>
      <G>
        <Path d="M18 3C9.735 3 3 9.735 3 18C3 26.265 9.735 33 18 33C26.265 33 33 26.265 33 18C33 9.735 26.265 3 18 3ZM23.88 19.125H11.88C11.265 19.125 10.755 18.615 10.755 18C10.755 17.385 11.265 16.875 11.88 16.875H23.88C24.495 16.875 25.005 17.385 25.005 18C25.005 18.615 24.51 19.125 23.88 19.125Z" fill={color} />
      </G>
    </Svg>
  );
}

// The only icon in the set that isn't flat: Figma fills both halves with the
// brand gradient, so `color` is ignored here. Hand-written rather than
// generated -- the generator flattens <defs>, which would leave the fills
// pointing at gradients that no longer exist.
export function Stop({ size = 80, style }: Pick<IconProps, "size" | "style">) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80" fill="none" style={style}>
      <Defs>
        <LinearGradient
          id="stopTop"
          x1={10}
          y1={34.0429}
          x2={69.4859}
          y2={34.0429}
          gradientUnits="userSpaceOnUse"
        >
          <GradientStop stopColor={COLORS.brandFrom} />
          <GradientStop offset={1} stopColor={COLORS.brandTo} />
        </LinearGradient>
        <LinearGradient
          id="stopBottom"
          x1={16.6946}
          y1={51.8099}
          x2={70}
          y2={51.8099}
          gradientUnits="userSpaceOnUse"
        >
          <GradientStop stopColor={COLORS.brandFrom} />
          <GradientStop offset={1} stopColor={COLORS.brandTo} />
        </LinearGradient>
      </Defs>
      <Path d="M67.8667 25.9333L15.1333 57.6C13.1 58.8333 10.3667 57.6 10.1 55.2333C10.0333 54.6 10 53.9667 10 53.3333V26.6667C10 16.6667 16.6667 10 26.6667 10H53.3333C63.3333 10 67.4333 15.1333 69.3667 22.1667C69.7667 23.6333 69.1333 25.1667 67.8667 25.9333Z" fill="url(#stopTop)" />
      <Path d="M70 36.9667V53.3333C70 63.3333 63.3333 70 53.3333 70H26.6667C23.6 70 20.7 69.1667 18.2333 67.7C16.1 66.4667 16.2333 63.3333 18.3333 62.0667L64.9333 34.1C67.1667 32.7667 70 34.3667 70 36.9667Z" fill="url(#stopBottom)" />
    </Svg>
  );
}

// vuesax/bold/play -- the "not playing" sibling of Stop above. Same reasoning:
// hand-written so the two brand-gradient fills survive instead of being
// flattened by the generator.
export function PlayFilled({ size = 80, style }: Pick<IconProps, "size" | "style">) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80" fill="none" style={style}>
      <Defs>
        <LinearGradient
          id="playTop"
          x1={13.3333}
          y1={33.7506}
          x2={60.0084}
          y2={33.7506}
          gradientUnits="userSpaceOnUse"
        >
          <GradientStop stopColor={COLORS.brandFrom} />
          <GradientStop offset={1} stopColor={COLORS.brandTo} />
        </LinearGradient>
        <LinearGradient
          id="playBottom"
          x1={17.7383}
          y1={52.0127}
          x2={66.942}
          y2={52.0127}
          gradientUnits="userSpaceOnUse"
        >
          <GradientStop stopColor={COLORS.brandFrom} />
          <GradientStop offset={1} stopColor={COLORS.brandTo} />
        </LinearGradient>
      </Defs>
      <Path d="M58.3 32L18.6667 55.9C16.3333 57.3 13.3333 55.6333 13.3333 52.9V26.2333C13.3333 14.6 25.9 7.33333 36 13.1333L51.3 21.9333L58.2667 25.9333C60.5667 27.3 60.6 30.6333 58.3 32Z" fill="url(#playTop)" />
      <Path d="M60.3 51.5333L46.8 59.3333L33.3333 67.1C28.5 69.8666 23.0333 69.3 19.0667 66.5C17.1333 65.1666 17.3667 62.2 19.4 61L61.7667 35.6C63.7667 34.4 66.4 35.5333 66.7667 37.8333C67.6 43 65.4667 48.5666 60.3 51.5333Z" fill="url(#playBottom)" />
    </Svg>
  );
}

export function Setting4({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <G>
        <Path d="M22 6.5H16" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M6 6.5H2" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M10 10C11.933 10 13.5 8.433 13.5 6.5C13.5 4.567 11.933 3 10 3C8.067 3 6.5 4.567 6.5 6.5C6.5 8.433 8.067 10 10 10Z" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M22 17.5H18" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M8 17.5H2" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M14 21C15.933 21 17.5 19.433 17.5 17.5C17.5 15.567 15.933 14 14 14C12.067 14 10.5 15.567 10.5 17.5C10.5 19.433 12.067 21 14 21Z" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function VideoCircle({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <G>
        <Path d="M9.1 12V10.52C9.1 8.61 10.45 7.84 12.1 8.79L13.38 9.53L14.66 10.27C16.31 11.22 16.31 12.78 14.66 13.73L13.38 14.47L12.1 15.21C10.45 16.16 9.1 15.38 9.1 13.48V12Z" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export function Clipboard({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <G>
        <Path d="M13.05 19.42C12.51 19.42 11.94 19.37 11.32 19.27L6.63 18.53C5.15 18.3 4.01 17.89 3.16 17.29C0.97 15.77 1.1 13.16 1.38 11.33L2.12 6.64C2.8 2.34 5.02 0.73 9.32 1.4L14.01 2.14C16.22 2.49 19.19 3.38 19.38 7.11C19.42 7.75 19.38 8.48 19.24 9.34L18.51 14.03C17.93 17.7 16.22 19.42 13.05 19.42ZM7.53 2.75C5.15 2.75 4.07 3.96 3.6 6.88L2.86 11.57C2.4 14.52 3.24 15.52 4.02 16.07C4.68 16.54 5.61 16.86 6.86 17.05L11.55 17.79C15.04 18.34 16.48 17.29 17.03 13.79L17.76 9.1C17.88 8.35 17.92 7.72 17.88 7.19V7.18C17.77 5.08 16.58 4.05 13.77 3.61L9.09 2.88C8.51 2.79 8 2.75 7.53 2.75Z" fill={color} />
        <Path d="M14.68 22.75C13.83 22.75 12.87 22.57 11.76 22.2L7.25 20.7C4.68 19.85 3.29 18.63 2.87 16.85C2.8 16.55 2.92 16.23 3.18 16.06C3.44 15.89 3.78 15.89 4.03 16.07C4.69 16.54 5.61 16.86 6.86 17.05L11.55 17.79C15.04 18.34 16.48 17.29 17.03 13.79L17.76 9.1C17.88 8.35 17.92 7.72 17.88 7.19C17.87 6.93 18 6.67 18.23 6.52C18.46 6.37 18.75 6.36 18.99 6.49C21.67 7.92 22.38 10.21 21.22 13.71L19.72 18.22C19.01 20.34 18.08 21.64 16.78 22.29C16.15 22.6 15.46 22.75 14.68 22.75ZM5.73 18.36C6.21 18.68 6.85 18.99 7.72 19.28L12.23 20.78C13.95 21.35 15.18 21.4 16.1 20.95C17.02 20.49 17.72 19.47 18.29 17.75L19.79 13.24C20.61 10.76 20.29 9.44 19.34 8.55C19.32 8.8 19.28 9.06 19.24 9.34L18.51 14.03C17.83 18.33 15.61 19.94 11.31 19.28L6.62 18.54C6.31 18.48 6.01 18.42 5.73 18.36Z" fill={color} />
        <Path d="M8.24 9.72C6.87 9.72 5.75 8.6 5.75 7.23C5.75 5.86 6.87 4.74 8.24 4.74C9.61 4.74 10.73 5.86 10.73 7.23C10.73 8.6 9.61 9.72 8.24 9.72ZM8.24 6.25C7.7 6.25 7.25 6.69 7.25 7.24C7.25 7.79 7.69 8.23 8.24 8.23C8.78 8.23 9.23 7.79 9.23 7.24C9.23 6.69 8.78 6.25 8.24 6.25Z" fill={color} />
      </G>
    </Svg>
  );
}

export function Grammerly({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <G>
        <Path d="M19.11 4.96C15.2 1.05 8.85 1.05 4.94 4.96C0.96 8.94 1.03 15.43 5.14 19.33C8.94 22.92 15.1 22.92 18.9 19.33C23.02 15.43 23.09 8.94 19.11 4.96ZM16.38 16.65C15.18 17.79 13.6 18.36 12.02 18.36C10.44 18.36 8.86 17.79 7.66 16.65C7.36 16.36 7.35 15.89 7.63 15.59C7.92 15.29 8.39 15.28 8.69 15.56C10.52 17.29 13.51 17.3 15.35 15.56C15.65 15.28 16.13 15.29 16.41 15.59C16.7 15.89 16.68 16.36 16.38 16.65Z" fill={color} />
      </G>
    </Svg>
  );
}


export function Eye({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M15.58 12c0 1.98-1.6 3.58-3.58 3.58S8.42 13.98 8.42 12s1.6-3.58 3.58-3.58 3.58 1.6 3.58 3.58Z" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 20.27c3.53 0 6.82-2.08 9.11-5.68.9-1.41.9-3.78 0-5.19-2.29-3.6-5.58-5.68-9.11-5.68-3.53 0-6.82 2.08-9.11 5.68-.9 1.41-.9 3.78 0 5.19 2.29 3.6 5.58 5.68 9.11 5.68Z" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function EyeSlash({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="m14.53 9.47-5.06 5.06a3.576 3.576 0 1 1 5.06-5.06Z" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17.82 5.77C16.07 4.45 14.07 3.73 12 3.73c-3.53 0-6.82 2.08-9.11 5.68-.9 1.41-.9 3.78 0 5.19.79 1.24 1.71 2.31 2.71 3.17M8.42 19.53c1.14.48 2.35.74 3.58.74 3.53 0 6.82-2.08 9.11-5.68.9-1.41.9-3.78 0-5.19-.33-.52-.69-1.01-1.06-1.47" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15.51 12.7a3.565 3.565 0 0 1-2.82 2.82M9.47 14.53 2 22M22 2l-7.47 7.47" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function Sms({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M17 20.5H7c-3 0-5-1.5-5-5v-7c0-3.5 2-5 5-5h10c3 0 5 1.5 5 5v7c0 3.5-2 5-5 5Z" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} />
      <Path d="m17 9-3.13 2.5c-1.03.82-2.72.82-3.75 0L7 9" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} />
    </Svg>
  );
}

export function Play({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M4 12V8.44c0-4.42 3.13-6.23 6.96-4.02l3.09 1.78 3.09 1.78c3.83 2.21 3.83 5.83 0 8.04l-3.09 1.78-3.09 1.78C7.13 21.79 4 19.98 4 15.56V12Z" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} />
    </Svg>
  );
}

export function Pause({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M10.65 19.11V4.89c0-1.35-.57-1.89-2.01-1.89H5.01C3.57 3 3 3.54 3 4.89v14.22C3 20.46 3.57 21 5.01 21h3.63c1.44 0 2.01-.54 2.01-1.89ZM21 19.11V4.89C21 3.54 20.43 3 18.99 3h-3.63c-1.43 0-2.01.54-2.01 1.89v14.22c0 1.35.57 1.89 2.01 1.89h3.63c1.44 0 2.01-.54 2.01-1.89Z" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function Setting2({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <G>
        <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.5} />
        <Path
          d="M12.0005 2L12.0005 2.75C12.7879 2.75003 13.5513 2.84818 14.2794 3.03261L14.4636 2.30557L14.6477 1.57853C13.8001 1.36383 12.913 1.25004 12.0005 1.25L12.0005 2ZM15.0794 3.01539L14.3486 3.18414C14.5738 4.1595 15.1879 5.04568 16.1255 5.58702L16.5005 4.9375L16.8755 4.28798C16.3138 3.96368 15.9459 3.43468 15.8101 2.84665L15.0794 3.01539ZM16.5005 4.9375L16.1255 5.58705C16.9862 6.08386 17.9619 6.1982 18.8559 5.98729L18.6837 5.25733L18.5115 4.52736C17.9728 4.65446 17.3906 4.58534 16.8754 4.28795L16.5005 4.9375ZM19.591 5.49417L19.0218 5.9825C19.7653 6.84927 20.3504 7.85424 20.7337 8.9537L21.4419 8.70679L22.1501 8.45987C21.704 7.18047 21.0237 6.01231 20.1602 5.00583L19.591 5.49417ZM21.0924 9.68652L20.6152 9.1079C19.7833 9.79398 19.2505 10.8345 19.2505 12H20.0005H20.7505C20.7505 11.3017 21.068 10.6788 21.5695 10.2651L21.0924 9.68652ZM20.0005 12H19.2505C19.2505 13.1656 19.7836 14.2055 20.6154 14.8913L21.0925 14.3126L21.5696 13.7339C21.0679 13.3203 20.7505 12.698 20.7505 12H20.0005ZM21.442 15.2921L20.7338 15.0452C20.3504 16.1447 19.7648 17.1496 19.0208 18.0166L19.5899 18.505L20.1591 18.9935C21.0228 17.987 21.7039 16.8189 22.1502 15.539L21.442 15.2921ZM18.6829 18.742L18.8547 18.0119C17.9608 17.8015 16.9857 17.9164 16.1255 18.413L16.5005 19.0625L16.8755 19.712C17.3907 19.4146 17.9726 19.3453 18.511 19.472L18.6829 18.742ZM16.5005 19.0625L16.1255 18.413C15.1881 18.9542 14.5741 19.8398 14.3487 20.8149L15.0795 20.9838L15.8102 21.1527C15.946 20.565 16.3138 20.0363 16.8755 19.712L16.5005 19.0625ZM14.4637 21.6935L14.2794 20.9665C13.5509 21.1513 12.7876 21.25 12.0005 21.25L12.0005 22L12.0005 22.75C12.9135 22.75 13.8006 22.6355 14.6481 22.4205L14.4637 21.6935ZM12.0005 22V21.25C11.2126 21.25 10.4485 21.1514 9.71957 20.9665L9.5352 21.6935L9.35083 22.4205C10.1991 22.6356 11.087 22.75 12.0005 22.75V22ZM8.91971 20.9838L9.65053 20.8153C9.42575 19.8406 8.81315 18.9545 7.8756 18.413L7.50049 19.0625L7.12538 19.712C7.68637 20.036 8.05329 20.5644 8.18889 21.1524L8.91971 20.9838ZM7.50049 19.0625L7.87549 18.413C7.015 17.9162 6.03889 17.8011 5.14442 18.0118L5.31636 18.7418L5.48831 19.4718C6.02717 19.3449 6.60997 19.4144 7.12549 19.712L7.50049 19.0625ZM4.40899 18.5048L4.97824 18.0165C4.23459 17.1496 3.64946 16.1447 3.26619 15.0452L2.55799 15.2921L1.84979 15.539C2.29583 16.8186 2.97634 17.9866 3.83974 18.9931L4.40899 18.5048ZM2.90758 14.3127L3.38454 14.8915C4.21646 14.2059 4.75049 13.166 4.75049 12H4.00049H3.25049C3.25049 12.6977 2.93272 13.3201 2.43062 13.7339L2.90758 14.3127ZM4.00049 12H4.75049C4.75049 10.8341 4.21681 9.7936 3.38476 9.10774L2.90771 9.68646L2.43066 10.2652C2.93269 10.679 3.25049 11.302 3.25049 12H4.00049ZM2.55809 8.70676L3.26628 8.95368C3.6496 7.85426 4.23466 6.8493 4.97821 5.98253L4.40896 5.49421L3.83972 5.00588C2.97634 6.01234 2.29597 7.18048 1.8499 8.45984L2.55809 8.70676ZM5.31633 5.25738L5.14409 5.98733C6.03837 6.19834 7.01458 6.08406 7.87549 5.58702L7.50049 4.9375L7.12549 4.28798C6.61023 4.58546 6.02764 4.65462 5.48857 4.52742L5.31633 5.25738ZM7.50049 4.9375L7.87556 5.58698C8.81353 5.0453 9.42608 4.15867 9.65067 3.18371L8.91981 3.01535L8.18896 2.84699C8.05342 3.43533 7.68647 3.96401 7.12542 4.28802L7.50049 4.9375ZM9.53537 2.30557L9.7195 3.03261C10.4482 2.84807 11.2124 2.75 12.0005 2.75V2V1.25C11.0875 1.25 10.1996 1.36366 9.35123 1.57852L9.53537 2.30557ZM8.91981 3.01535L9.65067 3.18371C9.66614 3.11656 9.69244 3.06922 9.71281 3.04443C9.7303 3.02316 9.73336 3.0291 9.7195 3.03261L9.53537 2.30557L9.35123 1.57852C8.66035 1.7535 8.3034 2.35019 8.18896 2.84699L8.91981 3.01535ZM2.90771 9.68646L3.38476 9.10774C3.32409 9.05772 3.28885 9.00364 3.27472 8.96748C3.26284 8.93708 3.27159 8.93844 3.26628 8.95368L2.55809 8.70676L1.8499 8.45984C1.5845 9.22103 1.99565 9.9066 2.43066 10.2652L2.90771 9.68646ZM5.31636 18.7418L5.14442 18.0118C5.07753 18.0275 5.02358 18.0249 4.99232 18.0176C4.96544 18.0113 4.96914 18.0059 4.97824 18.0165L4.40899 18.5048L3.83974 18.9931C4.30226 19.5323 4.99289 19.5885 5.48831 19.4718L5.31636 18.7418ZM9.5352 21.6935L9.71957 20.9665C9.73335 20.97 9.73023 20.9759 9.71272 20.9546C9.69232 20.9298 9.66601 20.8824 9.65053 20.8153L8.91971 20.9838L8.18889 21.1524C8.30343 21.649 8.66032 22.2454 9.35083 22.4205L9.5352 21.6935ZM15.0795 20.9838L14.3487 20.8149C14.3332 20.8822 14.3068 20.9296 14.2863 20.9545C14.2688 20.9759 14.2656 20.97 14.2794 20.9665L14.4637 21.6935L14.6481 22.4205C15.3386 22.2454 15.6955 21.649 15.8102 21.1527L15.0795 20.9838ZM19.5899 18.505L19.0208 18.0166C19.0298 18.006 19.0335 18.0115 19.0067 18.0178C18.9754 18.025 18.9215 18.0277 18.8547 18.0119L18.6829 18.742L18.511 19.472C19.0064 19.5886 19.6967 19.5323 20.1591 18.9935L19.5899 18.505ZM21.4419 8.70679L20.7337 8.9537C20.7284 8.93846 20.7372 8.9371 20.7253 8.96753C20.7111 9.00371 20.6759 9.05784 20.6152 9.1079L21.0924 9.68652L21.5695 10.2651C22.0043 9.90655 22.4155 9.22104 22.1501 8.45987L21.4419 8.70679ZM2.55799 15.2921L3.26619 15.0452C3.27151 15.0605 3.26277 15.0619 3.27463 15.0315C3.28874 14.9954 3.32393 14.9414 3.38454 14.8915L2.90758 14.3127L2.43062 13.7339C1.9955 14.0924 1.58448 14.7779 1.84979 15.539L2.55799 15.2921ZM18.6837 5.25733L18.8559 5.98729C18.9227 5.97154 18.9766 5.97415 19.0078 5.98142C19.0346 5.98767 19.0309 5.99311 19.0218 5.9825L19.591 5.49417L20.1602 5.00583C19.6977 4.46667 19.0071 4.41046 18.5115 4.52736L18.6837 5.25733ZM4.40896 5.49421L4.97821 5.98253C4.96911 5.99314 4.96539 5.9877 4.99221 5.98145C5.02342 5.97418 5.0773 5.97157 5.14409 5.98733L5.31633 5.25738L5.48857 4.52742C4.99299 4.41048 4.30228 4.46667 3.83972 5.00588L4.40896 5.49421ZM21.0925 14.3126L20.6154 14.8913C20.676 14.9413 20.7113 14.9953 20.7254 15.0315C20.7372 15.0618 20.7285 15.0604 20.7338 15.0452L21.442 15.2921L22.1502 15.539C22.4156 14.7779 22.0045 14.0925 21.5696 13.7339L21.0925 14.3126ZM14.4636 2.30557L14.2794 3.03261C14.2656 3.0291 14.2687 3.02318 14.2863 3.04453C14.3067 3.0694 14.3331 3.11685 14.3486 3.18414L15.0794 3.01539L15.8101 2.84665C15.6955 2.35019 15.3386 1.75352 14.6477 1.57853L14.4636 2.30557Z"
          fill={color}
        />
      </G>
    </Svg>
  );
}

export function TickCircle({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10Z" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="m7.75 12 2.83 2.83 5.67-5.66" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function Warning2({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M12 7.75V13M21.08 8.58v6.84c0 1.12-.6 2.16-1.57 2.73l-5.94 3.43c-.97.56-2.17.56-3.15 0l-5.94-3.43a3.15 3.15 0 0 1-1.57-2.73V8.58c0-1.12.6-2.16 1.57-2.73l5.94-3.43c.97-.56 2.17-.56 3.15 0l5.94 3.43c.97.57 1.57 1.6 1.57 2.73Z" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 16.2v.1" stroke={color} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function Add({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M6 12h12M12 18V6" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function Minus({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M6 12h12" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function Musicnote({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M7.97 22a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM11.97 18V4M14.61 2.11l4.42 1.47c1.07.36 1.95 1.57 1.95 2.7v1.17c0 1.53-1.18 2.38-2.63 1.9l-4.42-1.47c-1.07-.36-1.95-1.57-1.95-2.7V4c-.01-1.52 1.18-2.38 2.63-1.89Z" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}


export function Edit2({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="m13.26 3.6-8.21 8.69c-.31.33-.61.98-.67 1.43l-.37 3.24c-.13 1.17.71 1.97 1.87 1.77l3.22-.55c.45-.08 1.08-.41 1.39-.75l8.21-8.69c1.42-1.5 2.06-3.21-.15-5.3-2.2-2.07-3.87-1.34-5.29.16Z" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} />
      <Path d="M11.89 5.05a6.126 6.126 0 0 0 5.45 5.15M3 22h18" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} />
    </Svg>
  );
}

export function Calendar({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M8 2v3M16 2v3M3.5 9.09h17M21 8.5V17c0 3-1.5 5-5 5H8c-3.5 0-5-2-5-5V8.5c0-3 1.5-5 5-5h8c3.5 0 5 2 5 5Z" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} />
      <Path d="M15.695 13.7h.009M15.695 16.7h.009M11.995 13.7h.01M11.995 16.7h.01M8.294 13.7h.01M8.294 16.7h.01" stroke={color} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MessageQuestion({ size = 24, color = DEFAULT_COLOR, style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M17 18.43h-4l-4.45 2.96A.997.997 0 0 1 7 20.56v-2.13c-3 0-5-2-5-5v-6c0-3 2-5 5-5h10c3 0 5 2 5 5v6c0 3-2 5-5 5Z" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} />
      <Path d="M12 11.36v-.21c0-.68.42-1.04.84-1.33.41-.28.82-.64.82-1.3 0-.92-.74-1.66-1.66-1.66-.92 0-1.66.74-1.66 1.66M11.995 13.75h.01" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
