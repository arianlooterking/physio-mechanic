/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

/*
 * How the site's JavaScript is split, so that a deploy that adds or edits lessons changes only a few
 * files and returning visitors (their service worker keeps every hashed file) download little again.
 *
 * File names carry a content hash, and a chunk that imports a changed chunk changes too (its import
 * names the new file). So the chunks are layered by how often they change, and nothing that changes
 * with lessons sits in a chunk that the stable chunks import:
 *   vendor           react, react-dom, motion: change only with a dependency upgrade
 *   math             katex with mhchem
 *   content-kit      content/build.ts and lib/fns.ts, the helpers the lesson files import. Kept apart from
 *                    glossary/intros/warmups, or every subject chunk would change on every deploy.
 *   content-<folder> one chunk per subject folder in src/content (content-zist3, content-physics, ...)
 *   content-shared   glossary, intros, warmups, books, fields: change whenever lessons are added
 *   content          the lesson registry, src/content/index.ts
 *   app-core         app code that reads no content at all (lib/, icons, plots, mascot art)
 *   app-ui           app code that reads only glossary/intros/warmups (Rich, Blocks, questions, widgets, labs)
 *   index            the entry: main.tsx, the screens that read the registry, and every module that imports
 *                    a stylesheet, so all CSS stays one file in its source order
 * Content still loads synchronously: every chunk is a static import, and index.html modulepreloads them all.
 * Imports only point down the app layers (index -> app-ui -> app-core) and from content to content-kit, so
 * the chunks cannot import each other in a cycle; the noChunkCycles check below stops the build if they do.
 */
const CONTENT = String.raw`[\\/]src[\\/]content[\\/]`;
const KIT = new RegExp(String.raw`[\\/]src[\\/](content[\\/](build|types)|lib[\\/]fns)\.ts$`);
const SHARED = new RegExp(CONTENT + String.raw`(glossary|intros|warmups|books|fields)\.ts$`);
const REGISTRY = new RegExp(CONTENT + String.raw`index\.ts$`);
const SUBJECT = new RegExp(CONTENT + String.raw`([^\\/]+)[\\/]`);
const CSS = /\.css($|\?)/;

type Graph = { getModuleInfo(id: string): { importedIds: readonly string[] } | null };
/** 2: reaches the lesson registry or a stylesheet; 1: reaches only glossary/intros/warmups/books/fields; 0: neither. */
type Level = 0 | 1 | 2;

/** How far into changing content an app module reaches through its static imports. */
function reach(id: string, graph: Graph, memo: Map<string, Level>): Level {
  const known = memo.get(id);
  if (known !== undefined) return known;
  const seen = new Set<string>([id]);
  const stack = [id];
  let level: Level = 0;
  while (stack.length && level < 2) {
    for (const dep of graph.getModuleInfo(stack.pop()!)?.importedIds ?? []) {
      if (seen.has(dep) || dep.includes('node_modules')) continue;
      seen.add(dep);
      if (REGISTRY.test(dep) || SUBJECT.test(dep) || CSS.test(dep)) level = 2;
      else if (SHARED.test(dep)) level = level || 1;
      else stack.push(dep);
    }
  }
  memo.set(id, level);
  return level;
}

/** The chunk a module goes to; null leaves it in the entry chunk. */
function chunkName(id: string, graph: Graph, memo: Map<string, Level>): string | null {
  if (CSS.test(id)) return null;
  if (id.includes('node_modules')) return /[\\/]node_modules[\\/]katex[\\/]/.test(id) ? 'math' : 'vendor';
  // Virtual helper modules (oxc's class-field helpers, framer-motion's optional-peer stub) go with the
  // packages; left in the entry they would make vendor and app-core import the entry back (a cycle).
  if ((id.startsWith('\0') || id.startsWith('__vite-optional-peer-dep')) && !id.includes('modulepreload-polyfill')) return 'vendor';
  if (KIT.test(id)) return 'content-kit';
  if (SHARED.test(id)) return 'content-shared';
  if (REGISTRY.test(id)) return 'content';
  const subject = SUBJECT.exec(id);
  if (subject) return `content-${subject[1]}`;
  if (!/[\\/]src[\\/]/.test(id)) return null;
  return (['app-core', 'app-ui', null] as const)[reach(id, graph, memo)];
}

/* Chunks that import each other in a cycle can run code before the code it uses has loaded
   ("Cannot access … before initialization"). Stop the build instead of shipping that. */
const noChunkCycles: Plugin = {
  name: 'biomana:no-chunk-cycles',
  applyToEnvironment: (env) => env.name === 'client',
  generateBundle(_, bundle) {
    const imports = new Map<string, string[]>();
    for (const out of Object.values(bundle)) if (out.type === 'chunk') imports.set(out.fileName, out.imports);
    const state = new Map<string, 'open' | 'done'>();
    const visit = (file: string, path: string[]) => {
      state.set(file, 'open');
      for (const dep of imports.get(file) ?? []) {
        if (state.get(dep) === 'open')
          this.error(`chunk import cycle: ${[...path.slice(path.indexOf(dep)), dep].join(' -> ')}. See chunkName in vite.config.ts.`);
        if (!state.has(dep)) visit(dep, [...path, dep]);
      }
      state.set(file, 'done');
    };
    for (const file of imports.keys()) if (!state.has(file)) visit(file, [file]);
  },
};

/* KaTeX's stylesheet lists each font as woff2, woff and ttf. Every browser that runs this app takes
   woff2, so the other two formats are dropped and never built or deployed. */
const katexWoff2Only: Plugin = {
  name: 'biomana:katex-woff2-only',
  enforce: 'pre',
  transform(code, id) {
    if (!/[\\/]katex[\\/]dist[\\/]katex(\.min)?\.css$/.test(id)) return null;
    return { code: code.replace(/,\s*url\([^)]*\.(woff|ttf)\)\s*format\(["'](woff|truetype)["']\)/g, ''), map: null };
  },
};

// The Cloudflare plugin runs worker/index.ts (the /api/* routes) next to the app in
// `npm run dev`, and builds the Worker together with the site. Tests run without it.
export default defineConfig(() => {
  const memo = new Map<string, Level>();
  return {
    base: process.env.PREVIEW_BASE ?? '/',
    plugins: [katexWoff2Only, react(), noChunkCycles, ...(process.env.VITEST ? [] : [cloudflare()])],
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 1600,
      assetsInlineLimit: 0,
    },
    environments: {
      client: {
        build: {
          rolldownOptions: {
            output: {
              codeSplitting: {
                // Each module goes exactly where chunkName puts it (not pulled in with the modules that import it).
                includeDependenciesRecursively: false,
                groups: [{ name: (id: string, ctx: Graph) => chunkName(id, ctx, memo), debugName: 'biomana' }],
              },
            },
          },
        },
      },
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    },
  };
});
