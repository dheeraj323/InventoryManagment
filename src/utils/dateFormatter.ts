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
