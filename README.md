# California Driver's License Knowledge Test Prep

A fast, dependency-free practice-test web app for the California DMV knowledge test.
Static site hosted on Vercel at https://ca-dmv-test.dfrancour.dev; installable and fully offline as a PWA.

## Layout

```
site/                       # published as-is: no build step, no npm dependencies
  index.html  styles.css  app.js  sw.js  manifest.webmanifest
  handbook/ practice/ quiz/ results/ 404.html   # the pages, content and all (scripts/check.mjs --write)
  sitemap.xml robots.txt llms.txt     # for search engines and AI tools (likewise)
  og.png                    # the picture shown when a link is shared (scripts/og_image.py)
  precache.json             # every file the app uses, for offline (scripts/check.mjs --write)
  js/                       # router, addresses and titles, data loading, block rendering, progress, quiz logic, analytics
  js/views/                 # home, handbook contents, section reader, practice tests, quiz, results
  data/handbook/            # imported from the DMV: edition.json, sections/NN.json, figures/
  data/outline.json         # ours: each section's slug and reading units
  data/facts/               # ours: testable statements quoting the handbook
  data/questions/           # dmv-samples.json (imported), then ours
tests/                      # unit tests: node --test "tests/*.test.mjs"
scripts/
  dmv/fetch.py              # download the handbook and sample tests to .cache/
  dmv/import_handbook.py    # → data/handbook/ (keeps block ids across editions; needs Pillow)
  dmv/import_samples.py     # → data/questions/dmv-samples.json
  check.mjs                 # content checks, and builds the pages and precache (--write); the deploy runs it
  pages.mjs                 # the pages, sitemap, robots.txt and llms.txt, from the views
  stamp.mjs                 # stamps the commit into sw.js at deploy
  og_image.py               # draws site/og.png (needs Pillow)
  mark_quantities.py        # find facts' numbers in the handbook's words (marks)
  propose_skim.py           # which reading parts are skim, by the rule in docs/architecture.md
  eval/                     # blind samples and rater agreement (docs/evaluation.md)
  serve.py                  # dev server with live reload
docs/                       # architecture, questions, design, evaluation
AGENTS.md                   # start here: commands, rules, where things are
vercel.json                 # the deploy: build command, trailing slashes, headers
LICENSE                     # MIT, for the code (see "Licence" for the content)
```

## Local development

```sh
python3 scripts/serve.py          # http://127.0.0.1:8000
```

The dev server turns off caching and reloads open pages when anything in `site/` changes. Locally the service worker runs network-first, so you always see the current files.

## Conventions

- **Relative URLs only** (`styles.css`, not `/styles.css`), relative to the site's root, which every page's `<base href>` names.
- **Changed a view, the content, or a file in `site/`?** Run `node scripts/check.mjs --write` to rebuild the pages and `precache.json`. The deploy fails if they are out of date.
- **Cache versioning is automatic.** The build stamps the commit SHA into `sw.js` (`scripts/stamp.mjs`), so every deploy gets a fresh offline cache and installed apps show a "new version" prompt.

## Content

See [docs/architecture.md](docs/architecture.md) for the handbook, outline, facts and questions, and how a new edition of the handbook is brought in.

## Deployment

Vercel deploys each push to `main`, by `vercel.json`: the build runs the checks and the unit tests, stamps `sw.js`, and publishes `site/` as it is. If a check fails, nothing deploys. Other branches get preview addresses, which Vercel keeps out of search engines.

- **Trailing slashes are required.** `trailingSlash: true` sends `/handbook/x` to `/handbook/x/`; without the slash, each page's relative `<base href>` would point one level too high.
- **Only the site's own files load.** The Content-Security-Policy in `vercel.json` allows nothing from elsewhere, so a script, style, font or image from another address needs adding to it. It also blocks Vercel's toolbar on preview addresses.
- **Analytics.** `js/analytics.js`, on every page, loads Vercel Web Analytics and Speed Insights: anonymous visit counts and real visitors' page speed, without cookies. A browser sending Global Privacy Control or Do Not Track loads neither. Locally, `serve.py` answers `_vercel/` with empty scripts.

One-time setup (Add New → Project → import the repo; turn on Analytics and Speed Insights) and the rest of launch are in [docs/launch.md](docs/launch.md).

## Licence

- **The code** is MIT ([LICENSE](LICENSE)).
- **The handbook's text and figures** (`site/data/handbook/`, and the pages built from them) are the [California Driver's Handbook](https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/), © California DMV, licensed [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).
- **The DMV's sample questions** (`site/data/questions/dmv-samples.json`) are from the DMV's [sample knowledge tests](https://www.dmv.ca.gov/portal/driver-education-and-safety/educational-materials/sample-driver-license-dl-knowledge-tests/).
- **Our outline, facts, questions and explanations** (the rest of `site/data/`) adapt the handbook, and are licensed CC BY-NC 4.0 likewise.
