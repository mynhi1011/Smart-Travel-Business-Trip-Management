$base = "http://localhost:3001/api/v1"
$p = 0; $f = 0

function C($id, $desc, $code, $expected) {
  $ok = $code.Trim() -eq "$expected"
  if ($ok) { Write-Host "[PASS] $id $desc"; $script:p++ }
  else      { Write-Host "[FAIL] $id $desc | got:$($code.Trim()) exp:$expected"; $script:f++ }
}

# Get tokens
$loginDir = Split-Path $MyInvocation.MyCommand.Path
'{"email":"nam.nguyen@smarttravel.dev","password":"Password123!"}' | Out-File "$loginDir\b.json" -Encoding utf8 -NoNewline
$EMP = (curl.exe -s -X POST "$base/auth/login" -H "Content-Type: application/json" --data-binary "@$loginDir\b.json" | ConvertFrom-Json).accessToken
'{"email":"hung.tran@smarttravel.dev","password":"Password123!"}' | Out-File "$loginDir\b.json" -Encoding utf8 -NoNewline
$MGR = (curl.exe -s -X POST "$base/auth/login" -H "Content-Type: application/json" --data-binary "@$loginDir\b.json" | ConvertFrom-Json).accessToken
'{"email":"trang.pham@smarttravel.dev","password":"Password123!"}' | Out-File "$loginDir\b.json" -Encoding utf8 -NoNewline
$FIN = (curl.exe -s -X POST "$base/auth/login" -H "Content-Type: application/json" --data-binary "@$loginDir\b.json" | ConvertFrom-Json).accessToken
'{"email":"mai.le@smarttravel.dev","password":"Password123!"}' | Out-File "$loginDir\b.json" -Encoding utf8 -NoNewline
$ADM = (curl.exe -s -X POST "$base/auth/login" -H "Content-Type: application/json" --data-binary "@$loginDir\b.json" | ConvertFrom-Json).accessToken

Write-Host "Tokens: EMP=$(if($EMP){'OK'}else{'FAIL'}) MGR=$(if($MGR){'OK'}else{'FAIL'}) FIN=$(if($FIN){'OK'}else{'FAIL'}) ADM=$(if($ADM){'OK'}else{'FAIL'})"

# Auth endpoints
C "S01" "GET /auth/me EMP"       (curl.exe -s -o NUL -w "%{http_code}" "$base/auth/me" -H "Authorization: Bearer $EMP") 200
C "S02" "GET /auth/me no token"  (curl.exe -s -o NUL -w "%{http_code}" "$base/auth/me") 401

# Trips - list
C "S03" "GET /trips EMP"         (curl.exe -s -o NUL -w "%{http_code}" "$base/trips" -H "Authorization: Bearer $EMP") 200
C "S04" "GET /trips MGR"         (curl.exe -s -o NUL -w "%{http_code}" "$base/trips" -H "Authorization: Bearer $MGR") 200
C "S05" "GET /trips no token"    (curl.exe -s -o NUL -w "%{http_code}" "$base/trips") 401

# Get trip IDs from seed
$trips = curl.exe -s "$base/trips" -H "Authorization: Bearer $EMP" | ConvertFrom-Json
$TRIP_ID = $trips.data[0].id
$APPROVED_ID = "33333333-0000-4000-a000-000000000003"
Write-Host "Trip ID: $TRIP_ID | Approved: $APPROVED_ID"

# Trips - get by id
C "S06" "GET /trips/:id EMP"     (curl.exe -s -o NUL -w "%{http_code}" "$base/trips/$TRIP_ID" -H "Authorization: Bearer $EMP") 200
C "S07" "GET /trips/:id no token" (curl.exe -s -o NUL -w "%{http_code}" "$base/trips/$TRIP_ID") 401

# RBAC checks
C "S08" "POST /trips MGR 403"    (curl.exe -s -o NUL -w "%{http_code}" -X POST "$base/trips" -H "Content-Type: application/json" -H "Authorization: Bearer $MGR" --data-binary "@b.json") 403
C "S09" "DELETE /trips FIN 403"  (curl.exe -s -o NUL -w "%{http_code}" -X DELETE "$base/trips/$TRIP_ID" -H "Authorization: Bearer $FIN") 403

# Itinerary
C "S10" "GET itinerary EMP"      (curl.exe -s -o NUL -w "%{http_code}" "$base/trips/$TRIP_ID/itinerary" -H "Authorization: Bearer $EMP") 200
C "S11" "GET itinerary no token" (curl.exe -s -o NUL -w "%{http_code}" "$base/trips/$TRIP_ID/itinerary") 401

# Expenses - seed trip APPROVED has expense
C "S12" "GET expense FIN"        (curl.exe -s -o NUL -w "%{http_code}" "$base/trips/$APPROVED_ID/expenses" -H "Authorization: Bearer $FIN") 200
C "S13" "GET expense EMP"        (curl.exe -s -o NUL -w "%{http_code}" "$base/trips/$APPROVED_ID/expenses" -H "Authorization: Bearer $EMP") 200

# Notifications
C "S14" "GET notifications EMP"  (curl.exe -s -o NUL -w "%{http_code}" "$base/notifications" -H "Authorization: Bearer $EMP") 200
C "S15" "GET notifications MGR"  (curl.exe -s -o NUL -w "%{http_code}" "$base/notifications" -H "Authorization: Bearer $MGR") 200

# Dashboard
C "S16" "GET dashboard EMP"      (curl.exe -s -o NUL -w "%{http_code}" "$base/dashboard" -H "Authorization: Bearer $EMP") 200
C "S17" "GET dashboard MGR"      (curl.exe -s -o NUL -w "%{http_code}" "$base/dashboard" -H "Authorization: Bearer $MGR") 200
C "S18" "GET dashboard FIN"      (curl.exe -s -o NUL -w "%{http_code}" "$base/dashboard" -H "Authorization: Bearer $FIN") 200
C "S19" "GET dashboard ADM"      (curl.exe -s -o NUL -w "%{http_code}" "$base/dashboard" -H "Authorization: Bearer $ADM") 200

# PDF export — APPROVED_ID belongs to bao.tran (EMP2), use her token
'{"email":"bao.tran@smarttravel.dev","password":"Password123!"}' | Out-File "$loginDir\b.json" -Encoding utf8 -NoNewline
$EMP2 = (curl.exe -s -X POST "$base/auth/login" -H "Content-Type: application/json" --data-binary "@$loginDir\b.json" | ConvertFrom-Json).accessToken
C "S20" "GET export-pdf APPROVED EMP2" (curl.exe -s -o NUL -w "%{http_code}" "$base/trips/$APPROVED_ID/export-pdf" -H "Authorization: Bearer $EMP2") 200
C "S21" "GET export-pdf FIN"           (curl.exe -s -o NUL -w "%{http_code}" "$base/trips/$APPROVED_ID/export-pdf" -H "Authorization: Bearer $FIN") 200
C "S22" "GET export-pdf no token"      (curl.exe -s -o NUL -w "%{http_code}" "$base/trips/$APPROVED_ID/export-pdf") 401

# Health + 404
C "S23" "GET /health"            (curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3001/health") 200
C "S24" "Unknown route 404"      (curl.exe -s -o NUL -w "%{http_code}" "$base/unknown-xyz") 404

Remove-Item "b.json" -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "===== SMOKE TEST: $p PASS / $f FAIL ====="
