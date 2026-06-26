
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus } from '../../types';
import { RECORD_TYPES } from '../../constants';
import { Upload, FileSpreadsheet, Wand2, Save, Printer, X, Check, Download } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';

interface BulkImportProps {
  onSave: (record: RecordFile) => Promise<RecordFile | null>;
  calculateDeadline: (type: string, date: string) => string;
  calculateNextCode: (ward: string, date: string, existingCodes: string[], recordType?: string) => string;
  onPreview: (record: Partial<RecordFile>) => void;
  currentUser?: any;
}

interface BulkRecordItem extends Partial<RecordFile> {
    tempId: string;
    isSaved: boolean;
}

const BulkImport: React.FC<BulkImportProps> = ({ onSave, calculateDeadline, calculateNextCode, onPreview, currentUser }) => {
  const [bulkRecords, setBulkRecords] = useState<BulkRecordItem[]>([]);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };

  const handleDownloadTemplate = () => {
      const wb = XLSX.utils.book_new();
      
      const headers = [
          'MÃ HỒ SƠ', 'CHỦ SỬ DỤNG', 'CCCD', 'SĐT', 'ĐỊA CHỈ THƯỜNG TRÚ', 'XÃ', 'THỬA ĐẤT SỐ', 'TỜ BẢN ĐỒ SỐ', 'DIỆN TÍCH', 'ĐẤT Ở', 'ĐẤT CLN', 'ĐẤT BHK', 'ĐẤT LUC', 'ĐẤT KHÁC', 'ĐỊA CHỈ THỬA ĐẤT', 'NƠI GIAO TRẢ KẾT QUẢ', 'LOẠI HỒ SƠ', 'NỘI DUNG', 'GIẤY TỜ KÈM THEO', 'NGƯỜI ỦY QUYỀN', 'LOẠI ỦY QUYỀN', 'NGÀY NHẬN', 'NGƯỜI TIẾP NHẬN', 'HẸN TRẢ', 'NGƯỜI XỬ LÝ', 'NGÀY GIAO', 'NGÀY ĐÃ THỰC HIỆN', 'NGÀY TRÌNH KIỂM TRA', 'NGƯỜI KIỂM TRA', 'NGÀY ĐÃ KIỂM TRA', 'NGÀY TRÌNH KÝ', 'NGƯỜI KÝ DUYỆT', 'NGÀY KÝ DUYỆT', 'NGÀY GIAO 1 CỬA', 'TRẠNG THÁI', 'ĐỢT BAN GIAO', 'NGÀY XUẤT', 'SỐ ĐO ĐẠC', 'SỐ TRÍCH LỤC', 'SỐ PHÁT HÀNH', 'SỐ VÀO SỔ', 'NGÀY CẤP SỔ', 'CÓ SAI SÓT', 'LÝ DO SAI SÓT', 'NGÀY BÁO SAI SÓT', 'LÝ DO TRẢ HỒ SƠ', 'NGÀY TRẢ HỒ SƠ', 'GHI CHÚ CHUNG', 'GHI CHÚ NỘI BỘ', 'GHI CHÚ CÁ NHÂN', 'HẸN NHẮC NHỞ', 'SỐ BIÊN LAI', 'LOẠI BIÊN LAI', 'SỐ TIỀN THU', 'NGƯỜI NHẬN KẾT QUẢ', 'NGÀY TRẢ DÂN', 'CẦN CHỈNH LÝ BẢN ĐỒ', 'HỒ SƠ CÓ THUẾ', 'CHUYỂN DNLIS', 'ĐƠN GIÁ', 'TẠM ỨNG'
      ];
      
      const sampleData = [
          [
              '', 'Nguyễn Văn A', '070012345678', '0901234567', 'Tổ 1, Tân Quan', 'Tân Quan', '123', '45', '100.5', '60', '', '', '', '', 'Tổ 1, Tân Quan', 'Tân Quan', '2.1 Trích lục', 'Xin trích lục bản đồ', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Tiếp nhận', '', '', '', '', '', '', '', 'Không', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Không', 'Không', 'Không', '310000', ''
          ],
          [
              '', 'Trần Thị B', '070012345679', '0987654321', 'KP 3, Tân Khai', 'Tân Khai', '456', '78', '250.0', '100', '', '', '', '', 'KP 3, Tân Khai', 'Tân Khai', '2.3 Trích đo', 'Đo đạc cắm mốc', '', 'Lê Văn C', 'Giấy ủy quyền', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Tiếp nhận', '', '', '', '', '', '', '', 'Không', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Không', 'Không', 'Không', '310000', ''
          ]
      ];
      
      const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
      ws['!cols'] = headers.map(() => ({ wch: 18 }));
      
      // Styling the headers in the bulk import sheet
      const headerStyle = {
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" },
          fill: { fgColor: { rgb: "2E7D32" } }, // Deep Forest Green for receiving
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
              top: { style: "thin", color: { rgb: "CCCCCC" } },
              bottom: { style: "medium", color: { rgb: "2E7D32" } },
              left: { style: "thin", color: { rgb: "CCCCCC" } },
              right: { style: "thin", color: { rgb: "CCCCCC" } }
          }
      };
      
      for (let c = 0; c < headers.length; c++) {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c });
          if (ws[cellRef]) {
              ws[cellRef].s = headerStyle;
          }
      }
      
      XLSX.utils.book_append_sheet(wb, ws, "Mau_Nhap_Lieu");
      XLSX.writeFile(wb, "Mau_Nhap_Lieu_Ho_So.xlsx");
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const ab = evt.target?.result;
              const wb = XLSX.read(ab, { type: 'array' });
              setWorkbook(wb);
              
              const allSheets = wb.SheetNames;
              setSheetNames(allSheets);
              
              let defaultSheet = allSheets[0];
              const importableSheets = allSheets.filter(name => {
                  const upper = name.toUpperCase();
                  return !upper.includes('HUONG DAN') && !upper.includes('GUIDE') && !upper.includes('HƯỚNG DẪN');
              });
              
              if (importableSheets.length > 0) {
                  defaultSheet = importableSheets[0];
              }
              
              setSelectedSheet(defaultSheet);
              loadBulkSheetData(defaultSheet, wb);
          } catch (error) {
              console.error("Lỗi đọc Excel hàng loạt:", error);
              alert("Lỗi khi đọc file Excel.");
          }
      };
      reader.readAsArrayBuffer(file);
  };

  const loadBulkSheetData = (sheetName: string, activeWb?: XLSX.WorkBook) => {
      const currentWb = activeWb || workbook;
      if (!currentWb) return;
      
      try {
          const ws = currentWb.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(data.length, 20); i++) {
              const row = data[i] as any[];
              if (row && row.some(cell => {
                  const s = String(cell || '').toLowerCase();
                  return s.includes('chủ sử dụng') || s.includes('tên') || s.includes('họ tên') || s.includes('customer');
              })) {
                  headerRowIndex = i;
                  break;
              }
          }
          
          if (headerRowIndex === -1) {
              headerRowIndex = 0;
          }

          const headers = (data[headerRowIndex] as string[] || []).map(h => String(h || '').toUpperCase().trim());
          const newBulkRecords: BulkRecordItem[] = [];

          const typeMapping: Record<string, string> = {
              'TL': 'Trích lục bản đồ địa chính', 'TRÍCH LỤC': 'Trích lục bản đồ địa chính',
              'TĐ': 'Trích đo bản đồ địa chính', 'TD': 'Trích đo bản đồ địa chính', 'TRÍCH ĐO': 'Trích đo bản đồ địa chính',
              'ĐĐ': 'Đo đạc', 'DD': 'Đo đạc', 'ĐO ĐẠC': 'Đo đạc', 'CM': 'Cắm mốc', 'CẮM MỐC': 'Cắm mốc',
              'CL': 'Trích đo chỉnh lý bản đồ địa chính', 'CHỈNH LÝ': 'Trích đo chỉnh lý bản đồ địa chính',
              'HIẾN ĐƯỜNG': 'Trích đo chỉnh lý bản đồ địa chính', 'TÁCH THỬA': 'Tách thửa',
              'HỢP THỬA': 'Trích đo bản đồ địa chính', 'CẤP ĐỔI': 'Trích đo bản đồ địa chính'
          };

          for (let i = headerRowIndex + 1; i < data.length; i++) {
              const row = data[i] as any[];
              if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === '')) continue;

              const getVal = (possibleHeaders: string[]) => {
                  const idx = headers.findIndex(h => possibleHeaders.some(ph => h.includes(ph)));
                  return idx !== -1 ? row[idx] : undefined;
              };

              const customerName = getVal(['CHỦ SỬ DỤNG', 'TÊN', 'HỌ TÊN']);
              if (!customerName) continue;

              const ward = getVal(['XÃ', 'PHƯỜNG', 'ĐỊA BÀN']) || '';
              
              let rawType = String(getVal(['LOẠI', 'LĨNH VỰC', 'LOAI HO SO', 'LOẠI HỒ SƠ']) || '').trim();
              let recordType = typeMapping[rawType.toUpperCase()];

              if (!recordType) {
                  const lower = rawType.toLowerCase();
                  if (lower.includes('trích lục')) recordType = 'Trích lục bản đồ địa chính';
                  else if (lower.includes('chỉnh l�              const authorizedBy = String(getVal(['NGƯỜI ỦY QUYỀN', 'ỦY QUYỀN', 'AUTHORIZED BY']) || '');
              const authDocType = String(getVal(['LOẠI ỦY QUYỀN', 'GIẤY ỦY QUYỀN', 'AUTH DOC']) || '');

              const parseNumber = (v: any) => {
                  if (v === undefined || v === null || v === '') return undefined;
                  const parsed = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
                  return isNaN(parsed) ? undefined : parsed;
              };

              const parseBoolean = (v: any) => {
                  if (v === undefined || v === null) return undefined;
                  const str = String(v).trim().toLowerCase();
                  return (str === 'có' || str === 'yes' || str === 'true' || str === '1');
              };

              // parse additional fields
              const cccd = getVal(['CCCD', 'CMND']);
              const group = getVal(['TỔ', 'NHÓM', 'GROUP', 'group']);
              const submittedTo = getVal(['NGƯỜI KÝ DUYỆT', 'NGUOI KY DUYET', 'submittedto', 'submittedTo']);
              const checkedBy = getVal(['NGƯỜI KIỂM TRA', 'NGUOI KIEM TRA', 'checkedby', 'checkedBy']);
              
              const clnArea = parseNumber(getVal(['ĐẤT CLN', 'DIỆN TÍCH CLN', 'clnarea', 'clnArea']));
              const bhkArea = parseNumber(getVal(['ĐẤT BHK', 'DIỆN TÍCH BHK', 'bhkarea', 'bhkArea']));
              const lucArea = parseNumber(getVal(['ĐẤT LUC', 'DIỆN TÍCH LUC', 'lucarea', 'lucArea']));
              const otherLandArea = parseNumber(getVal(['ĐẤT KHÁC', 'DIỆN TÍCH ĐẤT KHÁC', 'otherlandarea', 'otherLandArea']));
              const residentialArea = parseNumber(getVal(['ĐẤT Ở', 'THỔ CƯ', 'residentialarea', 'residentialArea']));
              
              const handoverWard = getVal(['NƠI GIAO TRẢ KẾT QUẢ', 'NOI GIAO TRA KET QUA', 'ĐỊA BÀN GIAO TRẢ', 'handoverward', 'handoverWard']);
              const measurementNumber = getVal(['SỐ ĐO ĐẠC', 'SO DO DAC', 'measurementnumber', 'measurementNumber']);
              const excerptNumber = getVal(['SỐ TRÍCH LỤC', 'SO TRICH LUC', 'excerptnumber', 'excerptNumber']);
              
              const receiptNumber = getVal(['SỐ BIÊN LAI', 'SO BIEN LAI', 'receiptnumber', 'receiptNumber']);
              const receiptTypeRaw = getVal(['LOẠI BIÊN LAI', 'LOAI BIEN LAI', 'receipttype', 'receiptType']);
              const receiptType = receiptTypeRaw ? ((String(receiptTypeRaw).trim().toLowerCase().includes('hóa đơn') || String(receiptTypeRaw).trim().toLowerCase().includes('invoice')) ? 'invoice' : 'receipt') : undefined;
              const paymentAmount = parseNumber(getVal(['SỐ TIỀN THU', 'THỰC THU', 'paymentamount', 'paymentAmount']));
              const receiverName = getVal(['NGƯỜI NHẬN KẾT QUẢ', 'NGUOI NHAN KET QUA', 'receivername', 'receiverName']);
              const price = parseNumber(getVal(['ĐƠN GIÁ', 'GIÁ DỊCH VỤ', 'price']));
              const advancePayment = parseNumber(getVal(['TẠM ỨNG', 'advancepayment', 'advancePayment']));
              
              const hasDefect = parseBoolean(getVal(['CÓ SAI SÓT', 'SAI SÓT', 'hasdefect', 'hasDefect']));
              const defectReason = getVal(['LÝ DO SAI SÓT', 'defectreason', 'defectReason']);
              const rejectReason = getVal(['LÝ DO TRẢ HỒ SƠ', 'rejectreason', 'rejectReason']);
              const notes = getVal(['GHI CHÚ CHUNG', 'notes', 'notes_general']);
              const privateNotes = getVal(['GHI CHÚ NỘI BỘ', 'privatenotes', 'privateNotes']);
              const personalNotes = getVal(['GHI CHÚ CÁ NHÂN', 'personalnotes', 'personalNotes']);
              
              const needsMapCorrection = parseBoolean(getVal(['CẦN CHỈNH LÝ BẢN ĐỒ', 'LẬP DANH SÁCH CHỈNH LÝ', 'needsmapcorrection', 'needsMapCorrection']));
              const hasTax = parseBoolean(getVal(['CÓ THUẾ', 'HỒ SƠ CÓ THUẾ', 'hastax', 'hasTax']));
              const transferToDNLis = parseBoolean(getVal(['CHUYỂN DNLIS', 'transfertodnlis', 'transferToDNLis']));

              const receivedDate = new Date().toISOString();
              const deadline = calculateDeadline(String(recordType), receivedDate.split('T')[0]);

              newBulkRecords.push({
                  tempId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
                  isSaved: false,
                  customerName: String(customerName).trim(),
                  cccd: cccd ? String(cccd).trim() : undefined,
                  phoneNumber: String(getVal(['SĐT', 'ĐIỆN THOẠI']) || '').trim(),
                  ward: String(ward).trim(),
                  landPlot: String(getVal(['THỬA']) || '').trim(),
                  mapSheet: String(getVal(['TỜ']) || '').trim(),
                  area: parseFloat(String(getVal(['DIỆN TÍCH']) || '0')),
                  residentialArea: residentialArea || undefined,
                  clnArea: clnArea || undefined,
                  bhkArea: bhkArea || undefined,
                  lucArea: lucArea || undefined,
                  otherLandArea: otherLandArea || undefined,
                  address: String(getVal(['ĐỊA CHỈ']) || '').trim(),
                  recordType: String(recordType),
                  receivedDate: receivedDate,
                  deadline: deadline,
                  status: RecordStatus.RECEIVED,
                  receivedBy: currentUser?.employeeId,
                  content: String(getVal(['NỘI DUNG', 'GHI CHÚ']) || '').trim(),
                  authorizedBy: authorizedBy.trim(),
                  authDocType: authDocType.trim(),
                  group: group ? String(group).trim() : undefined,
                  submittedTo: submittedTo ? String(submittedTo).trim() : undefined,
                  checkedBy: checkedBy ? String(checkedBy).trim() : undefined,
                  handoverWard: handoverWard ? String(handoverWard).trim() : undefined,
                  measurementNumber: measurementNumber ? String(measurementNumber).trim() : undefined,
                  excerptNumber: excerptNumber ? String(excerptNumber).trim() : undefined,
                  receiptNumber: receiptNumber ? String(receiptNumber).trim() : undefined,
                  receiptType: receiptType || undefined,
                  paymentAmount: paymentAmount || undefined,
                  receiverName: receiverName ? String(receiverName).trim() : undefined,
                  price: price || undefined,
                  advancePayment: advancePayment || undefined,
                  hasDefect: hasDefect || undefined,
                  defectReason: defectReason ? String(defectReason).trim() : undefined,
                  rejectReason: rejectReason ? String(rejectReason).trim() : undefined,
                  notes: notes ? String(notes).trim() : undefined,
                  privateNotes: privateNotes ? String(privateNotes).trim() : undefined,
                  personalNotes: personalNotes ? String(personalNotes).trim() : undefined,
                  needsMapCorrection: needsMapCorrection || undefined,
                  hasTax: hasTax || undefined,
                  transferToDNLis: transferToDNLis || undefined,
                  code: ''
              });trim(),
                  mapSheet: String(getVal(['TỜ']) || '').trim(),
                  area: parseFloat(String(getVal(['DIỆN TÍCH']) || '0')),
                  address: String(getVal(['ĐỊA CHỈ']) || '').trim(),
                  recordType: String(recordType),
                  receivedDate: receivedDate,
                  deadline: deadline,
                  status: RecordStatus.RECEIVED,
                  receivedBy: currentUser?.employeeId,
                  content: String(getVal(['NỘI DUNG', 'GHI CHÚ']) || '').trim(),
                  authorizedBy: authorizedBy.trim(),
                  authDocType: authDocType.trim(),
                  code: ''
              });
          }
          setBulkRecords(newBulkRecords);
          if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
      } catch (err) {
          console.error("Lỗi parse bulk sheet:", err);
          alert("Lỗi khi tải bảng dữ liệu.");
      }
  };

  const handleGenerateBulkCode = (index: number) => {
      setBulkRecords(prev => {
          const newList = [...prev];
          const record = newList[index];
          if (!record.ward) { alert("Vui lòng nhập Xã/Phường trước khi tạo mã."); return prev; }
          const existingBulkCodes = newList.map(r => r.code || '').filter(c => c !== '');
          const newCode = calculateNextCode(record.ward, record.receivedDate || '', existingBulkCodes, record.recordType || undefined);
          newList[index] = { ...record, code: newCode };
          return newList;
      });
  };

  const handleSaveBulkRecord = async (index: number) => {
      const record = bulkRecords[index];
      if (!record.code || !record.customerName) { alert("Thiếu mã hoặc tên."); return; }

      const newRecord: RecordFile = { 
          ...record, 
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
          receivedDate: record.receivedDate || new Date().toISOString(),
          deadline: record.deadline || '',
          status: RecordStatus.RECEIVED,
          receivedBy: currentUser?.employeeId
      } as RecordFile;

      const savedRecord = await onSave(newRecord);
      if (savedRecord) {
          setBulkRecords(prev => {
              const newList = [...prev];
              newList[index] = { ...newList[index], isSaved: true, code: savedRecord.code };
              return newList;
          });
      } else {
          alert("Lỗi khi lưu.");
      }
  };

  const updateBulkRecord = (index: number, field: keyof RecordFile, value: any) => {
      setBulkRecords(prev => {
          const newList = [...prev];
          const updated = { ...newList[index], [field]: value };
          if (field === 'recordType' || field === 'receivedDate') {
              const rType = field === 'recordType' ? value : updated.recordType;
              const rDate = field === 'receivedDate' ? value : updated.receivedDate;
              if (rType && rDate) updated.deadline = calculateDeadline(rType, rDate);
          }
          newList[index] = updated;
          return newList;
      });
  };

  const removeBulkRecord = async (index: number) => {
      if(await confirmAction('Bạn muốn xóa dòng này?')) setBulkRecords(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
                <h3 className="font-bold text-blue-800 text-lg flex items-center gap-2">
                    <Upload size={20} /> Nhập liệu hàng loạt từ Excel
                </h3>
                <p className="text-sm text-blue-600 mt-1">Chọn file Excel để nhập danh sách. Mã hồ sơ sẽ được để trống và tạo sau.</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
                {sheetNames.length > 1 && (
                    <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 shadow-sm text-sm">
                        <span className="text-xs font-semibold text-gray-700">Chọn Sheet:</span>
                        <select 
                            value={selectedSheet}
                            onChange={(e) => {
                                setSelectedSheet(e.target.value);
                                loadBulkSheetData(e.target.value);
                            }}
                            className="bg-gray-50 border border-gray-300 rounded px-2 py-0.5 text-xs font-semibold text-gray-800 focus:outline-none"
                        >
                            {sheetNames.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                )}
                <button onClick={handleDownloadTemplate} className="bg-white text-green-700 border border-green-300 px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-100 flex items-center gap-2">
                    <Download size={16} /> Tải mẫu Excel
                </button>
                <button onClick={() => bulkFileInputRef.current?.click()} className="bg-white text-blue-700 border border-blue-300 px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-100 flex items-center gap-2">
                    <FileSpreadsheet size={16} /> Chọn File Excel
                </button>
                <input type="file" ref={bulkFileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleBulkImport} />
            </div>
        </div>

        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0">
            <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                <span className="font-bold text-gray-700">Danh sách chờ xử lý ({bulkRecords.length})</span>
                {bulkRecords.length > 0 && <span className="text-xs text-orange-600 italic">Lưu ý: Bấm "Tạo mã" &rarr; "Lưu" cho từng dòng.</span>}
            </div>
            <div className="overflow-auto flex-1">
                <table className="w-full text-left table-fixed min-w-[1200px]">
                    <thead className="bg-gray-100 text-xs text-gray-600 uppercase font-bold sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="p-3 w-10 text-center">#</th>
                            <th className="p-3 w-[160px]">Mã Hồ Sơ</th>
                            <th className="p-3 w-[200px]">Chủ Sử Dụng</th>
                            <th className="p-3 w-[150px]">Loại Hồ Sơ</th>
                            <th className="p-3 w-[120px]">Xã / Phường</th>
                            <th className="p-3 w-[120px]">Hẹn Trả</th>
                            <th className="p-3 w-[200px] text-center">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {bulkRecords.length > 0 ? bulkRecords.map((item, idx) => (
                            <tr key={item.tempId} className={`hover:bg-blue-50/30 ${item.isSaved ? 'bg-green-50' : ''}`}>
                                <td className="p-3 text-center text-gray-400">{idx + 1}</td>
                                <td className="p-3">
                                    <div className="flex gap-1">
                                        <input type="text" className={`w-full border rounded px-2 py-1 text-sm font-mono ${item.code ? 'border-blue-300 text-blue-700 font-bold' : 'border-gray-300 bg-gray-50'}`} placeholder="Chưa có mã" value={item.code || ''} onChange={(e) => updateBulkRecord(idx, 'code', e.target.value)} readOnly={item.isSaved} />
                                        {!item.isSaved && <button onClick={() => handleGenerateBulkCode(idx)} className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200" title="Tạo mã"><Wand2 size={14} /></button>}
                                    </div>
                                </td>
                                <td className="p-3"><input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={item.customerName ?? ''} onChange={(e) => updateBulkRecord(idx, 'customerName', e.target.value)} readOnly={item.isSaved} /></td>
                                <td className="p-3"><select className="w-full border border-gray-300 rounded px-2 py-1 text-sm outline-none" value={item.recordType ?? ''} onChange={(e) => updateBulkRecord(idx, 'recordType', e.target.value)} disabled={item.isSaved}> {RECORD_TYPES.map(t => <option key={t} value={t}>{t}</option>)} </select></td>
                                <td className="p-3"><input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={item.ward ?? ''} onChange={(e) => updateBulkRecord(idx, 'ward', e.target.value)} readOnly={item.isSaved} /></td>
                                <td className="p-3"><input type="date" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={dateVal(item.deadline)} onChange={(e) => updateBulkRecord(idx, 'deadline', e.target.value)} readOnly={item.isSaved} /></td>
                                <td className="p-3 text-center">
                                    <div className="flex justify-center gap-2">
                                        {item.isSaved ? <span className="flex items-center gap-1 text-green-600 font-bold px-3 py-1 bg-green-100 rounded text-xs"><Check size={14} /> Đã lưu</span> : <button onClick={() => handleSaveBulkRecord(idx)} disabled={!item.code} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 text-xs font-bold"><Save size={14} /> Lưu</button>}
                                        <button onClick={() => onPreview(item)} className="p-1.5 text-purple-600 border border-purple-200 rounded hover:bg-purple-50" title="In biên nhận"><Printer size={16} /></button>
                                        {!item.isSaved && <button onClick={() => removeBulkRecord(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xóa dòng"><X size={16} /></button>}
                                    </div>
                                </td>
                            </tr>
                        )) : <tr><td colSpan={7} className="p-12 text-center text-gray-400 italic">Chưa có dữ liệu.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default BulkImport;
