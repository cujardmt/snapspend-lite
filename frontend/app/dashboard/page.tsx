// frontend/app/dashboard/page.tsx
"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type ReceiptItem = {
  id: number;
  description: string;
  quantity: string;
  unit_price: string;
  line_total: string;
};

type Receipt = {
  id: number;
  store_name: string | null;
  date: string | null;
  category: string;
  total_amount: string | null;
  tax_amount: string;
  currency: string;
  items: ReceiptItem[];
  created_at: string;
  updated_at: string;
  file?: string | null;
  file_url?: string | null;
};

type SummaryMode = "total" | "percentage";

const SUMMARY_COLORS = ["#2563eb", "#10b981", "#f97316", "#8b5cf6", "#ec4899"];

function formatAmount(amount: number | string | null, currency: string) {
  const value =
    typeof amount === "string" ? parseFloat(amount || "0") : amount || 0;
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: currency || "PHP",
  }).format(value);
}

export default function DashboardPage() {
  const router = useRouter();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);


  const [filterCategory, setFilterCategory] = useState<string>("All Categories");
  const [sortField, setSortField] = useState<"date" | "category" | "total">(
    "date"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [summaryMode, setSummaryMode] = useState<SummaryMode>("percentage");

  // Editing – receipt summary
  const [editingReceiptId, setEditingReceiptId] = useState<number | null>(null);
  const [receiptDraft, setReceiptDraft] = useState<Partial<Receipt>>({});

  // Editing – individual item
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemDraft, setItemDraft] = useState<Partial<ReceiptItem>>({});

  // Upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Image modal
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [modalZoom, setModalZoom] = useState(1);

  // ----------------- Fetch receipts -----------------
  const loadReceipts = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/receipts/`, {
        method: "GET",
        credentials: "include",
      });

      if (res.status === 401 || res.status === 403) {
        router.replace("/login");
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }

      const data = await res.json();
      const list = Array.isArray(data.receipts) ? data.receipts : [];
      setReceipts(list);
    } catch (err: any) {
      console.error("Error loading receipts:", err);
      setError(err.message || "Failed to load receipts");
      setReceipts([]);
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    loadReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------- Upload receipts -----------------
  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!fileInputRef.current || !fileInputRef.current.files?.length) {
      return;
    }

    const files = fileInputRef.current.files;
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("file", file));

    setUploading(true);
    setError(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/receipts/upload/`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }

      const data = await res.json();
      const uploaded = Array.isArray(data.receipts) ? data.receipts : [];
      // Prepend newly uploaded receipts
      setReceipts((prev) => [...uploaded, ...prev]);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      console.error("Upload failed:", err);
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ----------------- Sorting / filtering -----------------
  const toggleSort = (field: "date" | "category" | "total") => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const categories = Array.from(
    new Set(receipts.map((r) => r.category || "Other"))
  );

  const filtered = receipts.filter((r) => {
    if (filterCategory === "All Categories") return true;
    return (r.category || "Other") === filterCategory;
  });

  const sorted = [...filtered].sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";

    if (sortField === "date") {
      aVal = a.date || "";
      bVal = b.date || "";
    } else if (sortField === "category") {
      aVal = a.category || "";
      bVal = b.category || "";
    } else if (sortField === "total") {
      aVal = parseFloat(a.total_amount || "0");
      bVal = parseFloat(b.total_amount || "0");
    }

    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  // ----------------- Expense summary data -----------------
  const categoryTotals: Record<string, number> = {};
  receipts.forEach((r) => {
    const cat = r.category || "Other";
    const value = parseFloat(r.total_amount || "0") || 0;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + value;
  });

  const totalExpenses = Object.values(categoryTotals).reduce(
    (sum, v) => sum + v,
    0
  );

  const summaryData = Object.entries(categoryTotals).map(
    ([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses ? (amount / totalExpenses) * 100 : 0,
    })
  );

  // ----------------- Editing: receipts -----------------
  const startEditReceipt = (r: Receipt) => {
    setEditingReceiptId(r.id);
    setReceiptDraft({
      store_name: r.store_name || "",
      date: r.date || "",
      category: r.category || "",
      total_amount: r.total_amount || "",
    });
  };

  const cancelEditReceipt = () => {
    setEditingReceiptId(null);
    setReceiptDraft({});
  };

  const saveReceipt = async (r: Receipt) => {
    try {
      const payload = {
        store_name: receiptDraft.store_name ?? r.store_name,
        date: receiptDraft.date ?? r.date,
        category: receiptDraft.category ?? r.category,
        total_amount: receiptDraft.total_amount ?? r.total_amount,
      };

      const res = await fetch(`${BACKEND_URL}/api/receipts/${r.id}/`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }

      const data = await res.json();
      const updated = data.receipt || data;

      setReceipts((prev) =>
        prev.map((rec) => (rec.id === r.id ? { ...rec, ...updated } : rec))
      );
      cancelEditReceipt();
    } catch (err) {
      console.error("Save receipt error", err);
      setError("Failed to save receipt changes");
    }
  };

  const deleteReceipt = async (r: Receipt) => {
    if (!confirm("Delete this receipt and all its items?")) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/receipts/${r.id}/`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }

      setReceipts((prev) => prev.filter((rec) => rec.id !== r.id));
      if (expandedId === r.id) setExpandedId(null);
    } catch (err) {
      console.error("Delete error", err);
      setError("Failed to delete receipt");
    }
  };

  // ----------------- Editing: items -----------------
  const startEditItem = (item: ReceiptItem) => {
    setEditingItemId(item.id);
    setItemDraft({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
    });
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
    setItemDraft({});
  };

  const saveItem = async (receiptId: number, item: ReceiptItem) => {
    try {
      const payload = {
        description: itemDraft.description ?? item.description,
        quantity: itemDraft.quantity ?? item.quantity,
        unit_price: itemDraft.unit_price ?? item.unit_price,
      };

      const res = await fetch(
        `${BACKEND_URL}/api/receipt-items/${item.id}/`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }

      const data = await res.json();
      const updatedItem = data.item || data;

      setReceipts((prev) =>
        prev.map((rec) =>
          rec.id === receiptId
            ? {
              ...rec,
              items: rec.items.map((it) =>
                it.id === item.id ? { ...it, ...updatedItem } : it
              ),
            }
            : rec
        )
      );
      cancelEditItem();
    } catch (err) {
      console.error("Save item error", err);
      setError("Failed to save item changes");
    }
  };

  // ----------------- Image modal helpers -----------------
  const openImageModal = (url: string) => {
    setModalImageUrl(url);
    setModalZoom(1);
  };

  const closeImageModal = () => {
    setModalImageUrl(null);
  };

  if (checkingAuth) {
    return (
      <div style={{ padding: 40, fontSize: 14, color: "#6b7280" }}>
        Checking authentication…
      </div>
    );
  }

  // Build a flat row set: one row per receipt item
  function buildExportRows(source: Receipt[]): string[][] {
    const rows: string[][] = [];

    rows.push([
      "receipt_id",
      "store_name",
      "date",
      "category",
      "currency",
      "total_amount",
      "tax_amount",
      "item_id",
      "item_description",
      "item_quantity",
      "item_unit_price",
      "item_line_total",
    ]);

    source.forEach((r) => {
      if (r.items && r.items.length > 0) {
        r.items.forEach((item) => {
          rows.push([
            String(r.id),
            r.store_name ?? "",
            r.date ?? "",
            r.category ?? "",
            r.currency ?? "",
            r.total_amount ?? "",
            r.tax_amount ?? "",
            String(item.id),
            item.description ?? "",
            item.quantity ?? "",
            item.unit_price ?? "",
            item.line_total ?? "",
          ]);
        });
      } else {
        // Receipt with no items – still export one row
        rows.push([
          String(r.id),
          r.store_name ?? "",
          r.date ?? "",
          r.category ?? "",
          r.currency ?? "",
          r.total_amount ?? "",
          r.tax_amount ?? "",
          "",
          "",
          "",
          "",
          "",
        ]);
      }
    });

    return rows;
  }

  function buildCsv(rows: string[][]): string {
    return rows
      .map((row) =>
        row
          .map((value) => {
            const s = value ?? "";
            const needsQuotes =
              s.includes(",") || s.includes('"') || s.includes("\n");
            if (needsQuotes) {
              return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
          })
          .join(","),
      )
      .join("\r\n");
  }

  function triggerDownload(filename: string, mimeType: string, data: string) {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportAsCsv() {
    const rows = buildExportRows(receipts);
    const csv = buildCsv(rows);
    triggerDownload("snapspend_receipts.csv", "text/csv;charset=utf-8;", csv);
    setExportOpen(false);
  }

  // NOTE: we still generate CSV data, but give it a .xlsx extension
  // so Excel opens it directly. This avoids needing extra libraries.
  function exportAsXlsx() {
    const rows = buildExportRows(receipts);
    const csv = buildCsv(rows);
    triggerDownload("snapspend_receipts.xlsx", "text/csv;charset=utf-8;", csv);
    setExportOpen(false);
  }

  // Same CSV, but named for Sheets + open Sheets homepage in a new tab
  function exportForGoogleSheets() {
    const rows = buildExportRows(receipts);
    const csv = buildCsv(rows);
    triggerDownload(
      "snapspend_receipts_for_sheets.csv",
      "text/csv;charset=utf-8;",
      csv,
    );
    try {
      window.open("https://docs.google.com/spreadsheets/u/0/", "_blank");
    } catch {
      // ignore if popup blocked
    }
    setExportOpen(false);
  }

  const hasReceipts = receipts.length > 0;

  return (
    <>
      <div className="layout-main">


        {/* Upload card */}
        <section className="card upload-card">
          <form onSubmit={handleUpload} className="upload-dropzone">
            <div className="upload-inner">
              <div className="upload-icon">⬆️</div>
              <div className="upload-title">Upload Receipt</div>
              <div className="upload-subtitle">
                {uploading ? "Uploading…" : "Click to upload or drag and drop"}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="upload-input"
              />
            </div>
          </form>
        </section>

        {/* Expense Summary */}
        <section className="card summary-card">
          <div className="summary-header">
            <h2 className="summary-title">Expense Summary</h2>

            <div className="summary-toggle">
              <button
                type="button"
                className={summaryMode === "total" ? "active" : ""}
                onClick={() => setSummaryMode("total")}
              >
                $ Total
              </button>
              <button
                type="button"
                className={summaryMode === "percentage" ? "active" : ""}
                onClick={() => setSummaryMode("percentage")}
              >
                % Percentage
              </button>
            </div>
          </div>

          {hasReceipts ? (
            <div className="summary-grid">
              {/* Left: pie chart */}
              <div className="summary-chart">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={summaryData}
                      dataKey={
                        summaryMode === "total" ? "amount" : "percentage"
                      }
                      nameKey="category"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      label={({ category, percentage }: any) =>
                        `${category} ${percentage.toFixed(1)}%`
                      }
                    >
                      {summaryData.map((entry, index) => (
                        <Cell
                          key={entry.category}
                          fill={
                            SUMMARY_COLORS[index % SUMMARY_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Right: total + legend */}
              <div className="summary-details">
                <div className="summary-amount-block">
                  <div className="summary-amount-label">
                    Total Expenses
                  </div>
                  <div className="summary-amount">
                    {formatAmount(totalExpenses, "PHP")}
                  </div>
                </div>

                <div className="summary-divider" />

                <div className="summary-list">
                  {summaryData.map((entry, index) => (
                    <div className="summary-row" key={entry.category}>
                      <div className="summary-left">
                        <span
                          className="summary-dot"
                          style={{
                            backgroundColor:
                              SUMMARY_COLORS[index % SUMMARY_COLORS.length],
                          }}
                        />
                        <span>{entry.category}</span>
                      </div>
                      <div className="summary-right">
                        {entry.percentage.toFixed(1)}% (
                        {formatAmount(entry.amount, "PHP")})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="muted-text">
              No receipts yet. Upload a receipt to see your spending
              summary.
            </p>
          )}
        </section>

        {/* Receipt history */}
        <section className="card history-card">
          <section className="panel">
            <div className="receipt-header-row">
              <div>
                <div className="panel-title">Receipt History</div>
                <div className="panel-subtitle">
                  Review and edit your receipts. Click a row to view items and the original image.
                </div>
              </div>

              <div className="export-wrapper">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setExportOpen((open) => !open)}
                >
                  Export ▾
                </button>

                {exportOpen && (
                  <div className="export-menu">
                    <button type="button" onClick={exportAsCsv}>
                      Export as .csv
                    </button>
                    <button type="button" onClick={exportAsXlsx}>
                      Export as .xlsx
                    </button>
                    <button type="button" onClick={exportForGoogleSheets}>
                      Export for Google Sheets
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* keep your existing Filter + table / accordion UI here */}


            <div className="history-filters">
              <label className="filter-label">
                Filter:
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="All Categories">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {error && (
            <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>
              {error}
            </p>
          )}

          {hasReceipts ? (
            <table className="receipts-table">
              <thead>
                <tr>
                  <th>Store Name</th>
                  <th onClick={() => toggleSort("date")} className="sortable">
                    Date{" "}
                    <span className="sort-indicator">
                      {sortField === "date"
                        ? sortDir === "asc"
                          ? "↑"
                          : "↓"
                        : "↕"}
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("category")}
                    className="sortable"
                  >
                    Category{" "}
                    <span className="sort-indicator">
                      {sortField === "category"
                        ? sortDir === "asc"
                          ? "↑"
                          : "↓"
                        : "↕"}
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("total")}
                    className="sortable"
                  >
                    Total Amount{" "}
                    <span className="sort-indicator">
                      {sortField === "total"
                        ? sortDir === "asc"
                          ? "↑"
                          : "↓"
                        : "↕"}
                    </span>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {sorted.map((r) => {
                  const isExpanded = expandedId === r.id;
                  const isEditing = editingReceiptId === r.id;
                  const imageUrl = r.file_url || r.file || "";

                  const subtotal = r.items.reduce((sum, it) => {
                    const v = parseFloat(it.line_total || "0") || 0;
                    return sum + v;
                  }, 0);

                  return (
                    <>
                      <tr
                        key={r.id}
                        className={
                          "receipt-row" + (isExpanded ? " expanded" : "")
                        }
                        onClick={() =>
                          setExpandedId((prev) =>
                            prev === r.id ? null : r.id
                          )
                        }
                      >
                        <td>
                          <span className="chevron">
                            {isExpanded ? (
                              <ChevronDown size={12} />
                            ) : (
                              <ChevronRight size={12} />
                            )}
                          </span>
                          {isEditing ? (
                            <input
                              className="inline-input"
                              value={
                                (receiptDraft.store_name as string) ??
                                r.store_name ??
                                ""
                              }
                              onChange={(e) =>
                                setReceiptDraft((prev) => ({
                                  ...prev,
                                  store_name: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            r.store_name || "—"
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <input
                              type="date"
                              className="inline-input"
                              value={
                                (receiptDraft.date as string) ?? r.date ?? ""
                              }
                              onChange={(e) =>
                                setReceiptDraft((prev) => ({
                                  ...prev,
                                  date: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            r.date || "—"
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <input
                              className="inline-input"
                              value={
                                (receiptDraft.category as string) ??
                                r.category ??
                                ""
                              }
                              onChange={(e) =>
                                setReceiptDraft((prev) => ({
                                  ...prev,
                                  category: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            <span className="category-pill">
                              {r.category || "Other"}
                            </span>
                          )}
                        </td>

                        <td>
                          {isEditing ? (
                            <input
                              className="inline-input"
                              type="number"
                              step="0.01"
                              value={
                                (receiptDraft.total_amount as string) ??
                                r.total_amount ??
                                ""
                              }
                              onChange={(e) =>
                                setReceiptDraft((prev) => ({
                                  ...prev,
                                  total_amount: e.target.value,
                                }))
                              }
                            />
                          ) : (
                            formatAmount(r.total_amount, r.currency)
                          )}
                        </td>

                        <td
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          {isEditing ? (
                            <>
                              <button
                                className="icon-btn success"
                                type="button"
                                onClick={() => saveReceipt(r)}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                className="icon-btn"
                                type="button"
                                onClick={cancelEditReceipt}
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="icon-btn"
                                type="button"
                                onClick={() => startEditReceipt(r)}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className="icon-btn danger"
                                type="button"
                                onClick={() => deleteReceipt(r)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="accordion-row">
                          <td colSpan={5} className="accordion-cell">
                            <div className="accordion-content open">
                              <div
                                className="accordion-inner"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* Left: items */}
                                <div className="accordion-left">
                                  <h4>Receipt Items</h4>
                                  {r.items && r.items.length > 0 ? (
                                    <table className="items-table">
                                      <thead>
                                        <tr>
                                          <th>Item Name</th>
                                          <th>Quantity</th>
                                          <th>Price</th>
                                          <th>Total</th>
                                          <th>Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {r.items.map((item) => {
                                          const editingThis =
                                            editingItemId === item.id;
                                          return (
                                            <tr key={item.id}>
                                              <td>
                                                {editingThis ? (
                                                  <input
                                                    className="inline-input"
                                                    value={
                                                      (itemDraft.description as string) ??
                                                      item.description
                                                    }
                                                    onChange={(e) =>
                                                      setItemDraft((prev) => ({
                                                        ...prev,
                                                        description:
                                                          e.target.value,
                                                      }))
                                                    }
                                                  />
                                                ) : (
                                                  item.description
                                                )}
                                              </td>
                                              <td>
                                                {editingThis ? (
                                                  <input
                                                    className="inline-input"
                                                    type="number"
                                                    step="0.01"
                                                    value={
                                                      (itemDraft.quantity as string) ??
                                                      item.quantity
                                                    }
                                                    onChange={(e) =>
                                                      setItemDraft((prev) => ({
                                                        ...prev,
                                                        quantity:
                                                          e.target.value,
                                                      }))
                                                    }
                                                  />
                                                ) : (
                                                  item.quantity
                                                )}
                                              </td>
                                              <td>
                                                {editingThis ? (
                                                  <input
                                                    className="inline-input"
                                                    type="number"
                                                    step="0.01"
                                                    value={
                                                      (itemDraft.unit_price as string) ??
                                                      item.unit_price
                                                    }
                                                    onChange={(e) =>
                                                      setItemDraft((prev) => ({
                                                        ...prev,
                                                        unit_price:
                                                          e.target.value,
                                                      }))
                                                    }
                                                  />
                                                ) : (
                                                  item.unit_price
                                                )}
                                              </td>
                                              <td>{item.line_total}</td>
                                              <td>
                                                {editingThis ? (
                                                  <>
                                                    <button
                                                      className="icon-btn success"
                                                      type="button"
                                                      onClick={() =>
                                                        saveItem(r.id, item)
                                                      }
                                                    >
                                                      <Check size={14} />
                                                    </button>
                                                    <button
                                                      className="icon-btn"
                                                      type="button"
                                                      onClick={
                                                        cancelEditItem
                                                      }
                                                    >
                                                      <X size={14} />
                                                    </button>
                                                  </>
                                                ) : (
                                                  <button
                                                    className="icon-btn"
                                                    type="button"
                                                    onClick={() =>
                                                      startEditItem(item)
                                                    }
                                                  >
                                                    <Pencil size={14} />
                                                  </button>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                        <tr className="subtotal-row">
                                          <td
                                            colSpan={3}
                                            style={{ textAlign: "right" }}
                                          >
                                            Subtotal:
                                          </td>
                                          <td>
                                            {formatAmount(
                                              subtotal,
                                              r.currency
                                            )}
                                          </td>
                                          <td />
                                        </tr>
                                      </tbody>
                                    </table>
                                  ) : (
                                    <p className="muted-text">
                                      No items extracted.
                                    </p>
                                  )}
                                </div>

                                {/* Right: image */}
                                <div className="accordion-right">
                                  <h4>Receipt Image</h4>
                                  {imageUrl ? (
                                    <div
                                      className="receipt-image-clickable tall"
                                      onClick={() =>
                                        openImageModal(imageUrl)
                                      }
                                    >
                                      <img src={imageUrl} alt="Receipt" />
                                      <div className="receipt-image-overlay">
                                        <span>Click to enlarge</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="muted-text">
                                      No image available.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="muted-text">
              No receipts uploaded yet. Upload your first receipt to get
              started.
            </p>
          )}
        </section>

        {/* Image modal */}
        {modalImageUrl && (
          <div className="modal-backdrop" onClick={closeImageModal}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()} // prevent backdrop click
            >
              <div className="modal-header">
                <div className="zoom-controls">
                  <button
                    type="button"
                    onClick={() =>
                      setModalZoom((z) => Math.max(0.5, z - 0.25))
                    }
                  >
                    -
                  </button>
                  <span>{Math.round(modalZoom * 100)}%</span>
                  <button
                    type="button"
                    onClick={() =>
                      setModalZoom((z) => Math.min(3, z + 0.25))
                    }
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={closeImageModal}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="modal-image-wrapper">
                <img
                  src={modalImageUrl}
                  alt="Receipt full"
                  style={{ transform: `scale(${modalZoom})` }}
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}