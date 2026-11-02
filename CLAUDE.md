# Biomana (بیومانا)

- Source of truth: https://github.com/arianlooterking/physio-mechanic, branch `main`.
- Built on the Fahmana engine (https://github.com/arianlooterking/fahmana). Engine fixes there can be ported here by hand.
- Content: musculoskeletal biomechanics for Persian-speaking physiotherapy students. All lesson text is original and follows
  only the chapter outline of *Basic Biomechanics of the Musculoskeletal System* (Nordin & Frankel, 5th ed., LWW).
  Never copy text, figures or problems from the book, and never add pirated copies of it to the repo.
- Lessons live in `src/content/bm/` (`lesson1.ts`…), grouped in `part1.ts` / `part2.ts`; glossary, intros and warmups in the same folder.
- Tests: `npx vitest run` (content rules are in `tests/content.test.ts`). Build: `npm run build`.
- Deploy: Cloudflare Worker `biomana` (`wrangler.jsonc`). Set the KV namespace id (`BIOMANA_KV`) before the first deploy.
- Never commit `.dev.vars` or any secret.
