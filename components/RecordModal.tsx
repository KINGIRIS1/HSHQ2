
import React, { useState, useEffect } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole, Holiday } from '../types';
import { GROUPS, EXTENDED_RECORD_TYPES, STATUS_LABELS, REGISTRATION_PROCEDURES } from '../constants';
import { isArchiveType, groupEmployeesByDepartment } from '../utils/appHelpers';
import { X, Save, Lock, User as UserIcon, MapPin, FileText, Calendar, FileCheck } from 'lucide-react';
import RecordForm from './receive-record/RecordForm';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (record: Omit<RecordFile, 'id' | 'status'> & { id?: string, status?: RecordStatus }) => void;
  initialData?: RecordFile | null;
  employees: Employee[];
  currentUser: User;
  wards: string[];
  currentView?: string;
  holidays?: Holiday[];
  records?: RecordFile[];
}

const RecordModal: React.FC<RecordModalProps> = ({ isOpen, onClose, onSubmit, initialData, employees, currentUser, wards, currentView, holidays, records }) => {
  const defaultState: Partial<RecordFile> = {
    code: '', customerName: '', phoneNumber: '', cccd: '', customerAddress: '', content: '', otherDocs: '',
    receivedDate: new Date().toISOString(), deadline: '', assignedTo: '',
    group: GROUPS[0], ward: '', landPlot: '', mapSheet: '', area: 0, address: '',
    recordType: '', measurementNumber: '', excerptNumber: '',
    privateNotes: '', authorizedBy: '', authDocType: '', receiptNumber: '', resultReturnedDate: ''
  };

  // --- LOCAL HẠN TRẢ CALCULATION IN RECORDMODAL ---
  const getSolarDateFromLunar = (lunarDay: number, lunarMonth: number, year: number): Date | null => {
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
  };

  const formatDateKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const calculateDeadline = (type: string, receivedDateStr: string) => {
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
    
    return currentDate.toISOString();
  };

  const allowedRecordTypes = React.useMemo(() => {
    // 1. Phân hệ Lưu trữ
    if (currentView && [
        "archive_records", "archive_assign_tasks", "archive_completed_list", 
        "archive_pending_check_list", "archive_check_list", "archive_handover_list", 
        "archive_director_completed"
    ].includes(currentView)) {
        return ['1. Cung cấp dữ liệu đất đai'];
    }

    // 2. Phân hệ Cấp Giấy (Đăng ký)
    if (currentView && [
        "registration_records", "registration_assign_tasks", "registration_completed_list", 
        "registration_pending_check_list", "registration_check_list", "registration_handover_list", 
        "registration_director_completed"
    ].includes(currentView)) {
        return REGISTRATION_PROCEDURES;
    }

    // 3. Phân hệ Đo đạc
    if (currentView && [
        "all_records", "assign_tasks", "completed_list", 
        "pending_check_list", "check_list", "handover_list", 
        "director_completed"
    ].includes(currentView)) {
        return [
          '2.1 Trích lục',
          '2.2 Trích lục Quy hoạch',
          '2.3 Trích đo',
          '2.4 Trích đo Cắm mốc',
          '2.5 Trích đo Tách - Hợp thửa',
          '2.6 Cung cấp số thửa',
          '2.7 Trích lục CMĐ'
        ];
    }

    // 4. Phân hệ Khác
    if (currentView && [
        "other_records", "other_assign_tasks", "other_check_list", 
        "other_handover_list", "other_director_completed"
    ].includes(currentView)) {
        return ['CMD', 'Tòa án', 'Thi hành án'];
    }

    // 5. Mặc định: Hiển thị tất cả ngoại trừ 'CMD', 'Tòa án', 'Thi hành án' và '2.7 Trích lục CMĐ' (không hiện ở tab hồ sơ)
    return [
      ...REGISTRATION_PROCEDURES,
      '1. Cung cấp dữ liệu đất đai',
      '2.1 Trích lục',
      '2.2 Trích lục Quy hoạch',
      '2.3 Trích đo',
      '2.4 Trích đo Cắm mốc',
      '2.5 Trích đo Tách - Hợp thửa',
      '2.6 Cung cấp số thửa'
    ];
  }, [currentView]);

  const [formData, setFormData] = useState<Partial<RecordFile>>(defaultState);
  const hasAdminRights = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;
  const isOneDoor = currentUser.role === UserRole.ONEDOOR;
  const canEditResult = hasAdminRights || isOneDoor;

  const generateCode = React.useCallback((wardName: string, dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const year = d.getFullYear().toString();
    const yy = year.slice(-2);
    const mm = ('0' + (d.getMonth() + 1)).slice(-2);
    const dd = ('0' + d.getDate()).slice(-2);
    const datePrefix = `${yy}${mm}${dd}`;
    
    let maxSeq = 0;
    
    const checkSeq = (code: string | undefined | null) => {
        if (!code) return;
        const parts = code.split('-');
        if (parts.length === 2 || parts.length === 3) {
            const rDate = parts.length === 2 ? parts[0] : parts[1];
            const rSeq = parts.length === 2 ? parts[1] : parts[2];
            if (rDate.substring(0, 2) === yy) {
                const seqNum = parseInt(rSeq, 10);
                if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
            }
        }
    };

    const targetRecords = records || [];
    targetRecords.forEach((r: RecordFile) => checkSeq(r.code));

    const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
    return `${datePrefix}-${nextSeq}`;
  }, [records]);

  const isMeasurement = React.useMemo(() => {
    return !!(currentView && ['all_records', 'assign_tasks', 'completed_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed'].includes(currentView));
  }, [currentView]);

  const isRegistrationRecord = React.useMemo(() => {
    const isRegView = currentView && [
      "registration_records", "registration_assign_tasks", "registration_completed_list", 
      "registration_pending_check_list", "registration_check_list", "registration_handover_list", 
      "registration_director_completed"
    ].includes(currentView);

    if (isRegView) return true;

    const type = (formData.recordType || initialData?.recordType || '').toLowerCase().trim();
    if (type.startsWith('3.') || type === 'đăng ký' || type === 'cấp giấy' || type === 'cấp đổi' || type === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => p.toLowerCase() === type)) {
      return true;
    }

    return false;
  }, [currentView, formData.recordType, initialData?.recordType]);

  useEffect(() => {
    if (isOpen) {
        if (initialData) setFormData(initialData);
        else {
            const initialType = allowedRecordTypes[0] || '';
            const initialDate = new Date().toISOString();
            const initialDeadline = initialType ? calculateDeadline(initialType, initialDate) : '';
            
            setFormData({ 
              ...defaultState, 
              code: `HS-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
              recordType: initialType,
              receivedDate: initialDate,
              deadline: initialDeadline
            });
        }
    }
  }, [initialData, isOpen, allowedRecordTypes]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = { ...formData };
    
    // Logic tự động set ngày khi trạng thái thay đổi hoặc xóa ngày khi quay lui
    // Chỉ áp dụng logic này nếu trạng thái khác với ban đầu (hoặc là tạo mới)
    // Hoặc user admin ép kiểu
    if (hasAdminRights && finalData.status) {
        const now = new Date().toISOString();
        
        // BACKFILL LOGIC: Nếu thay đổi trạng thái, đảm bảo các ngày của tiến trình trước đó (hoặc trạng thái cũ) 
        // được chốt lại để không bị mất màu trên Timeline do thiếu Date.
        if (initialData?.status && finalData.status !== initialData?.status) {
            const flow = [
                RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, 
                RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, 
                RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER
            ];
            // Tạm dùng initialData.status để lấp ngày (để đóng băng tiến độ cũ)
            const prevIdx = flow.indexOf(initialData.status);
            if (prevIdx >= 0) {
                if (prevIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !finalData.assignedDate) finalData.assignedDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.COMPLETED_WORK) && !finalData.completedWorkDate) finalData.completedWorkDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !finalData.pendingCheckDate) finalData.pendingCheckDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.CHECKED) && !finalData.checkedDate) finalData.checkedDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !finalData.submissionDate) finalData.submissionDate = now;
                if (prevIdx >= flow.indexOf(RecordStatus.SIGNED) && !finalData.approvalDate) finalData.approvalDate = now;
            }
            // Auto fill current forward progress as well if going forward
            const newIdx = flow.indexOf(finalData.status);
            if (newIdx >= 0) {
                if (newIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !finalData.assignedDate) finalData.assignedDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.COMPLETED_WORK) && !finalData.completedWorkDate) finalData.completedWorkDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !finalData.pendingCheckDate) finalData.pendingCheckDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.CHECKED) && !finalData.checkedDate) finalData.checkedDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !finalData.submissionDate) finalData.submissionDate = now;
                if (newIdx >= flow.indexOf(RecordStatus.SIGNED) && !finalData.approvalDate) finalData.approvalDate = now;
            }
        }

        // Logic làm sạch dữ liệu cũ khi quay lui trạng thái
        // 1. Nếu quay về RECEIVED (Tiếp nhận) -> Xóa hết các bước sau
        if (finalData.status === RecordStatus.RECEIVED) {
            finalData.assignedDate = undefined;
            finalData.completedWorkDate = undefined;
            finalData.pendingCheckDate = undefined;
            finalData.checkedDate = undefined;
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
            finalData.exportBatch = undefined;
            finalData.exportDate = undefined;
        } 
        // 2. Nếu quay về ASSIGNED (Đang thực hiện) -> Xóa bước quá trình sau
        else if (finalData.status === RecordStatus.ASSIGNED || finalData.status === RecordStatus.IN_PROGRESS) {
            finalData.completedWorkDate = undefined;
            finalData.pendingCheckDate = undefined;
            finalData.checkedDate = undefined;
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
            finalData.exportBatch = undefined;
            finalData.exportDate = undefined;
        }
        else if (finalData.status === RecordStatus.COMPLETED_WORK) {
            finalData.pendingCheckDate = undefined;
            finalData.checkedDate = undefined;
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
        else if (finalData.status === RecordStatus.PENDING_CHECK) {
            finalData.checkedDate = undefined;
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
        else if (finalData.status === RecordStatus.CHECKED) {
            finalData.submissionDate = undefined;
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
        // 3. Nếu quay về PENDING_SIGN (Chờ ký) -> Xóa bước Xong, Trả
        else if (finalData.status === RecordStatus.PENDING_SIGN) {
            finalData.approvalDate = undefined;
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
        // 4. Nếu quay về SIGNED (Đã ký) -> Xóa bước Hoàn thành/Trả
        else if (finalData.status === RecordStatus.SIGNED) {
            finalData.completedDate = undefined;
            finalData.resultReturnedDate = undefined;
        }
    }

    if (finalData.status === RecordStatus.WITHDRAWN && !finalData.completedDate) finalData.completedDate = new Date().toISOString();
    if (finalData.status === RecordStatus.REJECTED && !finalData.completedDate) finalData.completedDate = new Date().toISOString();
    
    if (finalData.resultReturnedDate && finalData.status !== RecordStatus.RETURNED) {
        finalData.status = RecordStatus.RETURNED;
        if (!finalData.completedDate) finalData.completedDate = finalData.resultReturnedDate;
    }
    
    // LOGIC QUAN TRỌNG: Nếu có Đợt xuất hoặc Ngày xuất thì phải là HANDOVER (trừ khi Đã rút, Đã trả hoặc Bị từ chối)
    if ((finalData.exportBatch || finalData.exportDate) && finalData.status !== RecordStatus.WITHDRAWN && finalData.status !== RecordStatus.RETURNED && finalData.status !== RecordStatus.REJECTED) {
        finalData.status = RecordStatus.HANDOVER;
        // Nếu chưa có completedDate, lấy luôn ngày xuất (nếu có) hoặc hôm nay
        if (!finalData.completedDate) {
            finalData.completedDate = finalData.exportDate ? finalData.exportDate : new Date().toISOString();
        }
    }

    // Để đảm bảo gửi null thay vì undefined cho API nếu cần xóa
    const cleanData = JSON.parse(JSON.stringify(finalData));
    if(finalData.status === RecordStatus.RECEIVED) {
        cleanData.assignedDate = null;
        cleanData.submissionDate = null;
        cleanData.approvalDate = null;
        cleanData.completedDate = null;
        cleanData.resultReturnedDate = null;
        cleanData.exportBatch = null;
        cleanData.exportDate = null;
    } else if (finalData.status === RecordStatus.ASSIGNED) {
        cleanData.submissionDate = null;
        cleanData.approvalDate = null;
        cleanData.completedDate = null;
        cleanData.resultReturnedDate = null;
        cleanData.exportBatch = null;
        cleanData.exportDate = null;
    }

    onSubmit(cleanData as any);
    onClose();
  };

  const handleChange = (field: keyof RecordFile, value: any) => {
    setFormData(prev => {
        const newData = { ...prev, [field]: value };
        if (field === 'recordType' || field === 'receivedDate') {
            const rType = field === 'recordType' ? value : prev.recordType;
            const rDate = field === 'receivedDate' ? value : prev.receivedDate;
            if (rType && rDate) {
                newData.deadline = calculateDeadline(rType, rDate);
            }
        }
        return newData;
    });
  };
  const val = (v: any) => v === undefined || v === null ? '' : v;
  const dateVal = (v: any) => { if (!v) return ''; const str = String(v); return str.includes('T') ? str.split('T')[0] : str; };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-0 md:p-4 backdrop-blur-sm">
      <div className="bg-white md:rounded-xl shadow-2xl w-full max-w-4xl h-full md:max-h-[95vh] flex flex-col animate-fade-in-up">
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 md:p-5 border-b bg-gray-50 rounded-t-none md:rounded-t-xl shrink-0">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 truncate pr-2 uppercase">
            {isRegistrationRecord ? (initialData ? 'Cập nhật thông tin hồ sơ' : 'Tiếp nhận hồ sơ mới') : (initialData ? 'Cập nhật thông tin hồ sơ' : 'Tiếp nhận hồ sơ mới')}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-gray-200">
            <X size={24} />
          </button>
        </div>
        
        {/* BODY - SCROLLABLE */}
        <div className="overflow-y-auto p-4 md:p-6 flex-1 bg-gray-100">
            {isRegistrationRecord ? (
                <RecordForm
                    initialData={initialData}
                    onSave={async (record) => {
                        onSubmit(record);
                        return record;
                    }}
                    wards={wards}
                    records={records || []}
                    holidays={holidays || []}
                    calculateDeadline={calculateDeadline}
                    generateCode={generateCode}
                    currentUser={currentUser}
                    employees={employees}
                    currentView={currentView}
                    isInModal={true}
                />
            ) : (
                <form id="record-form" onSubmit={handleSubmit} className="space-y-6">
                {/* 1. THÔNG TIN CHUNG */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2"><Calendar size={16} /> Thông tin chung</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Mã hồ sơ <span className="text-red-500">*</span></label>
                            <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 font-bold text-blue-700" value={val(formData.code)} onChange={(e) => handleChange('code', e.target.value)} />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Loại hồ sơ</label>
                            <select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white" value={val(formData.recordType)} onChange={(e) => handleChange('recordType', e.target.value)}>
                                <option value="">-- Chọn loại hồ sơ --</option>
                                {allowedRecordTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        {hasAdminRights && (
                            <>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày nhận</label><input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.receivedDate)} onChange={(e) => handleChange('receivedDate', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Hẹn trả <span className="text-red-500">*</span></label><input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2 font-semibold text-red-600 bg-red-50" value={dateVal(formData.deadline)} onChange={(e) => handleChange('deadline', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Ngày giao NV</label><input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={dateVal(formData.assignedDate)} onChange={(e) => handleChange('assignedDate', e.target.value)} /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">Trạng thái</label><select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-yellow-50 font-medium" value={val(formData.status)} onChange={(e) => handleChange('status', e.target.value)}>{Object.values(RecordStatus).filter(s => {
                                    const isArchive = isArchiveType(formData.recordType);
                                    if (isArchive) {
                                        return s !== RecordStatus.PENDING_CHECK && s !== RecordStatus.CHECKED;
                                    }
                                    return true;
                                }).map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}</select></div>
                                
                                {(formData.status === RecordStatus.HANDOVER || formData.status === RecordStatus.WITHDRAWN || formData.status === RecordStatus.RETURNED || formData.status === RecordStatus.REJECTED || formData.exportBatch) && (
                                    <div><label className="block text-xs font-bold text-green-700 mb-1">{formData.status === RecordStatus.WITHDRAWN ? 'Ngày rút hồ sơ' : formData.status === RecordStatus.REJECTED ? 'Ngày trả hồ sơ' : 'Ngày hoàn thành'}</label><input type="date" className="w-full border border-green-300 rounded-md px-3 py-2 bg-green-50 font-semibold text-green-800" value={dateVal(formData.completedDate)} onChange={(e) => handleChange('completedDate', e.target.value)} /></div>
                                )}
                                
                                {/* Thêm trường hiển thị Ngày Trình Ký và Ngày Ký Duyệt nếu trạng thái tương ứng hoặc đã có giá trị */}
                                {(formData.status === RecordStatus.PENDING_SIGN || formData.status === RecordStatus.SIGNED || formData.status === RecordStatus.HANDOVER || formData.status === RecordStatus.REJECTED || formData.status === RecordStatus.WITHDRAWN || !!formData.submissionDate) && (
                                    <div><label className="block text-xs font-bold text-purple-700 mb-1">Ngày trình ký</label><input type="date" className="w-full border border-purple-300 rounded-md px-3 py-2 bg-purple-50 text-purple-800" value={dateVal(formData.submissionDate)} onChange={(e) => handleChange('submissionDate', e.target.value)} /></div>
                                )}
                                {(formData.status === RecordStatus.SIGNED || formData.status === RecordStatus.HANDOVER || formData.status === RecordStatus.REJECTED || formData.status === RecordStatus.WITHDRAWN || !!formData.approvalDate) && (
                                    <div><label className="block text-xs font-bold text-indigo-700 mb-1">Ngày ký duyệt</label><input type="date" className="w-full border border-indigo-300 rounded-md px-3 py-2 bg-indigo-50 text-indigo-800" value={dateVal(formData.approvalDate)} onChange={(e) => handleChange('approvalDate', e.target.value)} /></div>
                                )}
                            </>
                        )}
                        {!hasAdminRights && <div className="col-span-full p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 italic text-center">* Ngày tháng và trạng thái chỉ Admin/Subadmin được chỉnh sửa.</div>}
                    </div>
                </div>

                {/* 2. CHỦ SỬ DỤNG */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2"><UserIcon size={16} /> Chủ sử dụng & Ủy quyền</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Tên chủ sử dụng <span className="text-red-500">*</span></label><input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 font-medium" value={val(formData.customerName)} onChange={(e) => handleChange('customerName', e.target.value)} /></div>
                        <div><label className="block text-xs font-bold text-gray-700 mb-1">Số điện thoại</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.phoneNumber)} onChange={(e) => handleChange('phoneNumber', e.target.value)} /></div>
                        <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Địa chỉ chủ sử dụng</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.customerAddress)} onChange={(e) => handleChange('customerAddress', e.target.value)} /></div>
                        <div><label className="block text-xs font-bold text-gray-700 mb-1">CCCD</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.cccd)} onChange={(e) => handleChange('cccd', e.target.value)} /></div>
                        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase">Người được ủy quyền</label><input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={val(formData.authorizedBy)} onChange={(e) => handleChange('authorizedBy', e.target.value)} placeholder="Họ tên..." /></div>
                            <div><label className="block text-[10px] font-bold text-gray-500 uppercase">Loại giấy tờ</label><select className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white" value={val(formData.authDocType)} onChange={(e) => handleChange('authDocType', e.target.value)}><option value="">-- Chọn giấy tờ --</option><option value="Hợp đồng ủy quyền">Hợp đồng ủy quyền</option><option value="Giấy ủy quyền">Giấy ủy quyền</option><option value="Văn bản ủy quyền">Văn bản ủy quyền</option></select></div>
                        </div>
                    </div>
                </div>

                {/* 3. Vị Trí & Thửa Đất (Giữ nguyên) */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2"><MapPin size={16} /> Vị trí & Thửa đất</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div><label className="block text-xs font-bold text-gray-700 mb-1">Xã / Phường</label><select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white" value={val(formData.ward)} onChange={(e) => handleChange('ward', e.target.value)}><option value="">-- Chọn Xã/Phường --</option>{wards.map(w => <option key={w} value={w}>{w}</option>)}</select></div>
                        <div className="md:col-span-2"><label className="block text-xs font-bold text-gray-700 mb-1">Địa chỉ chi tiết</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.address)} onChange={(e) => handleChange('address', e.target.value)} placeholder="Số nhà, đường, ấp..." /></div>
                        <div><label className="block text-xs font-bold text-gray-700 mb-1">Khu vực (Nhóm)</label><select className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.group)} onChange={(e) => handleChange('group', e.target.value)}>{GROUPS.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                        <div className="grid grid-cols-3 gap-2 md:col-span-4">
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Tờ bản đồ</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-center font-mono" value={val(formData.mapSheet)} onChange={(e) => handleChange('mapSheet', e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Thửa đất</label><input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-center font-mono" value={val(formData.landPlot)} onChange={(e) => handleChange('landPlot', e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Diện tích (m2)</label><input type="number" className="w-full border border-gray-300 rounded-md px-3 py-2 text-right" value={formData.area || 0} onChange={(e) => handleChange('area', parseFloat(e.target.value))} /></div>
                        </div>
                    </div>
                </div>

                {/* 4. NỘI DUNG & KỸ THUẬT */}
                <div className="bg-white p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2"><FileText size={16} /> Nội dung & Kỹ thuật</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Nội dung yêu cầu</label><textarea rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.content)} onChange={(e) => handleChange('content', e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Giấy tờ kèm theo</label><textarea rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.otherDocs)} onChange={(e) => handleChange('otherDocs', e.target.value)} placeholder="GCN QSDĐ, CMND, Hộ khẩu..." /></div>
                        </div>
                        <div className={`grid ${isMeasurement ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1'} gap-4 bg-gray-50 p-3 rounded border border-gray-200`}>
                            {isMeasurement && (
                                <>
                                    <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Số Trích đo</label><input type="text" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={val(formData.measurementNumber)} onChange={(e) => handleChange('measurementNumber', e.target.value)} /></div>
                                    <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Số Trích lục</label><input type="text" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={val(formData.excerptNumber)} onChange={(e) => handleChange('excerptNumber', e.target.value)} /></div>
                                </>
                            )}
                            <div className={isMeasurement ? 'col-span-2' : ''}>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Giao nhân viên xử lý</label>
                                <select 
                                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm cursor-pointer bg-white" 
                                    value={val(formData.assignedTo)} 
                                    onChange={(e) => handleChange('assignedTo', e.target.value)}
                                >
                                    <option value="">-- Chưa giao --</option>
                                    {groupEmployeesByDepartment(employees).map(group => (
                                        <optgroup key={group.key} label={group.label} className="font-bold text-blue-700 bg-blue-50">
                                            {group.employees.map(emp => (
                                                <option key={emp.id} value={emp.id} className="text-gray-800 font-normal bg-white">
                                                    {emp.name} ({emp.position || 'Nhân viên'})
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {/* QUAN TRỌNG: Hiển thị thông tin xuất đợt */}
                        {hasAdminRights && (
                            <div className="grid grid-cols-2 gap-4 bg-indigo-50 p-3 rounded border border-indigo-200">
                                <div><label className="block text-[10px] font-bold text-indigo-500 uppercase mb-1">Đợt xuất (Batch)</label><input type="number" className="w-full border border-indigo-200 rounded-md px-2 py-1.5 text-sm" value={val(formData.exportBatch)} onChange={(e) => handleChange('exportBatch', parseInt(e.target.value))} /></div>
                                <div><label className="block text-[10px] font-bold text-indigo-500 uppercase mb-1">Ngày xuất</label><input type="date" className="w-full border border-indigo-200 rounded-md px-2 py-1.5 text-sm" value={val(formData.exportDate ? formData.exportDate.split('T')[0] : '')} onChange={(e) => handleChange('exportDate', new Date(e.target.value).toISOString())} /></div>
                            </div>
                        )}
                        
                        {canEditResult && (
                            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                                <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2 mb-3"><FileCheck size={16} /> TRẢ KẾT QUẢ CHO DÂN</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold text-emerald-700 mb-1">Ngày trả kết quả</label><input type="date" className="w-full border border-emerald-300 rounded-md px-3 py-2 bg-white font-bold text-emerald-800" value={dateVal(formData.resultReturnedDate)} onChange={(e) => handleChange('resultReturnedDate', e.target.value)} /></div>
                                    <div><label className="block text-xs font-bold text-emerald-700 mb-1">Số Biên Lai</label><input type="text" className="w-full border border-emerald-300 rounded-md px-3 py-2 font-mono bg-white" value={val(formData.receiptNumber)} onChange={(e) => handleChange('receiptNumber', e.target.value)} placeholder="Nhập số biên lai..." /></div>
                                </div>
                            </div>
                        )}
                        {hasAdminRights && (
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                <div className="flex items-center gap-2 mb-1"><Lock size={14} className="text-yellow-600" /><label className="text-xs font-bold text-yellow-800 uppercase">Ghi chú nội bộ</label></div>
                                <textarea rows={2} className="w-full border border-yellow-300 rounded-md px-3 py-2 bg-white text-sm" value={val(formData.privateNotes)} onChange={(e) => handleChange('privateNotes', e.target.value)} />
                            </div>
                        )}
                    </div>
                </div>
            </form>
            )}
        </div>

        {/* FOOTER */}
        <div className="p-4 md:p-5 border-t bg-gray-50 flex justify-end gap-3 shrink-0 rounded-b-none md:rounded-b-xl sticky bottom-0 z-10">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 font-medium transition-colors text-sm">Hủy bỏ</button>
            <button type="submit" form="record-form" className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md font-bold transition-transform active:scale-95 text-sm select-none">
                <Save size={18} /> {isRegistrationRecord && !initialData ? 'LƯU & IN BIÊN NHẬN' : (initialData ? 'CẬP NHẬT' : 'LƯU & IN HỒ SƠ')}
            </button>
        </div>
      </div>
    </div>
  );
};

export default RecordModal;
