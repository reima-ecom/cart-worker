import {
  CHECKOUT_ADD_LINEITEM,
  CHECKOUT_CREATE,
  CHECKOUT_QUERY,
  CHECKOUT_REMOVE_LINEITEM,
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

type Money = {
  amount: number;
  currency: string;
};

export type LineItem = {
  id: string;
  title: string;
  quantity: number;
  variant: {
    title: string;
    image: {
      src: string;
      altText: string;
    };
    price: Money;
  };
};

export type Checkout = {
  id: string;
  url: string;
  subtotal: Money;
  items: LineItem[];
};

export type CustomAttributes = CustomAttributesShopify;

export type GraphQlRunner = ReturnType<typeof getGraphQlRunner>;

const _shopifyMoneyToDomain = (shopifyMoney: MoneyV2): Money => ({
  amount: Number.parseFloat(shopifyMoney.amount),
  currency: shopifyMoney.currencyCode,
});

const _toDomain = (shopifyCheckout: CheckoutShopify): Checkout => ({
  id: shopifyCheckout.id,
  url: shopifyCheckout.webUrl,
  subtotal: _shopifyMoneyToDomain(shopifyCheckout.subtotal),
  items: shopifyCheckout.lineItems.edges.map(({ node }) => ({
    id: node.id,
    quantity: node.quantity,
    title: node.title,
    variant: {
      title: node.variant.title,
      price: _shopifyMoneyToDomain(node.variant.price),
      image: {
        src: node.variant.image.src,
        altText: node.variant.image.altText,
      },
    },
  })),
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
  return _toDomain(result.checkoutLineItemsRemove.checkout);
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
    return _toDomain(createdCheckout.checkoutCreate.checkout);
  }

  const result = await graphQlRunner<CheckoutAddLineitemResult>({
    query: CHECKOUT_ADD_LINEITEM,
    variables: {
      checkoutId,
      lineItems,
    },
  });
  return _toDomain(result.checkoutLineItemsAdd.checkout);
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
  return _toDomain(result.node);
};
