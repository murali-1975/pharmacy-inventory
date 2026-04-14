/**
 * DispensingView.jsx
 *
 * Daily Medicine Dispensing Log — multi-row bulk entry.
 *
 * Record tab UX:
 *   1. Set the date and patient name once at the top.
 *   2. Each medicine line is a compact single row in a table.
 *   3. Press [ + Add Medicine ] to append more rows.
 *   4. Press [ 💊 Save All ] to submit all rows in one batch.
 *
 * History tab:
 *   Filterable table of all historical records (Admin can cancel).
 *
 * API Routes:
 *   POST /dispensing/         - Record a dispensing event
 *   GET  /dispensing/         - List / filter records
 *   DELETE /dispensing/{id}   - Cancel (Admin only)
 */
import React, { useState, useEffect, useCallback } from "react";
import { 
  Upload, Download, AlertCircle, CheckCircle, Search, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight 
} from "lucide-react";
import { formatDate } from "../utils/dateUtils";

const API_BASE = "/api";
const authHeaders = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------
const emptyRow = () => ({
  _id: Math.random().toString(36).slice(2), // local key only
  medicine_id: "",
  quantity: "",
  unit_price: "",
  gst_percent: "0",
  notes: "",
  batch_info: "", // Visual hint
});

function rowTotal(row) {
  const qty = parseFloat(row.quantity) || 0;
  const price = parseFloat(row.unit_price) || 0;
  // Always round to the nearest whole rupee
  return Math.round(qty * price).toString();
}

function grandTotal(rows) {
  const total = rows.reduce((sum, r) => sum + parseFloat(rowTotal(r)), 0);
  return Math.round(total).toString();
}

/** 
 * Searchable Medicine Selector 
 * Provides an autocomplete experience for bulk row entry.
 */
/** 
 * Searchable Medicine Selector 
 * Provides an autocomplete experience for bulk row entry and history filtering.
 */
