import { assertEquals } from "https://deno.land/std@0.86.0/testing/asserts.ts";
import {
  _handleRequest,
  getCheckoutOperationParameters,
  getEventListener,
} from "./handler.ts";
import type { Checkout } from "./lib/checkout.ts";

Deno.test("adding works with get variant", () => {
  const eventListener = getEventListener({
    checkoutAddItem: async (runner, checkoutId, variantId) => {
      assertEquals(variantId, "variant");
      return { id: "checkout" } as Checkout;
    },
    getResponseRewriter: (url) =>
      async (checkout) => {
        return new Response(checkout?.id);
      },
    // @ts-ignore
    getGraphQlRunner: () => undefined,
  });

  (self as any).test = "store;token;url";
  // @ts-ignore
  const event: FetchEvent = {
    request: new Request("https://test/cart?add=variant", {
      headers: {
        "Host": "test",
      },
    }),
    respondWith: async (resp) => {
      const body = await (await resp).text();
      assertEquals(body, "checkout");
    },
    waitUntil: () => undefined,
  };

  eventListener(event);
});

Deno.test("adding works with form post options", () => {
  const eventListener = getEventListener({
    checkoutAddItem: () => Promise.resolve({ id: "checkout" } as Checkout),
    getResponseRewriter: (url) =>
      async (checkout) => {
        return new Response(checkout?.id);
      },
    // @ts-ignore
    getGraphQlRunner: () => undefined,
  });

  (self as any).test = "store;token;url";
  // @ts-ignore
  const event: FetchEvent = {
    request: new Request("https://test/cart", {
      body: "product-id=body&Color=Blue",
      method: "POST",
      headers: {
        "Host": "test",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }),
    respondWith: async (resp) => {
      const body = await (await resp).text();
      assertEquals(body, "checkout");
    },
    waitUntil: () => undefined,
  };

  eventListener(event);
});

Deno.test("checkout operation parameters include custom attribute", async () => {
  const params = await getCheckoutOperationParameters(
    new Request("http://localhost", {
      headers: {
        "Cookie": "X-Checkout-Attr-A8=a8click",
      },
    }),
    { cartTemplateUrl: "", shopifyStore: "", shopifyStorefrontToken: "" },
  );
  assertEquals(
    // @ts-ignore
    params.customAttributes,
    [{ key: "A8", value: "a8click" }],
  );
});

Deno.test("checkout operation parameters include accept type", async () => {
  const params = await getCheckoutOperationParameters(
    new Request("http://localhost", {
      headers: {
        "Accept": "application/json",
      },
    }),
    { cartTemplateUrl: "", shopifyStore: "", shopifyStorefrontToken: "" },
  );
  assertEquals(
    params.acceptType,
    "application/json",
  );
});

Deno.test("checkout operation parameters works with old style cookie", async () => {
  const params = await getCheckoutOperationParameters(
    new Request("http://localhost", {
      headers: {
        "Cookie": "X-checkout=checkout-id",
      },
    }),
    { cartTemplateUrl: "", shopifyStore: "test", shopifyStorefrontToken: "" },
  );
  assertEquals(
    // @ts-ignore
    params.checkoutId,
    "checkout-id",
  );
});

Deno.test("checkout operation parameters works with new style cookie", async () => {
  const params = await getCheckoutOperationParameters(
    new Request("http://localhost", {
      headers: {
        "Cookie": "X-Checkout-test=checkout-id",
      },
    }),
    { cartTemplateUrl: "", shopifyStore: "test", shopifyStorefrontToken: "" },
  );
  assertEquals(
    // @ts-ignore
    params.checkoutId,
    "checkout-id",
  );
});

Deno.test("handler sets checkout id cookie", async () => {
  const response = await _handleRequest(
    {
      cartTemplateUrl: "",
      shopifyStore: "",
      shopifyStorefrontToken: "",
    },
    Promise.resolve({ checkoutId: "checkout-id" }),
    {
      checkoutAddItem: () => {
        throw new Error("Not implemented");
      },
      checkoutRemoveItem: () => {
        throw new Error("Not implemented");
      },
      getResponseRewriter: () => async () => new Response(),
      checkoutGet: async () => ({
        id: "checkout-id",
        url: "",
        subtotal: { amount: 0, currency: "" },
        items: [],
        store: "test",
      }),
      getGraphQlRunner: () => async <T>() => ({} as T),
    },
  );
  assertEquals(
    response.headers.get("Set-Cookie"),
    "X-Checkout-test=checkout-id; Path=/; SameSite=Lax; Max-Age=604800",
  );
});

Deno.test("handler able to return json", async () => {
  const checkout = {
    id: "checkout-id",
    url: "",
    subtotal: { amount: 0, currency: "" },
    items: [],
    store: "test",
  };
  const response = await _handleRequest(
    {
      cartTemplateUrl: "",
      shopifyStore: "",
      shopifyStorefrontToken: "",
    },
    Promise.resolve({
      checkoutId: "checkout-id",
      acceptType: "application/json",
    }),
    {
      checkoutAddItem: () => {
        throw new Error("Not implemented");
      },
      checkoutRemoveItem: () => {
        throw new Error("Not implemented");
      },
      getResponseRewriter: () => async () => new Response(),
      checkoutGet: async () => checkout,
      getGraphQlRunner: () => async <T>() => ({} as T),
    },
  );
  const json = await response.json();
  assertEquals(json, checkout);
});
