#!/usr/bin/env bash
# ============================================================
# Connexion Training Hub — End-to-End Test Suite
# Run from your local machine (NOT the Cowork sandbox).
#
# Usage:
#   chmod +x run-tests.sh
#   BOT_API_KEY=your_key BOT_ID=your_bot_id ./run-tests.sh
# ============================================================

BASE="https://training-jade-ten.vercel.app"
API_KEY="${BOT_API_KEY:?Set BOT_API_KEY env var}"
BOT_ID="${BOT_ID:?Set BOT_ID env var}"
TRAINEE="TestUser_$(date +%s)"   # unique per run to avoid collisions
PASS=0
FAIL=0

ok()   { echo "  ✅  $1"; ((PASS++)); }
fail() { echo "  ❌  $1"; ((FAIL++)); }

assert_field() {
  local label="$1" json="$2" field="$3" expected="$4"
  local actual
  actual=$(echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$field','MISSING'))" 2>/dev/null)
  if [ "$actual" = "$expected" ]; then
    ok "$label → $field=$actual"
  else
    fail "$label → $field expected=$expected got=$actual"
    echo "       Response: $json" | head -c 300
  fi
}

assert_status() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    ok "$label → HTTP $actual"
  else
    fail "$label → HTTP expected=$expected got=$actual"
  fi
}

# ── Schema migration check ──────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo " STEP 0 — Schema (run these in Supabase SQL editor if not done)"
echo "═══════════════════════════════════════════"
cat << 'SQL'
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_stub boolean default false;
  ALTER TABLE trainee_progress ADD COLUMN IF NOT EXISTS score_sum int default 0;
  UPDATE trainee_progress SET score_sum = round(avg_score * total_sessions)
    WHERE score_sum = 0 OR score_sum IS NULL;
  ALTER TABLE taxonomy_items ADD COLUMN IF NOT EXISTS search_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('simple',
      coalesce(title,'') || ' ' || coalesce(description,''))) STORED;
  CREATE INDEX IF NOT EXISTS taxonomy_items_search_tsv_idx
    ON taxonomy_items USING gin(search_tsv);
SQL
echo "(skip if already applied)"

# ── Test 1: Missing API key → 401 ───────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo " TEST 1 — Auth: missing API key"
echo "═══════════════════════════════════════════"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/session" \
  -H "Content-Type: application/json" \
  -d '{"bot_id":"x"}')
assert_status "No API key" "$STATUS" "401"

# ── Test 2: Bad API key → 401 ───────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo " TEST 2 — Auth: invalid API key"
echo "═══════════════════════════════════════════"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/session" \
  -H "Content-Type: application/json" \
  -H "x-api-key: bad_key_definitely_wrong" \
  -d '{"bot_id":"x","tech_name":"x","pathway_stage":"stage_1","passed":true,"rubric_evidence":{},"severity_level":"low","impact_level":"low","priority_assigned":"P4"}')
assert_status "Bad API key" "$STATUS" "401"

# ── Test 3: Valid session — low/low → P4 correct ────────────
echo ""
echo "═══════════════════════════════════════════"
echo " TEST 3 — Valid session (low/low → P4 correct)"
echo "═══════════════════════════════════════════"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/session" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"bot_id\": \"$BOT_ID\",
    \"tech_name\": \"$TRAINEE\",
    \"pathway_stage\": \"stage_1\",
    \"passed\": true,
    \"rubric_evidence\": {
      \"greeted_professionally\": true,
      \"verified_identity\": true,
      \"showed_empathy\": true,
      \"confirmed_resolution\": false
    },
    \"checkpoints\": {
      \"opened_ticket\": true,
      \"set_correct_priority\": true
    },
    \"severity_level\": \"low\",
    \"impact_level\": \"low\",
    \"priority_assigned\": \"P4\",
    \"feedback_text\": \"Good call overall. Greeted well, verified identity. Did not confirm resolution.\",
    \"stronger_phrasing\": [\"I will make sure to follow up with you.\"],
    \"caller_name\": \"Jane Doe\",
    \"caller_company\": \"Acme Corp\"
  }")
HTTP_STATUS=$(echo "$RESP" | tail -1)
JSON=$(echo "$RESP" | head -n -1)
assert_status "Session POST" "$HTTP_STATUS" "200"
assert_field  "priority_correct=true" "$JSON" "priority_correct" "True"
assert_field  "pathway_pass returned" "$JSON" "pathway_pass" "True"
echo "  📋  Full response: $JSON" | head -c 400
echo ""

# Store session_id for later
SESSION_ID=$(echo "$JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id',''))" 2>/dev/null)

# ── Test 4: low/low with wrong priority → P4 incorrect ──────
echo ""
echo "═══════════════════════════════════════════"
echo " TEST 4 — SLA: low/low with P1 assigned → incorrect"
echo "═══════════════════════════════════════════"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/session" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"bot_id\": \"$BOT_ID\",
    \"tech_name\": \"${TRAINEE}_b\",
    \"pathway_stage\": \"stage_1\",
    \"passed\": false,
    \"rubric_evidence\": {},
    \"severity_level\": \"low\",
    \"impact_level\": \"low\",
    \"priority_assigned\": \"P1\",
    \"feedback_text\": \"Test\"
  }")
