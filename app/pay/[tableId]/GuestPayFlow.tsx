"use client";

import { useState } from "react";
import { CheckView } from "./screens/CheckView";
import { SplitSelector } from "./screens/SplitSelector";
import { SplitEvenly } from "./screens/SplitEvenly";
import { SplitByItem } from "./screens/SplitByItem";
import { CustomAmount } from "./screens/CustomAmount";
import { TipSelection } from "./screens/TipSelection";

export type SplitMode = "full" | "even" | "by_item" | "custom";
export type Screen = "check" | "split-selector" | "split-evenly" | "split-by-item" | "custom-amount" | "tip";

export interface CheckItem {
  id: string;
  name: string;
  quantity: number;
  totalCents: number;
  claimedCents: number;
}

interface GuestPayFlowProps {
  checkId: string;
  venueName: string;
  tableNumber: string;
  checkNumber: string;
  items: CheckItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  openedAt: string;
}

export function GuestPayFlow({
  checkId,
  venueName,
  tableNumber,
  checkNumber,
  items,
  subtotalCents,
  taxCents,
  totalCents,
  paidCents,
  openedAt,
}: GuestPayFlowProps) {
  const [screen, setScreen] = useState<Screen>("check");
  const [splitMode, setSplitMode] = useState<SplitMode>("full");
  const [amountCents, setAmountCents] = useState(0);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const remainingCents = totalCents - paidCents;

  const handleSelectMode = (mode: SplitMode) => {
    setSplitMode(mode);
    if (mode === "full") {
      setAmountCents(remainingCents);
      setScreen("tip");
    } else if (mode === "even") {
      setScreen("split-evenly");
    } else if (mode === "by_item") {
      setScreen("split-by-item");
    } else if (mode === "custom") {
      setScreen("custom-amount");
    }
  };

  const handleSplitEvenlyConfirm = (amount: number) => {
    setAmountCents(amount);
    setScreen("tip");
  };

  const handleSplitByItemConfirm = (amount: number, itemIds: string[]) => {
    setAmountCents(amount);
    setSelectedItemIds(itemIds);
    setScreen("tip");
  };

  const handleCustomAmountConfirm = (amount: number) => {
    setAmountCents(amount);
    setScreen("tip");
  };

  const handleBack = () => {
    if (screen === "tip") {
      if (splitMode === "full") {
        setScreen("split-selector");
      } else if (splitMode === "even") {
        setScreen("split-evenly");
      } else if (splitMode === "by_item") {
        setScreen("split-by-item");
      } else if (splitMode === "custom") {
        setScreen("custom-amount");
      }
    } else if (screen === "split-evenly" || screen === "split-by-item" || screen === "custom-amount") {
      setScreen("split-selector");
    } else if (screen === "split-selector") {
      setScreen("check");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto">
        {screen === "check" && (
          <CheckView
            venueName={venueName}
            tableNumber={tableNumber}
            checkNumber={checkNumber}
            items={items}
            subtotalCents={subtotalCents}
            taxCents={taxCents}
            totalCents={totalCents}
            paidCents={paidCents}
            openedAt={openedAt}
            onPayCheck={() => setScreen("split-selector")}
          />
        )}

        {screen === "split-selector" && (
          <SplitSelector
            onSelectMode={handleSelectMode}
            onBack={() => setScreen("check")}
          />
        )}

        {screen === "split-evenly" && (
          <SplitEvenly
            totalCents={remainingCents}
            onConfirm={handleSplitEvenlyConfirm}
            onBack={handleBack}
          />
        )}

        {screen === "split-by-item" && (
          <SplitByItem
            items={items}
            taxCents={taxCents}
            subtotalCents={subtotalCents}
            onConfirm={handleSplitByItemConfirm}
            onBack={handleBack}
          />
        )}

        {screen === "custom-amount" && (
          <CustomAmount
            remainingCents={remainingCents}
            onConfirm={handleCustomAmountConfirm}
            onBack={handleBack}
          />
        )}

        {screen === "tip" && (
          <TipSelection
            checkId={checkId}
            amountCents={amountCents}
            splitMode={splitMode}
            selectedItemIds={selectedItemIds}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}
