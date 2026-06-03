"use client";

import type { Lead } from "@/lib/leads";
import { CallHistoryPanel } from "./CallHistoryPanel";

type Props = {
  testMode: boolean;
  onSelectLead: (lead: Lead) => void;
  onCallBack: (phone: string) => void;
  onUnreadChange?: (count: number) => void;
};

export function HistoryView({
  testMode,
  onSelectLead,
  onCallBack,
  onUnreadChange,
}: Props) {
  return (
    <div className="history-shell">
      <CallHistoryPanel
        variant="page"
        testMode={testMode}
        onSelectLead={onSelectLead}
        onCallBack={onCallBack}
        onUnreadChange={onUnreadChange}
      />
    </div>
  );
}
