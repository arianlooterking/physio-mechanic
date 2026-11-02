import { useState } from 'react';
import { fmt, pct } from '../lib/digits';
import { weekReport, type DayStats, type WeekStats } from '../lib/report';
import type { AppState } from '../lib/state';
import { dayKey, fromKey, weekdayShort } from '../lib/time';
import { Icon } from './Icon';

type Metric = 'q' | 'minutes';

/**
 * «گزارش هفته»: the last seven days against the seven before (lessons finished, questions answered, accuracy,
 * study minutes), and a seven-day column chart of questions or minutes per day.
 */
export function WeeklyReport({ s }: { s: AppState }) {
  const today = dayKey();
  const { now, before, days } = weekReport(s, today);
  const [metric, setMetric] = useState<Metric>(() => (days.some((d) => d.q > 0) ? 'q' : 'minutes'));
  return (
    <section className="card wr" aria-labelledby="wr-title">
      <div className="wr-head">
        <h3 id="wr-title">گزارش هفته</h3>
        <span className="tiny muted">۷ روز اخیر، در مقایسه با ۷ روز قبلش</span>
      </div>
      <div className="wr-tiles">
        <Tile label="درس تمام‌شده" value={fmt(now.lessons)} delta={compare(now.lessons, before.lessons, 'تا')} />
        <Tile label="سؤال جواب‌داده" value={fmt(now.questions)} delta={compare(now.questions, before.questions, 'تا')} />
        <Tile label="دقت جواب‌ها" value={now.accuracy === null ? '—' : pct(now.accuracy)} delta={accuracyDelta(now, before)} />
        <Tile label="دقیقهٔ یادگیری" value={fmt(now.minutes)} delta={compare(now.minutes, before.minutes, 'دقیقه')} />
      </div>
      <div className="wr-chart-head">
        <b className="small">هر روز این هفته</b>
        <div className="seg wr-seg" role="group" aria-label="نمودار بر اساس">
          <button aria-pressed={metric === 'q'} onClick={() => setMetric('q')}>
            سؤال
          </button>
          <button aria-pressed={metric === 'minutes'} onClick={() => setMetric('minutes')}>
            دقیقه
          </button>
        </div>
      </div>
      <Columns days={days} metric={metric} today={today} />
    </section>
  );
}

interface Delta {
  dir: 'up' | 'down' | 'same';
  text: string;
}

function compare(a: number, b: number, unit: string): Delta {
  if (a === b) return { dir: 'same', text: 'مثل هفتهٔ قبل' };
  return a > b ? { dir: 'up', text: `${fmt(a - b)} ${unit} بیشتر` } : { dir: 'down', text: `${fmt(b - a)} ${unit} کمتر` };
}

function accuracyDelta(now: WeekStats, before: WeekStats): Delta | null {
  if (now.accuracy === null || before.accuracy === null) return null;
  const d = Math.round((now.accuracy - before.accuracy) * 100);
  if (d === 0) return { dir: 'same', text: 'مثل هفتهٔ قبل' };
  return d > 0 ? { dir: 'up', text: `${fmt(d)} درصد بهتر` } : { dir: 'down', text: `${fmt(-d)} درصد کمتر` };
}

function Tile({ label, value, delta }: { label: string; value: string; delta: Delta | null }) {
  return (
    <div className="wr-tile">
      <span className="wr-label">{label}</span>
      <b className="wr-value">{value}</b>
      {delta ? (
        <span className={`wr-delta ${delta.dir}`}>
          {delta.dir !== 'same' && <Icon name={delta.dir === 'up' ? 'up' : 'down'} size={14} stroke={2.6} />}
          {delta.text}
        </span>
      ) : (
        <span className="wr-delta same">هفتهٔ قبل داده‌ای نیست</span>
      )}
    </div>
  );
}

const DAY_NAMES = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
/** Full weekday name, indexed by Date.getDay() (0 = Sunday). */
const dayName = (d: string) => DAY_NAMES[fromKey(d).getDay()];

function describe(d: DayStats, metric: Metric): string {
  return metric === 'q' ? (d.q ? `${fmt(d.q)} سؤال، ${fmt(d.ok)} درست` : 'سؤالی جواب ندادی') : d.minutes ? `${fmt(d.minutes)} دقیقه یادگیری` : 'یادگیری ثبت نشده';
}

/** One series, so no legend: the switch above names it. Value on the cap of today and of the busiest day only. */
function Columns({ days, metric, today }: { days: DayStats[]; metric: Metric; today: string }) {
  const value = (d: DayStats) => (metric === 'q' ? d.q : d.minutes);
  const max = Math.max(1, ...days.map(value));
  const peak = days.reduce((a, d) => (value(d) > value(a) ? d : a), days[0]);
  return (
    <>
      <div className="wr-chart" role="img" aria-label={`نمودار ${metric === 'q' ? 'سؤال‌های' : 'دقیقه‌های'} هر روز در ۷ روز اخیر`}>
        <span className="wr-max tiny muted" aria-hidden="true">
          {fmt(max)}
        </span>
        {days.map((d) => {
          const v = value(d);
          const label = d.day === today || (d === peak && v > 0);
          return (
            <div key={d.day} className={`wr-col${d.day === today ? ' today' : ''}`} tabIndex={0} aria-label={`${dayName(d.day)}: ${describe(d, metric)}`}>
              <span className="wr-tip" aria-hidden="true">
                <b>{describe(d, metric)}</b>
                <span>{dayName(d.day)}</span>
              </span>
              <span className="wr-cap" aria-hidden="true">
                {label && v > 0 ? fmt(v) : ''}
              </span>
              <span className="wr-bar" style={{ height: `${(v / max) * 100}%` }} />
            </div>
          );
        })}
      </div>
      <div className="wr-axis" aria-hidden="true">
        {days.map((d) => (
          <span key={d.day} className={d.day === today ? 'today' : ''}>
            {d.day === today ? 'امروز' : weekdayShort(d.day)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{metric === 'q' ? 'سؤال‌های جواب‌داده در هر روز' : 'دقیقه‌های یادگیری در هر روز'}</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{dayName(d.day)}</th>
              <td>{describe(d, metric)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
