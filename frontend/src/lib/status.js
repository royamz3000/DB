export const REASONS = {
  hard_bounce: { hue: 25, label: 'Hard bounce', listKind: 'bounce' },
  soft_bounce: { hue: 70, label: 'Soft bounce', listKind: 'bounce' },
  unsubscribed: { hue: 289, label: 'Unsubscribed', listKind: 'unsubscribe' },
  spam_complaint: { hue: 350, label: 'Spam complaint', listKind: 'bounce' },
  catch_all_risky: { hue: 110, label: 'Catch-all / risky', listKind: 'bounce' },
  global_blocklist: { hue: 250, label: 'Global blocklist', listKind: 'blocklist' },
  clean: { hue: 155, label: 'Deliverable', listKind: null },
  invalid_syntax: { hue: 25, label: 'Invalid syntax', listKind: null },
  invalid_domain: { hue: 25, label: 'Domain not found', listKind: null },
};

export const REASON_ORDER = [
  'hard_bounce',
  'soft_bounce',
  'unsubscribed',
  'spam_complaint',
  'catch_all_risky',
  'global_blocklist',
];

export function statusHue(reasonKey) {
  return REASONS[reasonKey]?.hue ?? REASONS.clean.hue;
}

export function statusColor(reasonKey) {
  return `oklch(0.66 0.125 ${statusHue(reasonKey)})`;
}

export function statusLabel(reasonKey) {
  return REASONS[reasonKey]?.label ?? reasonKey;
}
