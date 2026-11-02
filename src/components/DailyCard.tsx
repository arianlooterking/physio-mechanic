import { DAILY_SIZE } from '../lib/daily';
import { fmt } from '../lib/digits';
import { go } from '../lib/nav';
import { dailyOf, dailyStreak, dailyXp } from '../lib/state';
import { useAppState } from '../lib/store';
import { dayKey } from '../lib/time';
import { Icon } from './Icon';

/** Home card for «چالش امروز»: not started, or done with today's marks; and the days in a row. */
export function DailyCard() {
  const s = useAppState();
  const today = dayKey();
  const rec = dailyOf(s, today);
  const streak = dailyStreak(s, today);
  const right = rec ? rec.marks.filter(Boolean).length : 0;
  const maxXp = dailyXp(Array.from({ length: DAILY_SIZE }, () => true));
  return (
    <section className={`card daily-card${rec ? ' done' : ''}`} aria-label="چالش امروز">
      <div className="daily-top">
        <span className="daily-ic" aria-hidden="true">
          <Icon name={rec ? 'check' : 'bolt'} size={28} stroke={rec ? 3 : undefined} />
        </span>
        <div className="grow">
          <div className="daily-kicker">چالش امروز</div>
          {rec ? (
            <b>
              انجام شد: {fmt(right)} از {fmt(rec.marks.length)}
            </b>
          ) : (
            <b>{fmt(DAILY_SIZE)} سؤال کوتاه برای امروز</b>
          )}
          <div className="small muted">{rec ? 'فردا یک چالش تازه منتظرت است.' : `حدود ۳ دقیقه · تا ${fmt(maxXp)} امتیاز`}</div>
        </div>
        <button className={`btn sm${rec ? ' ghost' : ' accent'}`} onClick={() => go({ name: 'daily' })}>
          {rec ? 'نتیجه' : 'شروع'}
        </button>
      </div>
      <div className="daily-foot">
        {rec ? (
          <span className="dc-marks sm" aria-label={`${right} درست از ${rec.marks.length}`}>
            {rec.marks.map((m, k) => (
              <span key={k} className={m ? 'ok' : 'bad'}>
                <Icon name={m ? 'check' : 'x'} size={14} stroke={3} />
              </span>
            ))}
          </span>
        ) : (
          <span className="small muted">هر روز یک دست سؤال تازه</span>
        )}
        <span className={`daily-streak${streak ? ' on' : ''}`}>
          <Icon name="flame" size={18} /> {streak ? `${fmt(streak)} روز پشت‌سرهم` : 'زنجیره را شروع کن'}
        </span>
      </div>
    </section>
  );
}
