
export type Maybe<T> = T | null;

export const EXT_CLASS = "tpc-ext" as const;
export const PROCESSED_ATTR = "data-tpc-processed" as const;

export const qs = <T extends Element>(root: ParentNode, sel: string) =>
  root.querySelector(sel) as Maybe<T>;

export const qsa = <T extends Element>(root: ParentNode, sel: string) =>
  Array.from(root.querySelectorAll(sel)) as T[];

export function throttle<T extends (...args: any[]) => void>(fn: T, wait: number): T {
  let last = 0;
  let timer: number | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      if (timer) window.clearTimeout(timer);
      timer = null;
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = window.setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  } as T;
}

export function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}
