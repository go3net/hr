#!/usr/bin/env bash
#
# Set an environment variable on one Railway service.
#
# Railway's dashboard is the normal place for this. The script exists for the
# variables that belong with a code change — a feature flag shipped alongside
# the feature — so the value is set by the same run that deploys the code
# rather than by hand afterwards, when it is easy to forget.
#
# Railway restarts the service when a variable changes, so the value goes live
# on its own. Set REDEPLOY=1 to force a deploy as well.
#
# Usage:
#   RAILWAY_TOKEN=... ./infrastructure/railway/set-variable.sh api PLATFORM_OWNER_EMAILS you@example.com
#
# Never pass a secret through a GitHub Actions input — inputs are recorded in
# the run's metadata in plain text. Secrets belong in the Railway dashboard.
#
set -euo pipefail

API=https://backboard.railway.com/graphql/v2
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$HERE/services.json"

: "${RAILWAY_TOKEN:?RAILWAY_TOKEN is required}"

SERVICE_NAME="${1:?service name is required (api, worker, scheduler, reverb, web)}"
VAR_NAME="${2:?variable name is required}"
VAR_VALUE="${3-}"
REDEPLOY="${REDEPLOY:-0}"

read -r PROJECT_ID ENVIRONMENT_ID SERVICE_ID <<<"$(python3 -c "
import json, sys
cfg = json.load(open('$CONFIG'))
match = [s for s in cfg['services'] if s['name'] == '$SERVICE_NAME']
if not match:
    sys.exit('unknown service: $SERVICE_NAME')
print(cfg['projectId'], cfg.get('environmentId'), match[0]['id'])
")"

echo "→ $VAR_NAME on $SERVICE_NAME ($SERVICE_ID)"

# The value goes through a JSON file rather than string interpolation so a
# comma-separated list, a URL or anything with quotes in it survives intact.
python3 - "$PROJECT_ID" "$ENVIRONMENT_ID" "$SERVICE_ID" "$VAR_NAME" "$VAR_VALUE" <<'PY' > /tmp/railway-variable.json
import json, sys

project, environment, service, name, value = sys.argv[1:6]
print(json.dumps({
    "query": """
      mutation SetVariable($input: VariableUpsertInput!) {
        variableUpsert(input: $input)
      }
    """,
    "variables": {"input": {
        "projectId": project,
        "environmentId": environment,
        "serviceId": service,
        "name": name,
        "value": value,
    }},
}))
PY

response=$(curl -sS -X POST "$API" \
  -H "Content-Type: application/json" \
  -H "Project-Access-Token: $RAILWAY_TOKEN" \
  --retry 3 --retry-delay 2 --retry-connrefused \
  -d @/tmp/railway-variable.json)

python3 -c "
import json, sys
body = json.loads(sys.argv[1])
if body.get('errors'):
    sys.exit('✗ Railway rejected the change: ' + json.dumps(body['errors']))
print('✓ variable set')
" "$response"

# Railway restarts the service itself when a variable changes, so the value is
# live without any help from us. Triggering our own deploy on top of that races
# the restart: whichever one Railway keeps supersedes the other, the loser ends
# as REMOVED, and the script reports a failure for work that actually
# succeeded. Off by default for that reason — REDEPLOY=1 forces one anyway.
if [ "$REDEPLOY" = "1" ]; then
  echo "→ forcing a redeploy of $SERVICE_NAME (may race Railway's own restart)"
  ONLY="$SERVICE_NAME" "$HERE/deploy.sh"
else
  echo "→ Railway restarts $SERVICE_NAME on its own to pick the value up"
fi
