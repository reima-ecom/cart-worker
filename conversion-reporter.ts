import "https://raw.githubusercontent.com/reima-ecom/site-worker/v0.1.1/worker-types.ts";
import { getCookies } from "https://deno.land/std@0.86.0/http/cookie.ts";

type ConversionData = {
  userId: string;
  conversionEvent: string;
  timestamp: Date;
};

export type ConversionSender = (conversion: ConversionData) => Promise<void>;

declare const ELASTIC_APIKEY_BASE64: string;

export const sendConversionToElastic: ConversionSender = async (conversion) => {
  const resp = await fetch(
    "https://21ca8fec9bcd4a7ba46d584c59d76fa0.eastus2.azure.elastic-cloud.com:9243/experiment-conversions/_doc",
    {
      method: "POST",
      body: JSON.stringify(conversion),
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${ELASTIC_APIKEY_BASE64}`,
      },
    },
  );
  console.log(resp.status, resp.statusText);
  console.log(await resp.json());
};

export const reportConversionIfExperimentUID = (
  sendConversion: ConversionSender,
) =>
  async (event: FetchEvent): Promise<void> => {
    const { "exp-id": userId } = getCookies(event.request);
    if (userId) {
      await sendConversion({
        userId,
        conversionEvent: "Add to cart",
        timestamp: new Date(),
      });
    }
  };
