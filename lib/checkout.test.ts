import { assertEquals } from "https://deno.land/std@0.86.0/testing/asserts.ts";
import { checkoutAddItem, GraphQlRunner } from "./checkout.ts";
import { GraphQl } from "./graphql.ts";
import {
  CHECKOUT_CREATE,
  CheckoutCreateInput,
  CheckoutCreateResult,
} from "./queries.ts";

Deno.test("adding to new checkout works", async () => {
  const graphQlRunner = async (
    graphQl: GraphQl<CheckoutCreateInput>,
  ) => {
    if (graphQl.query === CHECKOUT_CREATE) {
      return {
        checkoutCreate: {
          checkout: {
            id: `created-with-${
              graphQl.variables.input.lineItems![0].variantId
            }`,
            subtotal: { amount: "10", currencyCode: "USD" },
            lineItems: { edges: [] },
            webUrl: "",
          },
        },
      } as CheckoutCreateResult;
    } else {
      throw new Error("Not implemented");
    }
  };
  const checkout = await checkoutAddItem(
    graphQlRunner as GraphQlRunner,
    undefined,
    "variant",
  );
  assertEquals(checkout.id, "created-with-variant");
});
