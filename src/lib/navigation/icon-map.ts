import type { LucideIcon } from 'lucide-react'
import {
  BadgePercent,
  BellRing,
  Bike,
  Boxes,
  CalendarClock,
  Gift,
  ChefHat,
  Circle,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  ListOrdered,
  MapPinned,
  PackageSearch,
  PlugZap,
  PartyPopper,
  QrCode,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  SquareStack,
  TrendingUp,
  UsersRound,
  UtensilsCrossed,
} from 'lucide-react'

// Maps DB-stored icon *names* to Lucide components for DB-driven navigation.
// Unknown names fall back to a neutral placeholder rather than throwing.
const ICON_BY_NAME: Record<string, LucideIcon> = {
  BadgePercent,
  BellRing,
  Bike,
  Boxes,
  CalendarClock,
  Gift,
  ChefHat,
  ClipboardList,
  FileBarChart,
  LayoutDashboard,
  ListOrdered,
  PartyPopper,
  QrCode,
  ShoppingBag,
  MapPinned,
  PackageSearch,
  PlugZap,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  ShoppingBasket,
  SquareStack,
  TrendingUp,
  UsersRound,
  UtensilsCrossed,
}

export function resolveNavIcon(name: string | null | undefined): LucideIcon {
  if (name && name in ICON_BY_NAME) {
    return ICON_BY_NAME[name]
  }

  return Circle
}
