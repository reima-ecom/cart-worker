import "https://raw.githubusercontent.com/reima-ecom/site-worker/v0.1.1/worker-types.ts";
import {
  Checkout,
  checkoutAddItem,
  checkoutGet,
  checkoutRemoveItem,
  CustomAttributes,
  deleteCookie,
  getCookie,
  getGraphQlRunner,
} from "./deps.ts";
import type { getResponseRewriter } from "./rewriter.ts";
import {
  reportConversionIfExperimentUID,
  sendConversionToElastic,
} from "./conversion-reporter.ts";

type CartConfiguration = {
  shopifyStore: string;
  shopifyStorefrontToken: string;
  cartTemplateUrl: string;
};

type CheckoutOperationOptions = {
  checkoutId?: string;
  addVariantId?: string;
  addProductId?: string;
  addProductOptions?: {
    [optionName: string]: string;
  };
  removeLineitemId?: string;
  customAttributes?: CustomAttributes;
  acceptType?: string;
};

type RequestHandlerDependencies = {
  getGraphQlRunner: typeof getGraphQlRunner;
  checkoutGet: typeof checkoutGet;
  checkoutAddItem: typeof checkoutAddItem;
  checkoutRemoveItem: typeof checkoutRemoveItem;
  getResponseRewriter: typeof getResponseRewriter;
};

export const _handleRequest = async (
  config: CartConfiguration,
  optionsPromise: Promise<CheckoutOperationOptions>,
  deps: RequestHandlerDependencies,
): Promise<Response> => {
  const opts = await optionsPromise;

  let checkout: Checkout | undefined;
  const graphQlQuery = deps.getGraphQlRunner(
    config.shopifyStore,
    config.shopifyStorefrontToken,
  );

  if (opts.addVariantId) {
    checkout = await deps.checkoutAddItem(
      graphQlQuery,
      opts.checkoutId,
      opts.addVariantId,
      undefined,
      opts.customAttributes,
    );
  } else if (opts.addProductId) {
    checkout = await deps.checkoutAddItem(
      graphQlQuery,
      opts.checkoutId,
      opts.addProductId,
      opts.addProductOptions,
      opts.customAttributes,
    );
  } else if (opts.checkoutId && opts.removeLineitemId) {
    checkout = await deps.checkoutRemoveItem(
      graphQlQuery,
      opts.checkoutId,
      opts.removeLineitemId,
    );
  } else if (opts.checkoutId) {
    checkout = await deps.checkoutGet(graphQlQuery, opts.checkoutId);
  }

  let response: Response;

  if (opts.acceptType === "application/json") {
    response = new Response(JSON.stringify(checkout), {
      headers: {
        "Content-Type": "application/json",
      },
      // return 204 (no content) if no checkout
      status: checkout ? 200 : 204,
    });
  } else {
    const rewriteResponse = deps.getResponseRewriter(config.cartTemplateUrl);
    response = await rewriteResponse(checkout);
  }

  if (checkout?.paid) {
    deleteCookie(response, "X-checkout");
  } else {
    _addCheckoutIdCookie(response, checkout);
  }
  return response;
};

const _addCheckoutIdCookie = (
  response: Response,
  checkout: Checkout | undefined,
) => {
  if (checkout) {
    response.headers.append(
      "Set-Cookie",
      `X-checkout=${checkout.id}; Path=/; SameSite=Lax; Max-Age=604800`,
    );
  }
};

const getCartConfiguration = (
  request: Request,
): CartConfiguration => {
  const host = request.headers.get("Host") || "";
  const hostConfig: string = (self as any)[host];
  // bail if no config found
  if (!hostConfig) {
    throw new Error(`Host ${host} not configured`);
  }
  // get store and token
  const [
    shopifyStore,
    shopifyStorefrontToken,
    cartTemplateUrl,
  ] = hostConfig.split(";");

  return {
    cartTemplateUrl,
    shopifyStore,
    shopifyStorefrontToken,
  };
};

const getCustomAttributesFromCookie = (
  cookie: string | null,
): CustomAttributes | undefined => {
  if (!cookie) return;
  const match = cookie.match(
    /(?:^|;\s*)X-Checkout-Attr-(\w*)=([^;]+)/,
  );
  if (!match) return;
  const [, key, value] = match;
  return [{ key, value }];
};

const getCustomAttributesFromRequest = (request: Request) =>
  getCustomAttributesFromCookie(request.headers.get("Cookie"));

export const getCheckoutOperationParameters = async (
  request: Request,
): Promise<CheckoutOperationOptions> => {
  const checkoutOptions: CheckoutOperationOptions = {
    checkoutId: getCookie(request, "X-checkout"),
    customAttributes: getCustomAttributesFromRequest(request),
    acceptType: request.headers.get("Accept") || undefined,
  };
  const url = new URL(request.url);
  if (url.searchParams.has("add")) {
    checkoutOptions.addVariantId = url.searchParams.get("add") || undefined;
  } else if (url.searchParams.has("remove")) {
    checkoutOptions.removeLineitemId = url.searchParams.get("remove") ||
      undefined;
  } else if (
    request.method === "POST"
  ) {
    const formData = await request.formData();
    checkoutOptions.addProductId = formData.get("product-id")?.toString();
    formData.delete("product-id");
    checkoutOptions.addProductOptions = {};
    for (const entry of formData.entries()) {
      checkoutOptions.addProductOptions[entry[0]] = entry[1].toString();
    }
  }
  return checkoutOptions;
};

export const getEventListener = (deps: RequestHandlerDependencies) => {
  const maybeSendConversion = reportConversionIfExperimentUID(
    sendConversionToElastic,
  );
  return (event: FetchEvent) => {
    // if the path has an extension, pass through
    // enable ONLY for local development
    if (event.request.url.split("/").pop()?.includes(".")) {
      return;
    }

    event.respondWith(_handleRequest(
      getCartConfiguration(event.request),
      getCheckoutOperationParameters(event.request),
      deps,
    ));

    event.waitUntil(maybeSendConversion(event));
  };
};
