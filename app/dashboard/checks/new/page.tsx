"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Table {
  id: string;
  tableNumber: string;
}

interface CheckItem {
  id: string;
  name: string;
  quantity: number;
  pricePerUnit: number;
}

export default function NewCheckPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [items, setItems] = useState<CheckItem[]>([
    { id: "1", name: "", quantity: 1, pricePerUnit: 0 },
  ]);
  const [taxRate, setTaxRate] = useState(9); // 9% default
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/dashboard/login");
        return;
      }

      // Fetch tables
      const response = await fetch("/api/dashboard/tables");
      if (response.ok) {
        const data = await response.json();
        setTables(data);
        if (data.length > 0) {
          setSelectedTableId(data[0].id);
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [router, supabase.auth]);

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), name: "", quantity: 1, pricePerUnit: 0 },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof CheckItem, value: string | number) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const calculateTotals = () => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.pricePerUnit,
      0
    );
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedTableId) {
      setMessage({ type: "error", text: "Please select a table" });
      return;
    }

    const validItems = items.filter((item) => item.name && item.pricePerUnit > 0);
    if (validItems.length === 0) {
      setMessage({ type: "error", text: "Please add at least one item" });
      return;
    }

    setIsSaving(true);

    try {
      const { subtotal, tax, total } = calculateTotals();

      const response = await fetch("/api/dashboard/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selectedTableId,
          checkNumber,
          subtotalCents: Math.round(subtotal * 100),
          taxCents: Math.round(tax * 100),
          totalCents: Math.round(total * 100),
          items: validItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            pricePerUnitCents: Math.round(item.pricePerUnit * 100),
            totalCents: Math.round(item.quantity * item.pricePerUnit * 100),
          })),
        }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Check created successfully! Redirecting…" });
        setTimeout(() => router.push("/dashboard"), 1000);
      } else {
        const error = await response.json();
        setMessage({ type: "error", text: `Failed to create check: ${error.error}` });
      }
    } catch (error) {
      console.error("Error creating check:", error);
      setMessage({ type: "error", text: "Failed to create check" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-gray-600 hover:text-gray-900">
              ← Back
            </a>
            <h1 className="text-2xl font-bold text-gray-900">Create Check</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          {/* Check Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Table *
              </label>
              <select
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {tables.length === 0 ? (
                  <option value="">No tables available</option>
                ) : (
                  tables.map((table) => (
                    <option key={table.id} value={table.id}>
                      Table {table.tableNumber}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check Number (Optional)
              </label>
              <input
                type="text"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="e.g., 1234"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, _index) => (
                <div key={item.id} className="flex gap-3 items-start">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                      placeholder="Item name"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, "quantity", parseInt(e.target.value) || 1)
                      }
                      min="1"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div className="w-28">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={item.pricePerUnit}
                        onChange={(e) =>
                          updateItem(item.id, "pricePerUnit", parseFloat(e.target.value) || 0)
                        }
                        min="0"
                        required
                        className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="w-24 py-2 text-right font-medium text-gray-900">
                    ${(item.quantity * item.pricePerUnit).toFixed(2)}
                  </div>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tax Rate */}
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tax Rate (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              min="0"
              max="100"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>${totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax ({taxRate}%)</span>
              <span>${totals.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-300">
              <span>Total</span>
              <span>${totals.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`p-4 rounded-lg ${
                message.type === "success"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <a
              href="/dashboard"
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={isSaving || tables.length === 0}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold rounded-lg transition-colors"
            >
              {isSaving ? "Creating..." : "Create Check"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
