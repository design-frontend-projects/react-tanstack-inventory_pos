import type { LucideIcon } from 'lucide-react'
import {
  BellRing,
  Boxes,
  ChefHat,
  Circle,
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  PackageSearch,
  PlugZap,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  ShoppingBasket,
  SquareStack,
  UsersRound,
} from 'lucide-react'

// Maps DB-stored icon *names* to Lucide components for DB-driven navigation.
// Unknown names fall back to a neutral placeholder rather than throwing.
const ICON_BY_NAME: Record<string, LucideIcon> = {
  BellRing,
  Boxes,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  PackageSearch,
  PlugZap,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  ShoppingBasket,
  SquareStack,
  UsersRound,
}

export function resolveNavIcon(name: string | null | undefined): LucideIcon {
  if (name && name in ICON_BY_NAME) {
    return ICON_BY_NAME[name]
  }

  return Circle
}