function MedicineSearchSelect({ 
  medicines, 
  value, 
  onSelect, 
  placeholder = "Search medicine...", 
  allowZeroStock = false,
  showAllOption = false,
  id
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch]   = useState("");
  
  // Find the selected medicine name for display when not searching
  const selectedMed = medicines.find(m => String(m.id) === String(value));
  const displayName = selectedMed 
    ? `${selectedMed.product_name} (${selectedMed.quantity_on_hand})`
    : (value === "" && showAllOption ? "All Medicines" : "");

  const filtered = medicines.filter(m => {
    // Search by product name
    const matchesSearch = (
      m.product_name.toLowerCase().includes(search.toLowerCase())
    );
    
    // Quantity logic: allowZeroStock (for history) vs stock > 0 (for recording)
    const hasStock = allowZeroStock || m.quantity_on_hand > 0;
    
    return matchesSearch && hasStock;
  }).slice(0, 50); // Performance cap

  return (
    <div style={s.searchContainer}>
      <input
        id={id}
        type="text"
        style={s.cellInput}
        placeholder={placeholder}
        value={isOpen ? search : displayName}
        onFocus={() => { setIsOpen(true); setSearch(""); }}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)} // delay to allow clicks
        onChange={(e) => setSearch(e.target.value)}
      />
      {isOpen && (
        <div style={s.searchDropdown}>
          {showAllOption && (
            <div
              style={{ ...s.searchResultItem, fontWeight: 700, color: "#0694a2" }}
              onMouseDown={() => {
                onSelect("");
                setIsOpen(false);
              }}
            >
              All Medicines
            </div>
          )}
          {filtered.length === 0 ? (
            <div style={s.searchNoResult}>No matches found</div>
          ) : (
            filtered.map((m) => (
              <div
                key={m.id}
                style={s.searchResultItem}
                onMouseDown={() => {
                  onSelect(m.id);
                  setIsOpen(false);
                }}
              >
                <div style={s.resName}>{m.product_name} ({m.quantity_on_hand})</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------
/**
 * Component for managing pharmacy dispensing records and history.
 * Provides features for manual record entry, bulk upload via CSV,
 * and paginated history viewing.
 * 
 * @param {Object} props - Component properties.
 * @param {Array} props.medicines - Master list of medicines.
 * @param {string} props.token - JWT authentication token.
 * @param {string} props.userRole - Current user's role (Admin, Staff, etc.).
 */
export default function DispensingView({ medicines = [], onRefreshMedicines = () => {}, token, userRole, onUnauthorized = () => {} }) {
  const todayStr = new Date().toISOString().split("T")[0];

  // Alphabetize medicines for all dropdowns and search components
  const sortedMedicines = React.useMemo(() => {
    return [...medicines].sort((a, b) => a.product_name.localeCompare(b.product_name));
  }, [medicines]);

  // --- API Helpers (Internal) ---
  const fetchDispensing = async (token, params = {}) => {
    const qs = new URLSearchParams();
    if (params.date) qs.append("date", params.date);
    if (params.medicine_id) qs.append("medicine_id", params.medicine_id);
    if (params.patient_name) qs.append("patient_name", params.patient_name);
    if (params.skip !== undefined) qs.append("skip", params.skip);
    qs.append("limit", params.limit || 20);
    const res = await fetch(`${API_BASE}/dispensing/?${qs}`, { headers: authHeaders(token) });
    if (res.status === 401) { onUnauthorized(); return; }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to fetch dispensing records");
    }
    return res.json();
  };

  const postDispensing = async (token, payload) => {
    const res = await fetch(`${API_BASE}/dispensing/`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    });
    if (res.status === 401) { onUnauthorized(); return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Failed to record dispensing");
    return data;
  };

  const fetchBestBatch = async (token, medicineId) => {
    const res = await fetch(`${API_BASE}/stock/${medicineId}/batches?active_only=true`, {
      headers: authHeaders(token),
    });
    if (res.status === 401) { onUnauthorized(); return; }
    if (!res.ok) throw new Error("Failed to fetch batch info");
    const batches = await res.json();
    return batches.length > 0 ? batches[0] : null;
  };

  const deleteDispensing = async (token, id) => {
    const res = await fetch(`${API_BASE}/dispensing/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    if (res.status === 401) { onUnauthorized(); return; }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Failed to cancel dispensing");
    }
  };

  const uploadDispensing = async (token, file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/dispensing/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.status === 401) { onUnauthorized(); return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Upload failed");
    return data;
  };

  const [activeTab, setActiveTab]     = useState("record");
  // Redundant local medicines state removed - now using props
  const [records, setRecords]         = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage]   = useState(1);
  const [pageSize, setPageSize]         = useState(20);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");

  // --- Bulk Upload State ---
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkData, setBulkData] = useState([]); // Array of { date, patient_name, medicine_name, quantity, notes, unit_price, status, medicine_id }
  const [isUploading, setIsUploading] = useState(false);
  const [bulkSummary, setBulkSummary] = useState(null);

  // --- Handlers for Bulk Upload ---
  const handleFileSelect = (file) => {
    if (!file) return;
    setBulkFile(file);
    setError("");
    setSuccess("");

    if (file.name.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const rows = text.split("\n").map(r => r.split(","));
        const headers = rows[0].map(h => h.trim().toLowerCase().replace(/ /g, "_"));
        const data = rows.slice(1).filter(r => r.length > 1).map(r => {
          const obj = {};
          headers.forEach((h, i) => obj[h] = r[i]?.trim());
          
          // Try to find medicine ID from master
          const med = medicines.find(m => m.product_name.toLowerCase() === (obj.medicine_name || "").toLowerCase());
          return {
            date: obj.date || obj.dispensed_date,
            patient_name: obj.patient_name || obj.patient,
            medicine_name: obj.medicine_name || obj.item,
            quantity: parseInt(obj.quantity) || 0,
            notes: obj.notes || "",
            unit_price: obj.unit_price || "",
            medicine_id: med ? med.id : null
          };
        });
        setBulkData(data);
      };
      reader.readAsText(file);
    } else {
      // For Excel, we'll just show the file and alert that preview is limited
      setBulkData([{ medicine_name: "Excel detected - direct upload required", status: "raw" }]);
    }
  };

  const handleMapMedicine = (idx, medId) => {
    const newData = [...bulkData];
    newData[idx].medicine_id = medId;
    const med = medicines.find(m => m.id === parseInt(medId));
    if (med) newData[idx].medicine_name = med.product_name;
    setBulkData(newData);
  };

  const submitBulkUpload = async () => {
    setIsUploading(true);
    setError("");
    try {
      const res = await uploadDispensing(token, bulkFile);
      setBulkSummary(res);
      if (res.success_count > 0) {
        onRefreshMedicines();
        loadRecords();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const downloadErrorReport = (csvContent) => {
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dispensing_upload_errors.csv";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // --- Header (shared across all rows) ---
  const [header, setHeader] = useState({ dispensed_date: todayStr, patient_name: "" });

  // --- Line rows ---
  const [rows, setRows] = useState([emptyRow()]);

  // --- Row-level save status (index → "ok" | "error: …") ---
  const [rowStatus, setRowStatus] = useState({});

  // --- History filters ---
  const [filters, setFilters]           = useState({ date: "", medicine_id: "", patient_name: "" });
  const [filterApplied, setFilterApplied] = useState({});

  // Centralized medicines are managed in App.jsx via props

  // Load history
  /**
   * Fetches a paginated list of dispensing records from the backend.
   * 
   * @param {Object} params - Search and filter parameters.
   * @param {number} page - The page number to load (1-indexed).
   */
  const loadRecords = useCallback(async (params = {}, page = 1) => {
    setLoading(true);
    setError("");
    try {
      const skip = (page - 1) * pageSize;
      const fetchParams = { 
        ...params, 
        skip, 
        limit: pageSize 
      };
      
      const data = await fetchDispensing(token, fetchParams);
      setRecords(data.items);
      setTotalRecords(data.total);
      setCurrentPage(page);
    } catch (e) {
      setError(e.message);
      console.error("Dispensing: Load failed", e);
    } finally {
      setLoading(false);
    }
  }, [token, pageSize]);

  useEffect(() => {
    if (activeTab === "history") loadRecords(filterApplied, 1);
  }, [activeTab, filterApplied, loadRecords]);

  // Handle page change
  const handlePageChange = (newPage) => {
    loadRecords(filterApplied, newPage);
    // Scroll to top of table or container when page changes
    const container = document.getElementById("dispensing-history-table");
    if (container) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // -----------------------------------------------------------------------
  // Row helpers
  // -----------------------------------------------------------------------
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (idx) =>
    setRows((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));

  const updateRow = async (idx, field, value) => {
    setRows((prev) => {
      const newRows = [...prev];
      newRows[idx] = { ...newRows[idx], [field]: value };
      return newRows;
    });

    // Auto-fill price if medicine changed
    if (field === "medicine_id" && value) {
      try {
        const bestBatch = await fetchBestBatch(token, value);
        const medicineInfo = medicines.find(m => String(m.id) === String(value));
        if (bestBatch || medicineInfo) {
          const mrp = bestBatch ? (parseFloat(bestBatch.mrp) || 0) : 0;
          const gst = bestBatch ? (parseFloat(bestBatch.gst) || 0) : 0;
          const masterPrice = parseFloat(medicineInfo?.unit_price) || 0;
          const spPercent = parseFloat(medicineInfo?.selling_price_percent) || 0;
          
          let basePrice = (mrp > 0) ? mrp : masterPrice;
          let calcPrice = basePrice;
          
          if (basePrice > 0) {
            calcPrice = basePrice - (basePrice * (spPercent / 100));
          }
          
          setRows((prev) => {
            const newRows = [...prev];
            newRows[idx] = { 
              ...newRows[idx], 
              unit_price: Math.round(calcPrice).toString(),
              gst_percent: (mrp > 0) ? gst : 5.0,
              batch_info: bestBatch 
                  ? `Auto-batch: ${bestBatch.batch_no} (Exp: ${bestBatch.expiry_date}) | ${mrp > 0 ? `MRP: ₹${mrp.toFixed(2)}` : `Master Fallback: ₹${masterPrice.toFixed(2)}`} | Disc: ${spPercent}%`
                  : `No Batch! Master Fallback: ₹${masterPrice.toFixed(2)} | Disc: ${spPercent}%`
            };
            return newRows;
          });
        }
      } catch (e) {
        console.error("Batch fetch error:", e);
      }
    }
  };

  // -----------------------------------------------------------------------
  // Bulk save
  // -----------------------------------------------------------------------
  const handleSaveAll = async () => {
    setError("");
    setSuccess("");
    setRowStatus({});

    // Header validation
    if (!header.patient_name.trim()) {
      setError("Please enter a Patient Name before saving.");
      return;
    }
    if (!header.dispensed_date) {
      setError("Please set the Dispensing Date.");
      return;
    }

    // Row validation
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.medicine_id) {
        setError(`Row ${i + 1}: Please select a medicine.`);
        return;
      }
      if (!r.quantity || parseInt(r.quantity) < 1) {
        setError(`Row ${i + 1}: Quantity must be at least 1.`);
        return;
      }
      if (r.unit_price === "" || parseFloat(r.unit_price) < 0) {
        setError(`Row ${i + 1}: Please enter a valid unit price.`);
        return;
      }
    }

    setSaving(true);
    const statusMap = {};
    let successCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        await postDispensing(token, {
          dispensed_date: header.dispensed_date,
          patient_name: header.patient_name.trim(),
          medicine_id: parseInt(r.medicine_id),
          quantity: parseInt(r.quantity),
          unit_price: parseFloat(r.unit_price) || 0,
          gst_percent: parseFloat(r.gst_percent) || 0,
          notes: r.notes.trim() || null,
        });
        statusMap[i] = "ok";
        successCount++;
      } catch (e) {
        statusMap[i] = `error: ${e.message}`;
      }
    }

    setSaving(false);
    setRowStatus(statusMap);

    const failed = rows.length - successCount;
    if (failed === 0) {
      setSuccess(`✅ All ${successCount} dispensing entries saved! Grand total: ₹${grandTotal(rows)}`);
      onRefreshMedicines();
      setRows([emptyRow()]);
      setHeader({ dispensed_date: todayStr, patient_name: "" });
    } else {
      setError(`⚠️ ${successCount} saved, ${failed} failed. Rows with errors are highlighted below.`);
    }
  };

  // -----------------------------------------------------------------------
  // Cancel (history)
  // -----------------------------------------------------------------------
  const handleCancel = async (id) => {
    if (!window.confirm("Cancel this dispensing record? Stock will be restored.")) return;
    setError("");
    setSuccess("");
    try {
      await deleteDispensing(token, id);
      setSuccess("Dispensing record cancelled and stock restored.");
      onRefreshMedicines();
      loadRecords(filterApplied);
    } catch (e) {
      setError(e.message);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div style={s.container}>
      <h2 style={s.heading}>💊 Medicine Dispensing</h2>
      <p style={s.subheading}>Record daily medicine dispensing for patients. Stock is deducted automatically.</p>

      {/* Tab Bar */}
      <div style={s.tabBar}>
        {[
          { id: "record",  label: "📝 Record Dispensing" },
          { id: "bulk",    label: "📂 Bulk Upload" },
          { id: "history", label: "📋 Dispensing History" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { 
                setActiveTab(tab.id); 
                setError(""); 
                setSuccess(""); 
                setBulkData([]); 
                setBulkFile(null);
                setBulkSummary(null);
            }}
            style={activeTab === tab.id ? s.tabActive : s.tab}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {error   && <div style={s.errorBox}>{error}</div>}
      {success && <div style={s.successBox}>{success}</div>}

      {/* ================================================================ */}
      {/* RECORD TAB                                                        */}
      {/* ================================================================ */}
      {activeTab === "record" && (
        <div style={s.card}>

          {/* ---- Header: Date + Patient (shared) ---- */}
          <div style={s.headerRow}>
            <div style={s.headerField}>
              <label htmlFor="dispensed_date" style={s.label}>Dispensing Date</label>
              <input
                id="dispensed_date"
                type="date"
                style={s.input}
                value={header.dispensed_date}
                onChange={(e) => setHeader({ ...header, dispensed_date: e.target.value })}
                required
              />
            </div>
            <div style={{ ...s.headerField, flex: 2 }}>
              <label htmlFor="patient_name" style={s.label}>Patient Name</label>
              <input
                id="patient_name"
                type="text"
                style={s.input}
                placeholder="e.g. Ravi Kumar / OP-0042"
                value={header.patient_name}
                onChange={(e) => setHeader({ ...header, patient_name: e.target.value })}
                required
              />
            </div>
          </div>

          {/* ---- Line items table ---- */}
          <div style={s.tableWrapper}>
            <table style={s.table}>
              <thead>
                <tr style={s.tableHead}>
                  <th style={{ ...s.th, width: "30%" }}>Medicine</th>
                  <th style={{ ...s.th, width: "8%"  }}>Qty</th>
                  <th style={{ ...s.th, width: "12%" }}>Unit Price (₹)</th>
                  <th style={{ ...s.th, width: "8%"  }}>GST %</th>
                  <th style={{ ...s.th, width: "10%" }}>Total (₹)</th>
                  <th style={{ ...s.th, width: "22%" }}>Notes</th>
                  <th style={{ ...s.th, width: "5%"  }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const status = rowStatus[i];
                  const rowBg = status === "ok"
                    ? "#F0FFF4"
                    : status?.startsWith("error")
                    ? "#FFF5F5"
                    : "white";
                  return (
                    <tr key={row._id} style={{ background: rowBg, borderBottom: "1px solid #EDF2F7" }}>
                      <td style={s.inputCell}>
                        <MedicineSearchSelect
                          medicines={sortedMedicines}
                          value={row.medicine_id}
                          onSelect={(val) => updateRow(i, "medicine_id", val)}
                        />
                        {row.batch_info && (
                          <div style={{ fontSize: "11px", color: row.batch_info.includes("available") ? "#C53030" : "#2B6CB0", marginTop: "4px", paddingLeft: "4px" }}>
                            ℹ️ {row.batch_info}
                          </div>
                        )}
                        {status?.startsWith("error") && (
                          <div style={s.rowError}>{status.replace("error: ", "")}</div>
                        )}
                      </td>
                      <td style={s.inputCell}>
                        <input
                          type="number" min="1" placeholder="0"
                          style={s.cellInput}
                          value={row.quantity}
                          onChange={(e) => updateRow(i, "quantity", e.target.value)}
                        />
                      </td>
                      <td style={s.inputCell}>
                        <input
                          type="number" min="0" step="0.01" placeholder="0.00"
                          style={s.cellInput}
                          value={row.unit_price}
                          onChange={(e) => updateRow(i, "unit_price", e.target.value)}
                        />
                      </td>
                      <td style={s.inputCell}>
                        <input
                          type="number" min="0" max="100" step="0.01" placeholder="0"
                          style={{ ...s.cellInput, background: "#f9fafb", cursor: "not-allowed" }}
                          value={row.gst_percent}
                          readOnly
                        />
                      </td>
                      <td style={{ ...s.inputCell, fontWeight: 700, color: "#276749", textAlign: "right", paddingRight: "14px" }}>
                        ₹{rowTotal(row)}
                      </td>
                      <td style={s.inputCell}>
                        <input
                          type="text" placeholder="Optional"
                          style={s.cellInput}
                          value={row.notes}
                          onChange={(e) => updateRow(i, "notes", e.target.value)}
                        />
                      </td>
                      <td style={{ ...s.inputCell, textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          style={s.removeBtn}
                        >✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={s.formFooter}>
            <button type="button" onClick={addRow} style={s.addBtn}>
              + Add Medicine
            </button>
            <div style={s.totalArea}>
              <span style={s.totalLabel}>Grand Total</span>
              <span style={s.totalValue}>₹{grandTotal(rows)}</span>
            </div>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              style={s.saveAllBtn}
            >
              {saving ? "Saving..." : `💊 Save All  (${rows.length} items)`}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* BULK TAB                                                          */}
      {/* ================================================================ */}
      {activeTab === "bulk" && (
        <div style={s.card}>
          <div style={s.bulkHeader}>
            <div>
              <h3 style={{ margin: 0, color: "#2d3748" }}>Bulk Dispensing Upload</h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#718096" }}>
                Upload a CSV or Excel file containing daily dispensing logs. 
              </p>
            </div>
            <button 
               onClick={async () => {
                 try {
                   const blob = await fetch(`${API_BASE}/dispensing/template`, { headers: authHeaders(token) }).then(r => r.blob());
                   const url = window.URL.createObjectURL(blob);
                   const a = document.createElement('a');
                   a.href = url;
                   a.download = 'dispensing_template.csv';
                   document.body.appendChild(a);
                   a.click();
                   window.URL.revokeObjectURL(url);
                 } catch (e) {
                   setError("Failed to download template");
                 }
               }}
               style={s.templateBtn}
            >
              <Download size={16} /> Download Template
            </button>
          </div>

          {!bulkFile && !bulkSummary && (
            <div 
              style={s.dropZone}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFileSelect(file);
              }}
            >
              <div style={s.dropZoneContent}>
                <div style={s.dropIcon}>📄</div>
                <p style={s.dropText}>
                  <strong>Click to upload</strong> or drag and drop<br/>
                  <span style={{ fontSize: "12px", color: "#A0AEC0" }}>CSV or Excel (.xlsx) files supported</span>
                </p>
                <input 
                  type="file" 
                  accept=".csv, .xlsx" 
                  style={{ display: "none" }} 
                  id="bulk-upload-input" 
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                />
                <button 
                  onClick={() => document.getElementById("bulk-upload-input").click()}
                  style={s.selectBtn}
                >
                  Select File
                </button>
              </div>
            </div>
          )}

          {bulkData.length > 0 && !bulkSummary && (
            <div style={{ marginTop: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h4 style={{ margin: 0 }}>📊 Preview ({bulkData.length === 1 && bulkData[0].medicine_name.includes("Excel") ? "File Ready" : `${bulkData.length} records`})</h4>
                <button 
                  onClick={() => { setBulkFile(null); setBulkData([]); }}
                  style={{ background: "none", border: "none", color: "#E53E3E", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}
                >
                  ✕ Clear & Reset
                </button>
              </div>

              {bulkData.length > 0 && !bulkData[0].medicine_name.includes("Excel") ? (
                <div style={s.tableWrapper}>
                  <table style={s.table}>
                    <thead>
                      <tr style={s.tableHead}>
                        <th style={s.th}>Date</th>
                        <th style={s.th}>Patient</th>
                        <th style={s.th}>Medicine Name</th>
                        <th style={s.th}>Qty</th>
                        <th style={s.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkData.map((row, idx) => (
                        <tr key={idx} style={s.row}>
                          <td style={s.td}>{formatDate(row.date)}</td>
                          <td style={s.td}>{row.patient_name}</td>
                          <td style={s.td}>
                            {row.medicine_id ? (
                              <span style={{ color: "#2F855A" }}>✅ {row.medicine_name}</span>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <span style={{ color: "#C53030", fontSize: "11px" }}>⚠️ {row.medicine_name}</span>
                                <select 
                                  style={{ padding: "4px", fontSize: "11px", borderRadius: "4px" }}
                                  onChange={(e) => handleMapMedicine(idx, e.target.value)}
                                  value={row.medicine_id || ""}
                                >
                                  <option value="">Map to...</option>
                                  {medicines.map(m => <option key={m.id} value={m.id}>{m.product_name}</option>)}
                                </select>
                              </div>
                            )}
                          </td>
                          <td style={s.td}>{row.quantity}</td>
                          <td style={s.td}>
                            <span style={{ color: row.medicine_id ? "#38A169" : "#E53E3E", fontSize: "12px", fontWeight: 600 }}>
                              {row.medicine_id ? "Ready" : "Fix Mapping"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: "20px", background: "#EBF8FF", borderRadius: "8px", border: "1px solid #BEE3F8", textAlign: "center" }}>
                   <p style={{ margin: 0, color: "#2B6CB0", fontWeight: 600 }}>Excel File Ready: <strong>{bulkFile?.name}</strong></p>
                </div>
              )}

              <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
                <button 
                  onClick={submitBulkUpload}
                  disabled={isUploading || (bulkData.length > 0 && !bulkData[0].medicine_name.includes("Excel") && bulkData.some(r => !r.medicine_id))}
                  style={s.saveAllBtn}
                >
                  {isUploading ? "Uploading..." : `🚀 Upload Records`}
                </button>
              </div>
            </div>
          )}

          {bulkSummary && (
            <div style={s.summaryCard}>
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎉</div>
                <h3 style={{ margin: 0 }}>Upload Complete</h3>
              </div>
              <div style={s.summaryStats}>
                <div style={s.statItem}>
                  <span style={s.statLabel}>Success</span>
                  <span style={{ ...s.statValue, color: "#38A169" }}>{bulkSummary.success_count}</span>
                </div>
                <div style={s.statItem}>
                   <span style={s.statLabel}>Errors</span>
                   <span style={{ ...s.statValue, color: "#E53E3E" }}>{bulkSummary.error_count}</span>
                </div>
              </div>
              {bulkSummary.error_count > 0 && (
                <button onClick={() => downloadErrorReport(bulkSummary.error_csv_content)} style={s.errorReportBtn}>
                   📥 Download Error Report
                </button>
              )}
              <div style={{ marginTop: "24px", textAlign: "center" }}>
                <button onClick={() => { setBulkSummary(null); setBulkData([]); setBulkFile(null); }} style={s.doneBtn}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* HISTORY TAB                                                        */}
      {/* ================================================================ */}
      {activeTab === "history" && (
        <div>
          {/* Filter bar */}
          <div style={s.filterBar}>
            <input
              type="date"
              style={s.filterInput}
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
            />
            <div style={{ ...s.filterInput, padding: 0, minWidth: "220px", border: "none" }}>
              <MedicineSearchSelect 
                medicines={sortedMedicines}
                value={filters.medicine_id}
                onSelect={(val) => setFilters({ ...filters, medicine_id: val })}
                placeholder="All Medicines..."
                allowZeroStock={true}
                showAllOption={true}
              />
            </div>
            <input
              type="text"
              style={s.filterInput}
              placeholder="Patient name..."
              value={filters.patient_name}
              onChange={(e) => setFilters({ ...filters, patient_name: e.target.value })}
            />
            <button style={s.filterBtn} onClick={() => setFilterApplied({ ...filters })}>🔍 Search</button>
            <button style={s.clearBtn} onClick={() => { setFilters({ date: "", medicine_id: "", patient_name: "" }); setFilterApplied({}); }}>✕ Clear</button>
          </div>

          {loading ? (
            <div style={s.spinner}><div style={s.spinnerDot} /></div>
          ) : (
            <>
              <div style={s.tableWrapper} id="dispensing-history-table">
                <table style={s.table}>
                  <thead>
                    <tr style={s.tableHead}>
                      <th style={s.th}>Date</th>
                      <th style={s.th}>Patient</th>
                      <th style={s.th}>Medicine</th>
                      <th style={s.th}>Qty</th>
                      <th style={s.th}>Total (₹)</th>
                      <th style={s.th}>Notes</th>
                      {userRole === "Admin" && <th style={s.th}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((rec) => (
                      <tr key={rec.id} style={s.row}>
                        <td style={s.td}>{formatDate(rec.dispensed_date)}</td>
                        <td style={s.td}><strong>{rec.patient_name}</strong></td>
                        <td style={s.td}>{rec.medicine?.product_name ?? `ID ${rec.medicine_id}`}</td>
                        <td style={s.td}>{rec.quantity}</td>
                        <td style={{ ...s.td, color: "#276749", fontWeight: 700 }}>₹{rec.total_amount.toFixed(0)}</td>
                        <td style={s.td}>{rec.notes || "—"}</td>
                        {userRole === "Admin" && (
                          <td style={s.td}>
                            <button onClick={() => handleCancel(rec.id)} style={s.cancelBtn}>✕ Cancel</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalRecords > 0 && (
                <div style={s.paginationRow}>
                  <div style={s.paginationSummary}>
                    Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to <strong>{Math.min(currentPage * pageSize, totalRecords)}</strong> of <strong>{totalRecords}</strong> records
                  </div>
                  
                  <div style={s.paginationControls}>
                    <button 
                      style={currentPage <= 1 ? s.pageBtnDisabled : s.pageBtn}
                      disabled={currentPage <= 1}
                      onClick={() => handlePageChange(1)}
                      title="First Page"
                    >
                      <ChevronsLeft size={16} />
                    </button>
                    <button 
                      style={currentPage <= 1 ? s.pageBtnDisabled : s.pageBtn}
                      disabled={currentPage <= 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                      title="Previous Page"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    <div style={s.pageIndicator}>
                      Page <strong>{currentPage}</strong> of <strong>{Math.ceil(totalRecords / pageSize)}</strong>
                    </div>
                    
                    <button 
                      style={currentPage >= Math.ceil(totalRecords / pageSize) ? s.pageBtnDisabled : s.pageBtn}
                      disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                      onClick={() => handlePageChange(currentPage + 1)}
                      title="Next Page"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button 
                      style={currentPage >= Math.ceil(totalRecords / pageSize) ? s.pageBtnDisabled : s.pageBtn}
                      disabled={currentPage >= Math.ceil(totalRecords / pageSize)}
                      onClick={() => handlePageChange(Math.ceil(totalRecords / pageSize))}
                      title="Last Page"
                    >
                      <ChevronsRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------
const s = {
  container:    { padding: "24px", fontFamily: "'Inter', 'Segoe UI', sans-serif" },
  heading:      { fontSize: "24px", fontWeight: 700, color: "#1a202c", margin: "0 0 4px" },
  subheading:   { color: "#718096", fontSize: "14px", margin: "0 0 24px" },
  
  bulkHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" },
  templateBtn: { padding: "8px 16px", background: "white", border: "1px solid #E2E8F0", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#4A5568", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" },
  
  dropZone: { border: "2px dashed #E2E8F0", borderRadius: "12px", background: "#F7FAFC", padding: "40px", transition: "all 0.2s" },
  dropZoneContent: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" },
  dropIcon: { fontSize: "32px", marginBottom: "12px" },
  dropText: { fontSize: "15px", color: "#4A5568", marginBottom: "16px", lineHeight: "1.5" },
  selectBtn: { padding: "8px 24px", background: "white", border: "1px solid #CBD5E0", borderRadius: "8px", fontWeight: 600, fontSize: "14px", color: "#2D3748", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },

  summaryCard: { maxWidth: "400px", margin: "40px auto", padding: "32px", background: "white", border: "1px solid #E2E8F0", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" },
  summaryStats: { display: "flex", gap: "24px", justifyContent: "center", borderTop: "1px solid #EDF2F7", borderBottom: "1px solid #EDF2F7", padding: "16px 0" },
  statItem: { textAlign: "center" },
  statLabel: { display: "block", fontSize: "12px", color: "#718096", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" },
  statValue: { fontSize: "24px", fontWeight: 800 },
  errorReportBtn: { width: "100%", padding: "10px", background: "#FFF5F5", border: "1px solid #FEB2B2", borderRadius: "8px", color: "#C53030", fontWeight: 600, fontSize: "13px", cursor: "pointer", marginTop: "12px" },
  doneBtn: { padding: "10px 48px", background: "#0694a2", color: "white", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "14px", cursor: "pointer" },

  tabBar:   { display: "flex", gap: "8px", borderBottom: "2px solid #e2e8f0", marginBottom: "24px" },
  tab:      { background: "none", border: "none", borderBottom: "3px solid transparent", padding: "10px 18px", cursor: "pointer", fontWeight: 500, fontSize: "14px", color: "#718096", marginBottom: "-2px" },
  tabActive:{ background: "none", border: "none", borderBottom: "3px solid #0694a2", padding: "10px 18px", cursor: "pointer", fontWeight: 600, fontSize: "14px", color: "#0694a2", marginBottom: "-2px" },

  errorBox:  { background: "#FFF5F5", border: "1px solid #FC8181", borderRadius: "8px", padding: "12px 16px", color: "#C53030", fontSize: "14px", marginBottom: "16px" },
  successBox:{ background: "#F0FFF4", border: "1px solid #68D391", borderRadius: "8px", padding: "12px 16px", color: "#276749", fontSize: "14px", marginBottom: "16px" },

  card: {
    background: "#fff",
    borderRadius: "12px",
    border: "1px solid #E2E8F0",
    padding: "24px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },

  /* Header row: date + patient */
  headerRow: {
    display: "flex",
    gap: "16px",
    marginBottom: "20px",
    alignItems: "flex-end",
  },
  headerField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    flex: 1,
  },

  label:  { fontWeight: 600, fontSize: "13px", color: "#4A5568" },
  input:  { padding: "9px 13px", border: "1px solid #CBD5E0", borderRadius: "8px", fontSize: "14px", color: "#1a202c", outline: "none", boxSizing: "border-box" },

  /* Line-item table */
  tableWrapper: { overflowX: "auto", overflowY: "auto", maxHeight: "500px", borderRadius: "10px", border: "1px solid #E2E8F0", marginBottom: "0" },
  table:     { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  tableHead: { background: "#F7FAFC" },
  th: { padding: "9px 10px", textAlign: "left", fontWeight: 600, color: "#4A5568", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", fontSize: "12px" },
  row: { borderBottom: "1px solid #EDF2F7" },
  td: { padding: "10px 12px", color: "#2D3748", verticalAlign: "middle" },
  inputCell: { padding: "6px 6px", verticalAlign: "middle" },

  cellSelect: {
    width: "100%",
    padding: "7px 10px",
    border: "1px solid #CBD5E0",
    borderRadius: "6px",
    fontSize: "13px",
    color: "#1a202c",
    background: "white",
    boxSizing: "border-box",
  },
  cellInput: {
    width: "100%",
    padding: "7px 10px",
    border: "1px solid #CBD5E0",
    borderRadius: "6px",
    fontSize: "13px",
    color: "#1a202c",
    boxSizing: "border-box",
    outline: "none",
  },
  rowError: {
    color: "#C53030",
    fontSize: "11px",
    marginTop: "3px",
  },

  removeBtn: {
    padding: "4px 8px",
    background: "none",
    border: "1px solid #FC8181",
    color: "#FC8181",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1,
  },

  /* Searchable result dropdown styles */
  searchContainer: { position: "relative", width: "100%" },
  searchDropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    background: "white",
    border: "1px solid #E2E8F0",
    borderRadius: "8px",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    zIndex: 1000,
    maxHeight: "480px",
    overflowY: "auto",
    padding: "4px",
  },
  searchResultItem: {
    padding: "8px 12px",
    cursor: "pointer",
    borderRadius: "6px",
    transition: "background 0.2s",
    ":hover": { background: "#F7FAFC" }, // standard CSS hover won't work in inline, but handled by JS or just standard background change
  },
  searchNoResult: { padding: "12px", color: "#A0AEC0", textAlign: "center", fontSize: "13px" },
  resName:    { fontSize: "13px", fontWeight: 600, color: "#2D3748" },
  resGeneric: { fontSize: "11px", color: "#718096" },

  /* Footer */
  formFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "14px",
    gap: "16px",
    flexWrap: "wrap",
  },
  addBtn: {
    padding: "9px 22px",
    background: "#EBF4FF",
    border: "1.5px dashed #63B3ED",
    color: "#2B6CB0",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
  },
  totalArea: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginLeft: "auto",
  },
  totalLabel: { color: "#4A5568", fontWeight: 600, fontSize: "14px" },
  totalValue: { fontSize: "22px", fontWeight: 800, color: "#276749" },

  saveAllBtn: {
    padding: "11px 28px",
    background: "linear-gradient(135deg, #0694a2, #0e7490)",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
    letterSpacing: "0.3px",
    whiteSpace: "nowrap",
  },

  /* History filter bar */
  filterBar:   { display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" },
  filterInput: { padding: "8px 12px", border: "1px solid #CBD5E0", borderRadius: "8px", fontSize: "13px", outline: "none", color: "#1a202c", minWidth: "140px" },
  filterSelect:{ padding: "8px 12px", border: "1px solid #CBD5E0", borderRadius: "8px", fontSize: "13px", color: "#1a202c", background: "white" },
  filterBtn:   { padding: "8px 18px", background: "#0694a2", color: "white", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer" },
  clearBtn:    { padding: "8px 14px", background: "#EDF2F7", color: "#4A5568", border: "1px solid #CBD5E0", borderRadius: "8px", fontWeight: 600, fontSize: "13px", cursor: "pointer" },

  emptyState: { textAlign: "center", padding: "48px", color: "#A0AEC0", fontSize: "15px", background: "#F7FAFC", borderRadius: "12px", border: "2px dashed #CBD5E0" },
  hint: { color: "#718096", fontSize: "13px", marginBottom: "12px" },

  cancelBtn: { padding: "5px 12px", background: "#FFF5F5", border: "1px solid #FC8181", color: "#C53030", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 600 },
  spinner:    { display: "flex", justifyContent: "center", padding: "48px" },
  spinnerDot: { width: "32px", height: "32px", border: "3px solid #E2E8F0", borderTop: "3px solid #0694a2", borderRadius: "50%", animation: "spin 0.8s linear infinite" },

  /* Pagination */
  paginationRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "20px", padding: "12px 16px", background: "#F7FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" },
  paginationSummary: { fontSize: "13px", color: "#4A5568" },
  paginationControls: { display: "flex", alignItems: "center", gap: "6px" },
  pageBtn: { display: "flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", background: "white", border: "1px solid #E2E8F0", borderRadius: "8px", pointer: "cursor", color: "#4A5568", transition: "all 0.2s" },
  pageBtnDisabled: { display: "flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", background: "#EDF2F7", border: "1px solid #E2E8F0", borderRadius: "8px", color: "#A0AEC0", cursor: "not-allowed", opacity: 0.6 },
  pageIndicator: { fontSize: "13px", color: "#4A5568", margin: "0 10px", background: "white", padding: "6px 12px", borderRadius: "6px", border: "1px solid #E2E8F0", fontWeight: 500 },
};
