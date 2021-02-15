import "https://raw.githubusercontent.com/reima-ecom/site-worker/v0.1.1/worker-cloudflare-types.ts";
import type { Checkout, LineItem } from "./deps.ts";

type MoneyFormatter = (
  money: { amount: number; currency: string },
) => string;

const formatMoney: MoneyFormatter = ({ amount, currency }) => {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

const renderLineItem = (lineItem: LineItem) =>
  `
<li>
  <img src="${lineItem.variant.image.src}" alt="${lineItem.variant.image.altText}">
  <div>
    <h2>${lineItem.title}</h2>
    <h3>${lineItem.variant.title}</h3>
    <div>${lineItem.quantity} pcs</div>
    <a href="?remove=${lineItem.id}">Remove</a>
  </div>
  <strong>${formatMoney(lineItem.variant.price)}</strong>
</li>
`;

export const getElementHandlers = (
  checkout: Checkout | null | undefined,
  format: MoneyFormatter = formatMoney,
): {
  items: ElementHandler;
  subtotal: ElementHandler;
  button: ElementHandler;
} => ({
  button: {
    element: (element) => {
      if (checkout) {
        element.setAttribute("href", checkout.url);
      }
    },
  },
  items: {
    element: (element) => {
      if (checkout?.items.length) {
        const content = checkout.items.map((lineItem) =>
          renderLineItem(lineItem)
        ).join("");
        element.setInnerContent(content, { html: true });
      } else {
        element.setInnerContent("");
      }
    },
  },
  subtotal: {
    element: (element) => {
      let subtotal = "";
      if (checkout) {
        subtotal = format(checkout.subtotal);
      }
      element.setInnerContent(subtotal);
    },
  },
});

export const getResponseRewriter = (cartTemplateUrl: string) => {
  const templateResponsePromise = fetch(cartTemplateUrl);
  return async (checkout: Checkout | undefined) => {
    const handlers = getElementHandlers(checkout);
    let response = await templateResponsePromise;

    return new HTMLRewriter()
      .on("[items]", handlers.items)
      .on("[checkout]", handlers.button)
      .on("[subtotal]", handlers.subtotal)
      .transform(response);
  };
};
