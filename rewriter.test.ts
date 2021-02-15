// check that env var handling works
// check that li rendered correctly
// check that subtotal set
// check that GET add works
// check that GET remove works
// check that POST set works


import { assertEquals } from "https://deno.land/std@0.86.0/testing/asserts.ts";
import { Checkout } from "./deps.ts";
import { getElementHandlers } from "./rewriter.ts";

Deno.test("element items set to empty on null checkout", () => {
  const elementHandlers = getElementHandlers(null);
  let content = "original content that should be overwritten";
  const element: Pick<Element, "setInnerContent"> = {
    setInnerContent: (innerContent) => {
      content = innerContent;
      return undefined as unknown as Element;
    },
  };
  elementHandlers.items.element!(element as Element);
  assertEquals(content, "");
});

Deno.test("element button url set to checkout web url", () => {
  const elementHandlers = getElementHandlers({
    url: "checkout url",
  } as Checkout);
  let checkoutUrl = "original url attribute";
  const element: Pick<Element, "setAttribute"> = {
    setAttribute: (name, value) => {
      if (name === "href") checkoutUrl = value;
      return undefined as unknown as Element;
    },
  };
  elementHandlers.button.element!(element as Element);
  assertEquals(checkoutUrl, "checkout url");
});

Deno.test("element subtotal set to formatted subtotal", () => {
  const elementHandlers = getElementHandlers(
    {
      subtotal: {
        amount: 10,
        currency: "USD",
      },
    } as Checkout,
    () => "$10.00",
  );
  let content = "original content that should be overwritten";
  const element: Pick<Element, "setInnerContent"> = {
    setInnerContent: (innerContent) => {
      content = innerContent;
      return undefined as unknown as Element;
    },
  };
  elementHandlers.subtotal.element!(element as Element);
  assertEquals(content, "$10.00");
});

export {};
