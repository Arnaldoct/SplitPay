"use client";

import { useEffect, useState } from "react";

interface Table {
  id: string;
  tableNumber: string;
  qrCodeUrl: string | null;
  active: boolean;
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchTables = async () => {
    try {
      const response = await fetch("/api/dashboard/tables");
      if (response.ok) {
        const data = await response.json();
        setTables(data);
      }
    } catch (error) {
      console.error("Error fetching tables:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Auth is enforced by middleware.ts for all /dashboard routes
    fetchTables();
  }, []);

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber.trim()) return;

    setIsSaving(true);

    try {
      const response = await fetch("/api/dashboard/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber: newTableNumber }),
      });

      if (response.ok) {
        const newTable = await response.json();
        setTables([...tables, newTable]);
        setNewTableNumber("");
        setShowAddForm(false);
      }
    } catch (error) {
      console.error("Error creating table:", error);
      alert("Failed to create table");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateQR = async (tableId: string) => {
    try {
      const response = await fetch(`/api/dashboard/tables/${tableId}/qr`, {
        method: "POST",
      });

      if (response.ok) {
        const { qrCodeUrl } = await response.json();
        setTables(tables.map(t => 
          t.id === tableId ? { ...t, qrCodeUrl } : t
        ));
      }
    } catch (error) {
      console.error("Error generating QR code:", error);
      alert("Failed to generate QR code");
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Back
              </a>
              <h1 className="text-2xl font-bold text-gray-900">Tables & QR Codes</h1>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
            >
              + Add Table
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Add Table Form */}
        {showAddForm && (
          <div className="mb-6 bg-white rounded-xl shadow-sm p-6">
            <form onSubmit={handleAddTable} className="flex gap-4">
              <input
                type="text"
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
                placeholder="Table number (e.g., 12)"
                required
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold rounded-lg transition-colors"
              >
                {isSaving ? "Creating..." : "Create Table"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Tables Grid */}
        {tables.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <p className="text-gray-600 mb-4">No tables yet</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="text-purple-600 hover:text-purple-700 font-semibold"
            >
              Create your first table
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tables.map((table) => (
              <div
                key={table.id}
                className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Table {table.tableNumber}
                    </h3>
                    <p className="text-sm text-gray-500">ID: {table.id.slice(0, 8)}...</p>
                  </div>
                  {table.active && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      Active
                    </span>
                  )}
                </div>

                {table.qrCodeUrl ? (
                  <div className="mb-4">
                    <img
                      src={table.qrCodeUrl}
                      alt={`QR Code for Table ${table.tableNumber}`}
                      className="w-full h-auto rounded-lg border border-gray-200"
                    />
                    <a
                      href={table.qrCodeUrl}
                      download={`table-${table.tableNumber}-qr.png`}
                      className="block mt-3 text-center text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Download QR Code
                    </a>
                  </div>
                ) : (
                  <div className="mb-4 py-8 bg-gray-50 rounded-lg text-center">
                    <p className="text-sm text-gray-500 mb-3">No QR code yet</p>
                    <button
                      onClick={() => handleGenerateQR(table.id)}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Generate QR Code
                    </button>
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  Guests scan this code to pay
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
