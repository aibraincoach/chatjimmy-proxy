#!/usr/bin/env bash
# --------------------------------------------------------------------------
# chatjimmy-proxy — live endpoint integration tests
#
# Usage:
#   ./test-endpoints.sh                          # test production
#   ./test-endpoints.sh http://localhost:3000     # test local dev
#
# Requirements: curl, jq
# --------------------------------------------------------------------------
set -euo pipefail

BASE_URL="${1:-https://chatjimmy-proxy-three.vercel.app}"
# Strip trailing slash
BASE_URL="${BASE_URL%/}"

# ── colours ──────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# ── counters ─────────────────────────────────────────────────────────────
PASS=0
FAIL=0
TOTAL=0

# ── dependency check ─────────────────────────────────────────────────────
for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo -e "${RED}✗ Missing required tool: ${cmd}${RESET}" >&2
    exit 1
  fi
done

# ── helpers ──────────────────────────────────────────────────────────────
pass() {
  PASS=$((PASS + 1))
  TOTAL=$((TOTAL + 1))
  echo -e "  ${GREEN}✓${RESET} $1"
}

fail() {
  FAIL=$((FAIL + 1))
  TOTAL=$((TOTAL + 1))
  echo -e "  ${RED}✗${RESET} $1"
}

section() {
  echo ""
  echo -e "${CYAN}${BOLD}── $1 ──${RESET}"
}

assert_eq() {
  local label="$1" actual="$2" expected="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label"
  else
    fail "$label (expected '$expected', got '$actual')"
  fi
}

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -qi "$needle"; then
    pass "$label"
  else
    fail "$label (expected to contain '$needle')"
  fi
}

assert_not_empty() {
  local label="$1" value="$2"
  if [[ -n "$value" ]]; then
    pass "$label"
  else
    fail "$label (value was empty)"
  fi
}

assert_starts_with() {
  local label="$1" value="$2" prefix="$3"
  if [[ "$value" == "$prefix"* ]]; then
    pass "$label"
  else
    fail "$label (expected to start with '$prefix', got '$value')"
  fi
}

assert_status() {
  local label="$1" actual="$2" expected="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label"
  else
    fail "$label (expected HTTP $expected, got HTTP $actual)"
  fi
}

# ── banner ───────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}chatjimmy-proxy integration tests${RESET}"
echo -e "Target: ${CYAN}${BASE_URL}${RESET}"
echo -e "Date:   $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# =========================================================================
# 1. GET /api/health
# =========================================================================
section "1. GET /api/health"

HEALTH_RESP=$(curl -sf -w "\n%{http_code}" "$BASE_URL/api/health" --max-time 30 2>/dev/null) || HEALTH_RESP=$'\n000'
HEALTH_STATUS=$(echo "$HEALTH_RESP" | tail -1)
HEALTH_BODY=$(echo "$HEALTH_RESP" | sed '$d')

assert_status "HTTP 200" "$HEALTH_STATUS" "200"

if [[ "$HEALTH_STATUS" == "200" ]]; then
  PROXY_VAL=$(echo "$HEALTH_BODY" | jq -r '.proxy // empty' 2>/dev/null)
  assert_eq "proxy is \"ok\"" "$PROXY_VAL" "ok"

  LATENCY_VAL=$(echo "$HEALTH_BODY" | jq -r '.latencyMs // empty' 2>/dev/null)
  assert_not_empty "latencyMs present" "$LATENCY_VAL"

  UPSTREAM_STATUS=$(echo "$HEALTH_BODY" | jq -r '.upstreamStatus // empty' 2>/dev/null)
  assert_eq "upstreamStatus is 200" "$UPSTREAM_STATUS" "200"

  ENDPOINTS_LEN=$(echo "$HEALTH_BODY" | jq -r '.endpoints | length // 0' 2>/dev/null)
  if [[ "$ENDPOINTS_LEN" -gt 0 ]]; then
    pass "endpoints list present ($ENDPOINTS_LEN endpoints)"
  else
    fail "endpoints list present (none found)"
  fi
