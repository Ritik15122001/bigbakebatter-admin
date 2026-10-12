/**
 * Icon name lists shared across admin screens. Names match the storefront's
 * icon set (BigBakeBatter/src/utils/iconPaths.js) — an icon that doesn't exist
 * there would render blank on the website, so only offer these.
 */

/** Every icon key the storefront knows about (75). */
export const STOREFRONT_ICONS = [
  'search', 'share', 'lock', 'card', 'refresh', 'trash', 'pin', 'user', 'heart', 'bag', 'menu', 'x',
  'cleft', 'cright', 'cdown', 'aright', 'aupright', 'truck', 'sparkles', 'eggoff', 'cake', 'slice',
  'cookie', 'bowl', 'party', 'gem', 'wheat', 'leaf', 'sun', 'star', 'camera', 'gift', 'clock', 'phone',
  'mail', 'insta', 'fb', 'tw', 'minus', 'plus', 'check', 'alert', 'info', 'quote', 'cal', 'percent',
  'home', 'news', 'pkg', 'msg', 'edit', 'eye', 'eyeoff', 'arrowup', 'arrowdown',
  'icecream', 'coffee', 'cherry', 'candy', 'donut', 'croissant', 'apple', 'wine', 'flame', 'crown',
  'flower', 'baby', 'smile', 'users', 'briefcase', 'graduation', 'tree', 'moon', 'music', 'tag',
];

/** Pure UI glyphs that make no sense as a category / content icon. */
const UI_GLYPHS = new Set([
  'x', 'menu', 'search', 'trash', 'edit', 'eye', 'eyeoff', 'lock', 'refresh', 'cleft', 'cright', 'cdown',
  'aright', 'aupright', 'arrowup', 'arrowdown', 'minus', 'plus', 'check', 'alert', 'info', 'share',
]);

/** Icons offered in every icon picker (categories, announcements, add-on groups, page content). */
export const PICKABLE_ICONS = STOREFRONT_ICONS.filter((n) => !UI_GLYPHS.has(n));

// Kept as aliases so each screen reads clearly; all draw from the same list.
export const BAR_ICONS = PICKABLE_ICONS;
export const CATEGORY_ICONS = PICKABLE_ICONS;
export const ADDON_GROUP_ICONS = PICKABLE_ICONS;
