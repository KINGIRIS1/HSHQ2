
import React, { useState, useEffect } from 'react';
import { RecordFile, Employee, User, UserRole, SplitItem, RecordStatus, Holiday } from '../types';
import { getNormalizedWard, REGISTRATION_PROCEDURES } from '../constants';
import StatusBadge from './StatusBadge';
import { X, MapPin, FileText, User as UserIcon, Receipt, DollarSign, CheckCircle2, Circle, Send, FileSignature, CheckSquare, CalendarClock, FileCheck, Calculator, Loader2, StickyNote, Save, Bell, Printer, Pencil, Trash2, Info, FileDown, AlertTriangle, Activity, ArrowRight, RotateCcw } from 'lucide-react';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import DocxPreviewModal from './DocxPreviewModal';
import { updateRecordApi, fetchContracts } from '../services/api';
import { calculateDeadline, isDefaultTaxProcedure, isRegType, getGcnWorkflowStepsHelper } from '../utils/appHelpers';
import { getEmployeeTeam } from './AssignModal';
import SystemReceiptTemplate from './receive-record/SystemReceiptTemplate';
import SystemAnnexTemplate from './receive-record/SystemAnnexTemplate';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  employees: Employee[];
  users: User[];
  currentUser: User | null;
  holidays?: Holiday[];
  onEdit?: (record: RecordFile) => void;
  onDelete?: (record: RecordFile) => void;
  onCreateLiquidation?: (record: RecordFile) => void; 
  onRefreshData?: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, record: initialRecord, employees, users, currentUser, holidays, onEdit, onDelete, onCreateLiquidation, onRefreshData }) => {
  const [localRecord, setLocalRecord] = useState<RecordFile | null>(null);
  const [isDefectDialogOpen, setIsDefectDialogOpen] = useState(false);
  const [defectReasonInput, setDefectReasonInput] = useState('');
  const [isSavingDefect, setIsSavingDefect] = useState(false);
  
  // States for citizen supplement (Chờ bổ sung - Người dân)
  const [isSupplementDialogOpen, setIsSupplementDialogOpen] = useState(false);
  const [supplementReasonInput, setSupplementReasonInput] = useState('');
  const [supplementLegalBasisInput, setSupplementLegalBasisInput] = useState('');
  const [isSavingSupplement, setIsSavingSupplement] = useState(false);

  const [isResumeDialogOpen, setIsResumeDialogOpen] = useState(false);
  const [resumeMode, setResumeMode] = useState<'supplement' | 'simple'>('supplement');
  const [isSavingResume, setIsSavingResume] = useState(false);

  useEffect(() => {
    setLocalRecord(initialRecord);
  }, [initialRecord]);

  const activeRecord = localRecord || initialRecord;
  const record = activeRecord;

  const isGCN = !!(record?.recordType && (
      record.recordType.trim().toLowerCase().startsWith('3.') || 
      record.recordType.trim().toLowerCase() === 'đăng ký' || 
      record.recordType.trim().toLowerCase() === 'cấp giấy' || 
      record.recordType.trim().toLowerCase() === 'cấp đổi' || 
      record.recordType.trim().toLowerCase() === 'cấp lại' || 
      REGISTRATION_PROCEDURES.some(p => p.toLowerCase() === record.recordType?.trim().toLowerCase())
  ));

  const getStepAssigneeName = (stepLabel: string) => {
      if (!record) return "";
      const label = stepLabel.toLowerCase();
      
      const assignedEmp = record.assignedTo ? employees.find(e => e.id === record.assignedTo) : null;
      const assignedName = assignedEmp ? assignedEmp.name : "";
      
      const checkerEmp = record.checkedBy ? employees.find(e => e.id === record.checkedBy) : null;
      const checkerName = checkerEmp ? checkerEmp.name : "";
      
      const submittedToId = record.submittedTo;
      const directorUser = submittedToId ? (users.find(u => u.employeeId === submittedToId) || employees.find(e => e.id === submittedToId)) : null;
      const directorName = directorUser ? directorUser.name : "";

      const receiverUser = record.receivedBy ? (users.find(u => u.employeeId === record.receivedBy) || employees.find(e => e.id === record.receivedBy)) : null;
      const receiverName = receiverUser ? receiverUser.name : "";

      if (label.includes("nhận hồ sơ")) {
          return receiverName || "Bộ phận tiếp nhận";
      }
      if (label.includes("ranh") || label.includes("dnlis")) {
          return assignedName || "Nhân viên xử lý";
      }
      if (label.includes("mộc kê") || label.includes("mộc")) {
          return assignedName || "Nhân viên xử lý";
      }
      if (label.includes("thế chấp")) {
          return assignedName || "Nhân viên xử lý";
      }
      if (label.includes("niêm yết") || label.includes("công văn")) {
          return assignedName || "Nhân viên xử lý";
      }
      if (label.includes("phiếu chuyển thuế") || label.includes("phiếu chuyển")) {
          return assignedName || "Nhân viên xử lý";
      }
      if (label.includes("trình ký thuế")) {
          return assignedName || "Nhân viên xử lý";
      }
      if (label.includes("tbt")) {
          return assignedName || "Nhân viên xử lý";
      }
      if (label.includes("in gcn") || label.includes("in giấy")) {
          return assignedName || "Nhân viên xử lý";
      }
      if (label.includes("thẩm tra")) {
          return checkerName || "Tổ trưởng kiểm tra";
      }
      if (label.includes("trình ký gcn") || label.includes("trình ký giấy")) {
          return directorName ? `Trình: ${assignedName || "NV"} -> Duyệt: ${directorName}` : (assignedName || "Nhân viên trình");
      }
      if (label.includes("vô số")) {
          return assignedName || "Cán bộ bộ phận Cấp giấy";
      }
      if (label.includes("giao 1 cửa") || label.includes("giao một cửa") || label.includes("trả kết quả")) {
          return "Bộ phận một cửa";
      }
      
      return assignedName || "Cán bộ xử lý";
  };

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemReceiptData, setSystemReceiptData] = useState<Partial<RecordFile> | null>(null);
  
  // State cho Ghi chú cá nhân
  const [personalNote, setPersonalNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // State cho Nhắc nhở
  const [reminderDate, setReminderDate] = useState('');
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  // State cho giá hợp đồng
  const [contractPrice, setContractPrice] = useState<number | null>(null);
  const [contractSplitItems, setContractSplitItems] = useState<SplitItem[] | null>(null);
  
  // State cho Thanh lý
  const [liquidationInfo, setLiquidationInfo] = useState<{ amount: number, content: string } | null>(null);

  const [isAnnexOpen, setIsAnnexOpen] = useState(false);

  const isMeasurementTeam = React.useMemo(() => {
      if (!currentUser?.employeeId) return false;
      const emp = employees.find(e => e.id === currentUser.employeeId);
      if (!emp) return false;
      return emp.department?.toLowerCase().includes('đo đạc') || emp.department?.toLowerCase().includes('kỹ thuật') || emp.position?.toLowerCase().includes('đo đạc');
  }, [currentUser, employees]);

  const getWorkflowSteps = () => {
    if (!record) return null;

    const isReturned = record.hasDefect || record.status === RecordStatus.REJECTED;

    if (isReturned) {
        const currentStatus = record.status;
        const s0 = 'completed';
        
        let s1: 'completed' | 'current' | 'upcoming' = 'upcoming';
        if ([RecordStatus.PENDING_CHECK].includes(currentStatus)) s1 = 'current';
        else if ([RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED].includes(currentStatus)) s1 = 'completed';

        let s2: 'completed' | 'current' | 'upcoming' = 'upcoming';
        if ([RecordStatus.CHECKED, RecordStatus.PENDING_SIGN].includes(currentStatus)) s2 = 'current';
        else if ([RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED].includes(currentStatus)) s2 = 'completed';

        let s3: 'completed' | 'current' | 'upcoming' = 'upcoming';
        if ([RecordStatus.SIGNED].includes(currentStatus)) s3 = 'current';
        else if ([RecordStatus.HANDOVER, RecordStatus.RETURNED].includes(currentStatus)) s3 = 'completed';

        return {
            type: 'returned',
            title: 'Quy trình Trả hồ sơ do sai sót',
            steps: [
                { label: 'Trả Hồ sơ', duration: 'Bắt đầu', status: s0, desc: 'Phát hiện sai sót' },
                { label: 'Trình kiểm tra', duration: 'Kiểm tra hồ sơ', status: s1, desc: 'Chờ/Đang kiểm tra' },
                { label: 'Ký Phiếu trả', duration: 'Ký duyệt', status: s2, desc: 'Lãnh đạo ký phiếu trả' },
                { label: 'Giao 1 cửa', duration: 'Bàn giao', status: s3, desc: 'Trả kết quả về 1 cửa' }
            ]
        };
    }

    if (isGCN) {
        return getGcnWorkflowStepsHelper(record, holidays || []);
    }

    return null;
  };

  useEffect(() => {
      if (record) {
          setPersonalNote(record.personalNotes || '');
          // Chuyển ISO string sang format datetime-local (yyyy-MM-ddTHH:mm) để hiển thị trong input
          if (record.reminderDate) {
              const d = new Date(record.reminderDate);
              const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
              setReminderDate(localIso);
          } else {
              setReminderDate('');
          }

          // Fetch Contract Price & Details
          const fetchPrice = async () => {
              const contracts = await fetchContracts();
              // Tìm hợp đồng có cùng mã hồ sơ (Case insensitive)
              const match = contracts.find(c => c.code && record.code && c.code.trim().toLowerCase() === record.code.trim().toLowerCase());
              
              if (match) {
                  // GIÁ TRỊ HỢP ĐỒNG (Lấy từ totalAmount - giá trị lúc lập hợp đồng)
                  setContractPrice(match.totalAmount ?? null);
                  setContractSplitItems(match.splitItems || null);

                  // GIÁ TRỊ THANH LÝ (Lấy từ liquidationAmount - nếu đã nhập)
                  if (match.liquidationAmount !== null && match.liquidationAmount !== undefined) {
                      
                      let liquidationLabel = 'Thanh lý hợp đồng';
                      const cType = (match.contractType || '').toLowerCase();
                      const sType = (match.serviceType || '').toLowerCase();

                      if (cType.includes('trích lục') || sType.includes('trích lục')) {
                          liquidationLabel = 'Thanh lý trích lục';
                      } else if (cType.includes('cắm mốc') || sType.includes('cắm mốc')) {
                          liquidationLabel = 'Thanh lý cắm mốc';
                      } else if (cType.includes('tách thửa') || sType.includes('tách thửa')) {
                          liquidationLabel = 'Thanh lý tách thửa';
                      } else if (cType.includes('đo đạc') || sType.includes('đo đạc')) {
                          liquidationLabel = 'Thanh lý đo đạc';
                      }

                      setLiquidationInfo({
                          amount: match.liquidationAmount, 
                          content: liquidationLabel
                      });
                  } else {
                      setLiquidationInfo(null);
                  }

              } else {
                  // Fallback: Nếu không có hợp đồng nhưng là hồ sơ Trích lục -> Hiển thị 53.163
                  const type = (record.recordType || '').toLowerCase();
                  if (type.includes('trích lục')) {
                      setContractPrice(53163);
                  } else {
                      setContractPrice(null);
                  }
                  setContractSplitItems(null);
                  setLiquidationInfo(null);
              }
          };
          fetchPrice();
      }
  }, [record]);

  const isOneDoor = React.useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ONEDOOR) return true;
    if (!currentUser.employeeId || !employees) return false;
    const emp = employees.find(e => e.id === currentUser.employeeId);
    if (!emp) return false;
    const teamName = getEmployeeTeam(emp);
    return teamName === "Tổ Hành chính";
  }, [currentUser, employees]);

  if (!isOpen || !record) return null;

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSubadmin = currentUser?.role === UserRole.SUBADMIN;

  const canPerformAction = isAdmin || isSubadmin || isOneDoor; // Điều kiện để Sửa, Xóa
  
  // Điều kiện để In biên nhận: Chỉ Admin hoặc Một cửa mới được thấy nút này
  const canPrintReceipt = isAdmin || isOneDoor;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    
    if (dateStr.includes('T')) {
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${h}:${min} - ${d}/${m}/${y}`;
    }
    return `${d}/${m}/${y}`;
  };

  const getEmployeeName = (id?: string | null) => {
    if (!id) return 'Chưa giao';
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.name} (${emp.department})` : 'Không xác định';
  };

  const handleSavePersonalNote = async () => {
      setIsSavingNote(true);
      if (!activeRecord) return;
      const updatedRecord = { ...activeRecord, personalNotes: personalNote };
      const result = await updateRecordApi(updatedRecord);
      setIsSavingNote(false);
      
      if (result) {
          setLocalRecord(updatedRecord);
          alert('Đã lưu ghi chú cá nhân thành công!');
          onRefreshData?.();
      } else {
          alert('Lỗi khi lưu ghi chú.');
      }
  };

  const handleSaveReminder = async () => {
      setIsSavingReminder(true);
      if (!activeRecord) return;
      
      // Nếu user xóa trắng input -> xóa nhắc nhở
      const newReminderDate = reminderDate ? new Date(reminderDate).toISOString() : null;
      
      // Reset lastRemindedAt khi đặt lịch mới để hệ thống nhắc lại từ đầu
      const updatedRecord = { 
          ...activeRecord, 
          reminderDate: newReminderDate as string, 
          lastRemindedAt: null as any 
      };
      
      const result = await updateRecordApi(updatedRecord);
      setIsSavingReminder(false);
      
      if (result) {
          setLocalRecord(updatedRecord);
          alert('Đã lưu lịch nhắc nhở!');
          onRefreshData?.();
      } else {
          alert('Lỗi khi lưu nhắc nhở.');
      }
  };

  const handleConfirmDefect = async () => {
      if (!activeRecord) return;
      setIsSavingDefect(true);
      const nowStr = new Date().toISOString();
      const formattedReason = `[Sai sót - Trả hồ sơ ngày ${new Date().toLocaleDateString('vi-VN')}]: ${defectReasonInput}`;
      const currentNotes = activeRecord.notes ? `${activeRecord.notes}\n${formattedReason}` : formattedReason;
      const currentPrivateNotes = activeRecord.privateNotes ? `${activeRecord.privateNotes}\n${formattedReason}` : formattedReason;
      
      const isReg = isRegType(activeRecord.recordType);
      const isArchive = activeRecord.recordType === 'Sao lục' || activeRecord.recordType === 'Công văn';
      
      let nextStatus = RecordStatus.IN_PROGRESS;
      const trackingUpdates: Partial<RecordFile> = {};
      
      if (isArchive) {
          // Gán lại cho chuyên viên thực hiện đối với hồ sơ lưu trữ
          nextStatus = 'assigned' as any;
      }
      
      const updatedRecord: RecordFile = {
          ...activeRecord,
          status: nextStatus,
          hasDefect: isReg,
          defectReason: defectReasonInput,
          defectDate: nowStr,
          notes: currentNotes,
          privateNotes: currentPrivateNotes
      };
      
      try {
          const result = await updateRecordApi(updatedRecord);
          setIsSavingDefect(false);
          setIsDefectDialogOpen(false);
          if (result) {
              setLocalRecord(updatedRecord);
              alert('Đã đánh dấu hồ sơ có sai sót thành công!');
              onRefreshData?.();
          } else {
              alert('Không thể lưu thông tin sai sót.');
          }
      } catch (err) {
          console.error(err);
          setIsSavingDefect(false);
          alert('Có lỗi xảy ra.');
      }
  };

  const handleToggleDefect = async () => {
      if (!activeRecord) return;
      
      if (activeRecord.hasDefect || activeRecord.status === RecordStatus.PENDING_SUPPLEMENT) {
          // Open the re-receive option dialog instead of a simple confirm
          setResumeMode('supplement');
          setIsResumeDialogOpen(true);
      } else {
          setDefectReasonInput('');
          setIsDefectDialogOpen(true);
      }
  };

  const handleConfirmSupplement = async () => {
      if (!activeRecord || !supplementReasonInput.trim()) return;
      setIsSavingSupplement(true);

      const today = new Date();
      const todayStr = today.toLocaleDateString('vi-VN');
      const todayISO = today.toISOString();

      const updatedRecord: RecordFile = {
          ...activeRecord,
          preSupplementStatus: activeRecord.status,
          preSupplementStepIndex: activeRecord.currentStepIndex !== undefined ? activeRecord.currentStepIndex : 0,
          status: RecordStatus.PENDING_SUPPLEMENT,
          defectReason: supplementReasonInput, // Đồng bộ lý do vào defectReason cho tương thích
          supplementReason: supplementReasonInput,
          supplementLegalBasis: supplementLegalBasisInput || null,
          supplementDate: todayISO,
          notes: activeRecord.notes 
              ? `${activeRecord.notes}\n[Trả HS Chờ bổ sung - Ngày ${todayStr}]: ${supplementReasonInput}` 
              : `[Trả HS Chờ bổ sung - Ngày ${todayStr}]: ${supplementReasonInput}`
      };

      try {
          const result = await updateRecordApi(updatedRecord);
          setIsSavingSupplement(false);
          setIsSupplementDialogOpen(false);
          setSupplementReasonInput('');
          setSupplementLegalBasisInput('');
          if (result) {
              setLocalRecord(updatedRecord);
              alert('Đã chuyển trạng thái hồ sơ thành Chờ dân bổ sung thành công!');
              onRefreshData?.();
          } else {
              alert('Không thể cập nhật trạng thái hồ sơ.');
          }
      } catch (err) {
          console.error(err);
          setIsSavingSupplement(false);
          alert('Có lỗi xảy ra.');
      }
  };

  const handleConfirmResume = async () => {
      if (!activeRecord) return;
      setIsSavingResume(true);

      let updatedRecord: RecordFile = { ...activeRecord };
      const today = new Date();
      const todayStr = today.toLocaleDateString('vi-VN');
      const todayISO = today.toISOString();

      // Khôi phục trạng thái và bước chi tiết trước khi bị trả chờ bổ sung
      const restoredStatus = activeRecord.preSupplementStatus || RecordStatus.IN_PROGRESS;
      const restoredStepIndex = activeRecord.preSupplementStepIndex !== undefined && activeRecord.preSupplementStepIndex !== null 
          ? activeRecord.preSupplementStepIndex 
          : activeRecord.currentStepIndex;

      if (resumeMode === 'supplement') {
          // Re-calculate deadline and set receivedDate to today for recalculating date from scratch
          const newDeadline = calculateDeadline(activeRecord.recordType || '', todayISO, holidays || [], !!activeRecord.hasTax);
          
          updatedRecord = {
              ...activeRecord,
              status: restoredStatus,
              currentStepIndex: restoredStepIndex,
              preSupplementStatus: null,
              preSupplementStepIndex: null,
              hasDefect: false,
              defectReason: null,
              receivedDate: todayISO,
              deadline: newDeadline,
              notes: activeRecord.notes 
                  ? `${activeRecord.notes}\n[Bổ sung HS - Tiếp nhận lại ngày ${todayStr}]: Quay lại bước trước khi trả, tính lại ngày hẹn trả (${newDeadline}) từ đầu` 
                  : `[Bổ sung HS - Tiếp nhận lại ngày ${todayStr}]: Quay lại bước trước khi trả, tính lại ngày hẹn trả (${newDeadline}) từ đầu`
          };
      } else {
          // Simple resume without changing receivedDate and deadline
          updatedRecord = {
              ...activeRecord,
              status: restoredStatus,
              currentStepIndex: restoredStepIndex,
              preSupplementStatus: null,
              preSupplementStepIndex: null,
              hasDefect: false,
              defectReason: null,
              notes: activeRecord.notes 
                  ? `${activeRecord.notes}\n[Tiếp nhận lại ngày ${todayStr}]: Hủy trạng thái Chờ bổ sung, giữ nguyên hạn trả gốc` 
                  : `[Tiếp nhận lại ngày ${todayStr}]: Hủy trạng thái Chờ bổ sung, giữ nguyên hạn trả gốc`
          };
      }

      try {
          const result = await updateRecordApi(updatedRecord);
          setIsSavingResume(false);
          setIsResumeDialogOpen(false);
          if (result) {
              setLocalRecord(updatedRecord);
              alert(resumeMode === 'supplement' ? 'Đã tiếp nhận lại hồ sơ bổ sung và tính lại ngày thành công!' : 'Đã hủy trạng thái sai sót hồ sơ.');
              onRefreshData?.();
          } else {
              alert('Không thể lưu thông tin hồ sơ.');
          }
      } catch (err) {
          console.error(err);
          setIsSavingResume(false);
          alert('Có lỗi xảy ra.');
      }
  };

  const handlePrintReceipt = async () => {
    if (!currentUser) return;
    
    if (!hasTemplate(STORAGE_KEYS.RECEIPT_TEMPLATE)) {
        setSystemReceiptData(record);
        return;
    }

    setIsProcessing(true);

    const rDate = record.receivedDate ? new Date(record.receivedDate) : new Date();
    const dDate = record.deadline ? new Date(record.deadline) : new Date();
    
    let standardDays = "30"; 
    const type = (record.recordType || '').toLowerCase();

    // Logic tính số ngày
    if (type.includes('trích lục')) {
        standardDays = "10";
    } else if (type.includes('trích đo chỉnh lý')) {
        standardDays = "15"; 
    } else if (type.includes('trích đo') || type.includes('đo đạc') || type.includes('cắm mốc')) {
        standardDays = "30";
    }

    // Logic Tiêu đề phiếu
    let tp1Value = 'Phiếu yêu cầu';
    if (type.includes('chỉnh lý') || type.includes('trích đo') || type.includes('trích lục')) {
        tp1Value = 'Phiếu yêu cầu trích lục, trích đo';
    } 
    else if (type.includes('đo đạc') || type.includes('cắm mốc')) {
        tp1Value = 'Phiếu yêu cầu Đo đạc, cắm mốc';
    }
    if (record.ward) {
        tp1Value += ` tại ${getNormalizedWard(record.ward)}`;
    }
    
    // Logic SĐT Liên hệ tự động
    let sdtLienHe = "";
    const wRaw = (record.ward || "").toLowerCase();
    if (wRaw.includes("minh hưng") || wRaw.includes("minh hung")) {
        sdtLienHe = "Nhân viên phụ trách Nguyễn Thìn Trung: 0886 385 757";
    } else if (wRaw.includes("nha bích") || wRaw.includes("nha bich")) {
        sdtLienHe = "Nhân viên phụ trách Lê Văn Hạnh: 0919 334 344";
    } else if (wRaw.includes("chơn thành") || wRaw.includes("chon thanh")) {
        sdtLienHe = "Nhân viên phụ trách Phạm Hoài Sơn: 0972 219 691";
    }

    const day = rDate.getDate().toString().padStart(2, '0');
    const month = (rDate.getMonth() + 1).toString().padStart(2, '0');
    const year = rDate.getFullYear();
    const dateFullString = `ngày ${day} tháng ${month} năm ${year}`;
    const dateShortString = `${day}/${month}/${year}`;
    
    const dayDead = dDate.getDate().toString().padStart(2, '0');
    const monthDead = (dDate.getMonth() + 1).toString().padStart(2, '0');
    const yearDead = dDate.getFullYear();
    const deadlineFullString = `ngày ${dayDead} tháng ${monthDead} năm ${yearDead}`;
    const deadlineShortString = `${dayDead}/${monthDead}/${yearDead}`;

    const val = (v: any) => (v === undefined || v === null) ? "" : String(v);

    const printData = {
        // --- ENGLISH RAW KEYS (Requested) ---
        code: val(record.code),
        customerName: val(record.customerName),
        landPlot: val(record.landPlot),
        mapSheet: val(record.mapSheet),
        
        // --- VIETNAMESE KEYS (Formatted per request) ---
        XAPHUONG: val(getNormalizedWard(record.ward)),
        
        // NGAYNHAN: ngày tháng năm
        NGAYNHAN: dateFullString,
        
        // NGAY_NHAN: dd/mm/yyyy
        NGAY_NHAN: dateShortString, 
        
        LOAI_GIAY_TO_UY_QUYEN: val(record.authDocType),
        DIA_CHI_CHI_TIET: val(record.address),

        // --- NHÓM THÔNG TIN CƠ BẢN ---
        MA: val(record.code), 
        SO_HS: val(record.code), 
        MA_HO_SO: val(record.code),
        CODE: val(record.code),

        // --- NHÓM CHỦ SỬ DỤNG ---
        TEN: val(record.customerName).toUpperCase(), 
        HO_TEN: val(record.customerName).toUpperCase(),
        CHU_SU_DUNG: val(record.customerName).toUpperCase(),
        KHACH_HANG: val(record.customerName).toUpperCase(),
        ONG_BA: val(record.customerName).toUpperCase(),

        // --- NHÓM LIÊN HỆ ---
        SDT: val(record.phoneNumber), 
        DIEN_THOAI: val(record.phoneNumber),
        PHONE: val(record.phoneNumber),
        CCCD: val(record.cccd), 
        CMND: val(record.cccd),
        DIA_CHI_CHU_SU_DUNG: val(record.customerAddress),

        // --- NHÓM ĐỊA CHỈ ---
        DIA_CHI: val(record.address || getNormalizedWard(record.ward)),
        DC: val(record.address || getNormalizedWard(record.ward)),
        ADDRESS: val(record.address || getNormalizedWard(record.ward)),
        XA: val(getNormalizedWard(record.ward)), 
        PHUONG: val(getNormalizedWard(record.ward)),
        WARD: val(getNormalizedWard(record.ward)),
        
        // --- NHÓM THỬA ĐẤT ---
        TO: val(record.mapSheet), 
        SO_TO: val(record.mapSheet),
        THUA: val(record.landPlot), 
        SO_THUA: val(record.landPlot),
        DT: val(record.area), 
        DIEN_TICH: val(record.area),
        
        // --- NHÓM NGÀY THÁNG (ALIASES) ---
        NGAY_NHAN_FULL: dateFullString,
        NGAY: day, 
        THANG: month, 
        NAM: year,
        RECEIVED_DATE: dateShortString,
        
        HEN_TRA: deadlineShortString, 
        NGAY_HEN: deadlineShortString,
        DEADLINE: deadlineShortString,
           NGUOI_UY_QUYEN: val(record.authorizedBy).toUpperCase(),
        UY_QUYEN: val(record.authorizedBy).toUpperCase(),
        LOAI_UY_QUYEN: val(record.authDocType),
        
        // --- CẤU HÌNH ---
        TGTRA: standardDays, 
        SO_NGAY: standardDays,
        TP1: tp1Value, 
        TIEU_DE: tp1Value,
        SDTLH: sdtLienHe, 
        TINH: "Bình Phước", 
        HUYEN: "huyện Hớn Quản"
    };

    const blob = await generateDocxBlobAsync(STORAGE_KEYS.RECEIPT_TEMPLATE, printData);
    
    setIsProcessing(false);

    if (blob) {
        setPreviewBlob(blob);
        setPreviewFileName(`BienNhan_${record.code}`);
        setIsPreviewOpen(true);
    }
  };

  // Helper cho Timeline
  // Updated: Hỗ trợ forceActive cho các bước không có ngày tháng cụ thể
  const TimelineItem = ({ date, label, icon: Icon, isLast, colorClass, forceActive, subText }: any) => {
      const isActive = !!date || !!forceActive;
      const isRejected = label === 'HỒ SƠ TRẢ';
      
      return (
          <div className="relative flex gap-4">
              <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 bg-white ${isActive ? colorClass.border : 'border-gray-200'}`}>
                      {isActive ? (
                          isRejected ? (
                              <Icon size={16} className={`${colorClass.text} animate-pulse`} />
                          ) : (
                              <CheckCircle2 size={16} className={colorClass.text} />
                          )
                      ) : <Circle size={16} className="text-gray-300" />}
                  </div>
                  {!isLast && <div className={`w-0.5 grow ${isActive ? colorClass.bg : 'bg-gray-100'} my-1`}></div>}
              </div>
              <div className="pb-6">
                  <p className={`text-xs font-bold uppercase mb-0.5 ${isActive ? colorClass.text : 'text-gray-400'}`}>{label}</p>
                  <div className="flex items-center gap-2">
                      <Icon size={14} className={isActive ? (isRejected ? 'text-red-500' : 'text-gray-500') : 'text-gray-300'} />
                      <span className={`text-sm font-medium ${isActive ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                          {date ? formatDate(date) : (forceActive ? 'Đã hoàn tất' : 'Chưa thực hiện')}
                      </span>
                  </div>
                  {subText && (
                      <p className={`text-[11px] mt-1 italic ${isRejected ? 'text-red-600 font-semibold' : 'text-indigo-600'}`}>
                          {subText}
                      </p>
                  )}
              </div>
          </div>
      );
  };

  // LOGIC HIỂN THỊ STATUS
  const getDisplayStatus = (r: RecordFile) => {
      if ((r.hasDefect || r.status === RecordStatus.REJECTED) && r.status !== RecordStatus.RETURNED && r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.HANDOVER) {
          return RecordStatus.REJECTED;
      }
      if ((r.exportBatch || r.exportDate) && r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.RETURNED) {
          return RecordStatus.HANDOVER;
      }
      return r.status;
  };
  const displayStatus = getDisplayStatus(record);

  // LOGIC CHECK NẾU ĐÃ THỰC HIỆN XONG (Để hiển thị bước "Đã thực hiện")
  const isWorkDone = [
      RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.completedWorkDate;
  
  const isPendingCheckActive = [
      RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.pendingCheckDate;

  const isCheckedActive = [
      RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.checkedDate;

  const isPendingSignActive = [
      RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.submissionDate;

  const isSignedActive = [
      RecordStatus.SIGNED, RecordStatus.HANDOVER, RecordStatus.RETURNED
  ].includes(record.status) || !!record.approvalDate;


  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col animate-fade-in-up">
        
        {/* HEADER */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded text-sm border border-blue-200">
                    {record.code}
                </span>
                <h2 className="text-lg font-bold text-gray-800 uppercase">{record.recordType}</h2>
                <StatusBadge status={displayStatus} recordType={record.recordType} />
            </div>
            
            <div className="flex items-center gap-2">
                {onCreateLiquidation && record && record.recordType !== 'Cung cấp tài liệu đất đai' && record.recordType !== 'Sao lục' && record.recordType !== 'Công văn' && (
                    <button
                        onClick={() => { onClose(); onCreateLiquidation(record); }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded hover:bg-green-100 transition-all text-sm font-bold shadow-sm"
                        title="Thanh lý HĐ"
                    >
                        <FileCheck size={16} /> Thanh lý HĐ
                    </button>
                )}

                {isMeasurementTeam && record && record.recordType !== 'Cung cấp tài liệu đất đai' && record.recordType !== 'Sao lục' && record.recordType !== 'Công văn' && (
                    <button
                        onClick={() => setIsAnnexOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded hover:bg-rose-100 transition-all text-sm font-bold shadow-sm"
                        title="In phụ lục hợp đồng"
                    >
                        <FileDown size={16} /> Phụ lục HĐ
                    </button>
                )}

                {canPrintReceipt && (
                    <button 
                        onClick={handlePrintReceipt}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded hover:bg-blue-50 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                        In biên nhận
                    </button>
                )}

                {canPerformAction && onEdit && (
                    <button onClick={() => { onClose(); onEdit(record); }} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                        <Pencil size={20} />
                    </button>
                )}
                
                {canPerformAction && onDelete && (currentUser?.role === 'ADMIN' || currentUser?.role === 'SUBADMIN') && (
                    <button onClick={() => { onClose(); onDelete(record); }} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={20} />
                    </button>
                )}

                <div className="w-px h-6 bg-gray-300 mx-2"></div>

                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={24} />
                </button>
            </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6">
            {record.hasDefect && (
                <div id="defect-banner-alert" className="mb-6 bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 flex items-start gap-3 shadow-sm animate-fade-in">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5 animate-pulse" size={18} />
                    <div>
                        <h4 className="text-sm font-bold text-red-900 uppercase">Hồ sơ đã được đánh giá có sai sót - Trình trả dân</h4>
                        <p className="text-xs text-red-700 mt-1 leading-relaxed">
                            <span className="font-bold">Lý do trả hồ sơ / sai sót chi tiết:</span>{" "}
                            {record.defectReason || "Chưa ghi cụ thể lý do."}
                        </p>
                        <p className="text-[11px] text-red-600 font-semibold mt-1">
                            * Quy trình xử lý (kiểm tra, trình ký, chuyển 1 cửa) vẫn tiếp tục được ghi nhận bình thường.
                        </p>
                    </div>
                </div>
            )}

            {(() => {
                const workflow = getWorkflowSteps();
                if (!workflow) return null;

                const getExecutionDate = (stepLabel: string, stepStatus: RecordStatus) => {
                    if (!record) return null;
                    const label = stepLabel.toLowerCase();
                    if (label.includes("ranh") || label.includes("dnlis")) {
                        return record.assignedDate;
                    }
                    if (label.includes("mộc kê")) {
                        return record.assignedDate;
                    }
                    if (label.includes("kiểm tra thế chấp")) {
                        return record.assignedDate;
                    }
                    if (label.includes("niêm yết") || label.includes("công văn")) {
                        return record.assignedDate;
                    }
                    if (label.includes("phiếu chuyển thuế") || label.includes("phiếu chuyển")) {
                        return record.completedWorkDate;
                    }
                    if (label.includes("trình ký thuế")) {
                        return record.completedWorkDate;
                    }
                    if (label.includes("tbt")) {
                        return record.taxPaymentDate;
                    }
                    if (label.includes("in gcn") || label.includes("in giấy")) {
                        return record.pendingCheckDate;
                    }
                    if (label.includes("thẩm tra")) {
                        return record.checkedDate;
                    }
                    if (label.includes("trình ký gcn") || label.includes("trình ký giấy")) {
                        return record.submissionDate;
                    }
                    if (label.includes("vô số")) {
                        return record.approvalDate;
                    }
                    if (label.includes("giao 1 cửa") || label.includes("giao một cửa")) {
                        return record.completedDate;
                    }
                    
                    if (stepStatus === RecordStatus.IN_PROGRESS) return record.assignedDate;
                    if (stepStatus === RecordStatus.COMPLETED_WORK) return record.completedWorkDate;
                    if (stepStatus === RecordStatus.PENDING_CHECK) return record.pendingCheckDate;
                    if (stepStatus === RecordStatus.CHECKED) return record.checkedDate;
                    if (stepStatus === RecordStatus.PENDING_SIGN) return record.submissionDate;
                    if (stepStatus === RecordStatus.SIGNED) return record.approvalDate;
                    if (stepStatus === RecordStatus.HANDOVER) return record.completedDate;
                    return null;
                };

                if (isGCN) {
                    const groupGcnSteps = (rawSteps: any[]): any[] => {
                        const groups: {
                            label: string;
                            matchKeywords: string[];
                            subSteps: any[];
                        }[] = [
                            {
                                label: "Xử lý bản vẽ / mộc kê",
                                matchKeywords: ["ranh", "dnlis", "mộc kê", "thế chấp", "niêm yết", "công văn"],
                                subSteps: []
                            },
                            {
                                label: "Thuế",
                                matchKeywords: ["phiếu chuyển", "trình ký thuế", "tbt"],
                                subSteps: []
                            },
                            {
                                label: "In GCN",
                                matchKeywords: ["in gcn", "in giấy", "thẩm tra", "trình ký gcn", "trình ký giấy"],
                                subSteps: []
                            },
                            {
                                label: "Vào số GCN",
                                matchKeywords: ["vô số"],
                                subSteps: []
                            },
                            {
                                label: "Giao 1 cửa",
                                matchKeywords: ["giao 1 cửa", "giao một cửa"],
                                subSteps: []
                            }
                        ];

                        rawSteps.forEach(step => {
                            const lowerLabel = step.label.toLowerCase();
                            let matched = false;
                            for (const g of groups) {
                                if (g.matchKeywords.some(kw => lowerLabel.includes(kw))) {
                                    g.subSteps.push(step);
                                    matched = true;
                                    break;
                                }
                            }
                            if (!matched) {
                                groups[0].subSteps.push(step);
                            }
                        });

                        const activeGroups = groups.filter(g => g.subSteps.length > 0);

                        return activeGroups.map(g => {
                            const subSteps = g.subSteps;
                            
                            let status: 'completed' | 'current' | 'upcoming' = 'upcoming';
                            const allCompleted = subSteps.every(s => s.status === 'completed');
                            const allUpcoming = subSteps.every(s => s.status === 'upcoming');
                            if (allCompleted) {
                                status = 'completed';
                            } else if (allUpcoming) {
                                status = 'upcoming';
                            } else {
                                status = 'current';
                            }

                            const currentSub = subSteps.find(s => s.status === 'current') || 
                                               subSteps.find(s => s.status === 'completed' && s.deadlineDate) ||
                                               subSteps[0];
                            
                            const deadlineDate = currentSub?.deadlineDate || null;
                            const isOverdue = subSteps.some(s => s.isOverdue);
                            const isUrgent = subSteps.some(s => s.isUrgent);

                            return {
                                label: g.label,
                                status,
                                deadlineDate,
                                isOverdue,
                                isUrgent,
                                subSteps
                            };
                        });
                    };

                    const grouped = groupGcnSteps(workflow.steps);

                    return (
                        <div className="mb-8 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-wider flex items-center gap-2">
                                <Activity size={14} className="text-slate-400" />
                                {workflow.title}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                {grouped.map((group, idx) => {
                                    let cardBorderClass = "border-slate-200 bg-white";
                                    let badgeColorClass = "bg-slate-100 text-slate-500";
                                    let badgeText = "Chờ thực hiện";
                                    
                                    if (group.status === 'completed') {
                                        cardBorderClass = "border-emerald-200 bg-emerald-50/10 hover:bg-emerald-50/20";
                                        badgeColorClass = "bg-emerald-100 text-emerald-700";
                                        badgeText = "Hoàn thành";
                                    } else if (group.status === 'current') {
                                        cardBorderClass = "border-blue-300 bg-blue-50/10 ring-2 ring-blue-100 shadow-md";
                                        badgeColorClass = "bg-blue-600 text-white animate-pulse";
                                        badgeText = "Đang xử lý";
                                    }

                                    return (
                                        <div key={idx} className={`rounded-xl border p-4 flex flex-col justify-between transition-all duration-300 ${cardBorderClass}`}>
                                            <div>
                                                <div className="flex justify-between items-start mb-3">
                                                    <h4 className="text-sm font-black text-slate-800 tracking-tight leading-tight">
                                                        {group.label}
                                                    </h4>
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${badgeColorClass}`}>
                                                        {badgeText}
                                                    </span>
                                                </div>
                                                
                                                {/* Danh sách tiến độ chi tiết (Sub-steps) */}
                                                <div className="space-y-1.5 bg-slate-50/50 p-2 rounded-lg border border-slate-100 mb-3">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                                        Tiến độ bước:
                                                    </p>
                                                    {group.subSteps.map((s: any, sIdx: number) => {
                                                        const execDate = getExecutionDate(s.label, s.overallStatus);
                                                        let iconNode = <Circle size={10} className="text-slate-300 mt-0.5" />;
                                                        let sLabelClass = "text-slate-400 font-medium";
                                                        
                                                        if (s.status === 'completed') {
                                                            iconNode = <CheckCircle2 size={10} className="text-emerald-500 mt-0.5" />;
                                                            sLabelClass = "text-emerald-800 font-semibold line-through decoration-emerald-200";
                                                        } else if (s.status === 'current') {
                                                            iconNode = <Loader2 size={10} className="text-blue-500 animate-spin mt-0.5" />;
                                                            sLabelClass = "text-blue-800 font-bold";
                                                        }

                                                        return (
                                                            <div key={sIdx} className="text-[11px] leading-tight flex items-start gap-1.5">
                                                                {iconNode}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className={`truncate ${sLabelClass}`} title={s.label}>
                                                                        {s.label}
                                                                    </p>
                                                                    {/* Hiển thị cán bộ thực hiện dưới mỗi bước quy trình */}
                                                                    <p className="text-[9px] text-slate-500 font-semibold flex items-center gap-1 mt-0.5">
                                                                        👤 {getStepAssigneeName(s.label) || "Chưa giao"}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            
                                            {/* Deadline / Time block */}
                                            <div className="border-t border-slate-100 pt-2 mt-auto">
                                                {group.status === 'completed' ? (
                                                    <p className="text-[10px] text-emerald-600 font-bold">
                                                        ✓ Đã hoàn thành
                                                    </p>
                                                ) : group.deadlineDate ? (
                                                    <div className="space-y-0.5">
                                                        <p className={`text-[10px] font-bold ${group.isOverdue ? "text-red-600 animate-pulse" : "text-blue-600"}`}>
                                                            Hạn: {formatDate(group.deadlineDate.toISOString())}
                                                        </p>
                                                        {group.isOverdue && (
                                                            <span className="text-[8px] font-extrabold text-red-600 uppercase tracking-widest bg-red-50 border border-red-100 px-1 py-0.2 rounded block text-center">
                                                                ⚠️ TRỄ HẠN
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-slate-400">---</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="mb-8 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-wider flex items-center gap-2">
                            <Activity size={14} className="text-slate-400" />
                            {workflow.title}
                        </h3>
                        <div className="relative flex items-center justify-between overflow-x-auto py-4 px-2 min-w-[700px] custom-scrollbar gap-2">
                            {workflow.steps.map((step, idx) => { const s = step as any;
                                const isLast = idx === workflow.steps.length - 1;
                                let circleClass = "";
                                let lineClass = "";
                                let textClass = "";
                                let iconNode = null;

                                if (s.status === 'completed') {
                                    circleClass = "bg-emerald-50 border-emerald-500 text-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.2)]";
                                    lineClass = "bg-emerald-500";
                                    textClass = "text-emerald-700 font-bold";
                                    iconNode = <CheckCircle2 size={16} />;
                                } else if (s.status === 'current') {
                                    circleClass = "bg-blue-50 border-blue-600 text-blue-700 ring-4 ring-blue-100 shadow-[0_0_12px_rgba(37,99,235,0.4)] animate-pulse";
                                    lineClass = "bg-gray-200";
                                    textClass = "text-blue-700 font-extrabold scale-105 transform origin-left";
                                    iconNode = <Loader2 size={16} className="animate-spin" />;
                                } else {
                                    circleClass = "bg-gray-50 border-gray-200 text-gray-400";
                                    lineClass = "bg-gray-100";
                                    textClass = "text-gray-400 font-medium";
                                    iconNode = <Circle size={14} className="opacity-40" />;
                                }

                                const execDate = getExecutionDate(s.label, s.overallStatus);

                                return (
                                    <div key={idx} className="flex-1 flex items-center relative">
                                        {/* Step body */}
                                        <div className="flex flex-col items-center flex-1 z-10">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${circleClass}`}>
                                                {iconNode}
                                            </div>
                                            <div className="text-center mt-2.5 max-w-[120px]">
                                                <p className={`text-xs truncate transition-all leading-tight ${textClass}`} title={s.label}>
                                                    {s.label}
                                                </p>
                                                <span className={`text-[10px] mt-0.5 inline-block px-1.5 py-0.5 rounded-full font-bold ${
                                                    s.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                                    s.status === 'current' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-400'
                                                }`}>
                                                    {s.duration}
                                                </span>
                                                {s.status === 'completed' && execDate ? (
                                                    <p className="text-[9px] text-emerald-600 font-extrabold mt-1 leading-none" title={`Thực hiện lúc: ${formatDate(execDate)}`}>
                                                        {formatDate(execDate)}
                                                    </p>
                                                ) : s.deadlineDate ? (
                                                    <p className={`text-[9px] font-bold mt-1 leading-none ${s.status === 'current' ? 'text-blue-600 animate-pulse' : 'text-gray-400'}`} title={`Hạn chót bước: ${formatDate(s.deadlineDate.toISOString())}`}>
                                                        Hạn: {formatDate(s.deadlineDate.toISOString())}
                                                    </p>
                                                ) : (
                                                    <p className="text-[9px] text-gray-400 mt-1 leading-none">---</p>
                                                )}
                                                {s.desc && (
                                                    <p className="text-[9px] text-gray-400 italic mt-1 leading-none max-w-[100px] mx-auto truncate" title={s.desc}>
                                                        {s.desc}
                                                    </p>
                                                )}

                                                {/* Hiển thị cán bộ thực hiện/được giao */}
                                                <div className="mt-1.5 px-1 py-0.5 bg-slate-100 rounded border border-slate-200/50 max-w-[110px] mx-auto">
                                                    <p className="text-[9px] text-slate-600 font-bold truncate" title={`Cán bộ được giao: ${getStepAssigneeName(s.label)}`}>
                                                        👤 {getStepAssigneeName(s.label) || "Chưa giao"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Connector line to next step */}
                                        {!isLast && (
                                            <div className="absolute top-[18px] left-1/2 right-[-50%] h-[2px] z-0 pointer-events-none pr-4">
                                                <div className={`h-full w-full transition-all duration-300 ${lineClass}`} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* COLUMN 1: THÔNG TIN CHUNG */}
                <div className="space-y-6">
                    {/* KHÁCH HÀNG */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-xs font-bold text-blue-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-blue-600 pl-2">
                            <UserIcon size={16}/> Thông tin chủ hồ sơ
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Chủ sử dụng</label>
                                <p className="text-base font-bold text-gray-800">{record.customerName}</p>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Số điện thoại</label>
                                <p className="text-base font-bold text-gray-800">{record.phoneNumber || '---'}</p>
                            </div>
                            {record.customerAddress && (
                                <div>
                                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Địa chỉ thường trú</label>
                                    <p className="text-sm font-bold text-gray-800">{record.customerAddress}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ĐỊA CHÍNH */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-xs font-bold text-green-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-green-600 pl-2">
                            <MapPin size={16}/> Thông tin địa chính
                        </h3>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Xã/Phường</label>
                                <p className="font-bold text-gray-800 text-sm">{getNormalizedWard(record.ward)}</p>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Tờ bản đồ</label>
                                <p className="font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-center">{record.mapSheet || '-'}</p>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Thửa đất</label>
                                <p className="font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-center">{record.landPlot || '-'}</p>
                            </div>
                        </div>
                        {record.address && (
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Địa chỉ chi tiết</label>
                                <p className="text-sm font-bold text-gray-800">{record.address}</p>
                            </div>
                        )}
                    </div>

                    {/* NGƯỜI XỬ LÝ */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-2">Người xử lý hồ sơ</label>
                        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                <UserIcon size={16}/>
                            </div>
                            <span className="font-bold text-sm text-gray-700">{getEmployeeName(record.assignedTo)}</span>
                        </div>

                        {record.status === RecordStatus.PENDING_CHECK || record.status === RecordStatus.CHECKED ? (
                            <div className="mt-4">
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-2">Người kiểm tra</label>
                                <div className="flex items-center gap-3 bg-orange-50 p-3 rounded-lg border border-orange-100">
                                    <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center text-orange-600">
                                        <UserIcon size={16}/>
                                    </div>
                                    <span className="font-bold text-sm text-orange-800">{getEmployeeName(record.checkedBy)}</span>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* REMINDER */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-blue-600 uppercase flex items-center gap-2">
                                <Bell size={16} /> Hẹn giờ nhắc việc
                            </h4>
                            <button 
                                onClick={handleSaveReminder} 
                                disabled={isSavingReminder}
                                className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50 font-bold transition-all"
                            >
                                {isSavingReminder ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Lưu
                            </button>
                        </div>
                        <input 
                            type="datetime-local" 
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                            value={reminderDate}
                            onChange={(e) => setReminderDate(e.target.value)}
                        />
                    </div>

                    {/* PERSONAL NOTE */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase">
                                <StickyNote size={16} />
                                <span>Ghi chú cá nhân</span>
                            </div>
                            <button 
                                onClick={handleSavePersonalNote} 
                                disabled={isSavingNote}
                                className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded flex items-center gap-1 hover:bg-blue-700 disabled:opacity-50 font-bold transition-all"
                            >
                                {isSavingNote ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                                Lưu
                            </button>
                        </div>
                        <textarea
                            rows={3}
                            className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="Nhập ghi chú riêng của bạn..."
                            value={personalNote}
                            onChange={(e) => setPersonalNote(e.target.value)}
                        />
                    </div>
                </div>

                {/* COLUMN 2: CHI TIẾT & TÀI CHÍNH */}
                <div className="space-y-6">
                    {/* NỘI DUNG */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
                        <h3 className="text-xs font-bold text-purple-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-purple-600 pl-2">
                            <FileText size={16}/> Nội dung chi tiết
                        </h3>
                        
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-gray-800 text-sm font-medium mb-6 min-h-[80px]">
                            {record.content || 'Không có nội dung chi tiết.'}
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Số trích đo</label>
                                <p className="text-sm font-bold text-gray-800">{record.measurementNumber || '---'}</p>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Số trích lục</label>
                                <p className="text-sm font-bold text-gray-800">{record.excerptNumber || '---'}</p>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                                <div className="bg-blue-200 p-1.5 rounded text-blue-700"><Receipt size={16}/></div>
                                <div>
                                    <label className="text-[10px] text-blue-500 uppercase font-bold block">
                                        {record.receiptType === 'invoice' ? 'Số Hóa Đơn' : 'Số Biên Lai'}
                                    </label>
                                    <p className="text-sm font-bold text-blue-800">{record.receiptNumber || '---'}</p>
                                </div>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex items-center gap-3">
                                <div className="bg-green-200 p-1.5 rounded text-green-700"><DollarSign size={16}/></div>
                                <div>
                                    <label className="text-[10px] text-green-500 uppercase font-bold block">
                                        {record.recordType === 'Cung cấp tài liệu đất đai' ? 'Giá trị hồ sơ' : 'Giá trị hợp đồng'}
                                    </label>
                                    <p className="text-sm font-bold text-green-800">
                                        {record.recordType === 'Cung cấp tài liệu đất đai' 
                                            ? '310.000 đ' 
                                            : (contractPrice !== null && contractPrice !== undefined ? contractPrice.toLocaleString('vi-VN') + ' đ' : '---')}
                                    </p>
                                </div>
                            </div>
                            {record.paymentAmount !== null && record.paymentAmount !== undefined && (
                                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-center gap-3 col-span-2">
                                    <div className="bg-emerald-200 p-1.5 rounded text-emerald-700"><DollarSign size={16}/></div>
                                    <div>
                                        <label className="text-[10px] text-emerald-600 uppercase font-bold block">Số tiền thực thu</label>
                                        <p className="text-sm font-bold text-emerald-800">{record.paymentAmount.toLocaleString('vi-VN')} đ</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* GIÁ TRỊ THANH LÝ */}
                        {liquidationInfo && (
                            <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 flex items-center gap-3">
                                    <div className="bg-orange-200 p-1.5 rounded text-orange-700"><Calculator size={16}/></div>
                                    <div>
                                        <label className="text-[10px] text-orange-600 uppercase font-bold block">{liquidationInfo.content}</label>
                                        <p className="text-sm font-bold text-orange-800">{liquidationInfo.amount.toLocaleString('vi-VN')} đ</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Chi tiết tách thửa */}
                        {contractSplitItems && contractSplitItems.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                <span className="text-[10px] font-bold text-gray-400 block mb-2 uppercase">Chi tiết tách thửa</span>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                    {contractSplitItems.map((item, idx) => (
                                        <div key={idx} className="text-xs flex justify-between bg-gray-50 p-2 rounded border border-gray-100">
                                            <span className="text-gray-700">
                                                <span className="font-bold text-blue-600 mr-1">Thửa {idx + 1}:</span> 
                                                <span className="font-bold">{item.area || 0} m²</span>
                                                {item.serviceName ? <span className="text-gray-500 ml-1 italic truncate max-w-[150px] inline-block align-bottom">- {item.serviceName}</span> : ''}
                                            </span>
                                            <span className="font-mono font-bold text-green-700 shrink-0 ml-2">
                                                {((item.price || 0) * (item.quantity || 0)).toLocaleString('vi-VN')} đ
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Ghi chú nội bộ */}
                        {record.privateNotes && (
                            <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                    <div className="flex items-center gap-2 mb-1 text-yellow-800 font-bold text-xs">
                                        <Info size={14} />
                                        <span>Ghi chú nội bộ</span>
                                    </div>
                                    <p className="text-yellow-900 text-xs italic">"{record.privateNotes}"</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* COLUMN 3: TIẾN ĐỘ & NHẮC VIỆC */}
                <div className="space-y-6">
                    {/* KHẨN CẤP: TRẢ CHỜ DÂN BỔ SUNG */}
                    {isRegType(record.recordType) && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-5 space-y-3.5">
                            <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2 border-l-4 border-amber-500 pl-2">
                                <AlertTriangle size={15} className="text-amber-500 animate-pulse" />
                                <span>Yêu cầu bổ sung hồ sơ</span>
                            </h4>

                            {record.status === RecordStatus.PENDING_SUPPLEMENT ? (
                                <div className="space-y-3">
                                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900 text-xs">
                                        <p className="font-bold uppercase mb-1 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                                            Chờ dân bổ sung giấy tờ
                                        </p>
                                        <p className="leading-relaxed mt-1.5">
                                            <span className="font-semibold text-amber-800">Nội dung yêu cầu:</span>{" "}
                                            {record.supplementReason || record.defectReason || 'Chưa có chi tiết yêu cầu.'}
                                        </p>
                                        {record.supplementLegalBasis && (
                                            <p className="mt-1">
                                                <span className="font-semibold text-amber-800">Căn cứ pháp lý:</span>{" "}
                                                {record.supplementLegalBasis}
                                            </p>
                                        )}
                                        {record.supplementDate && (
                                            <p className="text-[10px] text-amber-600 font-medium mt-2">
                                                Ngày chuyển: {formatDate(record.supplementDate)}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setResumeMode('supplement');
                                            setIsResumeDialogOpen(true);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                                    >
                                        <RotateCcw size={14} /> Tiếp nhận lại hồ sơ bổ sung
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-[11px] text-gray-500 leading-normal">
                                        Đóng băng tiến độ xử lý và chuyển hồ sơ về trạng thái "Chờ dân bổ sung" để làm công văn trả dân tại Trung tâm hành chính công.
                                    </p>
                                    <button
                                        onClick={() => {
                                            setSupplementReasonInput('');
                                            setSupplementLegalBasisInput('');
                                            setIsSupplementDialogOpen(true);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                                    >
                                        <AlertTriangle size={14} /> Trả hồ sơ chờ dân khắc phục
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TIMELINE */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-indigo-600 px-5 py-3 flex items-center gap-2">
                            <CalendarClock size={16} className="text-white"/>
                            <span className="text-xs font-bold text-white uppercase">{isGCN ? "Quy trình" : "Tiến độ & Thời gian"}</span>
                        </div>
                        
                        <div className="p-6 text-center border-b border-gray-100">
                             <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Hạn trả kết quả</label>
                             <p className="text-2xl font-black text-gray-800">{formatDate(record.deadline)}</p>
                             <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded mt-2 inline-block">
                                Ngày nhận: {formatDate(record.receivedDate)}
                             </span>
                        </div>

                        <div className="p-6 space-y-0">
                             {record.status === RecordStatus.REJECTED && (
                                 <TimelineItem 
                                     date={record.rejectDate || record.completedDate} 
                                     label="HỒ SƠ TRẢ" 
                                     icon={AlertTriangle}
                                     colorClass={{text: 'text-red-700 font-bold', border: 'border-red-600 bg-red-50', bg: 'bg-red-600'}}
                                     subText={`Lý do: ${record.rejectReason || 'Không có lý do chi tiết'} | Người được giao: ${(() => {
                                         const assigned = employees.find(e => e.id === record.assignedTo);
                                         return assigned ? `${assigned.name} (${assigned.position || 'Nhân viên'})` : 'Chưa giao';
                                     })()}`}
                                 />
                             )}

                             <TimelineItem 
                                date={record.receivedDate} 
                                label="NHẬN HỒ SƠ" 
                                icon={UserIcon}
                                colorClass={{text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600'}}
                                subText={record.receivedBy ? (() => {
                                    const receiver = users.find(u => u.employeeId === record.receivedBy);
                                    if (!receiver) return undefined;
                                    const emp = employees.find(e => e.id === receiver.employeeId);
                                    return `Người nhận: ${receiver.name} (${emp?.position || 'Nhân viên'})`;
                                })() : undefined}
                            />

                             <TimelineItem 
                                date={record.assignedDate} 
                                label="GIAO NHÂN VIÊN" 
                                icon={UserIcon}
                                colorClass={{text: 'text-blue-700', border: 'border-blue-600', bg: 'bg-blue-600'}}
                                subText={record.assignedTo ? (() => {
                                    const assigned = employees.find(e => e.id === record.assignedTo);
                                    if (!assigned) return undefined;
                                    return `Nhân viên thực hiện: ${assigned.name} (${assigned.position || 'Nhân viên'})`;
                                })() : undefined}
                            />
                            
                             <TimelineItem 
                                date={record.completedWorkDate} 
                                forceActive={isWorkDone}
                                label="ĐÃ THỰC HIỆN" 
                                icon={CheckSquare}
                                colorClass={{text: 'text-cyan-700', border: 'border-cyan-600', bg: 'bg-cyan-600'}}
                                subText={record.completedWorkDate && record.assignedTo ? (() => {
                                    const assigned = employees.find(e => e.id === record.assignedTo);
                                    if (!assigned) return undefined;
                                    return `Nhân viên hoàn thành: ${assigned.name} (${assigned.position || 'Nhân viên'})`;
                                })() : undefined}
                            />

                            {/* Ẩn mốc kiểm tra cho một số loại hồ sơ */}
                            {!(record.recordType === 'Cung cấp tài liệu đất đai' || record.recordType === 'Sao lục' || record.recordType === 'Công văn') && (
                                <>
                                    <TimelineItem 
                                        date={record.pendingCheckDate} 
                                        forceActive={isPendingCheckActive}
                                        label="TRÌNH KIỂM TRA" 
                                        icon={Send}
                                        colorClass={{text: 'text-orange-700', border: 'border-orange-600', bg: 'bg-orange-600'}}
                                        subText={record.pendingCheckDate ? (() => {
                                            const assigned = record.assignedTo ? employees.find(e => e.id === record.assignedTo) : null;
                                            const checker = record.checkedBy ? employees.find(e => e.id === record.checkedBy) : null;
                                            let text = '';
                                            if (assigned) text += `Người trình: ${assigned.name}`;
                                            if (checker) text += (text ? ` \n` : '') + `Người kiểm tra: ${checker.name} (${checker.position || 'Tổ trưởng'})`;
                                            return text || undefined;
                                        })() : undefined}
                                    />

                                    <TimelineItem 
                                        date={record.checkedDate} 
                                        forceActive={isCheckedActive}
                                        label="ĐÃ KIỂM TRA" 
                                        icon={CheckSquare}
                                        colorClass={{text: 'text-orange-700', border: 'border-orange-600', bg: 'bg-orange-600'}}
                                        subText={record.checkedDate && record.checkedBy ? (() => {
                                            const checker = employees.find(e => e.id === record.checkedBy);
                                            if (!checker) return undefined;
                                            return `Người kiểm tra: ${checker.name} (${checker.position || 'Tổ trưởng'})`;
                                        })() : undefined}
                                    />
                                </>
                            )}

                             <TimelineItem 
                                date={record.submissionDate} 
                                forceActive={isPendingSignActive}
                                label="TRÌNH KÝ" 
                                icon={Send}
                                colorClass={{text: 'text-purple-700', border: 'border-purple-600', bg: 'bg-purple-600'}}
                                subText={record.submissionDate ? (() => {
                                    const assigned = record.assignedTo ? employees.find(e => e.id === record.assignedTo) : null;
                                    const director = record.submittedTo ? (users.find(u => u.employeeId === record.submittedTo) || employees.find(e => e.id === record.submittedTo)) : null;
                                    let text = '';
                                    if (assigned) text += `Người trình: ${assigned.name}`;
                                    if (director) text += (text ? ` \n` : '') + `Người nhận trình: ${director.name} (${(director as any).position || 'Lãnh đạo'})`;
                                    return text || undefined;
                                })() : undefined}
                            />
                            
                             <TimelineItem 
                                date={record.approvalDate} 
                                forceActive={isSignedActive}
                                label="KÝ DUYỆT" 
                                icon={FileSignature}
                                colorClass={{text: 'text-indigo-700', border: 'border-indigo-600', bg: 'bg-indigo-600'}}
                                subText={record.approvalDate && record.submittedTo ? (() => {
                                    const director = users.find(u => u.employeeId === record.submittedTo) || employees.find(e => e.id === record.submittedTo);
                                    if (!director) return undefined;
                                    return `Người ký duyệt: ${director.name} (${(director as any).position || 'Lãnh đạo'})`;
                                })() : undefined}
                            />
                            
                             {record.status !== RecordStatus.REJECTED && (
                                 <TimelineItem 
                                     date={record.completedDate} 
                                     label={record.status === RecordStatus.WITHDRAWN ? "RÚT HỒ SƠ" : "HOÀN THÀNH"} 
                                     icon={CheckSquare}
                                     isLast={false}
                                     colorClass={{text: 'text-green-700', border: 'border-green-600', bg: 'bg-green-600'}}
                                     subText={record.completedDate && record.exportBatch ? `Chốt danh sách đợt: ĐỢT ${record.exportBatch}` : undefined}
                                 />
                             )}
                            
                             <TimelineItem 
                                date={record.resultReturnedDate} 
                                label="TRẢ KẾT QUẢ" 
                                icon={FileCheck}
                                isLast={true}
                                colorClass={{text: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-600'}}
                                subText={record.resultReturnedDate ? (() => {
                                    let details = '';
                                    if (record.receiverName) details += `Người nhận: ${record.receiverName}`;
                                    if (record.paymentAmount) details += (details ? `, ` : '') + `Lệ phí: ${record.paymentAmount.toLocaleString('vi-VN')}đ`;
                                    return details || undefined;
                                })() : undefined}
                            />
                        </div>
                    </div>

                    {/* EXPORT INFO */}
                    {record.exportBatch && (
                         <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col items-center text-center">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-2">
                                <Info size={16}/>
                            </div>
                            <p className="text-sm font-bold text-green-800">Hồ sơ đã được xuất danh sách Đợt {record.exportBatch}</p>
                            <p className="text-xs text-green-600 mt-1">Ngày: {formatDate(record.exportDate)}</p>
                         </div>
                    )}
                </div>

            </div>
        </div>

        <DocxPreviewModal
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            docxBlob={previewBlob}
            fileName={previewFileName}
        />
        {systemReceiptData && (
            <SystemReceiptTemplate 
                data={systemReceiptData} 
                receivingWard={systemReceiptData.ward || employees.find(e => e.id === currentUser?.employeeId)?.managedWards?.[0] || 'Tân Khai'}
                onClose={() => setSystemReceiptData(null)} 
                currentUser={currentUser}
                employees={employees}
            />
        )}
        {isAnnexOpen && record && (
            <SystemAnnexTemplate 
                data={record} 
                employees={employees}
                onClose={() => setIsAnnexOpen(false)}
            />
        )}
      </div>

      {isResumeDialogOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl border border-blue-150 w-full max-w-md overflow-hidden animate-fade-in-up">
                  <div className="bg-blue-600 px-5 py-3 text-white font-bold text-sm flex items-center gap-2">
                       <AlertTriangle size={16} />
                       <span>TIẾP NHẬN LẠI HỒ SƠ</span>
                  </div>
                  <div className="p-5">
                      <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                          Hồ sơ này đang được đánh dấu có sai sót (Trình trả dân). Bạn muốn tiếp nhận lại hồ sơ bổ sung như thế nào?
                      </p>

                      <div className="space-y-3">
                          <div 
                              onClick={() => setResumeMode('supplement')}
                              className={`block p-3 border rounded-lg cursor-pointer transition-all ${
                                  resumeMode === 'supplement' 
                                  ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' 
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                              <div className="flex items-start gap-2.5">
                                  <input 
                                      type="radio" 
                                      name="resumeMode" 
                                      checked={resumeMode === 'supplement'} 
                                      onChange={() => setResumeMode('supplement')} 
                                      className="mt-1 text-blue-600 focus:ring-blue-500" 
                                  />
                                  <div>
                                      <p className="text-xs font-bold text-slate-800">Tiếp nhận lại (Có Bổ sung hồ sơ)</p>
                                      <p className="text-[10.5px] text-slate-500 mt-1 leading-relaxed">
                                          Hủy đánh dấu sai sót, cập nhật ngày nhận là <span className="font-semibold text-blue-600">Hôm nay</span>, và <span className="font-semibold text-blue-600">tính lại thời hạn trả từ đầu</span> cho các bước tiếp theo.
                                      </p>
                                  </div>
                              </div>
                          </div>

                          <div 
                              onClick={() => setResumeMode('simple')}
                              className={`block p-3 border rounded-lg cursor-pointer transition-all ${
                                  resumeMode === 'simple' 
                                  ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' 
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                              <div className="flex items-start gap-2.5">
                                  <input 
                                      type="radio" 
                                      name="resumeMode" 
                                      checked={resumeMode === 'simple'} 
                                      onChange={() => setResumeMode('simple')} 
                                      className="mt-1 text-blue-600 focus:ring-blue-500" 
                                  />
                                  <div>
                                      <p className="text-xs font-bold text-slate-800">Hủy đánh dấu sai sót (Giữ nguyên ngày)</p>
                                      <p className="text-[10.5px] text-slate-500 mt-1 leading-relaxed">
                                          Chỉ hủy bỏ trạng thái lỗi hồ sơ để đưa về luồng xử lý bình thường. Giữ nguyên ngày nhận và thời hạn trả gốc.
                                      </p>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-5">
                          <button
                              onClick={() => setIsResumeDialogOpen(false)}
                              className="px-3.5 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded hover:bg-gray-200 transition-all border border-gray-200"
                          >
                              Hủy bỏ
                          </button>
                          <button
                              onClick={handleConfirmResume}
                              disabled={isSavingResume}
                              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
                          >
                              {isSavingResume ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                              Xác nhận tiếp nhận
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isDefectDialogOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl border border-red-150 w-full max-w-md overflow-hidden animate-fade-in-up">
                  <div className="bg-red-655 px-5 py-3 text-white font-bold text-sm flex items-center gap-2" style={{ backgroundColor: '#dc2626' }}>
                       <AlertTriangle size={16} />
                       <span>GHI NHẬN SAI SÓT & TRẢ HỒ SƠ</span>
                  </div>
                  <div className="p-5">
                      <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                          Vui lòng ghi rõ lý do sai sót chi tiết bên dưới. Hồ sơ này sẽ tiếp tục đi qua các bước kiểm tra, ký duyệt như bình thường nhưng kết quả cuối cùng sẽ được bàn giao dưới dạng <span className="font-bold text-red-600">"Hồ sơ trả"</span> để theo dõi lưu quy trình.
                      </p>
                      
                      <label className="text-xs font-bold text-gray-700 block mb-1">Chi tiết lý do / sai sót:</label>
                      <textarea
                          className="w-full border border-gray-300 rounded-md p-2.5 text-xs focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none h-28"
                          placeholder="Mô tả sai sót phát hiện được và lý do trả hồ sơ..."
                          value={defectReasonInput}
                          onChange={(e) => setDefectReasonInput(e.target.value)}
                      />
                      
                      <div className="flex justify-end gap-2 mt-4">
                          <button
                              onClick={() => { setIsDefectDialogOpen(false); setDefectReasonInput(''); }}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded hover:bg-gray-200 transition-all border border-gray-200"
                          >
                              Hủy bỏ
                          </button>
                          <button
                              onClick={handleConfirmDefect}
                              disabled={isSavingDefect || !defectReasonInput.trim()}
                              className="px-3.5 py-1.5 bg-red-655 text-white text-xs font-bold rounded hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
                              style={{ backgroundColor: '#dc2626' }}
                          >
                              {isSavingDefect ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
                              Xác nhận trả
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isSupplementDialogOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl border border-amber-150 w-full max-w-md overflow-hidden animate-fade-in-up">
                  <div className="bg-amber-500 px-5 py-3 text-white font-bold text-sm flex items-center gap-2">
                       <AlertTriangle size={16} />
                       <span>TRẢ HỒ SƠ CHỜ DÂN BỔ SUNG / KHẮC PHỤC</span>
                  </div>
                  <div className="p-5 space-y-4">
                      <p className="text-xs text-gray-600 leading-relaxed">
                          Nhập lý do sai sót hoặc các giấy tờ người dân cần bổ sung chi tiết bên dưới. Hệ thống sẽ tạm thời đóng băng tiến độ và chuyển trạng thái hồ sơ thành <span className="font-bold text-amber-600">"Chờ dân bổ sung"</span>.
                      </p>
                      
                      <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1">Nội dung yêu cầu bổ sung / sai sót (*):</label>
                          <textarea
                              className="w-full border border-gray-300 rounded-md p-2.5 text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none h-24 bg-white"
                              placeholder="Nhập nội dung cần bổ sung, chỉnh sửa..."
                              value={supplementReasonInput}
                              onChange={(e) => setSupplementReasonInput(e.target.value)}
                          />
                      </div>

                      <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1">Căn cứ pháp lý (nếu có):</label>
                          <input
                              type="text"
                              className="w-full border border-gray-300 rounded-md p-2.5 text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white font-medium"
                              placeholder="Ví dụ: Khoản 2 Điều 10 Luật Đất đai năm 2024..."
                              value={supplementLegalBasisInput}
                              onChange={(e) => setSupplementLegalBasisInput(e.target.value)}
                          />
                      </div>
                      
                      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                          <button
                              onClick={() => { setIsSupplementDialogOpen(false); setSupplementReasonInput(''); setSupplementLegalBasisInput(''); }}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded hover:bg-gray-200 transition-all border border-gray-200 cursor-pointer"
                          >
                              Hủy bỏ
                          </button>
                          <button
                              onClick={handleConfirmSupplement}
                              disabled={isSavingSupplement || !supplementReasonInput.trim()}
                              className="px-3.5 py-1.5 bg-amber-500 text-white text-xs font-bold rounded hover:bg-amber-600 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                          >
                              {isSavingSupplement ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
                              Xác nhận trả
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
