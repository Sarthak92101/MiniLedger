#!/usr/bin/env bash
# End-to-end smoke test against a running MiniLedger API.
set -uo pipefail

API="${API:-http://localhost:3000}"
LOG="${LOG:-/tmp/ml-server.log}"

# Reads a JSON file and prints one top-level key.
json() {
  local file="$1" key="$2"
  node -e '
    let d = "";
    process.stdin.on("data", c => d += c).on("end", () => {
      try { console.log(JSON.parse(d)[process.argv[1]] ?? ""); }
      catch (e) { console.log("PARSE_ERROR:" + d); }
    });
  ' "$key" < "$file"
}

# Reads a JSON file and prints a formatted summary of the loan at .loan
show_loan() {
  node -e '
    let d = "";
    process.stdin.on("data", c => d += c).on("end", () => {
      const l = JSON.parse(d).loan;
      console.log("   ", JSON.stringify({
        friend: l.friendName, amount: l.amount, amountCents: l.amountCents,
        dueDate: l.dueDate, status: l.status,
        isOverdue: l.isOverdue, daysOverdue: l.daysOverdue, receiptUrl: l.receiptUrl,
      }));
    });
  ' < "$1"
}

echo "==> 1. Request an OTP"
curl -s -X POST "$API/api/auth/otp/request" -H 'Content-Type: application/json' \
  -d '{"phone":"9876543210"}' > /tmp/ml_otp.json
head -c 200 /tmp/ml_otp.json; echo ""

OTP=$(grep 'mock-otp' "$LOG" | tail -1 | sed -E 's/.*otp=([0-9]+).*/\1/')
echo "    OTP printed in the server log: $OTP"

echo ""
echo "==> 2. Verify the OTP"
curl -s -X POST "$API/api/auth/otp/verify" -H 'Content-Type: application/json' \
  -d "{\"phone\":\"9876543210\",\"otp\":\"$OTP\"}" > /tmp/ml_verify.json
TOKEN=$(json /tmp/ml_verify.json token)
echo "    token: ${TOKEN:0:45}..."

AUTH="Authorization: Bearer $TOKEN"

echo ""
echo "==> 3. Upload a receipt"
node -e "require('fs').writeFileSync('/tmp/receipt.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'))"
curl -s -X POST "$API/api/uploads/receipt" -H "$AUTH" \
  -F "receipt=@/tmp/receipt.png;type=image/png" > /tmp/ml_upload.json
cat /tmp/ml_upload.json; echo ""
RECEIPT_URL=$(json /tmp/ml_upload.json receiptUrl)

echo ""
echo "==> 4. Create a loan with the receipt"
curl -s -X POST "$API/api/loans" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"friendName\":\"Sneha\",\"amount\":275.50,\"dueDate\":\"2026-09-01\",\"note\":\"Rent split\",\"receiptUrl\":\"$RECEIPT_URL\"}" \
  > /tmp/ml_loan.json
show_loan /tmp/ml_loan.json
LOAN_ID=$(node -e '
  let d = "";
  process.stdin.on("data", c => d += c).on("end", () => console.log(JSON.parse(d).loan.id));
' < /tmp/ml_loan.json)
echo "    loan id: $LOAN_ID"

echo ""
echo "==> 5. Mark it repaid"
curl -s -X PATCH "$API/api/loans/$LOAN_ID/repay" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{}' > /tmp/ml_repaid.json
show_loan /tmp/ml_repaid.json

echo ""
echo "==> 6. Summary"
curl -s "$API/api/summary" -H "$AUTH" > /tmp/ml_summary.json
node -e '
  let d = "";
  process.stdin.on("data", c => d += c).on("end", () => {
    const s = JSON.parse(d).summary;
    console.log("   ", JSON.stringify({
      totalLent: s.totalLent, totalRepaid: s.totalRepaid,
      totalOutstanding: s.totalOutstanding, overdueAmount: s.overdueAmount,
    }));
    console.log("    counts", JSON.stringify(s.counts));
  });
' < /tmp/ml_summary.json

echo ""
echo "==> 7. Overdue filter"
curl -s "$API/api/loans?status=overdue" -H "$AUTH" > /tmp/ml_overdue.json
node -e '
  let d = "";
  process.stdin.on("data", c => d += c).on("end", () => {
    const l = JSON.parse(d).loans;
    console.log("    " + l.length + " overdue: " +
      l.map(x => x.friendName + " ($" + x.amount + ", " + x.daysOverdue + "d late)").join(", "));
  });
' < /tmp/ml_overdue.json

echo ""
echo "==> 8. Receipt is served back"
curl -s -o /dev/null -w "    HTTP %{http_code}  %{content_type}  %{size_download} bytes\n" "$API$RECEIPT_URL" -H "$AUTH"

echo ""
echo "==> 9. Validation is enforced"
for payload in '{"amount":100,"dueDate":"2026-01-01"}' '{"friendName":"A","amount":-5,"dueDate":"2026-01-01"}' '{"friendName":"A","amount":10,"dueDate":"2026-02-31"}'; do
  CODE=$(curl -s -o /tmp/ml_err.json -w "%{http_code}" -X POST "$API/api/loans" -H "$AUTH" -H 'Content-Type: application/json' -d "$payload")
  echo "    HTTP $CODE  $(cat /tmp/ml_err.json)"
done

echo ""
echo "==> 10. Unauthenticated access is rejected"
CODE=$(curl -s -o /tmp/ml_err.json -w "%{http_code}" "$API/api/loans")
echo "    HTTP $CODE  $(cat /tmp/ml_err.json)"

echo ""
echo "==> 11. Another user's loan is not reachable"
curl -s -X POST "$API/api/auth/otp/request" -H 'Content-Type: application/json' \
  -d '{"phone":"9000000009"}' > /dev/null
OTP2=$(grep 'mock-otp' "$LOG" | tail -1 | sed -E 's/.*otp=([0-9]+).*/\1/')
curl -s -X POST "$API/api/auth/otp/verify" -H 'Content-Type: application/json' \
  -d "{\"phone\":\"9000000009\",\"otp\":\"$OTP2\"}" > /tmp/ml_verify2.json
TOKEN2=$(json /tmp/ml_verify2.json token)
CODE=$(curl -s -o /tmp/ml_err.json -w "%{http_code}" "$API/api/loans/$LOAN_ID" -H "Authorization: Bearer $TOKEN2")
echo "    HTTP $CODE  $(cat /tmp/ml_err.json)"
