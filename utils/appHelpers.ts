
import { RecordFile, RecordStatus, Employee, Holiday } from '../types';
import { STATUS_LABELS, REGISTRATION_PROCEDURES } from '../constants';

// --- HÀM TIỆN ÍCH CHO PHÂN HỆ HỒ SƠ ---
export function getSolarDateFromLunar(lunarDay: number, lunarMonth: number, year: number): Date | null {
    if (lunarMonth === 1) { 
        if (year === 2024) return new Date(2024, 1, lunarDay + 9);
        if (year === 2025) return new Date(2025, 0, lunarDay + 28);
        if (year === 2026) return new Date(2026, 1, lunarDay + 16); 
        if (year === 2027) return new Date(2027, 1, lunarDay + 5);
    }
    if (lunarMonth === 3 && lunarDay === 10) { 
        if (year === 2024) return new Date(2024, 3, 18);
        if (year === 2025) return new Date(2025, 3, 7);
        if (year === 2026) return new Date(2026, 3, 26);
        if (year === 2027) return new Date(2027, 3, 16);
    }
    return null;
}

export function formatDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function calculateDeadline(type: string, receivedDateStr: string, holidays: Holiday[] = [], hasTax?: boolean): string {
    if (!receivedDateStr) return '';
    let daysToAdd = 30; 
    const lowerType = (type || '').toLowerCase();

    if (lowerType.includes('cmđ') || lowerType.includes('cmd') || lowerType.includes('2.7 trích lục cmđ')) {
        daysToAdd = 2;
    } else if (lowerType.includes('cung cấp tài liệu đất đai') || 
        lowerType.includes('cung cấp dữ liệu đất đai') || 
        lowerType.includes('dữ liệu đất đai') || 
        lowerType.includes('trích lục quy hoạch') || 
        lowerType.includes('cung cấp số thửa đất') || 
        lowerType.includes('cung cấp số thửa') || 
        lowerType.includes('trích lục')) {
        daysToAdd = 10;
    } else if (lowerType.includes('trích đo') || lowerType.includes('cắm mốc') || lowerType.includes('tách thửa')) {
        daysToAdd = 30;
    }
    
    const t = (type || '').trim().toLowerCase();
    const isReg = t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => p.toLowerCase() === t);

    if (isReg && hasTax) {
        daysToAdd += 10;
    }
    
    const startDate = new Date(receivedDateStr);
    let count = 0;
    let currentDate = new Date(startDate);
    
    const holidaySet = new Set<string>();
    const currentYear = startDate.getFullYear();
    const listHolidays = holidays || [];
    
    [currentYear, currentYear + 1].forEach(year => {
        listHolidays.forEach(h => {
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
        const dayOfWeek = currentDate.getDay(); 
        const dateString = formatDateKey(currentDate);
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = holidaySet.has(dateString);

        if (!isWeekend && !isHoliday) {
            count++;
        }
    }
    return formatDateKey(currentDate);
}

export function getStatusLabel(status: RecordStatus, recordType?: string | null): string {
    return STATUS_LABELS[status] || status;
}

export function isMeasurementType(recordType: string | null | undefined): boolean {
    if (!recordType) return false;
    const t = recordType.toLowerCase();
    return t.includes('đo đạc') || t.includes('trích đo') || t.includes('cắm mốc') || t.includes('trích lục') || t.includes('số thửa');
}

export function isArchiveType(recordType: string | null | undefined): boolean {
    if (!recordType) return false;
    const t = recordType.toLowerCase();
    return t.includes('lưu trữ') || t.includes('cung cấp dữ liệu') || t.includes('cung cấp tài liệu') || t.includes('cung cấp thông tin');
}

// --- HÀM TIỆN ÍCH XỬ LÝ CHUỖI TIẾNG VIỆT ---
export function removeVietnameseTones(str: string): string {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); 
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); 
    str = str.replace(/ + /g, " ");
    str = str.trim();
    return str;
}

