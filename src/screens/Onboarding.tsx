import { useState } from 'react';
import { SUBJECTS } from '../content';
import type { Grade, Major, SubjectId } from '../content/types';
import { Icon } from '../components/Icon';
import { Mascot } from '../components/Mascot';
import { Bar, SubjectIcon } from '../components/ui';
import { fmt } from '../lib/digits';
import { sfx } from '../lib/sound';
import { getState, update } from '../lib/store';
import { setStudy } from '../lib/study';
import { GOALS } from './Profile';

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(() => getState().profile.name);
  const [goal, setGoal] = useState(30);
  const [focus, setFocus] = useState<SubjectId>('bm1');
  const grade: Grade = 12;
  const major: Major = 'science';
  const steps = 4;
  // Every part of the book that has lessons.
  const mine = SUBJECTS;
  const choices = SUBJECTS;
  const chosen = choices.some((sub) => sub.id === focus) ? focus : (choices[0]?.id ?? focus);

  const finish = () => {
    sfx.complete();
    update((s) => {
      s.profile.name = name.trim().slice(0, 30);
      s.profile.goal = goal;
      setStudy(s, grade, major);
      s.profile.focus = chosen;
      s.profile.onboarded = true;
    });
    location.hash = '#/';
  };

  return (
    <div className="onb">
      <div className="row" style={{ gap: 12 }}>
        {step > 0 && (
          <button className="icon-btn" onClick={() => setStep(step - 1)} aria-label="مرحلهٔ قبل">
            <Icon name="back" />
          </button>
        )}
        <div className="grow">
          <Bar value={(step + 1) / steps} />
        </div>
      </div>

      {step === 0 && (
        <div className="onb-body" key="0">
          <div className="center">
            <Mascot mood="cheer" size={150} className="bob" />
          </div>
          <h1 className="center">سلام! من «بیو» هستم 👋</h1>
          <p className="lead center">با هم بیومکانیک دستگاه اسکلتی‌ـ‌عضلانی را می‌فهمیم؛ نه اینکه فقط حفظ کنیم.</p>
          <div className="card stack" style={{ gap: 12 }}>
            <div className="row">
              <span className="chip primary">۱</span> هر مفهوم را اول ساده و با مثال توضیح می‌دهم.
            </div>
            <div className="row">
              <span className="chip primary">۲</span> اگر نفهمیدی، از یک راه دیگر: با شکل، قدم‌به‌قدم یا با یک تشبیه.
            </div>
            <div className="row">
              <span className="chip primary">۳</span> آن‌قدر ادامه می‌دهیم تا بگویی «فهمیدم» و با یک سؤال مطمئن شویم.
            </div>
            <div className="row">
              <span className="chip primary">۴</span> بعد با تمرین، کارت مرور و آزمون چهارگزینه‌ای تثبیتش می‌کنیم.
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="onb-body" key="1">
          <div className="mascot-row">
            <Mascot mood="happy" size={90} />
            <div className="speech">اسمت چیست؟ دوست دارم با اسم خودت صدایت کنم.</div>
          </div>
          <input
            className="text-input"
            autoFocus
            value={name}
            maxLength={30}
            placeholder="مثلاً: سارا"
            aria-label="نام"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setStep(2)}
          />
          <p className="small muted">اختیاری است؛ فقط روی همین دستگاه ذخیره می‌شود.</p>
        </div>
      )}

      {step === 2 && (
        <div className="onb-body" key="2">
          <div className="mascot-row">
            <Mascot mood="think" size={90} />
            <div className="speech">هر روز چقدر وقت داری؟ کم ولی هر روز، از زیاد ولی گاه‌به‌گاه بهتر است.</div>
          </div>
          <div className="goal-opts">
            {GOALS.map((g) => (
              <button key={g.xp} className={`opt${goal === g.xp ? ' sel' : ''}`} aria-pressed={goal === g.xp} onClick={() => setGoal(g.xp)}>
                <span className="goal-label">
                  <b>{g.label}</b>
                  <small>{g.sub}</small>
                </span>
                <span className="chip accent">{fmt(g.xp)} امتیاز</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="onb-body" key="3">
          <div className="mascot-row">
            <Mascot mood="wink" size={90} />
            <div className="speech">
              {mine.length
                ? 'از کدام بخش کتاب شروع کنیم؟ بعداً هر وقت خواستی عوضش کن.'
                : choices.length
                  ? 'درس‌های پایهٔ تو هر هفته اضافه می‌شوند. تا آن موقع، با یکی از درس‌های آمادهٔ رشته‌ات شروع کن.'
                  : 'درس‌های رشتهٔ تو هنوز آماده نیست و هر هفته درس تازه اضافه می‌شود. تا آن موقع کتاب‌هایت در کتابخانه است.'}
            </div>
          </div>
          <div className="goal-opts">
            {choices.map((s) => (
              <button key={s.id} className={`opt${chosen === s.id ? ' sel' : ''}`} aria-pressed={chosen === s.id} onClick={() => setFocus(s.id)}>
                <span className="row">
                  <span style={{ color: `var(--${s.color})` }}>
                    <SubjectIcon id={s.id} size={26} />
                  </span>
                  {s.title}
                </span>
                <span className="small muted">شروع از «{s.lessons[0]?.title}»</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button className="btn lg block" onClick={() => (step < steps - 1 ? setStep(step + 1) : finish())}>
        {step === 0 ? 'شروع کنیم' : step < steps - 1 ? 'ادامه' : 'بزن بریم!'}
      </button>
    </div>
  );
}
