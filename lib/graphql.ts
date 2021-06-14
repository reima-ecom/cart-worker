export type GraphQl<V = unknown> = {
  query: string;
  variables: V;
};

type ShopifyStore = {
  store: string
}

export const getGraphQlRunner = (
  shopifyStore: string,
  shopifyStorefrontToken: string,
) =>
  async <T = unknown, V = unknown>(
    graphQl: GraphQl<V>,
  ): Promise<T & ShopifyStore> => {
    const resp = await fetch(
      `https://${shopifyStore}.myshopify.com/api/2020-04/graphql`,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": shopifyStorefrontToken,
        },
        method: "POST",
        body: JSON.stringify(graphQl),
      },
    );
    if (!resp.ok) throw new Error(`Could not query: ${resp.statusText}`);
    const { data, errors } = await resp.json();
    if (errors) {
      errors.forEach((error: { message: string; locations: unknown[] }) => {
        console.error(error.message, "at", error.locations);
      });
      throw new Error("Errors encountered - see above");
    }
    return {
      ...data,
      store: shopifyStore,
    };
  };
