/**
 * Single source of truth for admin navigation: sidebar, breadcrumbs and the
 * ⌘K command palette all read from here.
 */
export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: 'grid', keywords: 'home stats revenue' }],
  },
  {
    label: 'Sales',
    items: [
      { to: '/orders', label: 'Orders', icon: 'bag', badge: 'orders', keywords: 'deliveries status' },
      { to: '/transactions', label: 'Payments', icon: 'card', keywords: 'transactions refunds finance razorpay' },
      { to: '/customers', label: 'Customers', icon: 'users', keywords: 'clients accounts' },
      { to: '/enquiries', label: 'Enquiries', icon: 'msg', badge: 'enquiries', keywords: 'custom cake corporate quotes contact' },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { to: '/cakes', label: 'Cakes', icon: 'cake', keywords: 'products items prices' },
      { to: '/stock', label: 'Categories & stock', icon: 'pkg', keywords: 'inventory quantity' },
      { to: '/content', label: 'Catalogue extras', icon: 'star', keywords: 'flavours occasions add-ons addons faqs reviews' },
      { to: '/coupons', label: 'Coupons', icon: 'percent', keywords: 'discount promo codes' },
    ],
  },
  {
    label: 'Website',
    items: [
      { to: '/website-content', label: 'Page content', icon: 'layout', keywords: 'text pages sections homepage footer' },
      { to: '/banners', label: 'Homepage banners', icon: 'image', keywords: 'hero slider' },
      { to: '/announcements', label: 'Announcements', icon: 'megaphone', keywords: 'top bar' },
      { to: '/festival', label: 'Festive theme', icon: 'flame', keywords: 'diwali festival' },
      { to: '/blog', label: 'Blog', icon: 'news', keywords: 'articles posts comments' },
      { to: '/subscribers', label: 'Subscribers', icon: 'mail', keywords: 'newsletter emails' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/settings', label: 'Store settings', icon: 'settings', keywords: 'business delivery phone address social' },
      { to: '/team', label: 'Team & account', icon: 'shield', keywords: 'admins password users staff' },
    ],
  },
];

export const NAV = NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));

export const isActivePath = (pathname, to) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`));
