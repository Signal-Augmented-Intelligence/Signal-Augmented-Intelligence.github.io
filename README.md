# SAI Lab website

SAI Lab — Signal Augmented Intelligence, Hanshin University.
Site: https://signal-augmented-intelligence.github.io/ · Organization: https://github.com/Signal-Augmented-Intelligence

**Read `guideline.md` first.** It covers design rules, content formats, seminar uploads, review checklist and handover.

## Layout
| What | Where |
| --- | --- |
| All page content (lab, professor, members, research areas, publications, seminars, news, poem, album, home photos) | `content/` |
| Seminar PDFs, photos (members, album, home) | `public/files/seminars/`, `public/images/{people,album,home}/` |
| Pages (Next.js App Router) | `src/app/` |
| Shared components | `src/components/` |
| Content loaders, menus | `src/lib/content.ts`, `src/lib/site.ts` |
| Management screen | `admin/` (built separately from GitHub Pages) |
| Post-build checks | `scripts/check-site.py` |

## Develop
Node 22.
```sh
npm install
npm run dev      # http://localhost:3000
npm run build    # static export to out/
npm run check    # local links and personal-information patterns in out/
```

## Deploy
GitHub Actions (`.github/workflows/pages.yml`) builds every push and pull request; pushes to `main` deploy `out/`
to GitHub Pages (Settings → Pages → Source: GitHub Actions). `draft: true` in `content/lab.yml` keeps the site out
of search engines and adds a footer note.

Seminar files and other content are managed through the separate authenticated management screen. The legacy
Google Apps Script upload relay and `/upload/` page have been removed from this source tree.

Fonts (SIL Open Font License, via npm): Instrument Sans, Pretendard, STIX Two Text.
