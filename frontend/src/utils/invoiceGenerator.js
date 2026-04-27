import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './dateUtils';
import { formatINR } from './formatters';

const CLINIC_NAME = "R.M.Women Health Clinic";
const CLINIC_ADDRESS = "6-A Vaikunda Perumal Koil Street, Big Kancheepuram - 631502";

/**
 * Generates a professional PDF invoice for a patient payment.
 * Includes branding, service breakdown, and specific GST notation for pharmacy items.
 * 
 * @param {Object} payment - The patient payment record with nested services and payments.
 */
export const generateInvoicePDF = (payment, masters) => {
  console.info("[invoiceGenerator] Generating invoice for:", payment?.patient_name, payment);
  
  if (!payment) {
    console.error("[invoiceGenerator] No payment data provided.");
    return;
  }

  try {
    // Create document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // --- Header Section ---
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.setFont("helvetica", "bold");
    doc.text(CLINIC_NAME, 105, 25, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.setFont("helvetica", "normal");
    doc.text(CLINIC_ADDRESS, 105, 32, { align: 'center' });
    
    // Accent line
    doc.setDrawColor(79, 70, 229); // Indigo 600
    doc.setLineWidth(0.8);
    doc.line(20, 38, 190, 38);
    
    // --- Document Title ---
    doc.setFontSize(14);
    doc.setTextColor(71, 85, 105); // Slate 600
    doc.setFont("helvetica", "bold");
    doc.text("TAX INVOICE / RECEIPT", 105, 50, { align: 'center' });
    
    // --- Metadata Section ---
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text("Invoice Details:", 20, 62);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice No: INV-${payment.id?.toString().padStart(6, '0') || '000000'}`, 20, 68);
    doc.text(`Date: ${formatDate(payment.payment_date)}`, 190, 68, { align: 'right' });
    
    // --- Patient Section ---
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 20, 80);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Patient Name: ${payment.patient_name || 'Walk-in Patient'}`, 20, 86);
    
    let currentY = 92;
    if (payment.token_no) {
      doc.text(`Token Number: ${payment.token_no}`, 20, currentY);
      currentY += 6;
    }
    
    if (payment.identifiers && payment.identifiers.length > 0) {
      const idStrings = payment.identifiers.map(id => id.id_value).join(", ");
      doc.text(`ID Reference: ${idStrings}`, 20, currentY);
      currentY += 6;
    }
    
    // --- Services Table ---
    const services = payment.services || [];
    const tableData = services.map(srv => {
      // Resolve service name using masters lookup if available
      let name = srv.service_name;
      if (!name && masters?.services) {
        name = masters.services.find(s => s.id === srv.service_id)?.service_name;
      }
      if (!name) name = "Medical Service";

      // Apply user request: "including gst" note for pharmacy type
      if (name.toLowerCase().includes("pharmacy") || name.toLowerCase().includes("medicine")) {
        name += " (including GST)";
      }
      return [name, "1", formatINR(srv.amount)];
    });
    
    const tableOptions = {
      startY: currentY + 5,
      head: [['Description', 'Qty', 'Amount']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 4,
        valign: 'middle'
      },
      headStyles: {
        fillColor: [79, 70, 229], // Indigo 600
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 40, halign: 'right' }
      },
      margin: { left: 20, right: 20 }
    };

    // Hyper-Resilient AutoTable Call (Handles all bundling edge cases)
    console.debug("[invoiceGenerator] Attempting autoTable call. Types:", {
      doc_autoTable: typeof doc.autoTable,
      autoTable_func: typeof autoTable,
      autoTable_default: typeof autoTable?.default
    });

    if (typeof doc.autoTable === 'function') {
      doc.autoTable(tableOptions);
    } else if (typeof autoTable === 'function') {
      autoTable(doc, tableOptions);
    } else if (autoTable && typeof autoTable.default === 'function') {
      autoTable.default(doc, tableOptions);
    } else {
      throw new Error("jsPDF-AutoTable plugin not found in any expected location.");
    }
    
    // --- Summary Section ---
    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : currentY + 30;
  
  // Box for totals
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.rect(130, finalY - 5, 60, 15, 'FD');
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Grand Total:", 135, finalY + 5);
  doc.setTextColor(79, 70, 229); // Indigo 600
  const totalStr = formatINR(parseFloat(payment.total_amount || 0));
  doc.text(totalStr, 185, finalY + 5, { align: 'right' });
  
  // Settlement Details
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  
  let settlementY = finalY + 25;
  const paymentModes = payment.payments?.map(p => p.payment_mode?.mode || "Cash/GPay").join(", ") || "N/A";
  doc.text(`Settlement Mode: ${paymentModes}`, 20, settlementY);
  
  const statusColor = payment.payment_status === 'PAID' ? [16, 185, 129] : [244, 63, 94];
  doc.setTextColor(...statusColor);
  doc.setFont("helvetica", "bold");
  doc.text(`Payment Status: ${payment.payment_status}`, 20, settlementY + 6);
  
  // --- Footer Section ---
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text("This is a computer generated document and does not require a physical signature.", 105, 275, { align: 'center' });
  doc.text("R.M.Women Health Clinic - Quality Care for Every Woman", 105, 280, { align: 'center' });
  doc.setFont("helvetica", "bold");
  doc.text("THANK YOU FOR YOUR VISIT", 105, 287, { align: 'center' });
  
  // Trigger Download
  const safeName = (payment.patient_name || 'Patient').replace(/[^a-z0-9]/gi, '_');
  const filename = `Invoice_${safeName}_${formatDate(payment.payment_date)}.pdf`;
  doc.save(filename);
  } catch (error) {
    console.error("Failed to generate PDF invoice:", error);
    alert("SYSTEM ERROR: Could not generate PDF. Please try again or contact support. Details: " + error.message);
  }
};