// Hàm chuyển đổi Title Case (Nguyễn Văn A)
export function toTitleCase(str: string | null | undefined): string {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// --- CONFIRM ACTION WRAPPER ---
let globalConfirmCallback: null | ((message: string, title: string) => Promise<boolean>) = null;

export const setGlobalConfirmCallback = (cb: (message: string, title: string) => Promise<boolean>) => {
    globalConfirmCallback = cb;
};

// Sử dụng Native Dialog của Electron nếu có, hoặc Global Modal, hoặc fallback dùng window.confirm
export const confirmAction = async (message: string, title: string = 'Xác nhận'): Promise<boolean> => {
    if ((window as any).electronAPI && (window as any).electronAPI.showConfirmDialog) {
        // Chờ kết quả từ Main Process (không block renderer)
        return await (window as any).electronAPI.showConfirmDialog(message, title);
    }
    
    if (globalConfirmCallback) {
        return await globalConfirmCallback(message, title);
    }
    
    try {
        // Fallback cho trình duyệt web (có thể lỗi nếu sandboxed)
        return window.confirm(message);
    } catch {
        // Nếu không cho confirm (Iframe sandbox preview) -> Auto true
        return true; 
    }
};

// --- ĐỊNH NGHĨA CÁC CỘT HIỂN THỊ ---
// Updated: Căn giữa tiêu đề và điều chỉnh độ rộng theo yêu cầu
// Updated: Gộp cột Đợt vào cột Hoàn thành
export const COLUMN_DEFS = [
  { key: 'code', label: 'Mã Hồ Sơ', sortKey: 'code', className: 'w-44 text-center' },
  { key: 'customer', label: 'Thông tin chủ sử dụng', sortKey: 'customerName', className: 'w-64 text-center' }, 
  { key: 'deadline', label: 'Thời hạn xử lý', sortKey: 'deadline', className: 'w-48 text-center' },
  { key: 'ward', label: 'Xã Phường', sortKey: 'ward', className: 'w-32 text-center' },
  { key: 'mapSheet', label: 'Tờ', sortKey: 'mapSheet', className: 'w-16 text-center' }, 
  { key: 'landPlot', label: 'Thửa', sortKey: 'landPlot', className: 'w-16 text-center' }, 
  { key: 'assigned', label: 'Giao nhân viên', sortKey: 'assignedDate', className: 'w-48 text-center' },
  { key: 'completed', label: 'Hoàn thành / Đợt', sortKey: 'completedDate', className: 'w-32 text-center' },
  { key: 'type', label: 'Loại Hồ Sơ', sortKey: 'recordType', className: 'w-[5.5rem] text-center' },
  { key: 'tech', label: 'TĐ / TL', sortKey: 'measurementNumber', className: 'w-20 text-center' },
  { key: 'receipt', label: 'Biên Lai', sortKey: 'receiptNumber', className: 'w-20 text-center' },
  { key: 'status', label: 'Trạng Thái', sortKey: 'status', className: 'w-32 text-center' },
];

export const DEFAULT_VISIBLE_COLUMNS = {
    code: true, 
    customer: true, 
    deadline: true,
    ward: true, 
    mapSheet: true, 
    landPlot: true, 
    assigned: true, 
    completed: true, // Mặc định hiện cột gộp này
    type: true, 
    tech: false, 
    receipt: true, 
    status: true
};

// --- CÁC HÀM CHECK LOGIC ---
export const isRecordOverdue = (record: RecordFile): boolean => {
  // 1. Kiểm tra trạng thái "Đã xong"
  const completedStatuses = [
      RecordStatus.HANDOVER,
      RecordStatus.RETURNED,
      RecordStatus.WITHDRAWN,
      RecordStatus.REJECTED,
      RecordStatus.SIGNED,
      RecordStatus.PENDING_SUPPLEMENT
  ];

  if (completedStatuses.includes(record.status)) return false;
  
  // 2. [QUAN TRỌNG] Kiểm tra dữ liệu thực tế (Fix lỗi trạng thái chưa cập nhật)
  // Nếu đã có ngày xuất (đã giao 1 cửa) hoặc đã có ngày trả kết quả -> Coi như đã xong -> Không quá hạn
  if (record.exportDate || record.exportBatch || record.resultReturnedDate) {
      return false;
  }
  
  if (!record.deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(record.deadline);
  deadline.setHours(0, 0, 0, 0);
  return deadline < today;
};

export const isRecordApproaching = (record: RecordFile): boolean => {
  const completedStatuses = [
      RecordStatus.HANDOVER,
      RecordStatus.RETURNED,
      RecordStatus.WITHDRAWN,
      RecordStatus.REJECTED,
      RecordStatus.SIGNED,
      RecordStatus.PENDING_SUPPLEMENT
  ];

  if (completedStatuses.includes(record.status)) return false;
  
  // Kiểm tra dữ liệu thực tế: Nếu đã xong thì không báo sắp đến hạn
  if (record.exportDate || record.exportBatch || record.resultReturnedDate) {
      return false;
  }

  if (isRecordOverdue(record)) return false;
  
  if (!record.deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(record.deadline);
  deadline.setHours(0, 0, 0, 0);
  const diffTime = deadline.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 3;
};

export interface EmployeeGroup {
  label: string;
  key: string;
  employees: Employee[];
}

export function groupEmployeesByDepartment(employees: Employee[]): EmployeeGroup[] {
  const categories = [
    { label: 'Tổ Đo đạc', key: 'dodac', keywords: ['do dac', 'do', 'ky thuat', 'dia chinh', 'noi nghiep', 'ngoai nghiep', 'do hinh'] },
    { label: 'Tổ Cấp giấy', key: 'capgiay', keywords: ['cap giay', 'dang ky', 'bien dong', 'cap qsd', 'tham dinh'] },
    { label: 'Tổ Lưu trữ', key: 'luutru', keywords: ['luu tru', 'sao luc', 'thong tin'] },
    { label: 'Tổ Hành chính', key: 'hanhchinh', keywords: ['hanh chinh', 'van thu', 'tong hop', 'ke toan', 'ke hanh', 'bao ve', 'tap vu', 'tiep nhan', 'mot cua', 'lanh dao', 'giam doc'] },
  ];

  const groups: Record<string, Employee[]> = {
    dodac: [],
    capgiay: [],
    luutru: [],
    hanhchinh: [],
    other: []
  };

  employees.forEach(emp => {
    const d = removeVietnameseTones(emp.department || '').toLowerCase();
    let matched = false;
    for (const cat of categories) {
      if (cat.keywords.some(k => d.includes(k))) {
        groups[cat.key].push(emp);
        matched = true;
        break;
      }
    }
    if (!matched) {
      groups.other.push(emp);
    }
  });

  const result: EmployeeGroup[] = [
    { label: 'Tổ Đo đạc', key: 'dodac', employees: groups.dodac },
    { label: 'Tổ Cấp giấy', key: 'capgiay', employees: groups.capgiay },
    { label: 'Tổ Lưu trữ', key: 'luutru', employees: groups.luutru },
    { label: 'Tổ Hành chính', key: 'hanhchinh', employees: groups.hanhchinh },
  ];

  if (groups.other.length > 0) {
    result.push({ label: 'Bộ phận khác', key: 'other', employees: groups.other });
  }

  return result.filter(g => g.employees.length > 0);
}

export function fillTimelineDatesForReturn(record: RecordFile, nowStr: string): Partial<RecordFile> {
    const isSpecialType = record.recordType === 'Cung cấp tài liệu đất đai' || 
                          record.recordType === 'Sao lục' || 
                          record.recordType === 'Công văn';
    
    // Khởi tạo các mốc thời gian theo thứ tự luồng
    const steps = [
        { key: 'receivedDate', val: record.receivedDate },
        { key: 'assignedDate', val: record.assignedDate },
        { key: 'completedWorkDate', val: record.completedWorkDate }
    ];

    if (!isSpecialType) {
        steps.push(
            { key: 'pendingCheckDate', val: record.pendingCheckDate },
            { key: 'checkedDate', val: record.checkedDate }
        );
    }

    steps.push(
        { key: 'submissionDate', val: record.submissionDate },
        { key: 'approvalDate', val: record.approvalDate },
        { key: 'completedDate', val: record.completedDate || nowStr }
    );

    // Bước 1: Chuẩn hóa nhận
    const nowMs = new Date(nowStr).getTime();
    if (!steps[0].val) {
        // Nếu không có ngày nhận, giả định nhận trước thời điểm hiện hành 2 ngày
        steps[0].val = new Date(nowMs - 2 * 24 * 60 * 60 * 1000).toISOString();
    }
    steps[steps.length - 1].val = nowStr;

    // Bước 2: Điền các giá trị trung gian bằng nội suy tuyến tính (Linear Interpolation)
    const knownIndices: number[] = [];
    steps.forEach((step, idx) => {
        if (step.val) knownIndices.push(idx);
    });

    for (let i = 0; i < knownIndices.length - 1; i++) {
        const startIdx = knownIndices[i];
        const endIdx = knownIndices[i + 1];
        const gap = endIdx - startIdx;
        
        if (gap > 1) {
            const startTime = new Date(steps[startIdx].val!).getTime();
            const endTime = new Date(steps[endIdx].val!).getTime();
            
            let adjustedEndTime = endTime;
            if (endTime <= startTime) {
                adjustedEndTime = startTime + gap * 15 * 60 * 1000;
                steps[endIdx].val = new Date(adjustedEndTime).toISOString();
            }

            const stepMs = (adjustedEndTime - startTime) / gap;
            for (let j = 1; j < gap; j++) {
                const targetIdx = startIdx + j;
                const targetMs = startTime + stepMs * j;
                steps[targetIdx].val = new Date(targetMs).toISOString();
            }
        }
    }

    // Trả về object các mốc thời gian cập nhật
    const updates: any = {};
    steps.forEach(step => {
        updates[step.key] = step.val;
    });

    return updates;
}

export function findArchiveStaffForWard(wardName: string | null | undefined, employees: Employee[]): Employee | null {
  if (!wardName) return null;
  
  const normWard = removeVietnameseTones(wardName).toLowerCase().trim();
  
  // Lọc nhân viên Tổ Lưu trữ
  const archiveStaff = employees.filter(emp => {
    const d = removeVietnameseTones(emp.department || '').toLowerCase();
    return d.includes('luu tru') || d.includes('archive');
  });
  
  // Tìm nhân viên phụ trách địa bàn này
  const matched = archiveStaff.find(emp => 
    emp.managedWards && emp.managedWards.some(w => 
      removeVietnameseTones(w).toLowerCase().trim() === normWard
    )
  );
  
  return matched || null;
}
