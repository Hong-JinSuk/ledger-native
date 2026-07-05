/**
 * Curated palette of lucide-react-native icon names offered in the category editor (Phase 4).
 * Stored on a category as a plain string; {@link CategoryIcon} resolves it dynamically and
 * falls back to `Circle` for anything unknown, so a stale name never crashes.
 */
export const PICKABLE_ICONS: string[] = [
  // 식·음료
  'Utensils', 'Coffee', 'Beer', 'Wine', 'Pizza', 'IceCream', 'Cake', 'Soup', 'Apple',
  // 쇼핑·생활
  'ShoppingBag', 'ShoppingCart', 'Shirt', 'Scissors', 'Gift', 'Tag', 'Package',
  // 주거·통신
  'Home', 'Sofa', 'Bed', 'Bath', 'Lightbulb', 'Plug', 'Wifi', 'Smartphone', 'Phone',
  // 이동
  'Bus', 'Car', 'Train', 'Plane', 'Bike', 'Fuel', 'TramFront',
  // 건강·뷰티
  'HeartPulse', 'Stethoscope', 'Pill', 'Dumbbell', 'Activity', 'Heart',
  // 문화·여가
  'Ticket', 'Film', 'Music', 'Gamepad2', 'BookOpen', 'Palette', 'Camera', 'PartyPopper',
  // 사람·교육
  'Baby', 'Users', 'User', 'GraduationCap', 'Cat', 'Dog',
  // 금융
  'Banknote', 'Coins', 'Wallet', 'PiggyBank', 'CreditCard', 'Landmark', 'Receipt',
  'TrendingUp', 'TrendingDown', 'BadgePercent', 'ShieldPlus',
  // 업무·이체
  'Briefcase', 'Clock', 'Building2', 'Laptop', 'ArrowRightLeft', 'ArrowRight', 'Repeat',
  // 기타
  'Star', 'Sparkles', 'Flower', 'Leaf', 'Sun', 'Umbrella', 'MapPin', 'Calendar',
  'MoreHorizontal', 'Circle',
];
