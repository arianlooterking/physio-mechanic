// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetState, update } from '../src/lib/store';
import { SummarySheet } from '../src/screens/Sheet';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = () => undefined;

let root: Root | null = null;
function mount(node: React.ReactNode) {
  const el = document.createElement('div');
  document.body.append(el);
  root = createRoot(el);
  act(() => root!.render(node));
  return el;
}
const click = (b: Element | null | undefined) => act(() => (b as HTMLElement).click());
const button = (el: ParentNode, text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;

beforeEach(() => {
  resetState();
  update((s) => {
    s.profile.onboarded = true;
    s.profile.sound = false;
    s.profile.grade = 12;
    s.profile.major = 'math';
  });
});
afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = '';
});

describe('«برگهٔ خلاصه» on screen', () => {
  it('shows a book\'s summaries with a print button, and hides notes or cards on request', () => {
    const el = mount(<SummarySheet subject="bm2" />);
    expect(el.querySelector('h1')?.textContent).toBe('بیومکانیک بافت‌ها');
    expect(el.querySelectorAll('.ss-lesson').length).toBeGreaterThan(3);
    expect(button(el, 'چاپ')).toBeTruthy();
    const notes = el.querySelectorAll('.ss-note').length;
    expect(notes).toBeGreaterThan(0);
    click(button(el, 'نکته‌ها'));
    expect(el.querySelectorAll('.ss-note').length).toBe(0);
    click(button(el, 'نکته‌ها'));
    expect(el.querySelectorAll('.ss-note').length).toBe(notes);
    click(button(el, 'کارت‌ها'));
    expect(el.querySelectorAll('.ss-card').length).toBe(0);
  });

  it('says so for a book it does not know', () => {
    const el = mount(<SummarySheet subject="nope" />);
    expect(el.textContent).toContain('این کتاب پیدا نشد');
  });
});
