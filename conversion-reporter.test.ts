import { assertEquals, assert } from "https://deno.land/std@0.86.0/testing/asserts.ts";
import {
  ConversionSender,
  reportConversionIfExperimentUID,
} from "./conversion-reporter.ts";

const createFetchEvent = (path: string, userId?: string): FetchEvent => {
  const request = new Request("http://localhost" + path);
  if (userId) {
    request.headers.append("Cookie", `exp-id=${userId}`);
  }
  return ({
    request,
  } as FetchEvent);
};

Deno.test("returns undefined for normal requests", async () => {
  await reportConversionIfExperimentUID(async () => {
    throw new Error(`Should not be called`);
  })(createFetchEvent("/"));
});

Deno.test("calls sender with correct data if user id exists", async () => {
  let called = false;
  const sender: ConversionSender = async (conversion) => {
    assertEquals(conversion.userId, "user-id");
    assertEquals(conversion.conversionEvent, "Add to cart");
    assert(conversion.timestamp instanceof Date);
    called = true;
  };
  const reporter = reportConversionIfExperimentUID(sender);
  await reporter(createFetchEvent("/", "user-id"));
  assertEquals(called, true);
});
