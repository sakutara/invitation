#!/usr/bin/env bash
# Publish dist/ (index.html, rsvp.html, invite.html + assets) to the gh-pages branch of the
# GitHub repo that serves https://invitation.fiddle.vn. Only dist/ is published — data/ (SQLite,
# guest phones/emails, original photos) and the source never leave this machine.
#
#   npm run deploy            # build from data/wedding.db, then publish
#   SKIP_BUILD=1 npm run deploy
set -euo pipefail

REPO="${DEPLOY_REPO:-git@github.com:sakutara/invitation.git}"
BRANCH="${DEPLOY_BRANCH:-gh-pages}"
DOMAIN="${DEPLOY_DOMAIN:-invitation.fiddle.vn}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="${WEDDING_DIST:-$ROOT/dist}"

if [ -z "${SKIP_BUILD:-}" ]; then
  (cd "$ROOT" && npm run --silent build)
fi

for page in index.html rsvp.html invite.html; do
  [ -f "$DIST/$page" ] || { echo "Missing $DIST/$page — build failed?" >&2; exit 1; }
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Reuse the published branch's history when it exists, otherwise start an orphan branch.
if git ls-remote --exit-code --heads "$REPO" "$BRANCH" >/dev/null 2>&1; then
  git clone --quiet --depth 1 --branch "$BRANCH" "$REPO" "$WORK/site"
else
  git init --quiet "$WORK/site"
  git -C "$WORK/site" checkout --quiet --orphan "$BRANCH"
  git -C "$WORK/site" remote add origin "$REPO"
fi

# Mirror dist/ into the checkout (deleting files that no longer exist), keeping .git.
rsync -a --delete --exclude '.git' "$DIST/" "$WORK/site/"
printf '%s\n' "$DOMAIN" > "$WORK/site/CNAME"
touch "$WORK/site/.nojekyll"

cd "$WORK/site"
git add -A
if git diff --cached --quiet; then
  echo "Nothing changed — https://$DOMAIN is already up to date."
  exit 0
fi
git commit --quiet -m "Deploy $(date '+%Y-%m-%d %H:%M:%S')"
git push --quiet origin "HEAD:$BRANCH"
echo "Published to https://$DOMAIN (GitHub Pages needs ~1 minute to update)."