HTTP_STATUS=$(echo "$RESP" | tail -1)
JSON=$(echo "$RESP" | head -n -1)
assert_status "Session POST (wrong priority)" "$HTTP_STATUS" "200"
assert_field  "priority_correct=false" "$JSON" "priority_correct" "False"

# ── Test 5: high/high → P1 correct ──────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo " TEST 5 — SLA: high/high → P1"
echo "═══════════════════════════════════════════"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/session" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"bot_id\": \"$BOT_ID\",
    \"tech_name\": \"${TRAINEE}_c\",
    \"pathway_stage\": \"stage_1\",
    \"passed\": true,
    \"rubric_evidence\": {\"greeted_professionally\": true},
    \"severity_level\": \"high\",
    \"impact_level\": \"high\",
    \"priority_assigned\": \"P1\",
    \"feedback_text\": \"Test\"
  }")
HTTP_STATUS=$(echo "$RESP" | tail -1)
JSON=$(echo "$RESP" | head -n -1)
assert_status "Session POST (high/high)" "$HTTP_STATUS" "200"
assert_field  "priority_correct=true" "$JSON" "priority_correct" "True"

# ── Test 6: Progress stored correctly ───────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo " TEST 6 — Progress: GET /progress/{name}"
echo "═══════════════════════════════════════════"
sleep 1  # let DB write settle
RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/progress/$TRAINEE" \
  -H "x-api-key: $API_KEY")
HTTP_STATUS=$(echo "$RESP" | tail -1)
JSON=$(echo "$RESP" | head -n -1)
assert_status "Progress GET" "$HTTP_STATUS" "200"
TOTAL=$(echo "$JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total_sessions','MISSING'))" 2>/dev/null)
SCORE_SUM=$(echo "$JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('score_sum','MISSING'))" 2>/dev/null)
if [ "$TOTAL" = "1" ]; then
  ok "total_sessions=1 (progress persisted)"
else
  fail "total_sessions expected=1 got=$TOTAL"
fi
if [ "$SCORE_SUM" != "0" ] && [ "$SCORE_SUM" != "MISSING" ]; then
  ok "score_sum=$SCORE_SUM (non-zero, stored correctly)"
else
  fail "score_sum expected non-zero got=$SCORE_SUM"
fi
echo "  📋  Progress: $JSON" | head -c 400
echo ""

# ── Test 7: Duplicate name → 409 ────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo " TEST 7 — Duplicate name → 409 (needs 2 users with same name in DB)"
echo "═══════════════════════════════════════════"
echo "  ℹ️  Skipping (requires manual DB setup — create 2 users with same name)"

# ── Test 8: Stage mismatch warning ──────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo " TEST 8 — Stage mismatch warning"
echo "═══════════════════════════════════════════"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/session" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"bot_id\": \"$BOT_ID\",
    \"tech_name\": \"$TRAINEE\",
    \"pathway_stage\": \"stage_999\",
    \"passed\": true,
    \"rubric_evidence\": {},
    \"severity_level\": \"low\",
    \"impact_level\": \"low\",
    \"priority_assigned\": \"P4\",
    \"feedback_text\": \"Test mismatch\"
  }")
HTTP_STATUS=$(echo "$RESP" | tail -1)
JSON=$(echo "$RESP" | head -n -1)
assert_status "Stage mismatch POST" "$HTTP_STATUS" "200"
WARNING=$(echo "$JSON" | python3 -c "import sys,json; print(json.load(sys.stdin).get('warning','none'))" 2>/dev/null)
if echo "$WARNING" | grep -q "mismatch\|stage"; then
  ok "warning returned for stage mismatch: $WARNING"
else
  fail "expected stage mismatch warning, got: $WARNING"
fi

# ── Test 9: taxonomy/apply-change blocked (public) ──────────
echo ""
echo "═══════════════════════════════════════════"
echo " TEST 9 — /taxonomy/apply-change → 403 (public blocked)"
echo "═══════════════════════════════════════════"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/taxonomy/apply-change" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"change_id":"test"}')
assert_status "apply-change blocked" "$STATUS" "403"

# ── Test 10: taxonomy search ────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo " TEST 10 — Taxonomy search"
echo "═══════════════════════════════════════════"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/api/taxonomy/search?q=password" \
  -H "x-api-key: $API_KEY")
HTTP_STATUS=$(echo "$RESP" | tail -1)
JSON=$(echo "$RESP" | head -n -1)
assert_status "Taxonomy search" "$HTTP_STATUS" "200"
echo "  📋  Results: $JSON" | head -c 200
echo ""

# ── Summary ─────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo " RESULTS: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "  🎉  All tests passed!"
else
  echo "  ⚠️   $FAIL test(s) need attention"
fi
