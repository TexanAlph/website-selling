export type LeadStatus =
  | "New"
  | "Calling"
  | "Wrong Number"
  | "Not Interested"
  | "Interested/Closed";

export type Lead = {
  id: string;
  business_name: string;
  phone: string;
  website: string | null;
  status: LeadStatus;
  niche: string | null;
  created_at: string;
};

export const OUTCOME_STATUSES: Record<
  "wrong" | "not_interested" | "interested",
  LeadStatus
> = {
  wrong: "Wrong Number",
  not_interested: "Not Interested",
  interested: "Interested/Closed",
};