fi

# =========================================================================
# 2. GET /api/models
# =========================================================================
section "2. GET /api/models"

MODELS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/models" --max-time 30 2>/dev/null) || MODELS_STATUS="000"
assert_status "HTTP 200" "$MODELS_STATUS" "200"

# =========================================================================
# 3. POST /api/chat (streaming)
# =========================================================================
section "3. POST /api/chat (streaming)"

STREAM_BODY=$(curl -sN -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"Say hi","history":[]}' \
  --max-time 30 2>/dev/null) || STREAM_BODY=""

if [[ -n "$STREAM_BODY" ]]; then
  pass "non-empty streaming response received"
else
  fail "non-empty streaming response received (body was empty)"
fi

# =========================================================================
# 4. POST /api/chat?format=json
# =========================================================================
section "4. POST /api/chat?format=json"

JSON_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/chat?format=json" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is 1+1?","history":[]}' \
  --max-time 30 2>/dev/null) || JSON_RESP=$'\n000'
JSON_STATUS=$(echo "$JSON_RESP" | tail -1)
JSON_BODY=$(echo "$JSON_RESP" | sed '$d')

assert_status "HTTP 200" "$JSON_STATUS" "200"

if [[ "$JSON_STATUS" == "200" ]]; then
  OBJ=$(echo "$JSON_BODY" | jq -r '.object // empty' 2>/dev/null)
  assert_eq "object is \"chat.completion\"" "$OBJ" "chat.completion"

  ROLE=$(echo "$JSON_BODY" | jq -r '.choices[0].message.role // empty' 2>/dev/null)
  assert_eq "choices[0].message.role is \"assistant\"" "$ROLE" "assistant"

  CONTENT=$(echo "$JSON_BODY" | jq -r '.choices[0].message.content // empty' 2>/dev/null)
  assert_not_empty "content present" "$CONTENT"

  FINISH=$(echo "$JSON_BODY" | jq -r '.choices[0].finish_reason // empty' 2>/dev/null)
  assert_not_empty "finish_reason present" "$FINISH"

  MODEL=$(echo "$JSON_BODY" | jq -r '.model // empty' 2>/dev/null)
  assert_not_empty "model present" "$MODEL"

  ID_VAL=$(echo "$JSON_BODY" | jq -r '.id // empty' 2>/dev/null)
  assert_not_empty "id present" "$ID_VAL"
fi

# =========================================================================
# 5. POST /v1/chat/completions (non-streaming)
# =========================================================================
section "5. POST /v1/chat/completions (non-streaming)"

V1_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.1-8B","messages":[{"role":"user","content":"Say hello"}],"stream":false}' \
  --max-time 30 2>/dev/null) || V1_RESP=$'\n000'
V1_STATUS=$(echo "$V1_RESP" | tail -1)
V1_BODY=$(echo "$V1_RESP" | sed '$d')

assert_status "HTTP 200" "$V1_STATUS" "200"

if [[ "$V1_STATUS" == "200" ]]; then
  V1_ID=$(echo "$V1_BODY" | jq -r '.id // empty' 2>/dev/null)
  assert_starts_with "id starts with \"chatcmpl-\"" "$V1_ID" "chatcmpl-"

  V1_OBJ=$(echo "$V1_BODY" | jq -r '.object // empty' 2>/dev/null)
  assert_eq "object is \"chat.completion\"" "$V1_OBJ" "chat.completion"

  V1_CONTENT=$(echo "$V1_BODY" | jq -r '.choices[0].message.content // empty' 2>/dev/null)
  assert_not_empty "content present" "$V1_CONTENT"

  V1_FINISH=$(echo "$V1_BODY" | jq -r '.choices[0].finish_reason // empty' 2>/dev/null)
  assert_eq "finish_reason is \"stop\"" "$V1_FINISH" "stop"

  V1_USAGE=$(echo "$V1_BODY" | jq -r '.usage // empty' 2>/dev/null)
  assert_not_empty "usage present" "$V1_USAGE"
