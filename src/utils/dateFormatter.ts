/**
 * Centralized Date Formatter Utility
 * Formats all dates consistently into Indian standard DD-MM-YYYY format.
 */

export function formatDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '-';

  // Fast path for YYYY-MM-DD
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-');
    return `${day}-${month}-${year}`;
  }

  // Already DD-MM-YYYY
  if (typeof dateInput === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(dateInput)) {
    return dateInput;
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    // If it's a string like "2026-09-17T18:30:00Z"
    if (typeof dateInput === 'string' && dateInput.includes('-')) {
      const parts = dateInput.split('T')[0].split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    return String(dateInput);
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
}

export function formatDateTime(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '-';

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return formatDate(dateInput);
  }

  const dateStr = formatDate(d);
  const timeStr = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `${dateStr}, ${timeStr}`;
}

export function isToday(dateInput?: string | number | Date | null): boolean {
  if (!dateInput) return false;

  const d = new Date(dateInput);
  if (!isNaN(d.getTime())) {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  }

  if (typeof dateInput === 'string') {
    const today = new Date();
    const todayYMD = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayDMY = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    return dateInput.startsWith(todayYMD) || dateInput.startsWith(todayDMY);
  }

  return false;
}

export function isFutureDate(dateInput?: string | number | Date | null): boolean {
  if (!dateInput) return false;

  let d = new Date(dateInput);
  if (isNaN(d.getTime()) && typeof dateInput === 'string') {
    const parts = dateInput.split('T')[0].split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else if (parts[2].length === 4) {
        d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
  }

  if (isNaN(d.getTime())) return false;

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d.getTime() > today.getTime();
}

export function isOrderDeliveredToday(order?: {
  deliveredAt?: string | null;
  deliveryDate?: string | null;
  updatedAt?: string | null;
}): boolean {
  if (!order) return false;
  // If explicitly delivered, check actual delivery timestamp
  if (order.deliveredAt) {
    return isToday(order.deliveredAt);
  }
  // Fallback for orders delivered today without deliveredAt
  if (order.deliveryDate && isToday(order.deliveryDate)) {
    return true;
  }
  if (order.updatedAt && isToday(order.updatedAt)) {
    return true;
  }
  return false;
}
