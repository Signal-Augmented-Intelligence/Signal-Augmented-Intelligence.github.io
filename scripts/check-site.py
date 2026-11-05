"""Checks for the SAI Lab site (guideline.md section 8).

Run after `npm run build` (static export in out/). Checks rendered routes, internal links and anchors, and
personal-information patterns on rendered pages. Data files are not validated here.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
import re
import json
import os

ROOT = Path('out')
ORIGIN = 'https://lab.invalid'
ROUTES = ('index.html', 'members/professor/index.html', 'members/our-team/index.html',
          'members/alumni/index.html', 'research/index.html', 'research/publications/index.html',
          'seminars/index.html', 'news/index.html', 'notices/index.html', 'album/index.html', 'contact/index.html', '404.html')
# Personal-information patterns that must never appear on a rendered page.
PRIVATE = {
    'phone number': re.compile(r'\b01[016789][- .]?\d{3,4}[- .]?\d{4}\b'),
    'resident registration number': re.compile(r'\b\d{6}-[1-4]\d{6}\b'),
    'personal email': re.compile(r'[\w.+-]+@(gmail|naver|daum|hanmail|kakao|nate|hotmail|outlook|yahoo)\.(com|net)', re.I),
}
errors = []
MEDIA_DELIVERY = json.loads(Path('content/media-delivery.json').read_text())
EXTERNAL_MEDIA = bool(MEDIA_DELIVERY['base_url'])
SKIP_PRIVATE_MEDIA = (MEDIA_DELIVERY.get('mode') == 'pages_artifact' and
                      os.environ.get('SAI_SKIP_PRIVATE_MEDIA_CHECK') == '1')
MANAGED_MEDIA = re.compile(r'^/(?:files/(?:seminars|publications)|images/(?:seminars|people|home|album|figures|notices))/')


# ---- rendered site ----
class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids, self.links = set(), []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.add(attrs['id'])
        for key in ('href', 'src'):
            if attrs.get(key):
                self.links.append(attrs[key])


pages = {p: Page(p.read_text()) for p in ROOT.rglob('*.html')}
for path, page in pages.items():
    source_url = ORIGIN + '/' + str(path.relative_to(ROOT)).removesuffix('index.html')
    for link in page.links:
        if EXTERNAL_MEDIA and MANAGED_MEDIA.match(link):
            errors.append(f'{path}: managed media still uses GitHub Pages: {link}')
        parsed = urlsplit(urljoin(source_url, link))
        if f'{parsed.scheme}://{parsed.netloc}' != ORIGIN:
            continue
        target = ROOT / unquote(parsed.path).lstrip('/')
        if target.is_dir():
            target = target / 'index.html'
        if not target.is_file() and SKIP_PRIVATE_MEDIA and MANAGED_MEDIA.match(parsed.path):
            continue
        if not target.is_file():
            errors.append(f'{path}: missing {link}')
        elif parsed.fragment and target in pages and unquote(parsed.fragment) not in pages[target].ids:
            errors.append(f'{path}: missing anchor {link}')
    text = path.read_text()
    for name, pattern in PRIVATE.items():
        if pattern.search(text):
            errors.append(f'{path}: looks like a {name}')

errors += [f'Missing route: {r}' for r in ROUTES if not (ROOT / r).is_file()]
if errors:
    raise SystemExit('\n'.join(errors))
print(f'Checked {len(pages)} pages.')
