import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce any fast-changing value by a specified delay (defaults to 450ms).
 *
 * @param value The value to debounce (e.g. search input text)
 * @param delay The delay in milliseconds (default 450ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 450): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
