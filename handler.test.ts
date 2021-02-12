import { assertEquals } from "https://deno.land/std@0.86.0/testing/asserts.ts";
import { getCheckoutOperationParameters, getEventListener } from "./handler.ts";
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
  );
  assertEquals(
    params.customAttributes,
    [{ key: "A8", value: "a8click" }],
  );
});
