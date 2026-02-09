import {
  User,
  Building2,
  CreditCard,
  Users,
  Bell,
  Globe,
  Link2,
  Info,
} from 'lucide-react';

export const SETTINGS_CATEGORIES = [
  {
    key: 'account',
    label: 'Account',
    description: 'Profile, email, and logout',
    path: '/settings/account',
    icon: User,
  },
  {
    key: 'workspace',
    label: 'Workspace',
    description: 'Workspace name and business details',
    path: '/settings/workspace',
    icon: Building2,
  },
  {
    key: 'billing',
    label: 'Billing',
    description: 'Plan, status, and payments',
    path: '/settings/billing',
    icon: CreditCard,
  },
  {
    key: 'team',
    label: 'Team',
    description: 'Members, roles, and invites',
    path: '/settings/team',
    icon: Users,
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Email reminders and summaries',
    path: '/settings/notifications',
    icon: Bell,
  },
  {
    key: 'regional',
    label: 'Regional',
    description: 'Timezone and follow-up timing',
    path: '/settings/regional',
    icon: Globe,
  },
  {
    key: 'integrations',
    label: 'Integrations',
    description: 'WhatsApp and email verification',
    path: '/settings/integrations',
    icon: Link2,
  },
  {
    key: 'about',
    label: 'About & Legal',
    description: 'App version, support, and policies',
    path: '/settings/about',
    icon: Info,
  },
];

export const getSettingsTitle = (pathname) => {
  const match = SETTINGS_CATEGORIES.find((item) => pathname.startsWith(item.path));
  return match ? match.label : 'Settings';
};
