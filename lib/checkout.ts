import {
  CHECKOUT_ADD_LINEITEM,
  CHECKOUT_CREATE,
  CHECKOUT_QUERY,
  CHECKOUT_REMOVE_LINEITEM,
  CHECKOUT_UPDATE_LINEITEM,
  CheckoutResult,
  CheckoutUpdateLineitemVariables,
  PRODUCT_VARIANT_ID,
} from "./queries.ts";
import type {
  Checkout as CheckoutShopify,
  CheckoutAddLineitemResult,
  CheckoutCreateInput,
  CheckoutCreateResult,
  CheckoutQueryResult,
  CheckoutRemoveLineitemResult,
  CustomAttributes as CustomAttributesShopify,
  MoneyV2,
  ProductVariantIdResult,
  ProductVariantIdVariables,
} from "./queries.ts";
import type { getGraphQlRunner } from "./graphql.ts";

export type Money = {
  amount: number;
  currency: string;
};

export type LineItem = {
  id: string;
  title: string;
  quantity: number;
  variant: {
    id: string;
    product: {
      id: string;
      handle: string;
    };
    title: string;
    image: {
      src: string;
      altText: string;
    };
    price: Money;
  };
};

export type Checkout = {
  store: string;
  id: string;
  url: string;
  subtotal: Money;
  items: LineItem[];
  paid?: boolean;
};

export type CustomAttributes = CustomAttributesShopify;

export type GraphQlRunner = ReturnType<typeof getGraphQlRunner>;

const _shopifyMoneyToDomain = (shopifyMoney: MoneyV2): Money => ({
  amount: Number.parseFloat(shopifyMoney.amount),
  currency: shopifyMoney.currencyCode,
});

const _toDomain = (shopifyCheckout: CheckoutShopify, store: string): Checkout => ({
  store,
  id: shopifyCheckout.id,
  url: shopifyCheckout.webUrl,
  subtotal: _shopifyMoneyToDomain(shopifyCheckout.subtotal),
  items: shopifyCheckout.lineItems.edges.map(({ node }) => ({
    id: node.id,
    quantity: node.quantity,
    title: node.title,
    variant: {
      id: node.variant.id,
      title: node.variant.title,
      price: _shopifyMoneyToDomain(node.variant.price),
      image: {
        src: node.variant.image.src,
        altText: node.variant.image.altText,
      },
      product: {
        id: node.variant.product.id,
        handle: node.variant.product.handle,
      },
    },
  })),
  paid: !!shopifyCheckout.order,
});

export const checkoutRemoveItem = async (
  graphQlRunner: GraphQlRunner,
  checkoutId: string,
  lineItemId: string,
): Promise<Checkout> => {
  const result = await graphQlRunner<CheckoutRemoveLineitemResult>({
    query: CHECKOUT_REMOVE_LINEITEM,
    variables: {
      checkoutId,
      lineItemIds: [lineItemId],
    },
  });
  return _toDomain(result.checkoutLineItemsRemove.checkout, result.store);
};

export const checkoutUpdateItemQuantity = async (
  graphQlRunner: GraphQlRunner,
  checkoutId: string,
  lineItemId: string,
  quantity: number,
): Promise<Checkout> => {
  const result = await graphQlRunner<
    CheckoutResult,
    CheckoutUpdateLineitemVariables
  >({
    query: CHECKOUT_UPDATE_LINEITEM,
    variables: {
      checkoutId,
      lineItems: [{
        id: lineItemId,
        quantity,
      }],
    },
  });
  return _toDomain(result.result.checkout, result.store);
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
): Promise<Checkout> => {
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
    return _toDomain(createdCheckout.checkoutCreate.checkout, createdCheckout.store);
  }

  const result = await graphQlRunner<CheckoutAddLineitemResult>({
    query: CHECKOUT_ADD_LINEITEM,
    variables: {
      checkoutId,
      lineItems,
    },
  });
  return _toDomain(result.checkoutLineItemsAdd.checkout, result.store);
};

export const checkoutGet = async (
  graphQlRunner: GraphQlRunner,
  checkoutId: string,
): Promise<Checkout | undefined> => {
  const result = await graphQlRunner<CheckoutQueryResult>({
    query: CHECKOUT_QUERY,
    variables: { id: checkoutId },
  });
  if (!result.node) return undefined;
  return _toDomain(result.node, result.store);
};
