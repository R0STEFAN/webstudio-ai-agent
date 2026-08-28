# 🧠 Webstudio & SEO Project Memory — tattoozp.com

## 1. Project Overview & Architecture
- **Website:** Tattoo Studio of Anna Sukhan in Zaporizhzhia (`https://tattoozp.com`)
- **Backend / CMS:** Directus API on PikaPod (`https://api.tattoozp.com/items`)
- **Visual Builder:** Webstudio Cloud (`https://p-fa99d4ff-ccf9-4c33-9b61-7ce9af9f8de2.apps.webstudio.is/?authToken=...`)
- **Frontend / Hosting:** React Router v7 (`@react-router/*`) deployed to Cloudflare Workers / Pages
- **Local MCP Toolkit:** 100% offline Webstudio MCP execution via `npx webstudio mcp single-op-call <tool> --input-file <payload.json>`

---

## 2. Key Tooling & CLI Commands

| Command | Purpose |
|---|---|
| `npx webstudio sync` | Pull latest visual edits from Webstudio Cloud into `.webstudio/data.json` |
| `npx webstudio import --to "<shareLink>"` | Push local `.webstudio/data.json` changes to Webstudio Cloud (with assets) |
| `npx webstudio build --template react-router --template react-router-cloudflare` | Generate React Router v7 + Cloudflare project code |
| `npm run dev` | Run local Vite development server (`http://localhost:5173`) |
| `npm run preview` | Run local production build preview (`react-router build && vite preview`) |
| `npm run deploy` | Build and deploy directly to Cloudflare Workers (`react-router build && wrangler deploy`) |
| `npm run index` | Push all sitemap URLs (excluding `/tattoo/*`) to **Google Indexing API** |
| `npm run index -- <URL>` | Push specific URL to Googlebot immediately |
| `npm run gsc` | Pull live **Google Search Console** query and performance analytics |
| `npm run gsc pages` | Pull top landing pages from Google Search Console |

---

## 3. SEO & Structural Implementations

1. **Schema.org JSON-LD:**
   - **Home (`/`):** `@graph` with `WebSite`, `TattooParlor` (вул. Олександрівська, 84, geo 47.8187, 35.1764, priceRange `500 - 15000 UAH`, phone `+380997538887`), and `FAQPage`.
   - **Gallery (`/gallery`):** `BreadcrumbList`, `CollectionPage`, and `FAQPage`.
   - **Blog (`/blog`):** `Blog` and `BreadcrumbList`.
   - **Single Post (`/blog/:slug`):** `BlogPosting` and `BreadcrumbList`.
   - **Single Tattoo (`/tattoo/:slug`):** `VisualArtwork` (`artform: Tattoo`, creator Anna Sukhan, directus image asset, price) + `BreadcrumbList`.
2. **Internal Linking & Navigation:**
   - **4-column SEO Footer:** Semantic links to Men's categories, Women's categories, Body zones, and studio info.
   - **Dynamic Zone Chips:** Horizontal single-line scroll strip (`overflow-x: auto`) bound to `MensPlacement` / `WomensPlacement` via `<ws.collection>`.
3. **AI Search (AEO/GEO):**
   - `/llms.txt`: Standard-compliant Markdown file (`llmstxt.org` specification with `[Title](URL)` links).
   - `/pricing.md`: Official pricing table, military discounts, and studio contact information.
4. **301 Redirects:**
   - `/blog/chy-bolyache-robyty-tatu` $\rightarrow$ `/blog/chy-diisno-bolyache-robyty-tatu`.

---

## 4. Critical Fixes & Gotchas Learned

1. **React Router v7 Dynamic Titles:**
   - In React Router v7, route titles and meta tags are populated during SSR and client navigation via `export const meta: MetaFunction<typeof loader>`.
   - Never insert dummy `HeadTitle` (`<title>Title</title>`) into `HeadSlot`, as React 19 hoists it and blocks dynamic page titles.
   - `scripts/setup-local-mcp.mjs` is patched (Step 7) to automatically configure full dynamic `meta` across all routes.
2. **Google Indexing API & Search Console:**
   - Service Account: `indexing-bot@indexing-bot-506915.iam.gserviceaccount.com` (configured as Owner in GSC).
   - Key file: `indexing-bot-*.json` in project root (ignored by `.gitignore`).
   - Both Indexing API and Search Console API are enabled in Google Cloud project `628235694633`.
3. **Robots.txt on Subdomain (`api.tattoozp.com`):**
   - Directus default `/robots.txt` had `Disallow: /`, which blocked Googlebot from crawling image assets.
   - Resolved via Cloudflare Worker Route on `api.tattoozp.com/robots.txt` returning `Allow: /assets/\nDisallow: /`.
4. **Favicon Persistence:**
   - Custom favicon is at `.webstudio/assets/favicon_bdXDkY8MiMEqsN_mdojqS.ico` (4.2 KB).
   - `scripts/setup-local-mcp.mjs` (Step 8) automatically syncs it into build template folders so it is never overwritten by Webstudio default.
