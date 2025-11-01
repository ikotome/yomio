/** 単純なデバウンスユーティリティ */
export type Debounced<T extends unknown[]> = ((...args: T) => void) & { cancel?: () => void };

export function debounce<T extends unknown[]>(fn: (...args: T) => void, wait: number): Debounced<T> {
  let t: ReturnType<typeof setTimeout> | null = null;
  const wrapped = (...args: T) => {
    if (t) clearTimeout(t as ReturnType<typeof setTimeout>);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, wait);
  };
  (wrapped as Debounced<T>).cancel = () => {
    if (t) clearTimeout(t as ReturnType<typeof setTimeout>);
    t = null;
  };
  return wrapped as Debounced<T>;
}
