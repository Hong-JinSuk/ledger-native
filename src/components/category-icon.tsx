import type { ComponentType } from 'react';
import * as LucideIcons from 'lucide-react-native';

type IconProps = { size?: number; color?: string; strokeWidth?: number };

// Category data stores icon *names* (strings), so we resolve the lucide component dynamically.
const ICONS = LucideIcons as unknown as Record<string, ComponentType<IconProps>>;

export function CategoryIcon({
  name,
  size = 18,
  color,
  strokeWidth = 2,
}: {
  name: string | undefined;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Icon = (name ? ICONS[name] : undefined) ?? ICONS.Circle;
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}
