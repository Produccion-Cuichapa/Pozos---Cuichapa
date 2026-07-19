#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(date +%Y.%m.%d.%H%M%S)
UPDATED_AT=$(date --iso-8601=seconds)

echo "Nueva versión PWA: $VERSION"

cat > admin/version.json <<JSON
{
  "version": "$VERSION",
  "name": "Cuichapa Control",
  "updatedAt": "$UPDATED_AT"
}
JSON

python3 - "$VERSION" <<'PY'
from pathlib import Path
import re
import sys

version = sys.argv[1]

sw_path = Path("admin/sw.js")
js_path = Path("admin/js/admin-pwa.js")
html_path = Path("admin/index.html")

sw = sw_path.read_text(encoding="utf-8")
sw = re.sub(
    r"const CACHE_NAME = 'cuichapa-admin-[^']+';",
    f"const CACHE_NAME = 'cuichapa-admin-{version}';",
    sw,
    count=1
)
sw_path.write_text(sw, encoding="utf-8")

js = js_path.read_text(encoding="utf-8")
js = re.sub(
    r"const EMBEDDED_VERSION = '[^']+';",
    f"const EMBEDDED_VERSION = '{version}';",
    js,
    count=1
)
js_path.write_text(js, encoding="utf-8")

html = html_path.read_text(encoding="utf-8")

for filename in (
    "manifest.json",
    "icon-192.png",
    "admin-pwa.css",
    "admin-pwa.js"
):
    html = re.sub(
        rf"({re.escape(filename)})\?v=[^\"']+",
        rf"\1?v={version}",
        html
    )

html_path.write_text(html, encoding="utf-8")
PY

node --check admin/sw.js
node --check admin/js/admin-pwa.js
node --check admin/js/ui.js
node --check admin/js/app.js

echo "Sintaxis correcta."
echo "Desplegando Firebase Hosting..."

firebase deploy --only hosting

echo
echo "======================================"
echo "CUICHAPA CONTROL PUBLICADO"
echo "Versión: $VERSION"
echo "======================================"
