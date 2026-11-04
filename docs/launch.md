# Launch

What's left to do now the site is live at **https://ca-dmv-test.dfrancour.dev**. The domain is set in one place, `ORIGIN` in `scripts/pages.mjs`.

## 1. Check it's right

- [ ] Share previews (https://www.opengraph.xyz) show the plate, the title and the description.
- [ ] A part and a questions page pass https://search.google.com/test/rich-results and https://validator.schema.org.
- [ ] Lighthouse at phone size, home page and a part: SEO and Accessibility 100, Performance in the 90s.
- [ ] On a phone, installed and in airplane mode: the home page, an unopened part and a test all work.

## 2. Search engines

- [ ] **Google Search Console:** add the site, submit the sitemap, and request indexing for the home page, the handbook contents and a few parts.
- [ ] **Bing Webmaster Tools:** import from Search Console and submit the sitemap.
- [ ] (Optional) **IndexNow** at each deploy.

## 3. Links in

- [ ] Link to the site from dfrancour.dev.
- [ ] Share it where people preparing for the test ask for help.

## 4. After two to four weeks

- [ ] Search Console → **Pages**: how many pages are indexed, especially the sections' questions pages.
- [ ] Search Console → **Performance**: which searches bring people in, to decide what to write next.
- [ ] Check whether AI search tools (ChatGPT, Perplexity, Claude) cite the site.

## Content to decide on

Each needs evaluating (`docs/evaluation.md`) and a design decision first.

- **A road-signs page**, from the handbook's sign figures and their alt text.
- **A page about the test itself** (how many questions, the pass mark, retakes), from Section 3's facts.
