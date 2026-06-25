
import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { RecordFile, RecordStatus, Employee, Holiday } from '../types';
import { RECORD_TYPES, REGISTRATION_PROCEDURES } from '../constants';
import { fetchHolidays } from '../services/api';
import { X, Upload, FileSpreadsheet, Save, Loader2, AlertCircle, Check, RefreshCw, PlusCircle, AlertTriangle } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (records: RecordFile[], mode: 'create' | 'update', onProgress?: (processed: number, total: number) => void) => Promise<boolean>;
  employees: Employee[];
}

// Helper: Solar date from Lunar (Giống ReceiveRecord)
const getSolarDateFromLunar = (lunarDay: number, lunarMonth: number, year: number): Date | null => {
    const lunarMapping: Record<number, Record<string, string>> = {
        2024: { "1/1": "2024-02-10", "2/1": "2024-02-11", "3/1": "2024-02-12", "10/3": "2024-04-18" },
        2025: { "1/1": "2025-01-29", "2/1": "2025-01-30", "3/1": "2025-01-31", "10/3": "2025-04-07" },
        2026: { "1/1": "2026-02-17", "2/1": "2026-02-18", "3/1": "2026-02-19", "10/3": "2026-04-26" }
    };
    const key = `${lunarDay}/${lunarMonth}`;
    return lunarMapping[year] && lunarMapping[year][key] ? new Date(lunarMapping[year][key]) : null;
};

