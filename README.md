# Server rendered cart page

This cart page is a CloudFlare Workers script that will render a Shopify checkout (/cart) based on a specifically formatted template HTML page. The main use-case is to support cart functionality when client-side Javascript does not work (e.g. in the case of syntax errors from unsupported clients) or when Javascript is not loaded at all (e.g. if JS is turned off or client doesn't support `type=module`).

## Installation

The worker should be published in your own account using the route `/cart*` or similar. Any path can be used. However, the asterisk is important, because the worker uses query string parameters. Routes [do not match](https://developers.cloudflare.com/workers/platform/routes#matching-behavior) when query parameters are used without the asterisk.

Configuration for the worker is done using [Workers environment variables](https://developers.cloudflare.com/workers/platform/environments#environment-variables). To specify the Shopify store and token, set an environment variable with the Shopify store name, Shopify storefront token and HTML template url as per below. The name of the environment variable should be the host name of your store. **This makes it possible to use the same worker instance for many sites.** Just attach the worker to all your desired zones and configure the zone-specific behavior using many different environment variables. Set environment variables via a `worker.toml` file (variables set in the Cloudflare dashboard are overwritten on publish).

```
"your.domain.com" = "your-store;storefront-token;https://your.domain.com/template-cart"
```

Details:

- *your.domain.com*: This is matched against the hostname of the current request, using the `Host` header of the request.
- *your-store*: The store name, e.g. in this case you would have a store at `your-store.myshopify.com`.
- *storefront-token*: Storefront token with at least the following access scopes: `unauthenticated_write_checkouts`, `unauthenticated_read_checkouts` (to read and manage checkouts) and `unauthenticated_read_product_listings` (to find product variants from variant options).
- *https://your.domain.com/template-cart*: Full URL of the HTML page to use as a template (see below for more info regarding the template). Note that this URL **can not be** `/cart` on the same zone if the worker route is `/cart*`.
- The parameters in the environment variable are separated using a semicolon `;`.

## Usage

To show the contents of the cart, just link to the URL of the worker (e.g. `/cart`). The worker will pick up the settings as detailed above, and use the checkout ID specified in the `X-checkout` cookie. In order to add items to the cart, use one of the following methods:

**Variant id in the query string**: Use the link format `/cart?add=VARIANT_ID` to add that variant to the cart.

**Product options in form data**: POST a form to the `/cart` with the following values:

- `product`: Product id (in storefront format), e.g. `product=gid://Product/aaabbb`
- `option[NAME]`: Value of the product option with the specified name, e.g. `option[Color]=Blue`. Naturally, you need to specify all options to add a variant.

Removing items from the cart is possible on the rendered cart page itself.

## Template format

The template HTML page can be any page. The worker just requires the following special elements (expressed as CSS selectors):

- `ul[items]`: Render the line items of the checkout inside this element (will replace current content).
- `*[subtotal]`: Set the contents of this element to the checkout subtotal amount.
- `a[checkout]`: Set the `href` of this element to the URL of the checkout in Shopify.

### HTML structure of line items

Each line items render the following HTML (see the source code if this seems out of date):

```html
<li>
  <img src="VARIANT PRODUCT IMAGE SRC" alt="VARIANT PRODUCT IMAGE ALT TEXT">
  <div>
    <h2>PRODUCT TITLE</h2>
    <h3>VARIANT TITLE</h3>
    <div>QUANTITY pcs</div>
    <a href="?remove=LINE ITEM ID">Remove</a>
  </div>
  <strong>VARIANT PRICE</strong>
</li>
```

In case there is no active checkout or it doesn't contain any line items, the contents of `ul[items]` will be cleared. So in this case you can use the `:empty` CSS selector.

## Development

The worker is written in Typescript and bundled to JS using Deno. Bundle using the command:

```sh
deno bundle index.ts dist.js
```

Local testing can be done using:

```sh
wrangler dev --host reima-demo.netlify.app --env dev
```