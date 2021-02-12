import {
  CHECKOUT_ADD_LINEITEM,
  CHECKOUT_CREATE,
  CHECKOUT_QUERY,
  CHECKOUT_REMOVE_LINEITEM,
  CheckoutAddLineitemResult,
  CheckoutCreateInput,
  CheckoutCreateResult,
  CheckoutQueryResult,
  CheckoutRemoveLineitemResult,
  CustomAttributes,
  PRODUCT_VARIANT_ID,
  ProductVariantIdResult,
  ProductVariantIdVariables,
} from "./queries.ts";
import type { getGraphQlRunner } from "./graphql.ts";
export type {
  Checkout,
  CustomAttributes,
  LineItem,
  MoneyV2,
} from "./queries.ts";

export type GraphQlRunner = ReturnType<typeof getGraphQlRunner>;

export const checkoutRemoveItem = async (
  graphQlRunner: GraphQlRunner,
  checkoutId: string,
  lineItemId: string,
) => {
  const result = await graphQlRunner<CheckoutRemoveLineitemResult>({
    query: CHECKOUT_REMOVE_LINEITEM,
    variables: {
      checkoutId,
      lineItemIds: [lineItemId],
    },
  });
  return result.checkoutLineItemsRemove.checkout;
};

/**
 * Add a variant to the checkout. Creates a new checkout if no `checkoutId` specified.
 * 
 * If a new checkout is created, the optional `customAttributes` are attached to the checkout.
 */
export const checkoutAddItem = async (
  graphQlRunner: GraphQlRunner,
  checkoutId: string | undefined,
  variantOrProductId: string,
  productOptions?: { [optionName: string]: string },
  customAttributes?: CustomAttributes,
) => {
  // first assume this is a variant id
  let variantId = variantOrProductId;

  // ... but if we have product options, treat it as a product call
  if (productOptions) {
    const selectedOptions = Object
      .entries(productOptions)
      .map((entry) => ({ name: entry[0], value: entry[1] }));
    const productWithSelectedVariant = await graphQlRunner<
      ProductVariantIdResult,
      ProductVariantIdVariables
    >(
      {
        query: PRODUCT_VARIANT_ID,
        variables: {
          selectedOptions,
          productId: variantOrProductId,
        },
      },
    );
    if (!productWithSelectedVariant.node) {
      throw new Error(`Could not find product ${variantOrProductId}`);
    }
    variantId = productWithSelectedVariant.node.variantBySelectedOptions.id;
  }

  const lineItems = [
    { quantity: 1, variantId },
  ];

  if (!checkoutId) {
    const createdCheckout = await graphQlRunner<
      CheckoutCreateResult,
      CheckoutCreateInput
    >({
      query: CHECKOUT_CREATE,
      variables: {
        input: {
          lineItems,
          customAttributes,
        },
      },
    });
    return createdCheckout.checkoutCreate.checkout;
  }

  const result = await graphQlRunner<CheckoutAddLineitemResult>({
    query: CHECKOUT_ADD_LINEITEM,
    variables: {
      checkoutId,
      lineItems,
    },
  });
  return result.checkoutLineItemsAdd.checkout;
};

export const checkoutGet = async (
  graphQlRunner: GraphQlRunner,
  checkoutId: string,
) => {
  const result = await graphQlRunner<CheckoutQueryResult>({
    query: CHECKOUT_QUERY,
    variables: { id: checkoutId },
  });
  return result.node;
};
