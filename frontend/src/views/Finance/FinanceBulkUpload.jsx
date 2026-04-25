import React, { useState } from 'react';
import { 
  Upload, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  FileText, 
  X,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import api from '../../api';

const FinanceBulkUpload = ({ token, onUnauthorized }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleDownloadTemplate = async () => {
    try {
      const blob = await api.getFinanceTemplate(token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'finance_payment_template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err.message === 'Unauthorized') onUnauthorized();
      else setError("Failed to download template");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/finance/payments/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.status === 401) { onUnauthorized(); return; }
      
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (response.ok) {
          setResult(data);
        } else {
          setError(data.detail || "Upload failed");
        }
      } catch (e) {
        console.error("Malformed JSON from upload:", text.substring(0, 100));
        setError("Server returned invalid response format");
      }
    } catch (err) {
      setError("Network error occurred during upload");
    } finally {
      setIsUploading(false);
    }
  };

  const downloadErrorReport = () => {
    if (!result?.error_csv_content) return;
    const blob = new Blob([result.error_csv_content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payment_upload_errors.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-50 pb-6">
          <div className="flex items-center gap-3 text-slate-800">
            <Upload className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-black tracking-tight">Bulk Payment Upload</h2>
          </div>
          <button 
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all"
          >
            <Download className="w-4 h-4" />
            Template
          </button>
        </div>

        {error && (
          <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3 text-red-700 animate-in fade-in zoom-in-95 duration-300">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {!result ? (
          <div className="space-y-4">
            <div 
              className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all ${
                file ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-200 hover:border-slate-300'
              }`}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files[0]); }}
            >
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <FileText className={`w-8 h-8 ${file ? 'text-indigo-500' : 'text-slate-400'}`} />
              </div>
              <div className="text-center">
                <p className="text-slate-900 font-bold">
                  {file ? file.name : 'Choose a file or drag it here'}
                </p>
                <p className="text-slate-400 text-sm mt-1">Supports CSV and Excel (.xlsx)</p>
              </div>
              
              <input 
                type="file" 
                id="file-upload" 
                className="hidden" 
                accept=".csv,.xlsx" 
                onChange={(e) => setFile(e.target.files[0])}
              />
              <button 
                onClick={() => document.getElementById('file-upload').click()}
                className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg active:scale-95"
              >
                Select File
              </button>
            </div>

            <button 
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              {isUploading ? 'Processing...' : 'Upload & Process'}
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                <div className="text-emerald-600 font-black text-3xl">{result.success_count}</div>
                <div className="text-emerald-700 text-xs font-bold uppercase tracking-wider">Successful</div>
              </div>
              <div className={`p-4 rounded-2xl border ${result.error_count > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className={`${result.error_count > 0 ? 'text-amber-600' : 'text-slate-400'} font-black text-3xl`}>{result.error_count}</div>
                <div className={`${result.error_count > 0 ? 'text-amber-700' : 'text-slate-500'} text-xs font-bold uppercase tracking-wider`}>Errors</div>
              </div>
            </div>

            {result.error_count > 0 && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-sm font-bold">Errors were found during processing</span>
                </div>
                <button 
                  onClick={downloadErrorReport}
                  className="w-fit flex items-center gap-2 text-xs font-black bg-white border border-amber-200 px-3 py-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Download Error Report
                </button>
              </div>
            )}

            <button 
              onClick={() => { setFile(null); setResult(null); }}
              className="w-full py-2.5 border-2 border-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition-all"
            >
              Upload Another File
            </button>
          </div>
        )}
      </div>

      <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 flex gap-4">
        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
          <AlertCircle className="w-6 h-6 text-indigo-600" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-800">How bulk upload works</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            The system groups rows by <strong>Date, Patient Name, and Token No</strong>. 
            All services and payments for the same patient-visit combination should be in separate rows but with identical patient headers. 
            Master data names must match exactly as configured in the system.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FinanceBulkUpload;
