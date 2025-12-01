"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from "recharts";


interface ReceiptItem {
  description: string;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
}

interface ReceiptExtractedData {
  store_name: string | null;
  store_address: string | null;
  store_tax_id: string | null;
  date: string | null;
  payment_method: string | null;
  subtotal_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
  currency: string | null;
  category: string | null;
  items: ReceiptItem[];
  confidence_score: number;
}

interface ReceiptData {
  id: number;
  file: string;
  extracted_data: ReceiptExtractedData;
  created_at: string;
}

type ReceiptSortField = "date" | "total_amount" | null;
type SortDirection = "asc" | "desc";

type ItemSortField = "unit_price" | "line_total" | null;

const RADIAN = Math.PI / 180;

const renderPieLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  // place the label halfway between inner and outer radius
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
    >
      {(percent * 100).toFixed(0)}%
    </text>
  );
};


const DUPLICATE_HIGHLIGHT_CLASSES = [
  "border-l-4 border-l-red-500",
  "border-l-4 border-l-yellow-500",
  "border-l-4 border-l-blue-500",
  "border-l-4 border-l-purple-500",
  "border-l-4 border-l-pink-500",
  "border-l-4 border-l-orange-500",
];

export default function HomePage() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [loading, setLoading] = useState(false);

  // Accordion state
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Sort state for receipts
  const [receiptSortField, setReceiptSortField] =
    useState<ReceiptSortField>(null);
  const [receiptSortDirection, setReceiptSortDirection] =
    useState<SortDirection>("asc");

  // Sort state for items (applies to the expanded receipt)
  const [itemSortField, setItemSortField] = useState<ItemSortField>(null);
  const [itemSortDirection, setItemSortDirection] =
    useState<SortDirection>("asc");

  // Pagination state
  const [rowsPerPage, setRowsPerPage] = useState<number>(30);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // ----------- CHART FILTER STATE ------------
  const [dateFilterType, setDateFilterType] = useState<"month" | "quarter" | "year" | "custom">("month");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedQuarter, setSelectedQuarter] = useState<"Q1" | "Q2" | "Q3" | "Q4">("Q1");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(e.target.files);
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) return;

    setLoading(true);

    const uploaded: ReceiptData[] = [];

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/receipts/upload/`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!res.ok) {
          console.error("Upload failed:", await res.text());
          continue;
        }

        const data = await res.json();
        uploaded.push(data);
      } catch (err) {
        console.error("Error uploading file:", err);
      }
    }

    // Append new receipts to existing ones
    setReceipts((prev) => [...prev, ...uploaded]);

    // If nothing is expanded yet, expand the first newly uploaded one
    setExpandedId((current) =>
      current === null && uploaded.length > 0 ? uploaded[0].id : current
    );

    setFiles(null);
    setLoading(false);
  };

  const handleDeleteReceipt = (id: number) => {
    setReceipts((prev) => prev.filter((r) => r.id !== id));
    setExpandedId((current) => (current === id ? null : current));
  };

  // ---------- EDIT HANDLERS ----------

  const updateReceiptField = (
    id: number,
    field: keyof ReceiptExtractedData,
    value: string
  ) => {
    setReceipts((prev) =>
      prev.map((rec) => {
        if (rec.id !== id) return rec;
        const extracted = { ...rec.extracted_data };

        if (
          field === "subtotal_amount" ||
          field === "tax_amount" ||
          field === "total_amount"
        ) {
          extracted[field] = value === "" ? null : Number(value);
        } else {
          extracted[field] = (value || null) as any;
        }

        return { ...rec, extracted_data: extracted };
      })
    );
  };

  const updateItemField = (
    receiptId: number,
    itemIndex: number,
    field: keyof ReceiptItem,
    value: string
  ) => {
    setReceipts((prev) =>
      prev.map((rec) => {
        if (rec.id !== receiptId) return rec;
        const extracted = { ...rec.extracted_data };
        const items = [...extracted.items];
        const item = { ...items[itemIndex] };

        if (field === "description") {
          item[field] = value;
        } else {
          item[field] = value === "" ? null : Number(value);
        }

        items[itemIndex] = item;
        extracted.items = items;
        return { ...rec, extracted_data: extracted };
      })
    );
  };

  // ---------- SORT HANDLERS (RECEIPTS) ----------

  const handleReceiptSort = (field: ReceiptSortField) => {
    if (!field) return;

    setReceipts((prev) => {
      const nextDirection: SortDirection =
        receiptSortField === field && receiptSortDirection === "asc"
          ? "desc"
          : "asc";

      setReceiptSortField(field);
      setReceiptSortDirection(nextDirection);

      const sorted = [...prev].sort((a, b) => {
        const av =
          field === "date"
            ? (a.extracted_data.date
              ? new Date(a.extracted_data.date).getTime()
              : 0)
            : a.extracted_data.total_amount ?? 0;
        const bv =
          field === "date"
            ? (b.extracted_data.date
              ? new Date(b.extracted_data.date).getTime()
              : 0)
            : b.extracted_data.total_amount ?? 0;

        if (av === bv) return 0;
        if (nextDirection === "asc") return av < bv ? -1 : 1;
        return av > bv ? -1 : 1;
      });

      return sorted;
    });

    // Reset to first page when resorting for consistency
    setCurrentPage(1);
  };

  // ---------- SORT HANDLERS (ITEMS) ----------

  const handleItemSort = (field: ItemSortField, receiptId: number) => {
    if (!field) return;

    setReceipts((prev) => {
      const nextDirection: SortDirection =
        itemSortField === field && itemSortDirection === "asc"
          ? "desc"
          : "asc";

      setItemSortField(field);
      setItemSortDirection(nextDirection);

      return prev.map((rec) => {
        if (rec.id !== receiptId) return rec;

        const extracted = { ...rec.extracted_data };
        const items = [...extracted.items];

        items.sort((a, b) => {
          const av =
            field === "unit_price"
              ? a.unit_price ?? 0
              : a.line_total ?? 0;
          const bv =
            field === "unit_price"
              ? b.unit_price ?? 0
              : b.line_total ?? 0;

          if (av === bv) return 0;
          if (nextDirection === "asc") return av < bv ? -1 : 1;
          return av > bv ? -1 : 1;
        });

        extracted.items = items;
        return { ...rec, extracted_data: extracted };
      });
    });
  };

  const toggleAccordion = (id: number) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  // ---------- DUPLICATE DETECTION ----------

  // Build a map from receipt ID to highlight class if it is part of a duplicate group.
  const duplicateHighlightById = useMemo(() => {
    const sigToIds = new Map<string, number[]>();

    receipts.forEach((r) => {
      const d = r.extracted_data;
      const signature = `${(d.store_name ?? "").trim()}|${(d.date ?? "").trim()}|${d.total_amount ?? ""
        }`;

      if (!signature.replace(/\|/g, "").trim()) return; // ignore empty signatures

      const list = sigToIds.get(signature) ?? [];
      list.push(r.id);
      sigToIds.set(signature, list);
    });

    const result: Record<number, string> = {};
    let colorIndex = 0;

    for (const [, ids] of sigToIds.entries()) {
      if (ids.length > 1) {
        const colorClass =
          DUPLICATE_HIGHLIGHT_CLASSES[
          colorIndex % DUPLICATE_HIGHLIGHT_CLASSES.length
          ];
        colorIndex++;
        ids.forEach((id) => {
          result[id] = colorClass;
        });
      }
    }

    return result;
  }, [receipts]);

  // ---------- PAGINATION ----------

  const totalPages = Math.max(1, Math.ceil(receipts.length / rowsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number(e.target.value);
    setRowsPerPage(value);
    setCurrentPage(1);
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const startIndex = (currentPage - 1) * rowsPerPage;
  const pageReceipts = receipts.slice(startIndex, startIndex + rowsPerPage);


  // ---------- FILTER RECEIPTS FOR CHART ----------
  const filteredReceiptsForChart = useMemo(() => {
    if (receipts.length === 0) return [];

    const parseDate = (d: string | null) => (d ? new Date(d) : null);

    return receipts.filter((r) => {
      const d = parseDate(r.extracted_data.date);
      if (!d) return false;

      switch (dateFilterType) {
        case "month": {
          const [year, month] = selectedMonth.split("-");
          return (
            d.getFullYear() === Number(year) &&
            d.getMonth() + 1 === Number(month)
          );
        }
        case "year":
          return d.getFullYear() === Number(selectedYear);

        case "quarter": {
          const q = Math.floor(d.getMonth() / 3) + 1;
          return `Q${q}` === selectedQuarter && d.getFullYear() === Number(selectedYear);
        }

        case "custom": {
          const start = customStart ? new Date(customStart) : null;
          const end = customEnd ? new Date(customEnd) : null;

          if (start && d < start) return false;
          if (end && d > end) return false;
          return true;
        }

        default:
          return true;
      }
    });
  }, [receipts, dateFilterType, selectedMonth, selectedQuarter, selectedYear, customStart, customEnd]);

  // ---------- BUILD CATEGORY TOTALS FOR PIE CHART ----------
  const pieChartData = useMemo(() => {
    const map: Record<string, number> = {};

    filteredReceiptsForChart.forEach((r) => {
      const cat = r.extracted_data.category ?? "Uncategorized";
      const total = r.extracted_data.total_amount ?? 0;

      map[cat] = (map[cat] || 0) + total;
    });

    return Object.keys(map).map((cat) => ({
      name: cat,
      value: map[cat],
    }));
  }, [filteredReceiptsForChart]);


  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <header className="space-y-1">
          <h1 className="text-3xl font-bold">SnapSpend Lite — Receipt Extractor</h1>
          <p className="text-gray-600">
            Upload multiple receipts, then validate and edit extracted data in a table.
          </p>
        </header>

        {/* TOP UPLOAD PANEL */}
        <section className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={handleFileChange}
              className="w-full border rounded-xl p-2"
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={loading || !files || files.length === 0}
            className="mt-2 md:mt-0 md:ml-4 bg-indigo-600 text-white px-5 py-2 rounded-xl disabled:opacity-50 hover:bg-indigo-700"
          >
            {loading ? "Processing…" : "Upload & Extract"}
          </button>
        </section>

        {/* RECEIPTS TABLE + ACCORDION */}
        {receipts.length > 0 && (
          <section className="bg-white rounded-2xl shadow p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Receipts Summary</h2>
                <p className="text-sm text-gray-500">
                  Click a row to expand and see its line items. Duplicate receipts are
                  highlighted with colored side borders.
                </p>
              </div>
              {/* Pagination controls */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <select
                    value={rowsPerPage}
                    onChange={handleRowsPerPageChange}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value={10}>10</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className="border rounded px-2 py-1 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span>
                    Page <strong>{currentPage}</strong> of {totalPages}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="border rounded px-2 py-1 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <Th>#</Th>
                    <Th>Store Name</Th>
                    <Th>Address</Th>
                    <Th>Tax ID</Th>
                    <SortableTh
                      label="Date"
                      active={receiptSortField === "date"}
                      direction={receiptSortDirection}
                      onClick={() => handleReceiptSort("date")}
                    />
                    <Th>Payment</Th>
                    <Th>Subtotal</Th>
                    <Th>Tax</Th>
                    <SortableTh
                      label="Total"
                      active={receiptSortField === "total_amount"}
                      direction={receiptSortDirection}
                      onClick={() => handleReceiptSort("total_amount")}
                    />
                    <Th>Category</Th>
                    <Th>Currency</Th>
                    <Th>Confidence</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {pageReceipts.map((receipt, indexOnPage) => {
                    const d = receipt.extracted_data;
                    const isExpanded = expandedId === receipt.id;
                    const globalIndex = startIndex + indexOnPage;
                    const duplicateClass =
                      duplicateHighlightById[receipt.id] ?? "";

                    return (
                      <React.Fragment key={receipt.id}>
                        <tr
                          onClick={() => toggleAccordion(receipt.id)}
                          className={`border-b hover:bg-gray-50 cursor-pointer ${isExpanded ? "bg-indigo-50" : ""
                            } ${duplicateClass}`}
                        >
                          <Td>{globalIndex + 1}</Td>

                          <Td>
                            <input
                              className="w-full border rounded px-1 py-0.5 text-xs"
                              value={d.store_name ?? ""}
                              onChange={(e) =>
                                updateReceiptField(
                                  receipt.id,
                                  "store_name",
                                  e.target.value
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Td>

                          <Td>
                            <input
                              className="w-full border rounded px-1 py-0.5 text-xs"
                              value={d.store_address ?? ""}
                              onChange={(e) =>
                                updateReceiptField(
                                  receipt.id,
                                  "store_address",
                                  e.target.value
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Td>

                          <Td>
                            <input
                              className="w-full border rounded px-1 py-0.5 text-xs"
                              value={d.store_tax_id ?? ""}
                              onChange={(e) =>
                                updateReceiptField(
                                  receipt.id,
                                  "store_tax_id",
                                  e.target.value
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Td>

                          <Td>
                            <input
                              className="w-full border rounded px-1 py-0.5 text-xs"
                              value={d.date ?? ""}
                              onChange={(e) =>
                                updateReceiptField(
                                  receipt.id,
                                  "date",
                                  e.target.value
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Td>

                          <Td>
                            <input
                              className="w-full border rounded px-1 py-0.5 text-xs"
                              value={d.payment_method ?? ""}
                              onChange={(e) =>
                                updateReceiptField(
                                  receipt.id,
                                  "payment_method",
                                  e.target.value
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Td>

                          <Td className="text-right">
                            <input
                              className="w-full border rounded px-1 py-0.5 text-xs text-right"
                              value={d.subtotal_amount ?? ""}
                              onChange={(e) =>
                                updateReceiptField(
                                  receipt.id,
                                  "subtotal_amount",
                                  e.target.value
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Td>

                          <Td className="text-right">
                            <input
                              className="w-full border rounded px-1 py-0.5 text-xs text-right"
                              value={d.tax_amount ?? ""}
                              onChange={(e) =>
                                updateReceiptField(
                                  receipt.id,
                                  "tax_amount",
                                  e.target.value
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Td>

                          <Td className="text-right">
                            <input
                              className="w-full border rounded px-1 py-0.5 text-xs text-right"
                              value={d.total_amount ?? ""}
                              onChange={(e) =>
                                updateReceiptField(
                                  receipt.id,
                                  "total_amount",
                                  e.target.value
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Td>

                          <Td>
                            <input
                              className="w-full border rounded px-1 py-0.5 text-xs"
                              value={d.category ?? ""}
                              onChange={(e) =>
                                updateReceiptField(
                                  receipt.id,
                                  "category",
                                  e.target.value
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Td>

                          <Td>
                            <input
                              className="w-full border rounded px-1 py-0.5 text-xs"
                              value={d.currency ?? ""}
                              onChange={(e) =>
                                updateReceiptField(
                                  receipt.id,
                                  "currency",
                                  e.target.value
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Td>

                          <Td className="text-center">
                            {(d.confidence_score * 100).toFixed(0)}%
                          </Td>

                          <Td className="text-center">
                            <button
                              className="text-red-600 text-xs border border-red-200 rounded px-2 py-0.5 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteReceipt(receipt.id);
                              }}
                            >
                              Delete
                            </button>
                          </Td>
                        </tr>

                        {/* ACCORDION ROW */}
                        {isExpanded && (
                          <tr>
                            <Td colSpan={13} className="bg-gray-50">
                              <LineItemsTable
                                receipt={receipt}
                                sortField={itemSortField}
                                sortDirection={itemSortDirection}
                                onSort={(field) => handleItemSort(field, receipt.id)}
                                onUpdateItem={updateItemField}
                              />
                            </Td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {receipts.length > 0 && (
          <section className="bg-white rounded-2xl shadow p-4 space-y-4">
            <h2 className="text-xl font-semibold">Expense Breakdown</h2>

            {/* DATE FILTERS */}
            <div className="flex flex-wrap gap-4 items-center">
              <select
                value={dateFilterType}
                onChange={(e) => setDateFilterType(e.target.value as any)}
                className="border px-2 py-1 rounded text-sm"
              >
                <option value="month">By Month</option>
                <option value="quarter">By Quarter</option>
                <option value="year">By Year</option>
                <option value="custom">Custom Range</option>
              </select>

              {/* MONTH */}
              {dateFilterType === "month" && (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="border px-2 py-1 rounded text-sm"
                />
              )}

              {/* QUARTER */}
              {dateFilterType === "quarter" && (
                <>
                  <select
                    value={selectedQuarter}
                    onChange={(e) => setSelectedQuarter(e.target.value as any)}
                    className="border px-2 py-1 rounded text-sm"
                  >
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                  </select>

                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="border px-2 py-1 rounded text-sm w-24"
                  />
                </>
              )}

              {/* YEAR */}
              {dateFilterType === "year" && (
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="border px-2 py-1 rounded text-sm w-24"
                />
              )}

              {/* CUSTOM RANGE */}
              {dateFilterType === "custom" && (
                <>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="border px-2 py-1 rounded text-sm"
                  />
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="border px-2 py-1 rounded text-sm"
                  />
                </>
              )}
            </div>

            {/* PIE CHART */}
            <div className="w-full flex justify-center">
              <PieChart width={350} height={350}>
                <Pie
                  data={pieChartData}
                  cx={175}
                  cy={170}
                  innerRadius={60}
                  outerRadius={130}
                  dataKey="value"
                  paddingAngle={2}
                  labelLine={false}
                  label={renderPieLabel}  // 👈 custom label INSIDE slices
                >
                  {pieChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`hsl(${(index * 57) % 360} 70% 60%)`}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>

            </div>
          </section>
        )}


        {/* BOTTOM UPLOAD PANEL (for long tables) */}
        {receipts.length > 0 && (
          <section className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Upload more receipts</p>
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={handleFileChange}
                className="w-full border rounded-xl p-2"
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={loading || !files || files.length === 0}
              className="mt-2 md:mt-0 md:ml-4 bg-indigo-600 text-white px-5 py-2 rounded-xl disabled:opacity-50 hover:bg-indigo-700"
            >
              {loading ? "Processing…" : "Upload & Extract"}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

// ---------- LINE ITEMS TABLE (WITH IMAGE PREVIEW + MODAL) ----------

function LineItemsTable({
  receipt,
  sortField,
  sortDirection,
  onSort,
  onUpdateItem,
}: {
  receipt: ReceiptData;
  sortField: ItemSortField;
  sortDirection: SortDirection;
  onSort: (field: ItemSortField) => void;
  onUpdateItem: (
    receiptId: number,
    itemIndex: number,
    field: keyof ReceiptItem,
    value: string
  ) => void;
}) {
  const items = receipt.extracted_data.items;
  const imageUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}${receipt.file}`;

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleImageClick = () => {
    if (!imgError) {
      setIsModalOpen(true);
    }
  };

  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <div className="space-y-3">
        {/* HEADER + META */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
          {/* IMAGE PREVIEW PANEL */}
          <div className="md:w-1/3 space-y-2">
            <h3 className="font-semibold text-sm">
              Receipt Preview — {receipt.extracted_data.store_name ?? "Unknown Store"}
            </h3>
            <p className="text-[11px] text-gray-500">
              Click the image to zoom in without leaving the page.
            </p>

            <div className="border rounded-xl bg-white p-2 flex items-center justify-center min-h-40">
              {imgError ? (
                // Broken image fallback
                <div className="flex flex-col items-center justify-center text-gray-400 text-xs space-y-2 py-6">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-lg">⚠️</span>
                  </div>
                  <p>Receipt image not available.</p>
                </div>
              ) : (
                <>
                  {/* Skeleton while loading */}
                  {!imgLoaded && (
                    <div className="w-full h-40 bg-gray-200 rounded-lg animate-pulse" />
                  )}

                  {receipt.file && (
                    <img
                      src={imageUrl}
                      alt={`Receipt ${receipt.id}`}
                      className={`max-h-64 w-auto object-contain rounded-lg cursor-zoom-in ${imgLoaded ? "block" : "hidden"
                        }`}
                      onLoad={() => setImgLoaded(true)}
                      onError={() => setImgError(true)}
                      onClick={handleImageClick}
                    />
                  )}
                </>
              )}
            </div>

            <div className="text-[11px] text-gray-500 space-y-1">
              <p>
                <span className="font-medium">Date:</span>{" "}
                {receipt.extracted_data.date ?? "-"}
              </p>
              <p>
                <span className="font-medium">Total:</span>{" "}
                {receipt.extracted_data.total_amount ?? "-"}{" "}
                {receipt.extracted_data.currency ?? ""}
              </p>
              <p>
                <span className="font-medium">Category:</span>{" "}
                {receipt.extracted_data.category ?? "-"}
              </p>
              <p>
                <span className="font-medium">Confidence:</span>{" "}
                {(receipt.extracted_data.confidence_score * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          {/* LINE ITEMS TABLE */}
          <div className="md:w-2/3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm">
                Line Items — {receipt.extracted_data.store_name ?? "Unknown Store"}
              </h3>
              <span className="text-xs text-gray-500">
                {items.length} item{items.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full text-xs border-collapse bg-white">
                <thead className="bg-gray-100">
                  <tr>
                    <Th>#</Th>
                    <Th>Description</Th>
                    <Th>Qty</Th>
                    <SortableTh
                      small
                      label="Unit Price"
                      active={sortField === "unit_price"}
                      direction={sortDirection}
                      onClick={() => onSort("unit_price")}
                    />
                    <SortableTh
                      small
                      label="Line Total"
                      active={sortField === "line_total"}
                      direction={sortDirection}
                      onClick={() => onSort("line_total")}
                    />
                  </tr>
                </thead>
                <tbody>
                  {items.length > 0 ? (
                    items.map((item, itemIndex) => (
                      <tr key={itemIndex} className="border-b">
                        <Td>{itemIndex + 1}</Td>

                        <Td>
                          <input
                            className="w-full border rounded px-1 py-0.5 text-xs"
                            value={item.description}
                            onChange={(e) =>
                              onUpdateItem(
                                receipt.id,
                                itemIndex,
                                "description",
                                e.target.value
                              )
                            }
                          />
                        </Td>

                        <Td>
                          <input
                            className="w-full border rounded px-1 py-0.5 text-xs text-right"
                            value={item.quantity ?? ""}
                            onChange={(e) =>
                              onUpdateItem(
                                receipt.id,
                                itemIndex,
                                "quantity",
                                e.target.value
                              )
                            }
                          />
                        </Td>

                        <Td>
                          <input
                            className="w-full border rounded px-1 py-0.5 text-xs text-right"
                            value={item.unit_price ?? ""}
                            onChange={(e) =>
                              onUpdateItem(
                                receipt.id,
                                itemIndex,
                                "unit_price",
                                e.target.value
                              )
                            }
                          />
                        </Td>

                        <Td>
                          <input
                            className="w-full border rounded px-1 py-0.5 text-xs text-right"
                            value={item.line_total ?? ""}
                            onChange={(e) =>
                              onUpdateItem(
                                receipt.id,
                                itemIndex,
                                "line_total",
                                e.target.value
                              )
                            }
                          />
                        </Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <Td colSpan={5} className="text-center text-gray-500">
                        No items detected for this receipt.
                      </Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ZOOM MODAL */}
      {isModalOpen && !imgError && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={closeModal}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute -top-3 -right-3 bg-white rounded-full w-7 h-7 flex items-center justify-center text-xs shadow"
              onClick={closeModal}
            >
              ✕
            </button>
            <img
              src={imageUrl}
              alt={`Receipt ${receipt.id} (zoomed)`}
              className="max-h-[90vh] w-auto object-contain rounded-lg bg-white"
              onError={() => setImgError(true)}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ---------- SMALL TABLE HELPERS ----------

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-2 py-2 border text-left text-xs font-medium text-gray-700">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      className={`px-2 py-1 border align-top text-xs ${className}`}
      colSpan={colSpan}
    >
      {children}
    </td>
  );
}

function SortableTh({
  label,
  active,
  direction,
  onClick,
  small = false,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <th
      className={`px-2 py-2 border text-left ${small ? "text-xs" : "text-sm"
        } font-medium text-gray-700 cursor-pointer select-none`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-[10px] text-gray-500">
          {active ? (direction === "asc" ? "▲" : "▼") : "▽"}
        </span>
      </span>
    </th>
  );
}