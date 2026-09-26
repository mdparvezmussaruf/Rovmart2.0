# ROVMART Test Report

Test date: 2026-09-26

## Completed automated checks

- JavaScript syntax checks: PASS
- Google Apps Script syntax check: PASS
- HTML asset/reference scan: PASS
- Local HTTP availability for all core files: PASS
- Apps Script backend smoke test: PASS
- Backend authoritative pricing calculation: PASS
- Backend Inside/Outside delivery calculation: PASS
- Duplicate request cache protection: PASS
- Invalid delivery-area rejection: PASS

## Backend smoke-test result

Test cart:

- P001 × 2 = ৳2,580
- P003 × 1 = ৳2,490
- Product subtotal = ৳5,070
- Outside Dhaka delivery = ৳100
- Final total = ৳5,170

Expected generated Order ID format:

`ORD-YYYYMMDD-####`

## Browser test environment note

A Chromium/Playwright interactive browser run was attempted, but the execution environment blocked local/file navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. Therefore this report does **not** claim a complete real-browser end-to-end checkout submission.

The storefront was instead validated by static HTTP/reference checks plus JavaScript and Apps Script execution tests. Before production, open the site on the target browser(s) and run the manual checkout checklist in `README.md`.
