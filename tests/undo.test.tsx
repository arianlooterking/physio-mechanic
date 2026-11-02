// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { Blocks } from '../src/components/Blocks';
import { QuestionView } from '../src/components/questions/QuestionView';
import type { Block, MatchQ, OrderQ, Question } from '../src/content/types';
import { grade, type Answer } from '../src/lib/grade';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(node: (rerender: () => void) => React.ReactNode) {
  const el = document.createElement('div');
  document.body.append(el);
  const root = createRoot(el);
  const render = () => root.render(node(render));
  act(render);
  return el;
}
const click = (b: Element | null | undefined) => act(() => (b as HTMLElement).click());

function question(q: Question) {
  const box = { answer: null as Answer | null };
  const el = mount((rerender) => <QuestionView q={q} answer={box.answer} onAnswer={(a) => ((box.answer = a), rerender())} locked={false} />);
  return { el, box };
}

/** Every step where answers are placed before «بررسی» lets the learner take them back or start over. */
describe('taking answers back', () => {
  it('order: a placed step goes back when tapped, and «از نو» clears them all', () => {
    const { el, box } = question({ id: 'u.o', type: 'order', concept: 'u', level: 1, prompt: 'p', items: ['A', 'B', 'C'], explain: '' } as OrderQ);
    const pool = () => [...el.querySelectorAll<HTMLButtonElement>('.order-pool .order-item')].filter((b) => !b.disabled);
    expect(el.querySelector('.order-tools')).toBeNull();
    click(pool()[0]);
    click(pool()[0]);
    expect(box.answer).toMatchObject({ t: 'order', seq: { length: 2 } });
    click(el.querySelector('.order-zone .order-item'));
    expect(box.answer).toMatchObject({ t: 'order', seq: { length: 1 } });
    click(pool()[0]);
    click(el.querySelector('.order-tools .link-btn'));
    expect(box.answer).toBeNull();
    expect(el.querySelectorAll('.order-zone .order-item')).toHaveLength(0);
    expect(pool()).toHaveLength(3);
  });

  it('match: tapping a picked item again lets it go', () => {
    const { el } = question({ id: 'u.m', type: 'match', concept: 'u', level: 1, prompt: 'p', pairs: [['a', '1'], ['b', '2'], ['c', '3']], explain: '' } as MatchQ);
    const left = () => el.querySelectorAll('.match-col')[0].querySelectorAll('button');
    click(left()[0]);
    expect(left()[0].className).toContain('sel');
    click(left()[0]);
    expect(left()[0].className).not.toContain('sel');
  });

  it('konkur block: «از نو» hides the solution and frees the options again', () => {
    const b: Block = { t: 'konkur', problem: 'p', options: ['r', 'w1', 'w2', 'w3'], answer: 0, solution: [] };
    const el = mount(() => <Blocks blocks={[b]} />);
    const opts = () => el.querySelectorAll<HTMLButtonElement>('.konkur-opts button');
    click(opts()[1]);
    expect(opts()[0].disabled).toBe(true);
    expect(el.querySelector('.konkur-sol')).not.toBeNull();
    click(el.querySelector('.konkur-head .link-btn'));
    expect(el.querySelector('.konkur-sol')).toBeNull();
    expect([...opts()].every((o) => !o.disabled && o.className === 'opt')).toBe(true);
  });
});

describe('orders with more than one right answer', () => {
  it('accepts an order listed in alts and colours it as right', () => {
    const q = { id: 'u.a', type: 'order', concept: 'u', level: 1, prompt: 'p', items: ['A', 'B', 'C', 'D'], alts: [[0, 2, 1, 3]], explain: '' } as OrderQ;
    expect(grade(q, { t: 'order', seq: [0, 1, 2, 3] })).toBe(true);
    expect(grade(q, { t: 'order', seq: [0, 2, 1, 3] })).toBe(true);
    expect(grade(q, { t: 'order', seq: [1, 0, 2, 3] })).toBe(false);
    const el = mount(() => <QuestionView q={q} answer={{ t: 'order', seq: [0, 2, 1, 3] }} onAnswer={() => undefined} locked />);
    const placed = [...el.querySelectorAll<HTMLElement>('.order-zone .order-item')];
    expect(placed.every((b) => b.style.borderColor === 'var(--ok)')).toBe(true);
  });
});
