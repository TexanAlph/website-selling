/**
 * Override any of these in Vercel / .env.local to match your exact offer.
 * Everything else in the SOP is inferred from your dialer product (local outbound, $599 sites).
 */
export type SalesConfig = {
  companyName: string;
  offerPrice: string;
  offerSummary: string;
  deliveryTimeline: string;
  paymentProcess: string;
  sendInfoFallback: string;
  targetGeo: string;
};

export function getSalesConfig(): SalesConfig {
  return {
    companyName:
      process.env.COACH_COMPANY_NAME?.trim() || "Apex Build Partners",
    offerPrice: process.env.COACH_OFFER_PRICE?.trim() || "$599",
    offerSummary:
      process.env.COACH_OFFER_SUMMARY?.trim() ||
      "one-time professional website (no monthly hosting pitch unless they ask)",
    deliveryTimeline:
      process.env.COACH_DELIVERY_DAYS?.trim() ||
      "live within 3 days on average",
    paymentProcess:
      process.env.COACH_PAYMENT_PROCESS?.trim() ||
      "simple invoice link by text after they agree",
    sendInfoFallback:
      process.env.COACH_SEND_INFO_URL?.trim() ||
      "offer to text a 2-link preview + invoice only after micro-commitment",
    targetGeo:
      process.env.COACH_TARGET_GEO?.trim() ||
      "San Antonio area local service businesses",
  };
}
