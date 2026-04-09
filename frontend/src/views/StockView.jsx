/**
 * StockView.jsx
 *
 * Admin Hub view for Medicine Stock Management.
 * Features:
 *   - Stock Overview tab: live table of all medicine stock levels with
 *     low-stock badge highlighting and reorder level indicators.
 *   - History tab: Click any row to see the full audit adjustment history.
 *   - Adjust Stock tab (Admin only): Form to apply manual stock adjustments.
 *
 * Routes consumed:
 *   GET  /stock/               - List all stock
 *   GET  /stock/{id}/adjustments  - History for one medicine
 *   POST /stock/adjust         - Manual adjustment
 */
import React, { useState, useEffect, useCallback } from "react";
import { 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Download, FileText, Search
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatDateTime } from "../utils/dateUtils";

const API_BASE = "/api";

// -----------------------------------------------------------------------
// API helpers
// -----------------------------------------------------------------------
const authHeaders = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

async function fetchStock(token, search = "", skip = 0, limit = 20) {
  let url = `${API_BASE}/stock/?skip=${skip}&limit=${limit}`;
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error("Failed to fetch stock data");
  return res.json();
}

async function fetchAdjustments(token, medicineId) {
  const res = await fetch(`${API_BASE}/stock/${medicineId}/adjustments`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch adjustment history");
  return res.json();
}

async function postAdjustment(token, payload) {
  const res = await fetch(`${API_BASE}/stock/adjust`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Adjustment failed");
  return data;
}

async function postInitialize(token, payload, force = false) {
  const url = `${API_BASE}/stock/initialize${force ? "?force=true" : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.detail || "Initialization failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

// -----------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------


/** Badge showing Normal / Low / Out of Stock */
function StockBadge({ qty, reorderLevel }) {
  if (qty === 0) {
    return (
      <span style={styles.badge.outOfStock}>Out of Stock</span>
    );
  }
  if (qty <= reorderLevel) {
    return <span style={styles.badge.low}>Low Stock</span>;
  }
  return <span style={styles.badge.normal}>Normal</span>;
}

/** Adjustment type badge */
function TypeBadge({ type }) {
  const colorMap = {
    "OPENING_BALANCE": styles.badge.opening,
    "INVOICE_RECEIPT": styles.badge.normal,
    "MANUAL_ADJUSTMENT": styles.badge.manual,
    "WRITE_OFF": styles.badge.outOfStock,
    "DISPENSED": styles.badge.outOfStock,
    // Keep backwards compatibility for labels if needed
    "Opening Balance": styles.badge.opening,
    "Invoice Receipt": styles.badge.normal,
    "Manual Adjustment": styles.badge.manual,
    "Write-Off": styles.badge.outOfStock,
  };
  
  const labelMap = {
    "OPENING_BALANCE": "Opening Balance",
    "INVOICE_RECEIPT": "Invoice Receipt",
    "MANUAL_ADJUSTMENT": "Manual Adjustment",
    "WRITE_OFF": "Write-Off",
    "DISPENSED": "Dispensed",
  };

  return (
    <span style={colorMap[type] || styles.badge.manual}>
      {labelMap[type] || type}
    </span>
  );
}

/** Loading spinner */
function Spinner() {
  return (
    <div style={styles.spinner}>
      <div style={styles.spinnerDot} />
    </div>
  );
}

// -----------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------
/**
 * Medicine Stock Management View.
 * 
 * Provides:
 * - Real-time inventory overview for all medicines.
 * - Detailed batch-level breakdown and adjustment history.
 * - Role-based access: 
 *    - Staff: Read-only access to overview and history.
 *    - Admin: Full access including manual adjustments and initialization.
 * 
 * @param {Object} props - Component properties.
 * @param {Array} props.medicinesList - Master list of medicines.
 * @param {string} props.token - JWT authentication token.
 * @param {string} props.userRole - Current user's role.
 */
export default function StockView({ medicinesList = [], token, userRole }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [stockData, setStockData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage]   = useState(1);
  const pageSize = 20;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // History panel state
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Redundant local medicinesList state removed - now using props
  const [adjustForm, setAdjustForm] = useState({
    medicine_id: "",
    quantity_change: "",
    adjustment_type: "MANUAL_ADJUSTMENT",
    reason: "",
  });
  const [adjusting, setAdjusting] = useState(false);

  // Initialize form state
  const todayStr = new Date().toISOString().split("T")[0];
  const [initForm, setInitForm] = useState({
    medicine_id: "",
    quantity: "",
    initialized_date: todayStr,
    notes: "",
  });
  const [initing, setIniting] = useState(false);
  const [handle409, setHandle409] = useState(false); // show force-override option

  /**
   * Loads current stock levels from the backend with pagination.
   * 
   * @param {string} search - Optional search query.
   * @param {number} page - Page number to load.
   */
  const loadStock = useCallback(async (search = "", page = 1) => {
    setLoading(true);
    setError("");
    try {
      const skip = (page - 1) * pageSize;
      const data = await fetchStock(token, search, skip, pageSize);
      setStockData(data.items);
      setTotalRecords(data.total);
      setCurrentPage(page);
    } catch (e) {
      setError(e.message);
      console.error("Stock: Load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadStock(searchTerm, 1); // Reset to page 1 on new search
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, loadStock]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > Math.ceil(totalRecords / pageSize)) return;
    loadStock(searchTerm, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Generates a professional multi-page A4 PDF of the price list.
   * Exports ALL records matching current search criteria.
   */
  const handleExportPDF = async () => {
    setLoading(true);
    setSuccess("");
    setError("");
    try {
      // Fetch ALL matching stock for export (bypass pagination limit)
      const data = await fetchStock(token, searchTerm, 0, 5000); 
      const allItems = data.items;

      const doc = new jsPDF('p', 'mm', 'a4');
      const dateStr = new Date().toLocaleDateString();
      const timeStr = new Date().toLocaleTimeString();

      // Styling and Content
      doc.setFontSize(22);
      doc.setTextColor(6, 148, 162); // Theme color
      doc.text("Pharmacy Inventory - Price List", 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${dateStr} ${timeStr}`, 14, 30);
      doc.text(`Total Records: ${data.total}`, 14, 36);

      const tableData = allItems.map((item, index) => [
        index + 1,
        item.medicine?.product_name || `Medicine ID: ${item.medicine_id}`,
        item.medicine?.generic_name || "—",
        item.medicine?.category || "—",
        item.quantity_on_hand.toString(),
        `RS. ${item.unit_price?.toFixed(0) || "0"}`,
        `${item.gst_percent || 0}%`,
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['S.No', 'Product Name', 'Generic Name', 'Category', 'Stock Qty', 'Unit Price', 'GST %']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [6, 148, 162], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [247, 250, 252] },
        styles: { fontSize: 9, cellPadding: 4, font: 'helvetica' },
        columnStyles: {
            0: { cellWidth: 12, halign: 'center' }, // S.No
            1: { cellWidth: 40 }, // Product Name
            2: { cellWidth: 40 }, // Generic Name
            4: { halign: 'center', cellWidth: 20 },
            5: { halign: 'right', fontStyle: 'bold', cellWidth: 25 },
            6: { halign: 'center', cellWidth: 15 },
        },
        margin: { top: 45, bottom: 20 },
        didDrawPage: (data) => {
            // Footer with page numbering
            const str = "Page " + doc.internal.getNumberOfPages();
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text(str, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
            doc.text("Pharmacy Inventory System", 14, doc.internal.pageSize.height - 10);
        }
      });

      const fileName = `PriceList_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Use Blob and anchor tagging for more robust file naming across browsers
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess("Full Price List exported as PDF successfully!");
    } catch (e) {
      setError("Failed to export PDF: " + e.message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles row click to show the detailed history panel.
   * 
   * @param {Object} stockItem - The stock record that was clicked.
   */
  const handleRowClick = async (stockItem) => {
    setSelectedMedicine(stockItem);
    setHistoryLoading(true);
    setError("");
    try {
      const data = await fetchAdjustments(token, stockItem.medicine_id);
      setHistory(data);
    } catch (e) {
      setError(e.message);
      console.error("Stock: History fetch failed", e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!adjustForm.medicine_id || !adjustForm.quantity_change || !adjustForm.reason.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setAdjusting(true);
    try {
      await postAdjustment(token, {
        medicine_id: parseInt(adjustForm.medicine_id),
        quantity_change: parseInt(adjustForm.quantity_change),
        adjustment_type: adjustForm.adjustment_type,
        reason: adjustForm.reason.trim(),
      });
      setSuccess("Stock adjustment applied successfully!");
      setAdjustForm({ medicine_id: "", quantity_change: "", adjustment_type: "MANUAL_ADJUSTMENT", reason: "" });
      await loadStock();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdjusting(false);
    }
  };

  const handleInitSubmit = async (e, forceOverride = false) => {
    e && e.preventDefault();
    setError("");
    setSuccess("");
    if (!initForm.medicine_id || initForm.quantity === "" || !initForm.initialized_date) {
      setError("Please fill in Medicine, Opening Quantity, and Date.");
      return;
    }
    setIniting(true);
    try {
      await postInitialize(
        token,
        {
          medicine_id: parseInt(initForm.medicine_id),
          quantity: parseInt(initForm.quantity),
          initialized_date: initForm.initialized_date,
          notes: initForm.notes.trim() || null,
        },
        forceOverride
      );
      setSuccess("Opening stock balance initialized successfully!");
      setInitForm({ medicine_id: "", quantity: "", initialized_date: todayStr, notes: "" });
      setHandle409(false);
      await loadStock();
    } catch (e) {
      if (e.status === 409) {
        setHandle409(true);
        setError(e.message);
      } else {
        setError(e.message);
        setHandle409(false);
      }
    } finally {
      setIniting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const tabs = [
    { id: "overview", label: "📦 Stock Overview" },
    { id: "pricing", label: "🏷️ Price List" },
    { id: "initialize", label: "🔢 Initialize Stock", adminOnly: true },
    { id: "adjust", label: "✏️ Adjust Stock", adminOnly: true },
  ];

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Stock Management</h2>
      <p style={styles.subheading}>
        Live medicine inventory levels. Stock updates automatically when pharmacy invoices are received.
      </p>

      {/* Tab Bar */}
      <div style={styles.tabBar}>
        {tabs.map((tab) => {
          if (tab.adminOnly && userRole !== "Admin") return null;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSuccess(""); setError(""); }}
              style={activeTab === tab.id ? styles.tabActive : styles.tab}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Feedback messages */}
      {error && <div style={styles.errorBox}>{error}</div>}
      {success && <div style={styles.successBox}>{success}</div>}

      {/* Stock Overview Tab */}
      {activeTab === "overview" && (
        <div>
          <div style={styles.toolbar}>
            <div style={styles.searchWrapper}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Search by product name or generic name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  style={styles.clearButton}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <p style={styles.hint}>Click any row to view its full adjustment history.</p>
          {loading ? (
            <Spinner />
          ) : stockData.length === 0 ? (
            <div style={styles.emptyState}>
              No stock records found. Create a pharmacy invoice to automatically add stock.
            </div>
          ) : (
            <>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHead}>
                      <th style={styles.th}>Medicine</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>UoM</th>
                      <th style={styles.th}>On Hand</th>
                      <th style={styles.th}>Reorder Level</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockData.map((item) => (
                      <tr
                        key={item.id}
                        style={selectedMedicine?.id === item.id ? styles.rowSelected : styles.row}
                        onClick={() => handleRowClick(item)}
                      >
                        <td style={styles.td}>
                          <strong>{item.medicine?.product_name ?? `Medicine #${item.medicine_id}`}</strong>
                          {item.medicine?.generic_name && (
                            <div style={styles.genericName}>{item.medicine.generic_name}</div>
                          )}
                        </td>
                        <td style={styles.td}>{item.medicine?.category ?? "—"}</td>
                        <td style={styles.td}>{item.medicine?.uom ?? "—"}</td>
                        <td style={{ ...styles.td, ...styles.qtyCell }}>
                          {item.quantity_on_hand}
                        </td>
                        <td style={styles.td}>{item.reorder_level || 0}</td>
                        <td style={styles.td}>
                          <StockBadge qty={item.quantity_on_hand} reorderLevel={item.reorder_level || 0} />
                        </td>
                        <td style={styles.td}>
                          {item.last_updated_at ? formatDateTime(item.last_updated_at) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              <div style={styles.paginationRow}>
                <div style={styles.paginationSummary}>
                  Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> - <strong>{Math.min(currentPage * pageSize, totalRecords)}</strong> of <strong>{totalRecords}</strong> medicines
                </div>
                <div style={styles.paginationControls}>
                  <button 
                    style={currentPage === 1 ? styles.pageBtnDisabled : styles.pageBtn} 
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button 
                    style={currentPage === 1 ? styles.pageBtnDisabled : styles.pageBtn} 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  
                  <span style={styles.pageIndicator}>Page {currentPage} of {Math.ceil(totalRecords / pageSize)}</span>
                  
                  <button 
                    style={currentPage >= Math.ceil(totalRecords / pageSize) ? styles.pageBtnDisabled : styles.pageBtn} 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button 
                    style={currentPage >= Math.ceil(totalRecords / pageSize) ? styles.pageBtnDisabled : styles.pageBtn} 
                    onClick={() => handlePageChange(Math.ceil(totalRecords / pageSize))}
                    disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Price List Tab */}
      {activeTab === "pricing" && (
        <div>
          <div style={styles.toolbar}>
            <div style={styles.searchWrapper}>
              <span style={styles.searchIcon}>🔍</span>
              <input
                type="text"
                placeholder="Search products for pricing..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  style={styles.clearButton}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            
            <button 
              onClick={handleExportPDF} 
              disabled={loading || totalRecords === 0}
              style={styles.exportBtn}
            >
              <FileText size={18} /> Export ALL to PDF (A4)
            </button>
          </div>
          <p style={styles.hint}>
            Unit prices are calculated based on the active batch MRP and medicine selling price percentage.
          </p>
          {loading ? (
            <Spinner />
          ) : stockData.length === 0 ? (
            <div style={styles.emptyState}>No medicines found in stock.</div>
          ) : (
            <>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHead}>
                      <th style={{ ...styles.th, width: '50px' }}>S.No</th>
                      <th style={styles.th}>Medicine</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Stock Qty</th>
                      <th style={styles.th}>Unit Price (₹)</th>
                      <th style={styles.th}>GST %</th>
                      <th style={styles.th}>Active Batch MRP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockData.map((item, index) => {
                      // Identify the active batch (earliest expiring with stock) for MRP display
                      const activeBatch = item.medicine?.batches
                        ?.filter(b => b.quantity_on_hand > 0)
                        .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))[0] || {};
                      
                      return (
                        <tr key={item.id} style={styles.row}>
                          <td style={{ ...styles.td, color: "#718096", fontSize: "12px" }}>
                            {(currentPage - 1) * pageSize + index + 1}
                          </td>
                          <td style={styles.td}>
                            <strong>{item.medicine?.product_name || `Medicine #${item.medicine_id}`}</strong>
                            {item.medicine?.generic_name && (
                              <div style={styles.genericName}>{item.medicine.generic_name}</div>
                            )}
                          </td>
                          <td style={styles.td}>{item.medicine?.category ?? "—"}</td>
                          <td style={styles.td}>{item.quantity_on_hand}</td>
                          <td style={{ ...styles.td, fontWeight: 700, color: "#2D3748" }}>
                            ₹{item.unit_price?.toFixed(0) || "0"}
                          </td>
                          <td style={styles.td}>{item.gst_percent || 0}%</td>
                          <td style={styles.td}>
                            {activeBatch.mrp ? `₹${activeBatch.mrp.toFixed(2)}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div style={styles.paginationRow}>
                <div style={styles.paginationSummary}>
                  Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> - <strong>{Math.min(currentPage * pageSize, totalRecords)}</strong> of <strong>{totalRecords}</strong> medicines
                </div>
                <div style={styles.paginationControls}>
                  <button 
                    style={currentPage === 1 ? styles.pageBtnDisabled : styles.pageBtn} 
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button 
                    style={currentPage === 1 ? styles.pageBtnDisabled : styles.pageBtn} 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  
                  <span style={styles.pageIndicator}>Page {currentPage} of {Math.ceil(totalRecords / pageSize)}</span>
                  
                  <button 
                    style={currentPage >= Math.ceil(totalRecords / pageSize) ? styles.pageBtnDisabled : styles.pageBtn} 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button 
                    style={currentPage >= Math.ceil(totalRecords / pageSize) ? styles.pageBtnDisabled : styles.pageBtn} 
                    onClick={() => handlePageChange(Math.ceil(totalRecords / pageSize))}
                    disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Initialize Stock Tab */}
          {selectedMedicine && (
            <div style={styles.historyPanel}>
              <h3 style={styles.historyHeading}>
                📋 Stock Breakdown & History — {selectedMedicine.medicine?.product_name ?? `Medicine #${selectedMedicine.medicine_id}`}
              </h3>

              {/* Batch Breakdown Section */}
              <div style={{ marginBottom: "28px" }}>
                <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#4A5568", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  📦 Active Batches (FEFO Order)
                </h4>
                {(!selectedMedicine.medicine?.batches || selectedMedicine.medicine.batches.length === 0) ? (
                  <p style={styles.hint}>No active batches found for this medicine.</p>
                ) : (
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr style={{ ...styles.tableHead, background: "#EDF2F7" }}>
                          <th style={styles.th}>Batch No</th>
                          <th style={styles.th}>Expiry Date</th>
                          <th style={styles.th}>Purchase Price (₹)</th>
                          <th style={styles.th}>Qty on Hand</th>
                          <th style={styles.th}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedMedicine.medicine.batches
                          .filter(b => b.quantity_on_hand > 0)
                          .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
                          .map((batch) => {
                            const isExpired = new Date(batch.expiry_date) < new Date();
                            const isNearExpiry = new Date(batch.expiry_date) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
                            return (
                              <tr key={batch.id} style={styles.row}>
                                <td style={styles.td}><strong>{batch.batch_no}</strong></td>
                                <td style={{ ...styles.td, color: isExpired ? "#C53030" : isNearExpiry ? "#B7791F" : "#2D3748", fontWeight: (isExpired || isNearExpiry) ? 700 : 400 }}>
                                  {formatDate(batch.expiry_date)}
                                  {isExpired && " (EXPIRED)"}
                                  {!isExpired && isNearExpiry && " (Near Expiry)"}
                                </td>
                                <td style={styles.td}>₹{batch.purchase_price.toFixed(2)}</td>
                                <td style={{ ...styles.td, fontWeight: 700 }}>{batch.quantity_on_hand}</td>
                                <td style={styles.td}>
                                  {isExpired ? (
                                    <span style={{ ...styles.badge.outOfStock, fontSize: "11px" }}>Expired</span>
                                  ) : isNearExpiry ? (
                                    <span style={{ ...styles.badge.low, fontSize: "11px" }}>Near Expiry</span>
                                  ) : (
                                    <span style={{ ...styles.badge.normal, fontSize: "11px" }}>Good</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#4A5568", marginBottom: "12px" }}>
                📜 Adjustment History
              </h4>
              {historyLoading ? (
                <Spinner />
              ) : history.length === 0 ? (
                <p style={styles.hint}>No adjustments recorded yet.</p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHead}>
                        <th style={styles.th}>Date</th>
                        <th style={styles.th}>Type</th>
                        <th style={styles.th}>Change</th>
                        <th style={styles.th}>Batch</th>
                        <th style={styles.th}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((adj) => (
                        <tr key={adj.id} style={styles.row}>
                          <td style={styles.td}>{formatDateTime(adj.adjusted_at)}</td>
                          <td style={styles.td}><TypeBadge type={adj.adjustment_type} /></td>
                          <td style={{ ...styles.td, ...(adj.quantity_change >= 0 ? styles.changePositive : styles.changeNegative) }}>
                            {adj.quantity_change > 0 ? "+" : ""}{adj.quantity_change}
                          </td>
                          <td style={styles.td}>
                            {adj.batch ? (
                              <span style={{ fontSize: "12px", color: "#4A5568", background: "#EDF2F7", padding: "2px 6px", borderRadius: "4px" }}>
                                {adj.batch.batch_no}
                              </span>
                            ) : "—"}
                          </td>
                          <td style={styles.td}>{adj.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
            </div>
          )}
        </div>
      )}

      {/* Initialize Stock Tab (Admin only) */}
      {activeTab === "initialize" && userRole === "Admin" && (
        <div style={styles.formCard}>
          <h3 style={styles.formHeading}>Initialize Opening Stock Balance</h3>
          <p style={styles.hint}>
            Use this to seed stock for medicines that existed before the system was digitized.
            This <strong>sets</strong> the stock to the absolute quantity you specify — it does
            not add to existing stock.
          </p>
          {handle409 && (
            <div style={styles.warnBox}>
              ⚠️ This medicine already has an Opening Balance. Tick the checkbox to force-replace it.
              <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) handleInitSubmit(null, true);
                  }}
                />
                Yes, replace the existing Opening Balance
              </label>
            </div>
          )}
          <form onSubmit={handleInitSubmit} style={{ ...styles.form, marginTop: "16px" }}>
            <label htmlFor="init_medicine_id" style={styles.label}>Medicine</label>
            <select
              id="init_medicine_id"
              value={initForm.medicine_id}
              onChange={(e) => { setInitForm({ ...initForm, medicine_id: e.target.value }); setHandle409(false); setError(""); }}
              style={styles.select}
              required
            >
              <option value="">— Select a medicine —</option>
              {medicinesList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.product_name} 
                  {stockData.find(s => s.medicine_id === m.id) 
                    ? ` (Current: ${stockData.find(s => s.medicine_id === m.id).quantity_on_hand})`
                    : " (No Stock Record)"}
                </option>
              ))}
            </select>

            <label htmlFor="init_quantity" style={styles.label}>Opening Quantity</label>
            <input
              id="init_quantity"
              type="number"
              min="0"
              placeholder="e.g. 500"
              value={initForm.quantity}
              onChange={(e) => setInitForm({ ...initForm, quantity: e.target.value })}
              style={styles.input}
              required
            />

            <label htmlFor="init_date" style={styles.label}>Initialization Date</label>
            <p style={{ ...styles.hint, marginBottom: "4px" }}>
              Set this to the date the physical stock count was taken — can be historical.
            </p>
            <input
              id="init_date"
              type="date"
              value={initForm.initialized_date}
              onChange={(e) => setInitForm({ ...initForm, initialized_date: e.target.value })}
              style={styles.input}
              required
            />

            <label htmlFor="init_notes" style={styles.label}>Notes (Optional)</label>
            <textarea
              id="init_notes"
              placeholder="e.g. Opening balance from Jan 2024 physical count — Shelf B2"
              value={initForm.notes}
              onChange={(e) => setInitForm({ ...initForm, notes: e.target.value })}
              style={styles.textarea}
              rows={3}
            />

            <button type="submit" disabled={initing} style={styles.initBtn}>
              {initing ? "Initializing..." : "Set Opening Balance"}
            </button>
          </form>
        </div>
      )}

      {/* Adjust Stock Tab (Admin only) */}
      {activeTab === "adjust" && userRole === "Admin" && (
        <div style={styles.formCard}>
          <h3 style={styles.formHeading}>Manual Stock Adjustment</h3>
          <p style={styles.hint}>
            Use a positive quantity to add stock, or a negative value to write off / correct downward.
          </p>
          <form onSubmit={handleAdjustSubmit} style={styles.form}>
            <label htmlFor="adjust_medicine_id" style={styles.label}>Medicine</label>
            <select
              id="adjust_medicine_id"
              value={adjustForm.medicine_id}
              onChange={(e) => setAdjustForm({ ...adjustForm, medicine_id: e.target.value })}
              style={styles.select}
              required
            >
              <option value="">— Select a medicine —</option>
              {medicinesList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.product_name}
                  {stockData.find(s => s.medicine_id === m.id) 
                    ? ` (Current: ${stockData.find(s => s.medicine_id === m.id).quantity_on_hand})`
                    : " (No Stock Record)"}
                </option>
              ))}
            </select>

            <label htmlFor="adjust_quantity_change" style={styles.label}>Quantity Change</label>
            <input
              id="adjust_quantity_change"
              type="number"
              placeholder="e.g. +10 or -5"
              value={adjustForm.quantity_change}
              onChange={(e) => setAdjustForm({ ...adjustForm, quantity_change: e.target.value })}
              style={styles.input}
              required
            />

            <label style={styles.label}>Adjustment Type</label>
            <select
              value={adjustForm.adjustment_type}
              onChange={(e) => setAdjustForm({ ...adjustForm, adjustment_type: e.target.value })}
              style={styles.select}
            >
              <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
              <option value="WRITE_OFF">Write-Off</option>
            </select>

            <label htmlFor="adjust_reason" style={styles.label}>Reason</label>
            <textarea
              id="adjust_reason"
              placeholder="e.g. Physical count — found 10 extra units on shelf C3"
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              style={styles.textarea}
              rows={3}
              required
            />

            <button type="submit" disabled={adjusting} style={styles.submitBtn}>
              {adjusting ? "Applying..." : "Apply Adjustment"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------
const styles = {
  container: {
    padding: "24px",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  heading: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#1a202c",
    margin: "0 0 4px",
  },
  subheading: {
    color: "#718096",
    fontSize: "14px",
    margin: "0 0 24px",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    gap: "16px",
    flexWrap: "wrap",
  },
  searchWrapper: {
    position: "relative",
    flex: 1,
    minWidth: "300px",
    maxWidth: "500px",
    display: "flex",
    alignItems: "center",
  },
  exportBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 20px",
    background: "#0694a2",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  paginationRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "20px",
    padding: "12px 16px",
    background: "#F7FAFC",
    borderRadius: "10px",
    border: "1px solid #E2E8F0",
  },
  paginationSummary: {
    fontSize: "13px",
    color: "#4A5568",
  },
  paginationControls: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  pageBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "34px",
    height: "34px",
    background: "white",
    border: "1px solid #E2E8F0",
    borderRadius: "8px",
    cursor: "pointer",
    color: "#4A5568",
    transition: "all 0.2s",
  },
  pageBtnDisabled: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "34px",
    height: "34px",
    background: "#EDF2F7",
    border: "1px solid #E2E8F0",
    borderRadius: "8px",
    color: "#A0AEC0",
    cursor: "not-allowed",
    opacity: 0.6,
  },
  pageIndicator: {
    fontSize: "13px",
    color: "#4A5568",
    margin: "0 10px",
    background: "white",
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid #E2E8F0",
    fontWeight: 500,
  },
  tabBar: {
    display: "flex",
    gap: "8px",
    borderBottom: "2px solid #e2e8f0",
    marginBottom: "24px",
  },
  tab: {
    background: "none",
    border: "none",
    borderBottom: "3px solid transparent",
    padding: "10px 18px",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: "14px",
    color: "#718096",
    marginBottom: "-2px",
  },
  tabActive: {
    background: "none",
    border: "none",
    borderBottom: "3px solid #4f46e5",
    padding: "10px 18px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
    color: "#4f46e5",
    marginBottom: "-2px",
  },
  errorBox: {
    background: "#FFF5F5",
    border: "1px solid #FC8181",
    borderRadius: "8px",
    padding: "12px 16px",
    color: "#C53030",
    fontSize: "14px",
    marginBottom: "16px",
  },
  successBox: {
    background: "#F0FFF4",
    border: "1px solid #68D391",
    borderRadius: "8px",
    padding: "12px 16px",
    color: "#276749",
    fontSize: "14px",
    marginBottom: "16px",
  },
  emptyState: {
    textAlign: "center",
    padding: "48px",
    color: "#A0AEC0",
    fontSize: "15px",
    background: "#F7FAFC",
    borderRadius: "12px",
    border: "2px dashed #CBD5E0",
  },
  hint: {
    color: "#718096",
    fontSize: "13px",
    marginBottom: "12px",
  },
  tableWrapper: {
    overflowX: "auto",
    borderRadius: "10px",
    border: "1px solid #e2e8f0",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  tableHead: {
    background: "#F7FAFC",
  },
  th: {
    padding: "12px 16px",
    textAlign: "left",
    fontWeight: 600,
    color: "#4A5568",
    borderBottom: "2px solid #E2E8F0",
    whiteSpace: "nowrap",
  },
  row: {
    cursor: "pointer",
    transition: "background 0.15s",
    borderBottom: "1px solid #EDF2F7",
  },
  rowSelected: {
    cursor: "pointer",
    background: "#EEF2FF",
    borderBottom: "1px solid #C7D2FE",
  },
  td: {
    padding: "12px 16px",
    color: "#2D3748",
    verticalAlign: "middle",
  },
  qtyCell: {
    fontWeight: 700,
    fontSize: "16px",
    color: "#2D3748",
  },
  genericName: {
    fontSize: "12px",
    color: "#718096",
    fontStyle: "italic",
  },
  changePositive: { color: "#276749", fontWeight: 700 },
  changeNegative: { color: "#C53030", fontWeight: 700 },
  badge: {
    opening: {
      background: "#FEEBC8",
      color: "#744210",
      padding: "3px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 600,
    },
    normal: {
      background: "#C6F6D5",
      color: "#276749",
      padding: "3px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 600,
    },
    low: {
      background: "#FEFCBF",
      color: "#975A16",
      padding: "3px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 600,
    },
    outOfStock: {
      background: "#FED7D7",
      color: "#C53030",
      padding: "3px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 600,
    },
    manual: {
      background: "#BEE3F8",
      color: "#2A69AC",
      padding: "3px 10px",
      borderRadius: "999px",
      fontSize: "12px",
      fontWeight: 600,
    },
  },
  searchIcon: {
    position: "absolute",
    left: "12px",
    fontSize: "16px",
    color: "#A0AEC0",
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    padding: "10px 40px 10px 40px",
    borderRadius: "8px",
    border: "1px solid #E2E8F0",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    backgroundColor: "#FFFFFF",
  },
  clearButton: {
    position: "absolute",
    right: "12px",
    background: "none",
    border: "none",
    color: "#A0AEC0",
    cursor: "pointer",
    fontSize: "14px",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  historyPanel: {
    marginTop: "32px",
    padding: "20px",
    background: "#F7FAFC",
    borderRadius: "12px",
    border: "1px solid #E2E8F0",
  },
  historyHeading: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#2D3748",
    margin: "0 0 16px",
  },
  formCard: {
    maxWidth: "520px",
    background: "#fff",
    borderRadius: "12px",
    border: "1px solid #E2E8F0",
    padding: "28px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  formHeading: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1a202c",
    margin: "0 0 8px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  label: {
    fontWeight: 600,
    fontSize: "13px",
    color: "#4A5568",
    marginBottom: "2px",
  },
  input: {
    padding: "10px 14px",
    border: "1px solid #CBD5E0",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  select: {
    padding: "10px 14px",
    border: "1px solid #CBD5E0",
    borderRadius: "8px",
    fontSize: "14px",
    width: "100%",
    background: "white",
    boxSizing: "border-box",
  },
  textarea: {
    padding: "10px 14px",
    border: "1px solid #CBD5E0",
    borderRadius: "8px",
    fontSize: "14px",
    width: "100%",
    resize: "vertical",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  submitBtn: {
    marginTop: "8px",
    padding: "12px 24px",
    background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    letterSpacing: "0.3px",
  },
  initBtn: {
    marginTop: "8px",
    padding: "12px 24px",
    background: "linear-gradient(135deg, #0694a2, #0e7490)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    letterSpacing: "0.3px",
  },
  warnBox: {
    background: "#FFFBEB",
    border: "1px solid #F59E0B",
    borderRadius: "8px",
    padding: "14px 16px",
    color: "#92400E",
    fontSize: "13px",
    marginBottom: "16px",
  },
  spinner: {
    display: "flex",
    justifyContent: "center",
    padding: "48px",
  },
  spinnerDot: {
    width: "32px",
    height: "32px",
    border: "3px solid #E2E8F0",
    borderTop: "3px solid #4f46e5",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};
