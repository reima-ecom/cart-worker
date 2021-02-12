import {
  checkoutAddItem,
  checkoutGet,
  checkoutRemoveItem,
  getGraphQlRunner,
} from "./deps.ts";
import { getEventListener } from "./handler.ts";
import { getResponseRewriter } from "./rewriter.ts";

const eventListener = getEventListener({
  checkoutAddItem,
  checkoutGet,
  checkoutRemoveItem,
  getGraphQlRunner,
  getResponseRewriter,
});

addEventListener("fetch", eventListener);
