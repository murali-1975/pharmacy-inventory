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
  const filename = `Invoice_${payment.patient_name.replace(/\s+/g, '_')}_${formatDate(payment.payment_date)}.pdf`;
  doc.save(filename);
  } catch (error) {
    console.error("Failed to generate PDF invoice:", error);
    alert("SYSTEM ERROR: Could not generate PDF. Please try again or contact support. Details: " + error.message);
  }
};