fi

# =========================================================================
# 6. POST /v1/chat/completions (streaming / SSE)
# =========================================================================
section "6. POST /v1/chat/completions (streaming)"

SSE_BODY=$(curl -sN -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.1-8B","messages":[{"role":"user","content":"Say hi"}],"stream":true}' \
  --max-time 30 2>/dev/null) || SSE_BODY=""

# Check for "data: " lines
DATA_LINES=$(echo "$SSE_BODY" | grep -c "^data: " 2>/dev/null) || DATA_LINES=0
if [[ "$DATA_LINES" -gt 0 ]]; then
  pass "SSE format: $DATA_LINES data: lines found"
else
  fail "SSE format: no data: lines found"
fi

# Check for chat.completion.chunk objects
CHUNK_COUNT=$(echo "$SSE_BODY" | grep -o '"chat.completion.chunk"' | wc -l 2>/dev/null) || CHUNK_COUNT=0
if [[ "$CHUNK_COUNT" -gt 0 ]]; then
  pass "chat.completion.chunk objects present ($CHUNK_COUNT)"
else
  fail "chat.completion.chunk objects present (none found)"
fi

# Check for finish_reason "stop" in a chunk
if echo "$SSE_BODY" | grep -q '"finish_reason".*"stop"'; then
  pass "finish_reason \"stop\" chunk found"
else
  fail "finish_reason \"stop\" chunk found"
fi

# Check for [DONE] sentinel
if echo "$SSE_BODY" | grep -q '^\[DONE\]\|^data: \[DONE\]'; then
  pass "[DONE] sentinel present"
else
  fail "[DONE] sentinel present"
fi

# =========================================================================
# 7. System prompt extraction
# =========================================================================
section "7. System prompt extraction"

SYS_RESP=$(curl -s -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.1-8B","messages":[{"role":"system","content":"You must respond with ONLY the word PINEAPPLE"},{"role":"user","content":"Go"}],"stream":false}' \
  --max-time 30 2>/dev/null) || SYS_RESP=""

SYS_CONTENT=$(echo "$SYS_RESP" | jq -r '.choices[0].message.content // empty' 2>/dev/null)
if echo "$SYS_CONTENT" | grep -qi "PINEAPPLE"; then
  pass "response contains PINEAPPLE"
else
  fail "response contains PINEAPPLE (got: '${SYS_CONTENT:0:100}')"
fi

# =========================================================================
# 8. Input validation
# =========================================================================
section "8. Input validation"

# 8a. Empty message → 400
VAL_EMPTY=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"","history":[]}' \
  --max-time 10 2>/dev/null) || VAL_EMPTY="000"
assert_status "empty message returns 400" "$VAL_EMPTY" "400"

# 8b. Whitespace-only message → 400
VAL_WS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"   ","history":[]}' \
  --max-time 10 2>/dev/null) || VAL_WS="000"
assert_status "whitespace-only message returns 400" "$VAL_WS" "400"

# 8c. Missing messages array (/v1) → 400
VAL_MISSING=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.1-8B"}' \
  --max-time 10 2>/dev/null) || VAL_MISSING="000"
assert_status "missing messages array returns 400" "$VAL_MISSING" "400"

# 8d. Empty messages array (/v1) → 400
VAL_EMPTY_ARR=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3.1-8B","messages":[]}' \
  --max-time 10 2>/dev/null) || VAL_EMPTY_ARR="000"
assert_status "empty messages array returns 400" "$VAL_EMPTY_ARR" "400"

# 8e. Oversized message (15k chars) → 400
BIG_MSG=$(printf 'A%.0s' $(seq 1 15000))
VAL_BIG=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$BIG_MSG\",\"history\":[]}" \
  --max-time 10 2>/dev/null) || VAL_BIG="000"
assert_status "oversized message (15k chars) returns 400" "$VAL_BIG" "400"

# =========================================================================
# 9. CORS
# =========================================================================
section "9. CORS"

