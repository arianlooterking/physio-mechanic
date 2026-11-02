import { useEffect, useRef } from 'react';

/**
 * The phone's back button (Android) closes the newest open thing first (a sheet, a glossary card) before it goes
 * back a screen, the way people expect. Each overlay registers here while it is open; src/native calls `runBack`
 * on every press, then goes back in the page history, and only leaves the app at the home screen. On the website
 * nothing calls it.
 */
const stack: { current: () => void }[] = [];

export function useBack(active: boolean, onBack: () => void) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    stack.push(ref);
    return () => {
      const i = stack.lastIndexOf(ref);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

/** handles a back press; false when nothing in the app wanted it */
export function runBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.current();
  return true;
}