/**
 * Generates a detailed daily financial summary report.
 * @param {Object} summary - The daily finance summary object.
 */
export const generateDailySummaryPDF = (summary) => {
  console.info("[invoiceGenerator] Generating Daily Summary PDF for:", summary?.summary_date);
  
  if (!summary) {
    console.error("[invoiceGenerator] No summary data provided.");
    return;
  }

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Ensure autoTable is loaded (Resilient Call)
    const applyAutoTable = (pdfDoc, options) => {
      if (typeof pdfDoc.autoTable === 'function') {
        return pdfDoc.autoTable(options);
      } else if (typeof autoTable === 'function') {
        return autoTable(pdfDoc, options);
      } else if (autoTable && typeof autoTable.default === 'function') {
        return autoTable.default(pdfDoc, options);
      }
      throw new Error("jsPDF-AutoTable plugin not found");
    };

    const safeINR = (val) => {
      // Strips the rupee symbol which renders poorly in jsPDF default fonts
      return 'Rs. ' + new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 0
      }).format(val || 0);
    };

    // --- Header ---
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text(CLINIC_NAME, 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text("Daily Financial Performance Report", 105, 26, { align: 'center' });
    
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.line(20, 32, 190, 32);

    // --- Summary Metadata ---
    const displayDate = formatDate(summary.summary_date);
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text(`REPORT DATE: ${displayDate}`, 20, 42);
    
    // Summary KPI Box (Centered Alignment)
    doc.setFillColor(248, 250, 252);
    doc.rect(20, 48, 170, 25, 'F');
    
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Total Patients", 41, 56, { align: 'center' });
    doc.text("Total Revenue", 82, 56, { align: 'center' });
    doc.text("Total Expenses", 123, 56, { align: 'center' });
    doc.text("Net Income", 164, 56, { align: 'center' });

    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(summary.patient_count?.toString() || "0", 41, 64, { align: 'center' });
    
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text(safeINR(summary.total_revenue), 82, 64, { align: 'center' });
    
    doc.setTextColor(239, 68, 68); // Rose
    doc.text(safeINR(summary.total_expenses), 123, 64, { align: 'center' });
    
    doc.setTextColor(79, 70, 229); // Indigo
    doc.text(safeINR(summary.total_revenue - summary.total_expenses), 164, 64, { align: 'center' });

    // --- Income Breakdown Table ---
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text("1. INCOME BREAKDOWN (By Service)", 20, 85);

    const serviceRows = Object.entries(summary.service_breakdown).map(([name, val]) => [name, safeINR(val)]);
    applyAutoTable(doc, {
      startY: 90,
      head: [['Service Name', 'Amount (INR)']],
      body: serviceRows,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 1: { halign: 'right' } }
    });

    // --- Payment Mode Summary ---
    let currentY = doc.lastAutoTable.finalY + 15;
    if (currentY > 240) { doc.addPage(); currentY = 20; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("2. COLLECTION SUMMARY (By Mode)", 20, currentY);

    const paymentRows = Object.entries(summary.payment_breakdown).map(([mode, val]) => [mode, safeINR(val)]);
    applyAutoTable(doc, {
      startY: currentY + 5,
      head: [['Payment Mode', 'Collected Amount']],
      body: paymentRows,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      styles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' } }
    });

    // --- Expense Breakdown Table ---
    currentY = doc.lastAutoTable.finalY + 15;
    if (currentY > 240) { doc.addPage(); currentY = 20; }
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("3. EXPENSE BREAKDOWN (By Category)", 20, currentY);

    const expenseRows = Object.entries(summary.expense_breakdown || {}).map(([type, val]) => [type, safeINR(val)]);
    if (expenseRows.length === 0) expenseRows.push(["No Expenses", "Rs. 0"]);
    
    applyAutoTable(doc, {
      startY: currentY + 5,
      head: [['Expense Category', 'Debit Amount']],
      body: expenseRows,
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68], textColor: 255 },
      styles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' } },
      foot: [['Total Daily Expenses', safeINR(summary.total_expenses)]],
      footStyles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold' }
    });

    // --- Tax Details ---
    currentY = doc.lastAutoTable.finalY + 15;
    if (currentY > 260) { doc.addPage(); currentY = 20; }
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.text("Tax Summary:", 20, currentY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Output GST (Collected): ${safeINR(summary.total_gst)}`, 20, currentY + 6);
    doc.text(`Input GST (Claimable): ${safeINR(summary.total_expense_gst)}`, 20, currentY + 11);

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
    }

    const safeDate = displayDate.replace(/[^a-z0-9]/gi, '-');
    doc.save(`Daily_Summary_${safeDate}.pdf`);
  } catch (error) {
    console.error("[invoiceGenerator] Summary PDF Error:", error);
    alert("Failed to generate summary PDF. Details: " + error.message);
  }
};
