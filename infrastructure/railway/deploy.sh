#!/usr/bin/env bash
#
# Deploy the Go3net Office stack to Railway.
#
# Railway's own push-to-deploy needs a webhook that only an account-level
# token can create; the project token we use can deploy but not create
# triggers. This script fills that gap and is driven by
# .github/workflows/railway-deploy.yml after CI passes on main.
#
# Usage (locally):
#   RAILWAY_TOKEN=... ./infrastructure/railway/deploy.sh
#   RAILWAY_TOKEN=... COMMIT_SHA=abc123 ONLY=api,web ./infrastructure/railway/deploy.sh
#
set -euo pipefail

API=https://backboard.railway.com/graphql/v2
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$HERE/services.json"

: "${RAILWAY_TOKEN:?RAILWAY_TOKEN is required}"
COMMIT_SHA="${COMMIT_SHA:-$(git rev-parse HEAD)}"
ONLY="${ONLY:-}"

ENVIRONMENT_ID="${RAILWAY_ENVIRONMENT_ID:-$(python3 -c "
import json; print(json.load(open('$CONFIG'))['environmentId'])")}"

# Wait this long for a single service to build and boot before giving up.
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-900}"
POLL_SECONDS=15

# Railway occasionally answers with something that is not JSON at all — an
# empty body, or a gateway's HTML — and curl's own --retry does not cover that
# because the request itself succeeded. Left unhandled it surfaces as a Python
# stack trace and a deploy that fails for no stated reason, so retry on an
# unparseable body and, if it never parses, say what actually came back.
gql() {
  python3 - "$1" <<'PY' > /tmp/railway-query.json
import json, sys
print(json.dumps({"query": sys.argv[1]}))
PY

  local attempt body
  for attempt in 1 2 3 4; do
    body=$(curl -sS -X POST "$API" \
      -H "Content-Type: application/json" \
      -H "Project-Access-Token: $RAILWAY_TOKEN" \
      --retry 3 --retry-delay 2 --retry-connrefused \
      -d @/tmp/railway-query.json)

    if printf '%s' "$body" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
      printf '%s' "$body"
      return 0
    fi

    echo "  … Railway returned a non-JSON response (attempt $attempt), retrying" >&2
    sleep $((attempt * 5))
  done

  echo "✗ Railway kept returning something that is not JSON. Last response:" >&2
  printf '%s\n' "${body:0:300}" >&2

  return 1
}

# Reads a dotted path out of a GraphQL response, failing loudly if the
# response carries errors instead of data.
extract() {
  python3 -c "
import json, sys
body = json.load(sys.stdin)
if body.get('errors'):
    sys.exit('Railway API error: ' + json.dumps(body['errors']))
node = body.get('data') or {}
for key in sys.argv[1].split('.'):
    if node is None:
        sys.exit('Unexpected response shape at ' + sys.argv[1])
    node = node.get(key)
print(node if node is not None else '')
" "$1"
}

deploy_service() {
  local name="$1" id="$2"

  echo "→ $name: triggering deploy of ${COMMIT_SHA:0:8}"
  local deployment_id
  deployment_id=$(gql "mutation { serviceInstanceDeployV2(
      serviceId: \"$id\",
      environmentId: \"$ENVIRONMENT_ID\",
      commitSha: \"$COMMIT_SHA\"
    ) }" | extract serviceInstanceDeployV2)

  if [ -z "$deployment_id" ]; then
    echo "✗ $name: Railway did not return a deployment id" >&2
    return 1
  fi

  local waited=0 status=""
  while [ "$waited" -lt "$TIMEOUT_SECONDS" ]; do
    status=$(gql "query { deployment(id: \"$deployment_id\") { status } }" \
      | extract deployment.status)

    case "$status" in
      SUCCESS)
        echo "✓ $name: deployed ($deployment_id)"
        return 0
        ;;
      FAILED | CRASHED | REMOVED)
        echo "✗ $name: $status — https://railway.com/project/${PROJECT_ID:-}/service/$id" >&2
        return 1
        ;;
    esac

    sleep "$POLL_SECONDS"
    waited=$((waited + POLL_SECONDS))
  done

  echo "✗ $name: still $status after ${TIMEOUT_SECONDS}s" >&2
  return 1
}

# Resolved in its own step, not inside a process substitution, so that a
# bad ONLY= filter aborts here instead of quietly deploying nothing.
if ! resolved=$(python3 -c "
import json, os, sys
config = json.load(open('$CONFIG'))
only = [s.strip() for s in os.environ.get('ONLY', '').split(',') if s.strip()]
unknown = set(only) - {s['name'] for s in config['services']}
if unknown:
    sys.exit('Unknown service(s): ' + ', '.join(sorted(unknown)))
for s in config['services']:
    if not only or s['name'] in only:
        print(s['name'] + ' ' + s['id'])
"); then
  echo "✗ could not resolve which services to deploy" >&2
  exit 1
fi

mapfile -t TARGETS <<<"$resolved"

if [ -z "$resolved" ] || [ ${#TARGETS[@]} -eq 0 ]; then
  echo "✗ no services matched — refusing to report success" >&2
  exit 1
fi

echo "Deploying ${#TARGETS[@]} service(s) at ${COMMIT_SHA:0:8}"

failed=()
for entry in "${TARGETS[@]}"; do
  read -r name id <<<"$entry"

  if ! deploy_service "$name" "$id"; then
    failed+=("$name")
    # api carries the migrations; if it is broken the rest would boot
    # against a schema that does not match their code.
    if [ "$name" = "api" ]; then
      echo "✗ api failed — skipping the remaining services" >&2
      break
    fi
  fi
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "Failed: ${failed[*]}" >&2
  exit 1
fi

echo "All services deployed."