// Helper: Format YYYY-MM-DD
const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport, employees }) => {
  type PreviewRecord = RecordFile & { _errors?: string[] };
  const [previewData, setPreviewData] = useState<PreviewRecord[]>([]);
  const [fileName, setFileName] = useState('');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'update'>('create');
  const [viewFilter, setViewFilter] = useState<'all' | 'valid' | 'errors'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  const [progress, setProgress] = useState<{ processed: number, total: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
        fetchHolidays().then(setHolidays);
        setPreviewData([]);
        setFileName('');
        setViewFilter('all');
        setProgress(null);
        setWorkbook(null);
        setSheetNames([]);
        setSelectedSheet('');
        if(fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen]);

  const parseExcelDate = (input: any): string | undefined => {
      if (input === undefined || input === null || input === '') return undefined;
      
      const num = parseFloat(input);
      if (!isNaN(num) && num > 20000) {
          const excelEpoch = new Date(1899, 11, 30);
          const totalMilliseconds = Math.round(num * 86400 * 1000); 
          const date = new Date(excelEpoch.getTime() + totalMilliseconds);
          return formatDateKey(date);
      }

      if (typeof input === 'string') {
          const cleanStr = input.trim();
          if (cleanStr.match(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/)) {
              const parts = cleanStr.split(/[\/-]/);
              return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
          if (cleanStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              return cleanStr;
          }
      }
      return '';
  };

  const calculateDeadline = (type: string, receivedDateStr: string, hasTax?: boolean) => {
      if(!receivedDateStr) return '';
      let daysToAdd = 30; 
      const lowerType = (type || '').toLowerCase();
      if (lowerType.includes('cmđ') || lowerType.includes('cmd') || lowerType.includes('2.7 trích lục cmđ')) daysToAdd = 2;
      else if (lowerType.includes('trích lục')) daysToAdd = 10; 
      else if (lowerType.includes('trích đo chỉnh lý')) daysToAdd = 15; 
      else if (lowerType.includes('trích đo') || lowerType.includes('đo đạc') || lowerType.includes('cắm mốc') || lowerType.includes('tách thửa')) daysToAdd = 30; 
      
      const t = (type || '').trim().toLowerCase();
      const isReg = t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => p.toLowerCase() === t);

      if (isReg && hasTax) {
          daysToAdd += 10;
      }
      
      const startDate = new Date(receivedDateStr);
      let count = 0;
      let currentDate = new Date(startDate);
      
      // Build Holiday Set
      const holidaySet = new Set<string>();
      const currentYear = startDate.getFullYear();
      [currentYear, currentYear + 1].forEach(year => {
          holidays.forEach(h => {
              if (h.isLunar) {
                  const solar = getSolarDateFromLunar(h.day, h.month, year);
                  if (solar) holidaySet.add(formatDateKey(solar));
              } else {
                  const solar = new Date(year, h.month - 1, h.day);
                  holidaySet.add(formatDateKey(solar));
              }
          });
      });

      while (count < daysToAdd) {
          currentDate.setDate(currentDate.getDate() + 1);
          const dateStr = formatDateKey(currentDate);
          const day = currentDate.getDay();
          
          const isWeekend = day === 0 || day === 6; // Sat + Sun
          const isHoliday = holidaySet.has(dateStr);

          if (!isWeekend && !isHoliday) {
              count++;
          }
      }
      return formatDateKey(currentDate);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const ab = evt.target?.result;
        const wb = XLSX.read(ab, { type: 'array' });
        setWorkbook(wb);
        
        const allSheets = wb.SheetNames;
        setSheetNames(allSheets);
        
        // Auto-select the first sheet that is NOT an instruction sheet
        let defaultSheet = allSheets[0];
        const importableSheets = allSheets.filter(name => {
            const upper = name.toUpperCase();
            return !upper.includes('HUONG DAN') && !upper.includes('GUIDE') && !upper.includes('HƯỚNG DẪN');
        });
        
        if (importableSheets.length > 0) {
            defaultSheet = importableSheets[0];
        }
        
        setSelectedSheet(defaultSheet);
        loadSheetData(defaultSheet, wb);
      } catch (error) {
        console.error("Lỗi đọc Excel:", error);
        alert("Có lỗi khi đọc file Excel.");
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const loadSheetData = (sheetName: string, activeWb?: XLSX.WorkBook) => {
      const currentWb = activeWb || workbook;
      if (!currentWb) return;
      
      setLoading(true);
      try {
          const ws = currentWb.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
          
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(data.length, 20); i++) {
              const row = data[i] as any[];
              if (row && row.some(cell => {
                  const s = String(cell || '').toLowerCase();
                  return s.includes('mã') || s.includes('chủ sử dụng') || s.includes('chủ sử') || s.includes('customer') || s.includes('tên') || s.includes('họ tên');
              })) {
                  headerRowIndex = i;
                  break;
              }
          }
          
          if (headerRowIndex === -1) {
              headerRowIndex = 0;
          }

          const headers = (data[headerRowIndex] as string[] || []).map(h => String(h || '').toUpperCase().trim());
          const mappedRecords: any[] = [];

          const typeMapping: Record<string, string> = {
              'TL': 'Trích lục bản đồ địa chính', 'TRÍCH LỤC': 'Trích lục bản đồ địa chính',
              'TĐ': 'Trích đo bản đồ địa chính', 'TRÍCH ĐO': 'Trích đo bản đồ địa chính',
              'ĐĐ': 'Đo đạc', 'ĐO ĐẠC': 'Đo đạc', 'CM': 'Cắm mốc', 'CẮM MỐC': 'Cắm mốc',
              'CL': 'Trích đo chỉnh lý bản đồ địa chính', 'CHỈNH LÝ': 'Trích đo chỉnh lý bản đồ địa chính'
          };

          for (let i = headerRowIndex + 1; i < data.length; i++) {
              const row = data[i] as any[];
              if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === '')) continue;

              const getVal = (possibleHeaders: string[]) => {
                  let idx = headers.findIndex(h => {
                      const hUpper = h.trim().toUpperCase();
                      return possibleHeaders.some(ph => hUpper === ph.toUpperCase());
                  });
                  if (idx === -1) {
                      idx = headers.findIndex(h => {
                          const hUpper = h.trim().toUpperCase();
                          return possibleHeaders.some(ph => hUpper.includes(ph.toUpperCase()));
                      });
                  }
                  return idx !== -1 ? row[idx] : undefined;
              };

              const codeRaw = getVal(['MÃ HỒ SƠ', 'MÃ HS', 'CODE', 'code']);
              const code = codeRaw ? String(codeRaw).trim() : undefined;
              
              if (mode === 'update' && !code) continue;

              const record: any = {};
              
              if (code) record.code = code;
              else if (mode === 'create') record.code = `AUTO-${Math.floor(Math.random()*100000)}`;

              const nameRaw = getVal(['CHỦ SỬ DỤNG', 'TÊN', 'HỌ TÊN', 'CUSTOMER', 'customername', 'customer_name', 'customerName']);
              if (nameRaw !== undefined) record.customerName = String(nameRaw).trim();
              else if (mode === 'create') record.customerName = 'Chưa cập nhật';

              const phoneRaw = getVal(['SĐT', 'ĐIỆN THOẠI', 'phonenumber', 'phone_number', 'phoneNumber']);
              if (phoneRaw !== undefined) record.phoneNumber = String(phoneRaw).trim();

              const addressRaw = getVal(['ĐỊA CHỈ', 'ADDRESS', 'customeraddress', 'customer_address', 'customerAddress', 'address']);
              if (addressRaw !== undefined) record.customerAddress = String(addressRaw).trim();

              const cccdRaw = getVal(['CCCD', 'CMND', 'cccd']);
              if (cccdRaw !== undefined) record.cccd = String(cccdRaw).trim();

              const authByRaw = getVal(['NGƯỜI ỦY QUYỀN', 'ỦY QUYỀN', 'authorizedby', 'authorized_by', 'authorizedBy']);
              const authTypeRaw = getVal(['LOẠI ỦY QUYỀN', 'GIẤY ỦY QUYỀN', 'authdoctype', 'auth_doc_type', 'authDocType']);
              if (authByRaw !== undefined || authTypeRaw !== undefined) {
                  record.authDocType = `${authByRaw ? String(authByRaw).trim() : ''}|${authTypeRaw ? String(authTypeRaw).trim() : 'Bản chính'}`;
              }

              const wardRaw = getVal(['XÃ', 'PHƯỜNG', 'WARD', 'ward']);
              if (wardRaw !== undefined) record.ward = String(wardRaw).trim();

              const mapSheetRaw = getVal(['TỜ', 'BẢN ĐỒ SỐ', 'mapsheet', 'map_sheet', 'mapSheet']);
              if (mapSheetRaw !== undefined) record.mapSheet = String(mapSheetRaw).trim();

              const landPlotRaw = getVal(['THỬA', 'THỬA ĐẤT SỐ', 'landplot', 'land_plot', 'landPlot']);
              if (landPlotRaw !== undefined) record.landPlot = String(landPlotRaw).trim();

              const errors: string[] = [];

              const rawArea = getVal(['DIỆN TÍCH', 'AREA', 'area']);
              if (rawArea !== undefined && rawArea !== null && rawArea !== '') {
                  const parsedArea = parseFloat(String(rawArea));
                  record.area = isNaN(parsedArea) ? 0 : parsedArea;
                  if (isNaN(parsedArea)) {
                      errors.push(`Diện tích "${rawArea}" không hợp lệ.`);
                  }
              } else if (rawArea !== undefined) {
                  record.area = null;
              }

              const rawResArea = getVal(['ĐẤT Ở', 'THỔ CƯ', 'residentialarea', 'residential_area', 'residentialArea']);
              if (rawResArea !== undefined && rawResArea !== null && rawResArea !== '') {
                   const parsedResArea = parseFloat(String(rawResArea));
                   record.residentialArea = isNaN(parsedResArea) ? 0 : parsedResArea;
                   if (isNaN(parsedResArea)) {
                       errors.push(`Đất ở "${rawResArea}" không hợp lệ.`);
                   }
              } else if (rawResArea !== undefined) {
                   record.residentialArea = null;
              }

              const issueNumRaw = getVal(['SỐ PHÁT HÀNH', 'issuenumber', 'issue_number', 'issueNumber']);
              if (issueNumRaw !== undefined) record.issueNumber = String(issueNumRaw).trim();

              const entryNumRaw = getVal(['SỐ VÀO SỔ', 'entrynumber', 'entry_number', 'entryNumber']);
              if (entryNumRaw !== undefined) record.entryNumber = String(entryNumRaw).trim();

              const processDateCell = (rawVal: any, label: string) => {
                  if (rawVal === undefined || rawVal === null || rawVal === '') return undefined;
                  const parsed = parseExcelDate(rawVal);
                  if (parsed === '') {
                      errors.push(`Trường "${label}" (${rawVal}) không đúng định dạng DD/MM/YYYY.`);
                      return undefined;
                  }
                  return parsed;
              };

              const issueDateRaw = getVal(['NGÀY CẤP', 'issuedate', 'issue_date', 'issueDate']);
              if (issueDateRaw !== undefined) record.issueDate = processDateCell(issueDateRaw, "Ngày cấp");

              const contentRaw = getVal(['NỘI DUNG', 'GHI CHÚ', 'content', 'notes']);
              if (contentRaw !== undefined) record.content = String(contentRaw).trim();

              const otherDocsRaw = getVal(['GIẤY TỜ KÈM THEO', 'GIẤY TỜ', 'otherdocs', 'other_docs', 'otherDocs']);
              if (otherDocsRaw !== undefined) record.otherDocs = String(otherDocsRaw).trim();

              const receivedRaw = getVal(['NGÀY NHẬN', 'NGÀY NỘP', 'receiveddate', 'received_date', 'receivedDate']);
              if (receivedRaw !== undefined) {
                  record.receivedDate = processDateCell(receivedRaw, "Ngày nhận/nộp");
              } else if (mode === 'create') {
                  record.receivedDate = new Date().toISOString();
              }

              const deadlineRaw = getVal(['HẸN TRẢ', 'DEADLINE', 'deadline']);
              if (deadlineRaw !== undefined) record.deadline = processDateCell(deadlineRaw, "Hạn trả");

              const completedWorkDateRaw = getVal(['NGÀY THỰC HIỆN', 'NGÀY ĐÃ THỰC HIỆN', 'completedworkdate', 'completed_work_date', 'completedWorkDate']);
              if (completedWorkDateRaw !== undefined) record.completedWorkDate = processDateCell(completedWorkDateRaw, "Ngày thực hiện");

              const pendingCheckDateRaw = getVal(['NGÀY TRÌNH KIỂM TRA', 'NGÀY CHỜ KIỂM TRA', 'pendingcheckdate', 'pending_check_date', 'pendingCheckDate']);
              if (pendingCheckDateRaw !== undefined) record.pendingCheckDate = processDateCell(pendingCheckDateRaw, "Ngày trình kiểm tra");

              const checkedDateRaw = getVal(['NGÀY ĐÃ KIỂM TRA', 'checkeddate', 'checked_date', 'checkedDate']);
              if (checkedDateRaw !== undefined) record.checkedDate = processDateCell(checkedDateRaw, "Ngày đã kiểm tra");

              const submissionDateRaw = getVal(['NGÀY TRÌNH KÝ', 'submissiondate', 'submission_date', 'submissionDate']);
              if (submissionDateRaw !== undefined) record.submissionDate = processDateCell(submissionDateRaw, "Ngày trình ký");

              const approvalDateRaw = getVal(['NGÀY KÝ DUYỆT', 'NGÀY KÝ', 'approvaldate', 'approval_date', 'approvalDate']);
              if (approvalDateRaw !== undefined) record.approvalDate = processDateCell(approvalDateRaw, "Ngày ký duyệt");

              const completedDateRaw = getVal(['NGÀY HOÀN THÀNH', 'completeddate', 'completed_date', 'completedDate', 'NGÀY GIAO 1 CỬA']);
              if (completedDateRaw !== undefined) record.completedDate = processDateCell(completedDateRaw, "Ngày bàn giao một cửa");

              const resultReturnedDateRaw = getVal(['NGÀY TRẢ DÂN', 'resultreturneddate', 'result_returned_date', 'resultReturnedDate']);
              if (resultReturnedDateRaw !== undefined) record.resultReturnedDate = processDateCell(resultReturnedDateRaw, "Ngày trả dân");

              const typeRaw = getVal(['LOẠI HỒ SƠ', 'LOAI HO SO', 'recordtype', 'record_type']);
              if (typeRaw !== undefined) {
                  record.recordType = String(typeRaw).trim();
              } else if (mode === 'create') {
                  record.recordType = RECORD_TYPES[0];
              }

              if (mode === 'create' && !record.deadline && record.recordType && record.receivedDate) {
                  record.deadline = calculateDeadline(record.recordType, record.receivedDate);
              }

              if (record.recordType === 'Cung cấp tài liệu đất đai' || record.recordType === '1. Cung cấp dữ liệu đất đai') {
                  record.price = 310000;
              }

              const exportBatchRaw = getVal(['ĐỢT', 'BATCH', 'exportbatch', 'export_batch', 'exportBatch']);
              if (exportBatchRaw !== undefined) {
                  const numStr = String(exportBatchRaw).replace(/[^0-9]/g, '');
                  if (numStr) record.exportBatch = parseInt(numStr, 10);
              }

              const exportDateRaw = getVal(['NGÀY XUẤT', 'EXPORT DATE', 'NGÀY TRẢ', 'exportdate', 'export_date', 'exportDate']);
              if (exportDateRaw !== undefined) {
                  record.exportDate = processDateCell(exportDateRaw, "Ngày xuất/trả");
              }

              let explicitStatus: RecordStatus | undefined = undefined;
              const statusRaw = getVal(['TRẠNG THÁI', 'STATUS', 'status']);
              if (statusRaw !== undefined && String(statusRaw).trim() !== '') {
                  let sStr = String(statusRaw).toUpperCase();
                  if (sStr.includes('GIAO NHÂN VIÊN') || sStr.includes('PASSED_TO') || sStr.includes('ASSIGNED')) explicitStatus = RecordStatus.ASSIGNED;
                  else if (sStr.includes('ĐANG') || sStr.includes('PROGRESS')) explicitStatus = RecordStatus.IN_PROGRESS;
                  else if (sStr.includes('ĐÃ THỰC HIỆN') || sStr.includes('THỰC HIỆN XONG') || sStr.includes('COMPLETED_WORK')) explicitStatus = RecordStatus.COMPLETED_WORK;
                  else if (sStr.includes('CHỜ KIỂM TRA') || sStr.includes('PENDING_CHECK')) explicitStatus = RecordStatus.PENDING_CHECK;
                  else if (sStr.includes('ĐÃ KIỂM TRA') || sStr.includes('CHECKED')) explicitStatus = RecordStatus.CHECKED;
                  else if (sStr.includes('CHỜ KÝ') || sStr.includes('PENDING_SIGN') || sStr.includes('TRÌNH KÝ')) explicitStatus = RecordStatus.PENDING_SIGN;
                  else if (sStr.includes('ĐÃ KÝ') || sStr.includes('SIGNED') || sStr.includes('KÝ DUYỆT')) explicitStatus = RecordStatus.SIGNED;
                  else if (sStr.includes('XONG') || sStr.includes('HOÀN THÀNH') || sStr.includes('HANDOVER') || sStr.includes('GIAO 1 CỬA')) explicitStatus = RecordStatus.HANDOVER;
                  else if (sStr.includes('TRẢ DÂN') || sStr.includes('RETURNED') || sStr.includes('ĐÃ TRẢ')) explicitStatus = RecordStatus.RETURNED;
                  else if (sStr.includes('TIẾP NHẬN') || sStr.includes('RECEIVED') || sStr.includes('MỚI NHẬN')) explicitStatus = RecordStatus.RECEIVED;
              }

              if (explicitStatus !== undefined) {
                  record.status = explicitStatus;
                  const nowStr = new Date().toISOString();
                  if (explicitStatus === RecordStatus.HANDOVER) {
                      if (!record.completedDate) record.completedDate = nowStr;
                  } else if (explicitStatus === RecordStatus.RETURNED) {
                      if (!record.resultReturnedDate) record.resultReturnedDate = nowStr;
                  } else if (explicitStatus === RecordStatus.SIGNED) {
                      if (!record.approvalDate) record.approvalDate = nowStr;
                  } else if (explicitStatus === RecordStatus.PENDING_SIGN) {
                      if (!record.submissionDate) record.submissionDate = nowStr;
                  } else if (explicitStatus === RecordStatus.CHECKED) {
                      if (!record.checkedDate) record.checkedDate = nowStr;
                  } else if (explicitStatus === RecordStatus.PENDING_CHECK) {
                      if (!record.pendingCheckDate) record.pendingCheckDate = nowStr;
                  } else if (explicitStatus === RecordStatus.COMPLETED_WORK) {
                      if (!record.completedWorkDate) record.completedWorkDate = nowStr;
                  } else if (explicitStatus === RecordStatus.ASSIGNED || explicitStatus === RecordStatus.IN_PROGRESS) {
                      if (!record.assignedDate) record.assignedDate = nowStr;
                  }
              } else {
                  if (record.exportBatch || record.exportDate || record.completedDate) {
                      record.status = RecordStatus.HANDOVER;
                      if (!record.completedDate && record.exportDate) {
                          record.completedDate = record.exportDate;
                      }
                  } else if (record.resultReturnedDate) {
                      record.status = RecordStatus.RETURNED;
                  } else if (record.approvalDate) {
                      record.status = RecordStatus.SIGNED;
                  } else if (record.submissionDate) {
                      record.status = RecordStatus.PENDING_SIGN;
                  } else if (record.checkedDate) {
                      record.status = RecordStatus.CHECKED;
                  } else if (record.pendingCheckDate) {
                      record.status = RecordStatus.PENDING_CHECK;
                  } else if (record.completedWorkDate) {
                      record.status = RecordStatus.COMPLETED_WORK;
                  } else if (mode === 'create') {
                      record.status = RecordStatus.RECEIVED;
                  }
              }

              const assigneeRaw = getVal(['NGƯỜI XỬ LÝ', 'NHÂN VIÊN', 'assignedto', 'assigned_to', 'assignedTo']);
              if (assigneeRaw !== undefined) {
                  const emp = employees.find(e => e.name.toLowerCase().includes(String(assigneeRaw).toLowerCase()));
                  if (emp) {
                      record.assignedTo = emp.id;
                      if (mode === 'create') record.assignedDate = record.receivedDate;
                  }
              }

              const assignedDateRaw = getVal(['NGÀY GIAO', 'NGÀY GIAO VIỆC', 'assigneddate', 'assigned_date', 'assignedDate']);
              if (assignedDateRaw !== undefined) {
                  record.assignedDate = processDateCell(assignedDateRaw, "Ngày giao việc");
              }

              record.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);
              
              if (mode === 'create') {
                  if (!record.customerName) errors.push("Thiếu tên Chủ sử dụng.");
                  if (!record.recordType) errors.push("Thiếu Loại hồ sơ.");
              } else {
                  if (!record.code) errors.push("Thiếu Mã HS (Bắt buộc để cập nhật).");
              }

              record._errors = errors;
              mappedRecords.push(record);
          }

          setPreviewData(mappedRecords as PreviewRecord[]);
          setLoading(false);
      } catch (err) {
          console.error("Lỗi parse sheet:", err);
          alert("Lỗi khi tải bảng dữ liệu.");
          setLoading(false);
      }
  };

  const handleSave = async () => {
      setLoading(true);
      setProgress({ processed: 0, total: previewData.length });
      const success = await onImport(previewData, mode, (processed, total) => {
          setProgress({ processed, total });
      });
      setLoading(false);
      setProgress(null);
      if (success) {
          onClose();
      }
  };

  const handleDownloadTemplate = () => {
      const wb = XLSX.utils.book_new();
      
      // 1. HUONG DAN SU DUNG
      const instrHeaders = ["TIÊU ĐỀ / TÊN CỘT", "MÔ TẢ CHI TIẾT", "ĐỊA BÀN HOẶC ĐỊNH DẠNG", "TÍNH BẮT BUỘC"];
      const instrRows = [
          ["MẪU NHẬP LIỆU HỒ SƠ ĐA PHÂN HỆ QUA EXCEL", "", "", ""],
          ["Hệ thống quản lý thông minh hồ sơ đất đai và đăng ký biến động", "", "", ""],
          [],
          ["[PHẦN 1] CÁC TAB BẢN MẪU HỒ SƠ CHUYÊN BIỆT:"],
          ["- Tab '2. HO SO DAT DAI':", "Dành cho hồ sơ đo đạc, trích lục, trích đo, cấp số thửa, cung cấp dữ liệu..."],
          ["- Tab '3. DANG KY BIEN DONG':", "Dành cho hồ sơ chuyển nhượng, tặng cho, thừa kế, thỏa thuận (quy trình 3.*)..."],
          ["- Tab '4. SAO LUC & CONG VAN':", "Dành cho hồ sơ sao lục lưu trữ và công văn hành chính đến/đi..."],
          ["- Tab '5. HO SO KHAC':", "Dành cho hồ sơ chuyển mục đích sử dụng (CMD), thi hành án, tòa án trưng cầu..."],
          [],
          ["[PHẦN 2] QUY CHUẨN ĐỊNH DẠNG HỆ THỐNG ĐỌC:"],
          ["CHỦ SỬ DỤNG", "Họ và tên người nộp / Chủ đất. Ví dụ: Nguyễn Văn A", "Văn bản tự do", "BẮT BUỘC KHI THÊM MỚI"],
          ["XÃ", "Tên địa bàn xã/phường nơi có thửa đất.", "Phải chọn đúng: Tân Khai, Tân Quan, Tân Hưng, Minh Đức", "BẮT BUỘC KHI THÊM MỚI"],
          ["LOẠI HỒ SƠ", "Quy trình hồ sơ. Hệ thống dùng trường này để tự động tính thời hạn xử lý.", "VD: 2.1 Trích lục, 2.3 Trích đo, 3.3 Chuyển Nhượng, CMD, Sao lục, Công văn...", "BẮT BUỘC KHI THÊM MỚI"],
          ["MÃ HỒ SƠ", "Mã hồ sơ định danh duy nhất.", "Cần điền chính xác nếu sử dụng chế độ 'Cập nhật thông tin'. Để trống khi Thêm mới.", "Bắt buộc khi CẬP NHẬT"],
          ["NGÀY NHẬN", "Ngày tiếp nhận hồ sơ tại bộ phận Một cửa.", "Định dạng Ngày: YYYY-MM-DD hoặc DD/MM/YYYY (Ví dụ: 2026-06-24)", "Không bắt buộc (Tự lấy hôm nay)"],
          ["TRẠNG THÁI", "Trạng thái hồ sơ ban đầu.", "Chọn: Tiếp nhận, Đang xử lý, Chờ kiểm tra, Đã kiểm tra, Chờ ký, Đã ký, Đã giao 1 cửa, Đã trả dân", "Không bắt buộc"],
          [],
          ["[PHẦN 3] QUY TẮC PHÂN BIỆT 2 CHẾ ĐỘ TRÊN HỆ THỐNG:"],
          ["- CHẾ ĐỘ 'NHẬP HỒ SƠ MỚI':", "Thêm toàn bộ dòng mới vào hệ thống. Các trường ngày nhận, hẹn trả sẽ tự động tính nếu trống.", "", ""],
          ["- CHẾ ĐỘ 'CẬP NHẬT THÔNG TIN':", "Sử dụng cột 'MÃ HỒ SƠ' để đối chiếu. Chỉ ghi đè dữ liệu đối với các cột xuất hiện trong file Excel.", "", ""]
      ];
      
      const wsInstr = XLSX.utils.aoa_to_sheet([]);
      XLSX.utils.sheet_add_aoa(wsInstr, instrRows, { origin: "A1" });
      XLSX.utils.sheet_add_aoa(wsInstr, [instrHeaders], { origin: "A11" });
      
      wsInstr['!cols'] = [{ wch: 25 }, { wch: 45 }, { wch: 40 }, { wch: 25 }];
      
      if (wsInstr['A1']) {
          wsInstr['A1'].s = {
              font: { bold: true, color: { rgb: "1F4E79" }, sz: 14, name: "Calibri" }
          };
      }
      if (wsInstr['A2']) {
          wsInstr['A2'].s = {
              font: { italic: true, color: { rgb: "555555" }, sz: 10, name: "Calibri" }
          };
      }
      
      const tableHeaderStyle = {
          font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" },
          fill: { fgColor: { rgb: "5B9BD5" } },
          alignment: { horizontal: "center", vertical: "center" }
      };
      
      for (let c = 0; c < 4; c++) {
          const cellRef = XLSX.utils.encode_cell({ r: 10, c });
          if (wsInstr[cellRef]) {
              wsInstr[cellRef].s = tableHeaderStyle;
          }
      }
      
      XLSX.utils.book_append_sheet(wb, wsInstr, '1. HUONG DAN SU DUNG');

      const addStyledSheet = (sheetName: string, headers: string[], rows: any[][], colWidths: number[]) => {
          const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
          ws['!cols'] = colWidths.map(w => ({ wch: w }));
          
          const headerStyle = {
              font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" },
              fill: { fgColor: { rgb: "1F4E79" } },
              alignment: { horizontal: "center", vertical: "center", wrapText: true },
              border: {
                  top: { style: "thin", color: { rgb: "CCCCCC" } },
                  bottom: { style: "medium", color: { rgb: "1F4E79" } },
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
          
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
      };

      // 2. HO SO DAT DAI
      const landHeaders = [
          'MÃ HỒ SƠ', 'CHỦ SỬ DỤNG', 'CCCD', 'SĐT', 'ĐỊA CHỈ', 'XÃ', 'THỬA', 'TỜ', 'DIỆN TÍCH', 'ĐẤT Ở', 'LOẠI HỒ SƠ', 'NỘI DUNG', 'GIẤY TỜ KÈM THEO', 'NGÀY NHẬN', 'HẸN TRẢ', 'TRẠNG THÁI'
      ];
      const landRows = [
          ['HS-DAT-001', 'Trần Văn Nam', '070012345678', '0901112222', 'Tổ 2, Tân Khai', 'Tân Khai', '105', '12', '120.5', '60', '2.1 Trích lục', 'Cung cấp trích lục bản đồ phục vụ giao dịch', 'Sổ đỏ bản gốc|CCCD photo', '2026-06-20', '2026-06-24', 'Tiếp nhận'],
          ['HS-DAT-002', 'Lê Thị Thu', '070012345679', '0988877665', 'Ấp 3, Tân Hưng', 'Tân Hưng', '88', '5', '450.0', '100', '2.3 Trích đo', 'Trích đo bản đồ phục vụ tách thửa', 'Đơn đề nghị|Sổ hồng photo', '2026-06-22', '2026-07-06', 'Đang xử lý'],
          ['HS-DAT-003', 'Nguyễn Minh Tiến', '070012345680', '0912345678', 'Ấp 1, Tân Quan', 'Tân Quan', '215', '20', '310.2', '', '1. Cung cấp dữ liệu đất đai', 'Xin cung cấp thông tin quy hoạch sử dụng đất', 'CCCD photo', '2026-06-23', '2026-07-05', 'Tiếp nhận']
      ];
      addStyledSheet('2. HO SO DAT DAI', landHeaders, landRows, [14, 20, 15, 14, 22, 12, 10, 10, 12, 10, 24, 30, 25, 12, 12, 12]);

      // 3. DANG KY BIEN DONG
      const regHeaders = [
          'MÃ HỒ SƠ', 'CHỦ SỬ DỤNG', 'CCCD', 'SĐT', 'ĐỊA CHỈ', 'NGƯỜI ỦY QUYỀN', 'LOẠI ỦY QUYỀN', 'XÃ', 'THỬA', 'TỜ', 'DIỆN TÍCH', 'ĐẤT Ở', 'SỐ PHÁT HÀNH', 'SỐ VÀO SỔ', 'NGÀY CẤP', 'LOẠI HỒ SƠ', 'NỘI DUNG', 'GIẤY TỜ KÈM THEO', 'NGÀY NHẬN', 'HẸN TRẢ', 'TRẠNG THÁI'
      ];
      const regRows = [
          ['HS-BD-001', 'Phạm Minh Đức', '070012345111', '0966554433', 'Tổ 5, Minh Đức', '', '', 'Minh Đức', '12', '34', '150.0', '100', 'CC 998811', 'CH 1122', '2026-06-10', '3.3 Chuyển Nhượng', 'Chuyển nhượng quyền sử dụng đất cho Nguyễn Văn Hải', 'Hợp đồng chuyển nhượng|Sổ đỏ gốc', '2026-06-20', '2026-07-20', 'Tiếp nhận'],
          ['HS-BD-002', 'Vũ Hoàng Quân', '070012345222', '0944332211', 'Khu phố 2, Tân Khai', 'Vũ Văn Bằng', 'Giấy ủy quyền', 'Tân Khai', '45', '16', '200.0', '200', 'DD 223344', 'CH 3344', '2026-06-12', '3.2 Tặng Cho', 'Tặng cho quyền sử dụng đất gia đình cho con trai', 'Hợp đồng tặng cho|Giấy khai sinh', '2026-06-22', '2026-07-22', 'Đang xử lý']
      ];
      addStyledSheet('3. DANG KY BIEN DONG', regHeaders, regRows, [14, 20, 15, 14, 22, 18, 18, 12, 10, 10, 12, 10, 15, 12, 12, 22, 30, 25, 12, 12, 12]);

      // 4. SAO LUC & CONG VAN
      const arcHeaders = [
          'MÃ HỒ SƠ', 'CHỦ SỬ DỤNG', 'SĐT', 'ĐỊA CHỈ', 'LOẠI HỒ SƠ', 'NỘI DUNG', 'GIẤY TỜ KÈM THEO', 'NGÀY NHẬN', 'HẸN TRẢ', 'TRẠNG THÁI', 'NGƯỜI XỬ LÝ', 'NGÀY GIAO'
      ];
      const arcRows = [
          ['HS-SL-001', 'Văn phòng Đăng ký Đất đai', '02713888999', 'Số 12 Trần Hưng Đạo', 'Sao lục', 'Yêu cầu sao lục hồ sơ địa chính thửa 45 tờ 16 xã Tân Khai', 'Phiếu yêu cầu', '2026-06-23', '2026-06-25', 'Chờ kiểm tra', 'Nguyễn Thị Hoa', '2026-06-23'],
          ['HS-CV-001', 'UBND huyện Hớn Quản', '02713777888', 'Khu hành chính huyện', 'Công văn', 'Công văn số 456/UBND về việc phối hợp đo đạc phục vụ giải phóng mặt bằng', 'Công văn đính kèm', '2026-06-24', '2026-06-26', 'Tiếp nhận', 'Trần Văn Nam', '2026-06-24']
      ];
      addStyledSheet('4. SAO LUC & CONG VAN', arcHeaders, arcRows, [14, 25, 14, 25, 15, 35, 20, 12, 12, 12, 18, 12]);

      // 5. HO SO KHAC
      const otherHeaders = [
          'MÃ HỒ SƠ', 'CHỦ SỬ DỤNG', 'CCCD', 'SĐT', 'ĐỊA CHỈ', 'XÃ', 'THỬA', 'TỜ', 'DIỆN TÍCH', 'LOẠI HỒ SƠ', 'NỘI DUNG', 'GIẤY TỜ KÈM THEO', 'NGÀY NHẬN', 'HẸN TRẢ', 'TRẠNG THÁI'
      ];
      const otherRows = [
          ['HS-KHAC-001', 'Nguyễn Văn Đạt', '070012345999', '0903999888', 'Ấp 2, Tân Quan', 'Tân Quan', '72', '8', '500.0', 'CMD', 'Chuyển mục đích sử dụng đất sang đất ở', 'Đơn xin chuyển mục đích', '2026-06-24', '2026-07-24', 'Tiếp nhận'],
          ['HS-KHAC-002', 'Tòa án Nhân dân Hớn Quản', '', '02713555444', 'Thị trấn Tân Khai', 'Tân Khai', '11', '2', '350.2', 'Tòa án', 'Trưng cầu đo đạc giải quyết tranh chấp đất đai', 'Quyết định trưng cầu', '2026-06-24', '2026-07-24', 'Tiếp nhận']
      ];
      addStyledSheet('5. HO SO KHAC', otherHeaders, otherRows, [14, 25, 15, 14, 25, 12, 10, 10, 12, 15, 35, 20, 12, 12, 12]);

      XLSX.writeFile(wb, 'Mau_Nhap_Lieu_Da_Phan_He.xlsx');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl h-[85vh] flex flex-col animate-fade-in-up">
        {/* HEADER */}
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileSpreadsheet className="text-green-600" />
            Xử Lý Dữ Liệu Excel
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600">
            <X size={24} />
          </button>
        </div>

        {/* MODE SWITCHER */}
        <div className="p-5 border-b bg-gray-50 shrink-0 space-y-4">
            <div className="flex justify-center">
                <div className="bg-white border border-gray-300 rounded-lg p-1 flex shadow-sm">
                    <button 
                        onClick={() => { setMode('create'); setPreviewData([]); setFileName(''); }}
                        className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium text-sm transition-all ${mode === 'create' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <PlusCircle size={16} /> Nhập hồ sơ mới
                    </button>
                    <button 
                        onClick={() => { setMode('update'); setPreviewData([]); setFileName(''); }}
                        className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium text-sm transition-all ${mode === 'update' ? 'bg-orange-500 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
                    >
                        <RefreshCw size={16} /> Cập nhật thông tin
                    </button>
                </div>
            </div>

            <div className={`p-3 rounded border text-sm flex items-start gap-2 ${mode === 'create' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-orange-50 border-orange-200 text-orange-800'}`}>
                {mode === 'create' ? (
                    <>
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <span>Chế độ này sẽ <strong>thêm mới</strong> toàn bộ dòng trong file Excel vào hệ thống.</span>
                    </>
                ) : (
                    <>
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        <div>
                            <strong>Chế độ Cập Nhật Thông Minh:</strong>
                            <ul className="list-disc pl-5 mt-1 space-y-1">
                                <li>Hệ thống tìm hồ sơ theo <strong>Mã Hồ Sơ</strong>.</li>
                                <li>Chỉ cập nhật các cột <strong>CÓ</strong> trong file Excel (VD: chỉ có cột Ngày Xuất thì chỉ cập nhật Ngày Xuất).</li>
                                <li><strong>QUAN TRỌNG:</strong> Nếu có cột "Đợt" hoặc "Ngày xuất/Ngày trả", hệ thống sẽ tự động chuyển trạng thái sang "Đã giao 1 cửa" để không bị báo trễ hạn.</li>
                            </ul>
                        </div>
                    </>
                )}
            </div>

            <div className="flex items-center gap-4 flex-wrap">
                <div className="relative">
                    <input type="file" ref={fileInputRef} accept=".xlsx, .xls" onChange={handleFileChange} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className={`flex items-center gap-2 text-white px-4 py-2 rounded-lg hover:opacity-90 transition-colors shadow-sm font-medium ${mode === 'create' ? 'bg-green-600' : 'bg-orange-600'}`}>
                        <Upload size={18} /> Chọn File Excel
                    </button>
                </div>

                {sheetNames.length > 1 && (
                    <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-1.5 shadow-sm">
                        <span className="text-xs font-semibold text-gray-700">Chọn Sheet:</span>
                        <select 
                            value={selectedSheet}
                            onChange={(e) => {
                                setSelectedSheet(e.target.value);
                                loadSheetData(e.target.value);
                            }}
                            className="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            {sheetNames.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <button onClick={handleDownloadTemplate} className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors shadow-sm font-medium border border-blue-200">
                    <FileSpreadsheet size={18} /> Tải File Mẫu
                </button>
                {fileName && <span className="text-sm text-gray-600 font-medium">{fileName}</span>}
                {previewData.length > 0 && <div className="ml-auto flex items-center gap-2 text-sm text-blue-700 bg-blue-100 px-3 py-1.5 rounded-full">
                    <Check size={16} /> Đã đọc <strong>{previewData.length}</strong> dòng ({selectedSheet})
                </div>}
            </div>
        </div>

        {/* CÔNG CỤ LỌC (CHỈ HIỂN THỊ KHI CÓ DATA) */}
        {previewData.length > 0 && !loading && (
            <div className="bg-white border-b px-5 py-3 flex gap-2 shrink-0">
                <button 
                    onClick={() => setViewFilter('all')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${viewFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    Tất cả ({previewData.length})
                </button>
                <button 
                    onClick={() => setViewFilter('valid')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${viewFilter === 'valid' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'}`}
                >
                    Hợp lệ ({previewData.filter(r => !r._errors?.length).length})
                </button>
                <button 
                    onClick={() => setViewFilter('errors')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${viewFilter === 'errors' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'}`}
                >
                    Có lỗi ({previewData.filter(r => r._errors?.length).length})
                </button>
            </div>
        )}

        {/* PREVIEW TABLE */}
        <div className="flex-1 overflow-auto p-0">
            {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Loader2 className="w-10 h-10 animate-spin mb-2 text-blue-500" />
                    <p>Đang xử lý dữ liệu...</p>
                </div>
            ) : previewData.length > 0 ? (
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 sticky top-0 shadow-sm z-10 text-xs uppercase font-bold text-gray-600">
                        <tr>
                            <th className="p-3 border-b">#</th>
                            <th className="p-3 border-b">Mã HS</th>
                            <th className="p-3 border-b">Chủ Sử Dụng</th>
                            <th className="p-3 border-b">Trạng Thái (Dự kiến)</th>
                            <th className="p-3 border-b">Ngày Xuất</th>
                            <th className="p-3 border-b">Đợt</th>
                            <th className="p-3 border-b">Kiểm duyệt lỗi</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-gray-700 divide-y divide-gray-100">
                        {previewData.filter(r => {
                            if (viewFilter === 'valid') return !r._errors?.length;
                            if (viewFilter === 'errors') return r._errors && r._errors.length > 0;
                            return true;
                        }).map((record, idx) => {
                            const hasError = record._errors && record._errors.length > 0;
                            // Find original index for display
                            const originalIdx = previewData.indexOf(record) + 1;
                            return (
                                <tr key={originalIdx} className={`hover:bg-blue-50 ${hasError ? 'bg-red-50' : ''}`}>
                                    <td className="p-3">{originalIdx}</td>
                                    <td className="p-3 font-medium text-blue-600">{record.code}</td>
                                    <td className="p-3 font-medium text-gray-500">{record.customerName || <span className="text-gray-300 italic">(Giữ nguyên)</span>}</td>
                                    <td className="p-3">{record.status ? <span className={`text-xs px-2 py-1 rounded-full font-bold ${record.status === RecordStatus.HANDOVER ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{record.status}</span> : <span className="text-gray-300 italic">(Giữ nguyên)</span>}</td>
                                    <td className="p-3 font-mono text-green-700">{record.exportDate ? record.exportDate.split('T')[0] : '-'}</td>
                                    <td className="p-3 font-bold">{record.exportBatch || '-'}</td>
                                    <td className="p-3">
                                        {hasError ? (
                                            <ul className="text-red-600 list-disc pl-4 text-xs font-medium">
                                                {record._errors!.map((err, i) => <li key={i}>{err}</li>)}
                                            </ul>
                                        ) : (
                                            <span className="text-green-600 text-xs flex items-center gap-1 font-medium"><Check size={14} /> Hợp lệ</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <FileSpreadsheet size={48} className="mb-2 opacity-50" />
                    <p>Chưa có dữ liệu. Vui lòng chọn file Excel.</p>
                </div>
            )}
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t bg-white flex justify-between items-center shrink-0 rounded-b-lg">
            {previewData.length > 0 ? (
                <div className="flex gap-4 text-sm font-medium">
                    <span className="text-green-600">✅ Hợp lệ: {previewData.filter(r => !r._errors?.length).length}</span>
                    {previewData.some(r => r._errors?.length) && <span className="text-red-500">❌ Lỗi: {previewData.filter(r => r._errors?.length).length} (Vui lòng sửa Excel và tải lại)</span>}
                </div>
            ) : <div />}
            <div className="flex gap-3 items-center">
                {progress && (
                    <div className="w-48 bg-gray-200 rounded-full h-2.5 mr-4 overflow-hidden">
                        <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${Math.max(5, (progress.processed / progress.total) * 100)}%` }}></div>
                    </div>
                )}
                <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50" disabled={loading}>Hủy bỏ</button>
                <button 
                    onClick={handleSave} 
                    disabled={previewData.length === 0 || previewData.some(r => r._errors?.length) || loading} 
                    className={`flex items-center gap-2 px-6 py-2 text-white rounded-md disabled:opacity-50 font-medium shadow-sm transition-all ${mode === 'create' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                    {loading ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            {progress ? `Đang lưu... ${Math.round((progress.processed / progress.total) * 100)}%` : 'Đang xử lý...'}
                        </>
                    ) : (
                        <>
                            <Save size={18} /> {mode === 'create' ? 'Lưu vào hệ thống' : 'Tiến hành cập nhật'}
                        </>
                    )}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