CORS_HEADERS=$(curl -sI -X OPTIONS "$BASE_URL/api/chat" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  --max-time 10 2>/dev/null) || CORS_HEADERS=""

if echo "$CORS_HEADERS" | grep -qi "Access-Control-Allow-Origin"; then
  pass "Access-Control-Allow-Origin header present"
else
  fail "Access-Control-Allow-Origin header present"
fi

if echo "$CORS_HEADERS" | grep -qi "Access-Control-Allow-Methods"; then
  pass "Access-Control-Allow-Methods header present"
else
  fail "Access-Control-Allow-Methods header present"
fi

# =========================================================================
# 10. Concurrency
# =========================================================================
section "10. Concurrency (10 simultaneous requests)"

CONC_DIR=$(mktemp -d)
CONC_START=$(date +%s)

for i in $(seq 1 10); do
  (
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/chat?format=json" \
      -H "Content-Type: application/json" \
      -d "{\"message\":\"Say $i\",\"history\":[]}" \
      --max-time 30 2>/dev/null) || HTTP_CODE="000"
    echo "$HTTP_CODE" > "$CONC_DIR/$i"
  ) &
done
wait

CONC_END=$(date +%s)

CONC_OK=0
CONC_FAIL=0
for i in $(seq 1 10); do
  CODE=$(cat "$CONC_DIR/$i" 2>/dev/null || echo "000")
  if [[ "$CODE" == "200" ]]; then
    CONC_OK=$((CONC_OK + 1))
  else
    CONC_FAIL=$((CONC_FAIL + 1))
  fi
done
rm -rf "$CONC_DIR"

if [[ "$CONC_START" != "0" && "$CONC_END" != "0" ]]; then
  CONC_ELAPSED_MS=$(( (CONC_END - CONC_START) * 1000 ))
  echo -e "  ${CYAN}→${RESET} Completed in ${CONC_ELAPSED_MS}ms"
fi

TOTAL=$((TOTAL + 1))
if [[ "$CONC_OK" -eq 10 ]]; then
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}✓${RESET} All 10/10 requests succeeded"
else
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}✗${RESET} $CONC_OK/10 succeeded, $CONC_FAIL/10 failed"
fi

# =========================================================================
# 11. Latency benchmark
# =========================================================================
section "11. Latency benchmark (5 sequential requests)"

LATENCY_SUM=0
for i in $(seq 1 5); do
  REQ_START=$(date +%s)
  curl -s -o /dev/null -X POST "$BASE_URL/api/chat?format=json" \
    -H "Content-Type: application/json" \
    -d '{"message":"ping","history":[]}' \
    --max-time 30 2>/dev/null || true
  REQ_END=$(date +%s)

  if [[ "$REQ_START" != "0" && "$REQ_END" != "0" ]]; then
    REQ_MS=$(( (REQ_END - REQ_START) * 1000 ))
    LATENCY_SUM=$((LATENCY_SUM + REQ_MS))
    echo -e "  ${CYAN}→${RESET} Request $i: ${REQ_MS}ms"
  else
    echo -e "  ${CYAN}→${RESET} Request $i: (timing unavailable)"
  fi
done

if [[ "$LATENCY_SUM" -gt 0 ]]; then
  AVG_MS=$((LATENCY_SUM / 5))
  echo -e "  ${CYAN}→${RESET} Average: ${AVG_MS}ms"
fi

# =========================================================================
# Summary
# =========================================================================
echo ""
echo -e "${BOLD}── Summary ──${RESET}"
echo -e "  Target:  ${CYAN}${BASE_URL}${RESET}"
echo -e "  Total:   ${TOTAL}"
echo -e "  Passed:  ${GREEN}${PASS}${RESET}"
echo -e "  Failed:  ${RED}${FAIL}${RESET}"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo -e "${RED}${BOLD}FAIL${RESET} — $FAIL test(s) failed"
  exit 1
else
  echo -e "${GREEN}${BOLD}PASS${RESET} — all $TOTAL tests passed"
  exit 0
fi
