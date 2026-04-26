import React, { useState } from 'react';
import { X, Upload, FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../../api';

const BulkUploadModal = ({ onClose, onRefresh, token }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.uploadInvoices(token, file);
      setResult(data);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || 'Failed to upload invoices.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await api.getInvoiceTemplate(token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'invoice_template.csv';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      alert('Failed to download template');
    }
  };

  const handleDownloadErrors = () => {
    if (!result?.error_csv_content) return;
    const blob = new Blob([result.error_csv_content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'upload_errors.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <Upload size={20} />
            <h2 className="text-lg font-bold">Bulk Invoice Upload</h2>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {!result ? (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-gray-500 text-sm">
                  Upload a CSV or Excel file containing your invoices. 
                </p>
                <button 
                  onClick={handleDownloadTemplate}
                  className="text-blue-600 text-xs font-bold hover:underline flex items-center justify-center space-x-1 mx-auto"
                >
                  <Download size={14} />
                  <span>Download CSV Template</span>
                </button>
              </div>

              <div 
                className={`border-2 border-dashed rounded-2xl p-8 transition-all text-center flex flex-col items-center justify-center space-y-3 cursor-pointer
                  ${file ? 'border-blue-300 bg-blue-50/30' : 'border-gray-100 hover:border-gray-200'}
                `}
                onClick={() => document.getElementById('fileInput').click()}
              >
                <input 
                  id="fileInput"
                  type="file" 
                  className="hidden" 
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                />
                
                <div className={`p-4 rounded-full ${file ? 'bg-blue-100 text-blue-600' : 'bg-gray-50 text-gray-400'}`}>
                  {file ? <FileText size={32} /> : <Upload size={32} />}
                </div>
                
                <div>
                  <div className="font-bold text-gray-900">
                    {file ? file.name : 'Click to select file'}
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                    MAX SIZE: 10MB • CSV/EXCEL
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center space-x-3">
                  <AlertCircle size={20} />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              )}

              <button 
                onClick={handleUpload}
                disabled={!file || loading}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Upload size={20} />
                    <span>Start Import</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center space-y-6 py-4 animate-in slide-in-from-bottom duration-500">
              <div className="inline-flex items-center justify-center p-4 bg-green-100 text-green-600 rounded-full mb-2">
                <CheckCircle size={48} />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-gray-900">Import Complete</h3>
                <p className="text-gray-500 text-sm">Processed {result.success_count + result.error_count} invoices</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-2xl border border-green-100/50">
                  <div className="text-2xl font-black text-green-600">{result.success_count}</div>
                  <div className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Successful</div>
                </div>
                <div className={`p-4 rounded-2xl border ${result.error_count > 0 ? 'bg-red-50 border-red-100/50' : 'bg-gray-50 border-gray-100/50'}`}>
                  <div className={`text-2xl font-black ${result.error_count > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {result.error_count}
                  </div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Failed</div>
                </div>
              </div>

              {result.error_count > 0 && (
                <button 
                  onClick={handleDownloadErrors}
                  className="w-full bg-white border-2 border-red-100 text-red-600 py-4 rounded-2xl font-bold hover:bg-red-50 transition-all flex items-center justify-center space-x-2 group"
                >
                  <Download size={20} className="group-hover:translate-y-0.5 transition-transform" />
                  <span>Download Error Report</span>
                </button>
              )}

              <button 
                onClick={onClose}
                className="w-full text-gray-500 font-bold hover:text-gray-700 py-2 transition-colors"
              >
                Close Window
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkUploadModal;
