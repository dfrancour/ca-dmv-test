# Launch

What's left to do to put the site live at **https://ca-dmv-test.dfrancour.dev**. The domain is set in one place, `ORIGIN` in `scripts/pages.mjs`.

## 1. Publish

- [ ] **Vercel → Add New → Project →** import `dfrancour/ca-dmv-test`, leaving the settings alone (`vercel.json` has them). Importing deploys `main`.
- [ ] Turn on **Analytics** and **Speed Insights** for the project, then redeploy so the scripts under `_vercel/` are served.
- [ ] **Domains →** add `ca-dmv-test.dfrancour.dev`. In Cloudflare, which holds `dfrancour.dev`'s DNS, add the record Vercel asks for (a CNAME named `ca-dmv-test`) with the proxy off, "DNS only", so Vercel can issue the certificate. Then set the project's `*.vercel.app` domain to redirect (308) to it, before sharing any address: progress is kept per domain, so anyone who starts on the `vercel.app` address would find it empty on the real one.

## 2. Check it's right

- [ ] `curl -s https://ca-dmv-test.dfrancour.dev/handbook/rules-of-the-road/signs/` returns 200 with the handbook text in the HTML; without the trailing slash, it redirects.
- [ ] An address that doesn't exist returns 404 with the "Page not found" page.
- [ ] The responses carry the `Content-Security-Policy` header, and the browser console shows nothing blocked on a part, a test and its results.
- [ ] Visits show in the project's **Analytics** tab.
- [ ] `robots.txt`, `sitemap.xml` and `llms.txt` load at the root.
- [ ] Share previews (https://www.opengraph.xyz) show the plate, the title and the description.
- [ ] A part and a questions page pass https://search.google.com/test/rich-results and https://validator.schema.org.
- [ ] Lighthouse at phone size, home page and a part: SEO and Accessibility 100, Performance in the 90s.
- [ ] On a phone, installed and in airplane mode: the home page, an unopened part and a test all work.

## 3. Search engines

- [ ] **Google Search Console:** add the site, submit the sitemap, and request indexing for the home page, the handbook contents and a few parts.
- [ ] **Bing Webmaster Tools:** import from Search Console and submit the sitemap.
- [ ] (Optional) **IndexNow** at each deploy.

## 4. Links in

- [ ] GitHub repo → **About**: the website, a one-line description, and topics (`california`, `dmv`, `drivers-license`, `practice-test`, `pwa`).
- [ ] Link to the site from dfrancour.dev.
- [ ] Share it where people preparing for the test ask for help.

## 5. After two to four weeks

- [ ] Search Console → **Pages**: how many pages are indexed, especially the sections' questions pages.
- [ ] Search Console → **Performance**: which searches bring people in, to decide what to write next.
- [ ] Check whether AI search tools (ChatGPT, Perplexity, Claude) cite the site.

## Content to decide on

Each needs evaluating (`docs/evaluation.md`) and a design decision first.

- **A road-signs page**, from the handbook's sign figures and their alt text.
- **A page about the test itself** (how many questions, the pass mark, retakes), from Section 3's facts.
