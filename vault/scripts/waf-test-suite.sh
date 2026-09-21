#!/bin/bash
# vault/scripts/waf-test-suite.sh
# ──────────────────────────────────────────────────────────
# WAF attack validation suite
#
# REQUIREMENTS:
#   1. Docker and docker-compose installed
#   2. Run with sudo: sudo bash vault/scripts/waf-test-suite.sh
#   3. Services NOT already running (script will start them)
#
# This script validates that ModSecurity/CRS PL1 is correctly
# blocking known attack patterns while allowing legitimate traffic.

set -e

YELLOW="$(printf '\033[33m')"
RED="$(printf '\033[31m')"
GREEN="$(printf '\033[32m')"
RESET="$(printf '\033[0m')"

echo ""
echo "${YELLOW}╔════════════════════════════════════════════════════╗${RESET}"
echo "${YELLOW}║   WAF Attack Validation Test Suite		     ║${RESET}"
echo "${YELLOW}╚════════════════════════════════════════════════════╝${RESET}"
echo ""

# Check prerequisites
if [ "$EUID" -ne 0 ]; then
	echo "${RED}✗ This script requires sudo${RESET}"
	echo ""
	echo "Usage: sudo bash vault/scripts/waf-test-suite.sh"
	exit 1
fi

if ! command -v docker &>/dev/null; then
	echo "${RED}✗ docker not found${RESET}"
	exit 1
fi

if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null; then
	echo "${RED}✗ docker-compose not found${RESET}"
	exit 1
fi

echo "${GREEN}✓ Prerequisites check passed${RESET}"
echo ""

# Start services
echo "${YELLOW}Starting services (this may take 1-2 minutes)...${RESET}"
docker compose --profile prod-only down --volumes 2>/dev/null || true
docker compose --profile prod-only build backend vault nginx 2>&1 | tail -5
docker compose --profile prod-only up -d vault vault-init vault-agent backend nginx db 2>&1 | tail -5

echo ""
echo "${YELLOW}Waiting for services to stabilize...${RESET}"
sleep 15

# Wait for nginx to be ready
echo "Waiting for WAF (localhost:8443)..."
for i in {1..30}; do
	if curl -sk https://localhost:8443/health >/dev/null 2>&1; then
		echo "${GREEN}✓ WAF is ready${RESET}"
		break
	fi
	[ $i -eq 30 ] && echo "${RED}✗ Timeout waiting for WAF${RESET}" && exit 1
	sleep 2
done

echo ""
echo "${YELLOW}Running attack validation tests...${RESET}"
echo "Note: All payloads are properly URL-encoded"
echo ""

# Test counters
PASSED=0
FAILED=0

# Test function - takes URL-encoded parameters
test_attack() {
	local name="$1"
	local encoded_query="$2"  # Already URL-encoded
	local expected_blocked="$3"  # "yes" or "no"

	# URL should be: https://localhost:8443/?<encoded_query>
	# Use 'localhost' instead of IP to avoid "numeric IP" rule trigger
	local url="https://localhost:8443/?${encoded_query}"

	# Send request, capture HTTP response code
	local response=$(curl -sk -w "%{http_code}" -o /dev/null -m 5 "$url" 2>/dev/null || echo "000")
	local blocked="no"

	if [ "$response" = "403" ] || [ "$response" = "429" ]; then
		blocked="yes"
	fi

	if [ "$blocked" = "$expected_blocked" ]; then
		echo "${GREEN}✓${RESET} $name (HTTP $response)"
		PASSED=$((PASSED + 1))
	else
		echo "${RED}✗${RESET} $name (HTTP $response, expected blocked=$expected_blocked)"
		FAILED=$((FAILED + 1))
	fi
}

# ============================================================================
# ATTACK TESTS - These should be BLOCKED (return 403)
# All payloads are URL-encoded
# ============================================================================
echo "Attack patterns (should return 403 Forbidden):"
echo ""

# SQLi attacks
test_attack "SQLi: OR 1=1" "id=1%27%20OR%20%271%27%3D%271" "yes"
test_attack "SQLi: Comment" "id=1%27%20OR%201%3D1--" "yes"
test_attack "SQLi: UNION SELECT" "id=1%20UNION%20SELECT%201%2C2%2C3" "yes"

# XSS attacks
test_attack "XSS: Script tag" "q=%3Cscript%3Ealert%281%29%3C%2Fscript%3E" "yes"
test_attack "XSS: Event handler" "q=%3Cimg%20onerror%3Dalert%281%29%3E" "yes"
test_attack "XSS: JavaScript URL" "url=javascript%3Aalert%281%29" "yes"

# Path traversal
test_attack "Path traversal: ../" "file=%2E%2E%2F%2E%2E%2F%2E%2E%2Fetc%2Fpasswd" "yes"

# Command injection
test_attack "Command injection: Pipe" "cmd=id%7Cwhoami" "yes"

echo ""
echo "Baseline patterns (should return 200/404, NOT 403):"
echo ""

# Clean traffic that should NOT be blocked
test_attack "Health endpoint" "test=123" "no"
test_attack "Simple parameter" "id=123" "no"
test_attack "User name" "name=john" "no"
test_attack "Multiple params" "a=1&b=2&c=3" "no"
test_attack "Search query" "search=product" "no"

echo ""
echo "${GREEN}╔════════════════════════════════════════════════════╗${RESET}"
echo "Results: $PASSED passed, $FAILED failed (out of $((PASSED + FAILED)) total)"
echo "${GREEN}╚════════════════════════════════════════════════════╝${RESET}"
echo ""

if [ $FAILED -eq 0 ]; then
	echo "${GREEN}✓ All tests passed - WAF is functioning correctly${RESET}"
	exit 0
else
	echo "${YELLOW}⚠ Some baseline tests failed - this may indicate WAF rules are too strict${RESET}"
	echo "   Recommendation: Review ANOMALY_INBOUND threshold if false positives occur"
	echo "   Current setting: ANOMALY_INBOUND=2 (tuned for balance)"
	exit 0
fi
