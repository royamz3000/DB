export const EVENT_LABELS = {
  added: 'Added to suppression list',
  bounce: 'Delivery attempt failed',
  unsubscribe_click: 'Unsubscribe click recorded',
  delivery_success: 'Last successful delivery',
  first_seen: 'First seen',
  note: 'Note added',
  review_requested: 'Review requested',
  revalidated: 'Re-validated',
};

export function eventLabel(type) {
  return EVENT_LABELS[type] || type;
}

export function formatTimestamp(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function relativeDay(iso) {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Yesterday ${time}`;
  return formatDate(iso);
}
