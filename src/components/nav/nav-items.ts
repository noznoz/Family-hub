import {
  Home, MessageCircle, ListChecks, Wallet, LayoutGrid,
  Plane, FileText, LifeBuoy, Users, Building2, GraduationCap,
  Award, Calendar, Settings, UserRound, MoonStar, ScrollText, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Primary mobile bottom navigation. */
export const primaryNav: NavItem[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/money', label: 'Money', icon: Wallet },
  { href: '/more', label: 'More', icon: LayoutGrid },
];

/** Secondary destinations under "More" — Support kept near the top. */
export const moreNav: NavItem[] = [
  { href: '/profile', label: 'My profile', icon: UserRound },
  { href: '/prayer', label: 'Prayer times', icon: MoonStar },
  { href: '/support', label: 'Support', icon: LifeBuoy },
  { href: '/travel', label: 'Travel', icon: Plane },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/family', label: 'Family', icon: Users },
  { href: '/accommodation', label: 'Accommodation', icon: Building2 },
  { href: '/university', label: 'University', icon: GraduationCap },
  { href: '/scholarship', label: 'Scholarship', icon: Award },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/audit', label: 'Activity log', icon: ScrollText },
  { href: '/settings', label: 'Settings', icon: Settings },
];
