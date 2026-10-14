#!/bin/sh
# Sets the ?v= value behind main.css, boot.js and main.js in the HTML pages to a hash of the
# file content. Run it after editing one of those files: browsers and Cloudflare then fetch the
# new version right away instead of keeping the old one for up to a year (see server.ts).
set -eu
cd "$(dirname "$0")/public"
for f in assets/css/main.css assets/js/boot.js assets/js/main.js; do
  h=$(sha256sum "$f" | cut -c1-10)
  pat=$(printf '%s' "/$f" | sed 's/[.]/\\./g')
  for page in index.html 404.html; do
    sed -i -E "s#(${pat}\?v=)[A-Za-z0-9_]+#\1${h}#g" "$page"
  done
done
grep -ho '/assets/[a-z/]*\.[a-z]*?v=[A-Za-z0-9_.]*' index.html 404.html | sort -u
