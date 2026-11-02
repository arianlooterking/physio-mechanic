# بیومانا (Biomana)

A Duolingo-style app for learning **musculoskeletal biomechanics** in Persian, for physiotherapy and rehabilitation students.
Every concept is explained one way first (simple, with a clinical example). If the student says they did not get it, the app
explains it again a different way (a picture or plot, step by step, an analogy, or a precise formal version) until it clicks,
then checks with a quick question. It runs on the engine of [Fahmana](https://github.com/arianlooterking/fahmana).

The lessons follow the chapter outline of *Basic Biomechanics of the Musculoskeletal System* (Nordin & Frankel, 5th ed.).
All text, examples and questions are original; nothing is copied from the book.

## Content so far

| Part | Lessons |
| --- | --- |
| ۱. مقدمه و مفاهیم پایه | حرکت، نیرو و گشتاور در بدن · رفتار مکانیکی مواد زیستی |
| ۲. بیومکانیک بافت‌ها | استخوان · غضروف مفصلی · تاندون و رباط · عصب محیطی و ریشهٔ عصب · عضلهٔ اسکلتی |
| ۳. بیومکانیک مفصل‌ها | coming soon |
| ۴. بیومکانیک کاربردی | coming soon |

Each lesson has 3 concepts with 3+ explanations each, concept checks, practice, a 4-option test, Leitner flashcards,
a warmup and a summary sheet. The AI tutor «بیو» (`server/tutor.ts`) is optional; the app works fully without it.

## Develop

```sh
npm install
npm run dev        # local dev server
npx vitest run     # tests (content rules included)
npm run build      # production build
```

Deploys as the Cloudflare Worker `biomana` (`wrangler.jsonc`, `worker/index.ts`). Create a KV namespace and put its id
in `BIOMANA_KV` before the first `npx wrangler deploy`.

## Adding a lesson

Write `src/content/bm/lessonN.ts` with the builders in `src/content/build.ts`, add it to `part1.ts`/`part2.ts`
(or a new part), then add its glossary terms, concept intros and warmup in `src/content/bm/`. `npx vitest run` checks the rules.
