# ROVMART — Final Static Fashion Store

A production-oriented, beginner-editable fashion storefront using only **HTML5, CSS3, Vanilla JavaScript, Google Sheets, and Google Apps Script**.

## Included

- Dynamic product catalog from `products.js`
- Dedicated `assets/banner.svg` hero artwork
- Category hamburger menu generated from product categories
- Product search
- Responsive editorial-style product grid
- Cursor-following image magnification on desktop
- Dynamic `product.html?id=P001` product details
- LocalStorage cart with quantity controls
- Floating confirm-order bar
- Cart drawer
- Checkout modal
- Inside Dhaka delivery: **৳50**
- Outside Dhaka delivery: **৳100**
- Server-authoritative product prices and delivery charges
- Native form submission to Google Apps Script via hidden iframe
- Token-correlated `postMessage()` response
- Server-generated Bangladesh date/time
- Daily order IDs such as `ORD-20260926-0001`
- Duplicate-request protection with Apps Script cache
- Success confirmation with Order ID
- PWA manifest + service worker
- Local SVG product/banner placeholders — no third-party image dependency

## Folder structure

```text
ROVMART-final/
├── index.html
├── product.html
├── style.css
├── products.js
├── cart.js
├── order.js
├── app.js
├── config.js
├── manifest.webmanifest
├── service-worker.js
├── README.md
├── .gitignore
├── assets/
│   ├── banner.svg
│   ├── favicon.svg
│   └── products/
│       ├── product-01.svg
│       ├── product-02.svg
│       ├── product-03.svg
│       ├── product-04.svg
│       ├── product-05.svg
│       ├── product-06.svg
│       ├── product-07.svg
│       └── product-08.svg
├── google-apps-script/
│   └── Code.gs
└── tests/
    ├── smoke-test.html
    └── test-codegs.js
```

## 1. Configure Google Apps Script URL

Open `config.js` and replace:

```js
GOOGLE_SCRIPT_URL: "PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE"
```

with the deployed Apps Script Web App `/exec` URL.

Do not put private API keys or credentials in this file.

## 2. Google Sheet

Create a Google Spreadsheet and a tab named `Orders`.

The required first row is:

```text
Order ID | Date | Time | Customer Name | Phone | Delivery Address |
Delivery Area | Delivery Charge | Product IDs | Product Names |
Quantities | Unit Prices | Subtotal | Total Amount | Order Status | Additional Note
```

The supplied Apps Script also creates the `Orders` tab and the headers automatically when the bound spreadsheet does not yet contain them.

## 3. Apps Script

1. Open the Google Spreadsheet.
2. Go to **Extensions → Apps Script**.
3. Replace the existing script with `google-apps-script/Code.gs`.
4. Save it.
5. Set the Apps Script project timezone to `Asia/Dhaka` in **Project Settings**.
6. Deploy → **New deployment**.
7. Select **Web app**.
8. Execute as **Me**.
9. Set the access level to the public/anonymous option available to your account.
10. Authorize the script.
11. Copy the `/exec` Web App URL.
12. Paste it into `config.js`.
13. If the script is redeployed as a new version later, update the deployment rather than creating multiple competing URLs.

### Required public origin

The supplied `Code.gs` currently sends the order result back to:

```text
https://mdparvezmussaruf.github.io
```

If the GitHub Pages owner/repository origin changes, update `CONFIG.FRONTEND_ORIGIN` in `Code.gs` before deploying.

## 4. Test locally

Do not rely on `file://` for application testing. Use a local HTTP server.

### Python

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000/
```

### Expected behavior

- Homepage renders 8 sample products.
- Category menu contains the automatic categories.
- Search filters the catalog.
- Clicking a product title or image opens the dynamic product page.
- Add to cart updates the header count and floating cart.
- Cart quantity controls work.
- Checkout shows product subtotal + delivery charge + final total.
- Invalid customer data is rejected before submission.
- With the Apps Script URL configured, native form submission targets the hidden iframe.

## 5. Deploy the frontend on GitHub Pages

1. Create or use a GitHub repository.
2. Upload the entire contents of this folder to the repository root.
3. Commit the files.
4. Open **Settings → Pages**.
5. Choose the branch and repository root as the publishing source.
6. Save.
7. Open the published GitHub Pages URL.

The Apps Script `FRONTEND_ORIGIN` must exactly match the final GitHub Pages origin.

## 6. Add a product

Add another object to `products.js`:

```js
{
  id: "P009",
  name: "Your Product Name",
  price: 1990,
  oldPrice: 2390,
  category: "Shirt",
  image: "assets/products/product-09.jpg",
  description: "Product description.",
  details: [
    "Fabric detail",
    "Fit detail",
    "Feature detail",
    "Care detail"
  ],
  available: true
}
```

Then create the matching image file in `assets/products/`.

For order validation, also add the product to `CONFIG.PRODUCTS` in `google-apps-script/Code.gs` with the authoritative selling price.

## 7. Change a price

Change the price in both places:

- `products.js`
- `google-apps-script/Code.gs` → `CONFIG.PRODUCTS`

The backend copy is the authoritative value used for the saved order.

## 8. Remove a product

Set:

```js
available: false
```

in `products.js` and the backend `CONFIG.PRODUCTS` entry. This prevents checkout of that product and keeps old orders readable.

## 9. Delivery charges

Frontend display:

```text
Inside Dhaka  = ৳50
Outside Dhaka = ৳100
```

Backend calculation is authoritative. The browser sends only `inside` or `outside`.

## 10. Order flow

```text
Product catalog
      ↓
Product detail
      ↓
Add to cart
      ↓
LocalStorage
      ↓
Confirm order
      ↓
Checkout form
      ↓
Native POST to Apps Script iframe
      ↓
Apps Script validates request
      ↓
Backend prices + delivery fee calculated
      ↓
Order saved in Google Sheet
      ↓
postMessage() response
      ↓
Success screen + Order ID
      ↓
Cart cleared
```

## 11. Security model used here

- Never trust browser-provided unit prices.
- Never trust browser-provided delivery charges.
- Validate product IDs and quantities server-side.
- Validate name, phone, address and delivery area server-side.
- Generate order date/time on Apps Script, not in the browser.
- Use a script lock for order ID generation.
- Correlate frontend responses with a random client request ID.
- Cache the successful result for the request ID to reduce accidental duplicate order creation.
- Keep Google Sheet edit access private.

This is suitable for a simple COD storefront; it is not a full multi-vendor marketplace or online-payment system.

## 12. Before changing to online payments

Do not treat a return URL as proof of payment. A future bKash/SSLCommerz/Stripe adapter must verify the provider transaction server-side and authenticate the provider callback/webhook before changing payment status.
