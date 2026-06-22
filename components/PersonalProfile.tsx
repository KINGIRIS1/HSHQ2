
import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, RecordStatus, User, Employee, RolePermissions, DEFAULT_ROLE_PERMISSIONS } from '../types';
import StatusBadge from './StatusBadge';
import { Briefcase, ArrowRight, CheckCircle, Clock, Send, AlertTriangle, UserCog, ChevronLeft, ChevronRight, AlertCircle, Search, ArrowUp, ArrowDown, ArrowUpDown, Bell, CalendarClock, FileCheck, Map, CheckSquare, ClipboardList, FileDown, RotateCcw, CornerUpLeft } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { getShortRecordType } from '../constants';
import { confirmAction } from '../utils/appHelpers';
import { updateRecordApi } from '../services/api';
import { fetchArchiveRecords, ArchiveRecord, saveArchiveRecord } from '../services/apiArchive';
import SubmitModal from './receive-record/SubmitModal';
import ReturnReasonModal from './receive-record/ReturnReasonModal';
import SystemAnnexTemplate from './receive-record/SystemAnnexTemplate';
import { generateDocxBlobAsync, hasTemplate, STORAGE_KEYS } from '../services/docxService';
import saveAs from 'file-saver';

interface PersonalProfileProps {
  user: User;
  records: RecordFile[];
  isDirector?: boolean;
  users: User[];
  employees: Employee[];
  rolePermissions?: RolePermissions;
  onUpdateStatus: (record: RecordFile, newStatus: RecordStatus) => void;
  onUpdateRecord?: (record: RecordFile) => Promise<RecordFile | null>;
  onViewRecord: (record: RecordFile) => void;
  onCreateLiquidation?: (record: RecordFile) => void; 
  onMapCorrection?: (record: RecordFile) => void; // New Handler Prop
}

function removeVietnameseTones(str: string): string {
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

const PersonalProfile: React.FC<PersonalProfileProps> = ({ user, records, isDirector, users, employees, rolePermissions, onUpdateStatus, onUpdateRecord, onViewRecord, onCreateLiquidation, onMapCorrection }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'pending_check' | 'pending_sign' | 'finished' | 'reminder'>(isDirector ? 'pending_sign' : 'pending');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof RecordFile; direction: 'asc' | 'desc' }>({
    key: 'deadline',
    direction: 'desc' 
  });

  const [archiveRecords, setArchiveRecords] = useState<ArchiveRecord[]>([]);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitCheckModalOpen, setIsSubmitCheckModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [submitTargetRecords, setSubmitTargetRecords] = useState<RecordFile[]>([]);
  const [returnTargetRecords, setReturnTargetRecords] = useState<RecordFile[]>([]);
  const [isAnnexModalOpen, setIsAnnexModalOpen] = useState(false);
  const [annexTargetRecord, setAnnexTargetRecord] = useState<RecordFile | null>(null);

  useEffect(() => {
    const loadArchive = async () => {
        const saoluc = await fetchArchiveRecords('saoluc');
        const congvan = await fetchArchiveRecords('congvan');
        setArchiveRecords([...saoluc, ...congvan]);
    };
    loadArchive();
  }, []);

  const myRecords = useMemo(() => {
    const mainRecords = records.filter(r => {
        if (!user.employeeId) return false;
        if (isDirector) {
            return r.submittedTo === user.employeeId || r.assignedTo === user.employeeId;
        }
        // Nếu là người kiểm tra, họ có thể thấy hồ sơ được giao cho họ HOẶC hồ sơ trình cho họ kiểm tra
        const isCheckerUser = employees.find(e => e.id === user.employeeId)?.position?.toLowerCase().includes('tổ') && (employees.find(e => e.id === user.employeeId)?.department?.toLowerCase().includes('đo đạc') || employees.find(e => e.id === user.employeeId)?.department?.toLowerCase().includes('kỹ thuật'));
        if (isCheckerUser) {
            return r.assignedTo === user.employeeId || r.checkedBy === user.employeeId;
        }
        return r.assignedTo === user.employeeId;
    });
    
    const mappedArchives = archiveRecords
        .filter(r => {
            if (!user.employeeId) return false;
            if (isDirector) {
                return r.data?.submitted_to === user.employeeId || r.data?.assigned_to === user.employeeId; 
            }
            const isCheckerUser = employees.find(e => e.id === user.employeeId)?.position?.toLowerCase().includes('tổ') && (employees.find(e => e.id === user.employeeId)?.department?.toLowerCase().includes('đo đạc') || employees.find(e => e.id === user.employeeId)?.department?.toLowerCase().includes('kỹ thuật'));
            if (isCheckerUser) {
                return r.data?.assigned_to === user.employeeId || r.data?.checked_by === user.employeeId;
            }
            return r.data?.assigned_to === user.employeeId;
        })
        .map(r => {
            // Map status
            let status = RecordStatus.RECEIVED;
            if (r.status === 'assigned') status = RecordStatus.ASSIGNED;
            else if (r.status === 'executed') status = RecordStatus.COMPLETED_WORK;
            else if (r.status === 'pending_sign') status = RecordStatus.PENDING_SIGN;
            else if (r.status === 'signed') status = RecordStatus.SIGNED;
            else if (r.status === 'completed') status = RecordStatus.RETURNED;

            return {
                id: r.id,
                code: r.so_hieu,
                customerName: r.noi_nhan_gui, // Sao lục: Chủ sử dụng, Công văn: Cơ quan phát hành
                recordType: r.type === 'saoluc' ? 'Sao lục' : 'Công văn',
                content: r.trich_yeu,
                receivedDate: r.ngay_thang,
                deadline: r.data?.hen_tra,
                status: status,
                assignedTo: r.data?.assigned_to,
                ward: r.data?.xa_phuong,
                submissionDate: r.type === 'congvan' ? r.ngay_thang : undefined, // Example mapping
                // Fill other required fields with defaults or null
                phoneNumber: null,
                cccd: null,
                landPlot: r.data?.thua_dat,
                mapSheet: r.data?.to_ban_do,
                area: null,
                address: null,
                group: null,
                assignedDate: r.data?.assigned_date,
                approvalDate: null,
                completedDate: null,
                notes: null,
                privateNotes: null,
                personalNotes: null,
                authorizedBy: null,
                authDocType: null,
                otherDocs: null,
                exportBatch: null,
                exportDate: null,
                measurementNumber: null,
                excerptNumber: null,
                reminderDate: null,
                lastRemindedAt: null,
                receiptNumber: null,
                receiverName: null,
                resultReturnedDate: null,
                needsMapCorrection: false
            } as RecordFile;
        });

    return [...mainRecords, ...mappedArchives];
  }, [records, archiveRecords, user.employeeId]);
  
  const isChecker = useMemo(() => {
      // Check via role permissions
      if (rolePermissions && rolePermissions[user.role]) {
          const perms = rolePermissions[user.role];
          if (perms.includes('*') || perms.includes('CHECK_RECORDS')) {
              return true;
          }
      } else {
          // Fallback to DEFAULT_ROLE_PERMISSIONS
          const perms = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
          if (perms.includes('*') || perms.includes('CHECK_RECORDS')) {
              return true;
          }
      }
      if (!user.employeeId) return false;
      const emp = employees.find(e => e.id === user.employeeId);
      if (!emp) return false;
      const isDoDac = emp.department?.toLowerCase().includes('đo đạc') || emp.department?.toLowerCase().includes('kỹ thuật');
      const isLeader = emp.position?.toLowerCase().includes('tổ trưởng') || emp.position?.toLowerCase().includes('tổ phó');
      return isDoDac && isLeader;
  }, [user.employeeId, user.role, employees, rolePermissions]);

  const isMeasurementTeam = useMemo(() => {
      if (!user.employeeId) return false;
      const emp = employees.find(e => e.id === user.employeeId);
      if (!emp) return false;
      return emp.department?.toLowerCase().includes('đo đạc') || emp.department?.toLowerCase().includes('kỹ thuật') || emp.position?.toLowerCase().includes('đo đạc');
  }, [user.employeeId, employees]);

  useEffect(() => {
      if (isChecker && activeTab !== 'pending_check' && activeTab !== 'finished') {
          setActiveTab('pending_check');
      }
  }, [isChecker]);

  // 1. Hồ sơ Đang thực hiện (ASSIGNED, IN_PROGRESS, COMPLETED_WORK)
  const pendingRecords = useMemo(() => {
      let list = myRecords.filter(r => r.status === RecordStatus.ASSIGNED || r.status === RecordStatus.IN_PROGRESS || r.status === RecordStatus.COMPLETED_WORK);
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 2. Hồ sơ Đã thực hiện (Bỏ qua - Trống)
  const completedWorkRecords = useMemo(() => {
      return [];
  }, []);

  // 3. Hồ sơ Chờ kiểm tra (PENDING_CHECK) - Dành cho Tổ trưởng/Tổ phó
  const pendingCheckRecords = useMemo(() => {
      let list = myRecords.filter(r => r.status === RecordStatus.PENDING_CHECK || r.status === RecordStatus.CHECKED);
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 4. Hồ sơ Chờ ký (PENDING_SIGN) - Chuyển thành Tab chính
  const reviewRecords = useMemo(() => {
      let list = myRecords.filter(r => r.status === RecordStatus.PENDING_SIGN);
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 4. Hồ sơ Hoàn thành (SIGNED, HANDOVER, RETURNED, REJECTED, WITHDRAWN)
  const finishedRecords = useMemo(() => {
      let list = myRecords.filter(r => 
          r.status === RecordStatus.SIGNED || 
          r.status === RecordStatus.HANDOVER || 
          r.status === RecordStatus.RETURNED ||
          r.status === RecordStatus.REJECTED ||
          r.status === RecordStatus.WITHDRAWN
      );
      return filterAndSort(list, searchTerm, sortConfig);
  }, [myRecords, searchTerm, sortConfig]);

  // 5. Hồ sơ Có hẹn nhắc việc
  const reminderRecords = useMemo(() => {
      let list = myRecords.filter(r => 
          r.reminderDate && 
          r.status !== RecordStatus.HANDOVER && 
          r.status !== RecordStatus.WITHDRAWN &&
          r.status !== RecordStatus.REJECTED &&
          r.status !== RecordStatus.RETURNED
      );
      // Logic search & sort riêng cho reminder
      if (searchTerm) {
          const lowerSearch = removeVietnameseTones(searchTerm);
          const rawSearch = searchTerm.toLowerCase();
          list = list.filter(r => {
             const nameNorm = removeVietnameseTones(r.customerName || '');
             const codeRaw = (r.code || '').toLowerCase();
             return nameNorm.includes(lowerSearch) || codeRaw.includes(rawSearch);
          });
      }
      return list.sort((a, b) => {
          const timeA = new Date(a.reminderDate!).getTime();
          const timeB = new Date(b.reminderDate!).getTime();
          return timeA - timeB;
      });
  }, [myRecords, searchTerm]);

  // Helper filter & sort chung
  function filterAndSort(list: RecordFile[], term: string, sort: any) {
      if (term) {
          const lowerSearch = removeVietnameseTones(term);
          const rawSearch = term.toLowerCase();
          list = list.filter(r => {
             const nameNorm = removeVietnameseTones(r.customerName || '');
             const codeRaw = (r.code || '').toLowerCase();
             const wardNorm = removeVietnameseTones(r.ward || '');
             return nameNorm.includes(lowerSearch) || codeRaw.includes(rawSearch) || wardNorm.includes(lowerSearch);
          });
      }
      return list.sort((a, b) => {
          const aValue = a[sort.key as keyof RecordFile];
          const bValue = b[sort.key as keyof RecordFile];
          if (!aValue) return 1;
          if (!bValue) return -1;
          if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }

  // Tổng hợp các chỉ số
  const completedTotal = finishedRecords.length;

  // Xác định danh sách hiển thị dựa trên Tab đang chọn
  const displayRecords = 
      activeTab === 'pending' ? pendingRecords : 
      activeTab === 'pending_check' ? pendingCheckRecords :
      activeTab === 'pending_sign' ? reviewRecords :
      activeTab === 'finished' ? finishedRecords :
      reminderRecords;

  const totalPages = Math.ceil(displayRecords.length / itemsPerPage);
  
  const paginatedDisplayRecords = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return displayRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [displayRecords, currentPage, itemsPerPage]);

  const handleSort = (key: keyof RecordFile) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const handleExportExcel = () => {
      const dataToExport = displayRecords.map((r, idx) => ({
          'STT': idx + 1,
          'Mã hồ sơ': r.code,
          'Chủ sử dụng': r.customerName,
          'Số điện thoại': r.phoneNumber || '',
          'CCCD': r.cccd || '',
          'Loại hồ sơ': r.recordType,
          'Ngày nhận': r.receivedDate ? r.receivedDate.split('T')[0] : '',
          'Hẹn trả': r.deadline ? r.deadline.split('T')[0] : '',
          'Trạng thái': r.status,
          'Xã/Phường': r.ward || '',
          'Số tờ': r.mapSheet || '',
          'Số thửa': r.landPlot || '',
          'Diện tích': r.area || '',
          'Địa chỉ': r.address || '',
          'Nội dung': r.content || '',
          'Ngày giao việc': r.assignedDate ? r.assignedDate.split('T')[0] : '',
          'Ngày trình ký': r.submissionDate ? r.submissionDate.split('T')[0] : '',
          'Ngày duyệt': r.approvalDate ? r.approvalDate.split('T')[0] : '',
          'Ngày hoàn thành': r.completedDate ? r.completedDate.split('T')[0] : '',
          'Ngày trả kết quả': r.resultReturnedDate ? r.resultReturnedDate.split('T')[0] : '',
          'Ghi chú': r.notes || '',
          'Ghi chú cá nhân': r.personalNotes || '',
          'Số trích đo': r.measurementNumber || '',
          'Số trích lục': r.excerptNumber || ''
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "HoSoCaNhan");
      XLSX.writeFile(wb, `HoSoCaNhan_${user.name}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // --- ACTIONS ---

  const handleMarkAsDone = async (record: RecordFile) => {
    if (await confirmAction(`Xác nhận đã hoàn thành công việc cho hồ sơ ${record.code}?\nHồ sơ sẽ chuyển sang trạng thái "Đã thực hiện".`)) {
        if (record.recordType === 'Sao lục' || record.recordType === 'Công văn') {
            // Handle Archive Record
            const archiveType = record.recordType === 'Sao lục' ? 'saoluc' : 'congvan';
            // Find original record to get full data if needed, or just update status
            // We need to append history as well.
            
            const historyEntry = {
                action: 'Thực hiện xong',
                status: 'executed',
                timestamp: new Date().toISOString(),
                user: user.name
            };

            // We need to fetch the current record to get its data.history
            // Or we can just use the one from archiveRecords state
            const currentArchive = archiveRecords.find(r => r.id === record.id);
            if (currentArchive) {
                 const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                 const newHistory = [...oldHistory, historyEntry];
                 
                 await saveArchiveRecord({
                     id: record.id,
                     status: 'executed',
                     data: { ...currentArchive.data, history: newHistory }
                 });
                 
                 // Refresh data
                 const saoluc = await fetchArchiveRecords('saoluc');
                 const congvan = await fetchArchiveRecords('congvan');
                 setArchiveRecords([...saoluc, ...congvan]);
            }
        } else {
            // Normal Record
            onUpdateStatus(record, RecordStatus.COMPLETED_WORK);
        }
    }
  };

  const handleMarkAsChecked = async (record: RecordFile) => {
    if (await confirmAction(`Xác nhận đã kiểm tra hồ sơ ${record.code}?\nHồ sơ sẽ chuyển sang trạng thái "Đã kiểm tra".`)) {
        onUpdateStatus(record, RecordStatus.CHECKED);
    }
  };

  const handleForwardToSign = async (record: RecordFile) => {
    setSubmitTargetRecords([record]);
    setIsSubmitModalOpen(true);
  };

  const handleForwardToCheck = async (record: RecordFile) => {
    setSubmitTargetRecords([record]);
    setIsSubmitCheckModalOpen(true);
  };

  const handleConfirmSubmit = async (directorId: string) => {
    try {
        for (const record of submitTargetRecords) {
            if (record.recordType === 'Sao lục' || record.recordType === 'Công văn') {
                 // Handle Archive Record
                const historyEntry = {
                    action: 'Trình ký',
                    status: 'pending_sign',
                    timestamp: new Date().toISOString(),
                    user: user.name
                };

                const currentArchive = archiveRecords.find(r => r.id === record.id);
                if (currentArchive) {
                     const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                     const newHistory = [...oldHistory, historyEntry];
                     
                     await saveArchiveRecord({
                         id: record.id,
                         status: 'pending_sign',
                         data: { ...currentArchive.data, history: newHistory, submitted_to: directorId }
                     });
                }
            } else {
                // Normal Record
                const updatedRecord = {
                    ...record,
                    status: RecordStatus.PENDING_SIGN,
                    submittedTo: directorId,
                    submissionDate: new Date().toISOString(),
                    completedWorkDate: record.completedWorkDate || new Date().toISOString(),
                    checkedDate: (record.status === RecordStatus.PENDING_CHECK || record.status === RecordStatus.CHECKED) ? (record.checkedDate || new Date().toISOString()) : record.checkedDate,
                    checkedBy: (record.status === RecordStatus.PENDING_CHECK || record.status === RecordStatus.CHECKED) ? (record.checkedBy || user.employeeId) : record.checkedBy
                };
                
                if (onUpdateRecord) {
                    await onUpdateRecord(updatedRecord);
                } else {
                    await updateRecordApi(updatedRecord);
                    onUpdateStatus(record, RecordStatus.PENDING_SIGN); // Fallback local state update
                }
            }
        }
        
        // Refresh archive data
        const saoluc = await fetchArchiveRecords('saoluc');
        const congvan = await fetchArchiveRecords('congvan');
        setArchiveRecords([...saoluc, ...congvan]);
        
        setIsSubmitModalOpen(false);
        setSubmitTargetRecords([]);
    } catch (error) {
        console.error("Error submitting records:", error);
        alert("Có lỗi xảy ra khi trình ký.");
    }
  };

  const handleOpenReturnModal = (record: RecordFile) => {
    setReturnTargetRecords([record]);
    setIsReturnModalOpen(true);
  };

  const handleConfirmReturn = async (reason: string) => {
    try {
        const nowStr = new Date().toISOString();
        for (const record of returnTargetRecords) {
            const formattedReason = `[Trả hồ sơ ngày ${new Date().toLocaleDateString('vi-VN')} bởi ${user.name}]: ${reason}`;
            const currentNotes = record.notes ? `${record.notes}\n${formattedReason}` : formattedReason;
            const currentPrivateNotes = record.privateNotes ? `${record.privateNotes}\n${formattedReason}` : formattedReason;
            
            if (record.recordType === 'Sao lục' || record.recordType === 'Công văn') {
                const currentArchive = archiveRecords.find(r => r.id === record.id);
                let nextStatus: ArchiveRecord['status'] = 'assigned';
                let actionText = 'Trình ký';
                if (currentArchive) {
                    const currentStatus = currentArchive.status;
                    if (currentStatus === 'assigned' || currentStatus === 'executed') {
                        nextStatus = 'pending_sign';
                        actionText = 'Trình ký (Bị trả/Có lỗi)';
                    } else if (currentStatus === 'pending_sign') {
                        nextStatus = 'signed';
                        actionText = 'Ký duyệt (Bị trả/Có lỗi)';
                    } else if (currentStatus === 'signed') {
                        nextStatus = 'completed';
                        actionText = 'Hoàn thành (Bị trả/Có lỗi)';
                    } else {
                        nextStatus = currentStatus;
                        actionText = 'Bị trả lại';
                    }
                }

                const historyEntry = {
                    action: actionText,
                    status: nextStatus,
                    timestamp: nowStr,
                    user: user.name,
                    notes: reason
                };

                if (currentArchive) {
                    const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                    const newHistory = [...oldHistory, historyEntry];
                    await saveArchiveRecord({
                        id: record.id,
                        status: nextStatus,
                        data: { 
                            ...currentArchive.data, 
                            history: newHistory,
                            notes: currentNotes,
                            privateNotes: currentPrivateNotes,
                            returned_reason: reason,
                            hasDefect: true,
                            defectReason: reason,
                            defectDate: nowStr
                        }
                    });
                }
            } else {
                // Determine next status for normal records
                let nextStatus = RecordStatus.PENDING_CHECK;
                const trackingUpdates: Partial<RecordFile> = {};
                
                if (record.status === RecordStatus.RECEIVED || 
                    record.status === RecordStatus.ASSIGNED || 
                    record.status === RecordStatus.IN_PROGRESS || 
                    record.status === RecordStatus.COMPLETED_WORK) {
                    
                    if (record.recordType === 'Cung cấp tài liệu đất đai') {
                        nextStatus = RecordStatus.PENDING_SIGN;
                        trackingUpdates.submissionDate = nowStr;
                        trackingUpdates.submittedTo = record.submittedTo || user.employeeId || 'DIR01';
                    } else {
                        nextStatus = RecordStatus.PENDING_CHECK;
                        trackingUpdates.pendingCheckDate = nowStr;
                        trackingUpdates.checkedBy = record.checkedBy || user.employeeId || 'CHECK01';
                    }
                } else if (record.status === RecordStatus.PENDING_CHECK || 
                           record.status === RecordStatus.CHECKED) {
                    nextStatus = RecordStatus.PENDING_SIGN;
                    trackingUpdates.checkedDate = nowStr;
                    trackingUpdates.checkedBy = record.checkedBy || user.employeeId || 'CHECK01';
                    trackingUpdates.submissionDate = nowStr;
                    trackingUpdates.submittedTo = record.submittedTo || 'DIR01';
                } else if (record.status === RecordStatus.PENDING_SIGN) {
                    nextStatus = RecordStatus.SIGNED;
                    trackingUpdates.approvalDate = nowStr;
                } else if (record.status === RecordStatus.SIGNED) {
                    nextStatus = RecordStatus.HANDOVER;
                    trackingUpdates.completedDate = nowStr;
                } else {
                    nextStatus = record.status;
                }

                // Normal Record
                const updatedRecord: RecordFile = {
                    ...record,
                    status: nextStatus,
                    notes: currentNotes,
                    privateNotes: currentPrivateNotes,
                    hasDefect: true,
                    defectReason: reason,
                    defectDate: nowStr,
                    ...trackingUpdates
                };

                if (onUpdateRecord) {
                    await onUpdateRecord(updatedRecord);
                } else {
                    await updateRecordApi(updatedRecord);
                    onUpdateStatus(record, nextStatus);
                }
            }
        }

        // Refresh archive data
        const saoluc = await fetchArchiveRecords('saoluc');
        const congvan = await fetchArchiveRecords('congvan');
        setArchiveRecords([...saoluc, ...congvan]);

        setIsReturnModalOpen(false);
        setReturnTargetRecords([]);
        alert("Đã trả hồ sơ thành công!");
    } catch (error) {
        console.error("Error returning records:", error);
        alert("Có lỗi xảy ra khi trả hồ sơ.");
    }
  };

  const handleRecallRecord = async (record: RecordFile) => {
    if (await confirmAction(`Xác nhận thu hồi hồ sơ ${record.code}?\nHồ sơ sẽ chuyển lại về trạng thái "Đang thực hiện".`)) {
        try {
            if (record.recordType === 'Sao lục' || record.recordType === 'Công văn') {
                const historyEntry = {
                    action: 'Thu hồi',
                    status: 'assigned',
                    timestamp: new Date().toISOString(),
                    user: user.name
                };

                const currentArchive = archiveRecords.find(r => r.id === record.id);
                if (currentArchive) {
                    const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                    const newHistory = [...oldHistory, historyEntry];
                    await saveArchiveRecord({
                        id: record.id,
                        status: 'assigned',
                        data: { ...currentArchive.data, history: newHistory }
                    });
                }
            } else {
                // Normal Record
                const updatedRecord: RecordFile = {
                    ...record,
                    status: RecordStatus.IN_PROGRESS
                };

                if (onUpdateRecord) {
                    await onUpdateRecord(updatedRecord);
                } else {
                    await updateRecordApi(updatedRecord);
                    onUpdateStatus(record, RecordStatus.IN_PROGRESS);
                }
            }

            // Refresh archive data
            const saoluc = await fetchArchiveRecords('saoluc');
            const congvan = await fetchArchiveRecords('congvan');
            setArchiveRecords([...saoluc, ...congvan]);

            alert("Đã thu hồi hồ sơ thành công!");
        } catch (error) {
            console.error("Error recalling record:", error);
            alert("Có lỗi xảy ra khi thu hồi.");
        }
    }
  };

  const handleExportAnnex = async (record: RecordFile) => {
      const hasAnnexTemplate = hasTemplate(STORAGE_KEYS.CONTRACT_TEMPLATE_ANNEX);
      if (!hasAnnexTemplate) {
          alert("Chưa có mẫu Phụ lục gia hạn hợp đồng nào được cấu hình trong hệ thống.\nVui lòng vào mục Cài đặt hệ thống để cấu hình mẫu này.");
          return;
      }

      // Lấy thời gian mốc hợp đồng
      const dateHD = {
          day: '...',
          month: '...',
          year: '...'
      };
      
      const rDate = record.receivedDate || record.issueDate;
      if (rDate) {
          const d = new Date(rDate);
          if (!isNaN(d.getTime())) {
              dateHD.day = String(d.getDate()).padStart(2, '0');
              dateHD.month = String(d.getMonth() + 1).padStart(2, '0');
              dateHD.year = String(d.getFullYear());
          }
      }

      const printData = {
          MA_HS: record.code || '',
          NGAY_HD: dateHD.day,
          THANG_HD: dateHD.month,
          NAM_HD: dateHD.year,
          TEN: (record.customerName || '').toUpperCase(),
          DIACHI: record.address || record.customerAddress || record.ward || '',
          SDT: record.phoneNumber || ''
      };

      try {
          const blob = await generateDocxBlobAsync(STORAGE_KEYS.CONTRACT_TEMPLATE_ANNEX, printData);
          if (blob) {
              const fileName = `Phu_Luc_Gia_Han_${record.code || 'HS'}.docx`;
              
              const electron = (window as any).electronAPI;
              if (electron && electron.saveAndOpenFile) {
                  const reader = new FileReader();
                  reader.readAsDataURL(blob);
                  reader.onloadend = async () => {
                      if (!electron?.saveAndOpenFile) return;
                      const base64Data = (reader.result as string).split(',')[1];
                      const result = await electron.saveAndOpenFile({
                          fileName: fileName,
                          base64Data: base64Data
                      });
                      if (!result.success) {
                          alert(`Lỗi khi lưu file: ${result.message}`);
                      }
                  };
              } else {
                  // Web Fallback
                  saveAs(blob, fileName);
              }
          }
      } catch (err: any) {
          console.error("Lỗi khi xuất phụ lục:", err);
          alert("Lỗi xuất phụ lục: " + err.message);
      }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '---';
    const date = new Date(dateStr);
    const time = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${time} ${d}/${m}`;
  };

  const getDeadlineStatus = (record: RecordFile) => {
      // 1. Kiểm tra nếu đã hoàn thành/xuất hồ sơ thì KHÔNG tính trễ hạn
      // Nếu có exportBatch hoặc exportDate hoặc status là HANDOVER/RETURNED/SIGNED -> Coi như xong
      if (
          record.status === RecordStatus.HANDOVER || 
          record.status === RecordStatus.RETURNED || 
          record.status === RecordStatus.WITHDRAWN ||
          record.status === RecordStatus.REJECTED ||
          record.status === RecordStatus.SIGNED ||
          record.exportBatch || 
          record.exportDate ||
          record.resultReturnedDate
      ) {
           return { color: 'text-gray-600', icon: null, text: '' };
      }

      // 2. Nếu chưa xong, kiểm tra deadline
      const deadlineStr = record.deadline;
      if (!deadlineStr) return { color: 'text-gray-600', icon: null, text: '' };
      
      const today = new Date();
      today.setHours(0,0,0,0);
      const deadline = new Date(deadlineStr);
      deadline.setHours(0,0,0,0);

      const diffTime = deadline.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return { color: 'text-red-600 font-bold', icon: <AlertCircle size={14} />, text: '(Quá hạn)' };
      if (diffDays <= 2) return { color: 'text-orange-600 font-bold', icon: <Clock size={14} />, text: '(Gấp)' };
      return { color: 'text-gray-600', icon: null, text: '' };
  };

  const renderSortHeader = (label: string, key: keyof RecordFile) => {
      const isSorted = sortConfig.key === key;
      return (
          <div className="flex items-center gap-1 cursor-pointer select-none" onClick={() => handleSort(key)}>
              {label}
              <span className="text-gray-400">
                {isSorted ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-600"/> : <ArrowDown size={12} className="text-blue-600"/>
                ) : <ArrowUpDown size={12} />}
              </span>
          </div>
      );
  };

  // Helper để lấy tên Tab hiện tại cho placeholder
  const getTabLabel = () => {
      switch(activeTab) {
          case 'pending': return 'Đang thực hiện';
          case 'pending_check': return 'Chờ kiểm tra';
          case 'pending_sign': return 'Chờ ký';
          case 'reminder': return 'Nhắc việc';
          default: return 'danh sách';
      }
  };

  if (!user.employeeId) {
    return (
        <div className="flex flex-col items-center justify-center h-96 bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="bg-orange-100 p-4 rounded-full mb-4">
                <UserCog size={48} className="text-orange-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Tài khoản chưa liên kết nhân sự</h2>
            <p className="text-gray-600 max-w-md mb-6">
                Tài khoản <strong>{user.username}</strong> hiện là quản trị viên hệ thống nhưng chưa được liên kết với hồ sơ nhân viên cụ thể.
            </p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4 animate-fade-in-up overflow-hidden">
      {/* Header thống kê */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
             <Briefcase className="text-blue-600" />
             Xin chào, {user.name}
          </h2>
          <p className="text-gray-500 mt-1">Danh sách hồ sơ bạn đang phụ trách.</p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-4 w-full md:w-auto justify-center md:justify-end">
             {!isDirector && (
                 <>
                     <div className="flex-1 md:flex-none text-center px-4 py-2 bg-blue-50 rounded-lg border border-blue-100 min-w-[100px]">
                        <div className="text-2xl font-bold text-blue-700">{pendingRecords.length}</div>
                        <div className="text-xs text-blue-600 uppercase font-semibold">Đang xử lý</div>
                     </div>
                     <div className="flex-1 md:flex-none text-center px-4 py-2 bg-orange-50 rounded-lg border border-orange-100 min-w-[100px]">
                        <div className="text-2xl font-bold text-orange-700">{pendingCheckRecords.length}</div>
                        <div className="text-xs text-orange-600 uppercase font-semibold">Chờ kiểm tra</div>
                     </div>
                     {!isChecker && (
                         <div className="flex-1 md:flex-none text-center px-4 py-2 bg-purple-50 rounded-lg border border-purple-100 min-w-[100px]">
                            <div className="text-2xl font-bold text-purple-700">{reviewRecords.length}</div>
                            <div className="text-xs text-purple-600 uppercase font-semibold">Chờ ký</div>
                         </div>
                     )}
                 </>
             )}
             <div className="flex-1 md:flex-none text-center px-4 py-2 bg-green-50 rounded-lg border border-green-100 min-w-[100px]">
                <div className="text-2xl font-bold text-green-700">{finishedRecords.length}</div>
                <div className="text-xs text-green-600 uppercase font-semibold">Hoàn thành</div>
             </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-0">
        
        {/* TABS & SEARCH */}
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
            <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm overflow-x-auto max-w-full">
                {!isDirector && (
                    <>
                        <button 
                            onClick={() => { setActiveTab('pending'); setCurrentPage(1); setSearchTerm(''); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                                activeTab === 'pending' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <Clock size={16} /> Đang thực hiện ({pendingRecords.length})
                        </button>
                        <button 
                            onClick={() => { setActiveTab('pending_check'); setCurrentPage(1); setSearchTerm(''); }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                                activeTab === 'pending_check' ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <ClipboardList size={16} /> Chờ kiểm tra ({pendingCheckRecords.length})
                        </button>
                    </>
                )}
                {!isChecker && (
                    <button 
                        onClick={() => { setActiveTab('pending_sign'); setCurrentPage(1); setSearchTerm(''); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                            activeTab === 'pending_sign' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <Send size={16} /> Chờ ký ({reviewRecords.length})
                    </button>
                )}
                <button 
                    onClick={() => { setActiveTab('finished'); setCurrentPage(1); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                        activeTab === 'finished' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <FileCheck size={16} /> Hoàn thành ({finishedRecords.length})
                </button>
                {!isDirector && !isChecker && (
                    <button 
                        onClick={() => { setActiveTab('reminder'); setCurrentPage(1); setSearchTerm(''); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                            activeTab === 'reminder' ? 'bg-pink-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <Bell size={16} /> Nhắc việc ({reminderRecords.length})
                    </button>
                )}
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder={`Tìm trong ${getTabLabel()}...`}
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                <button 
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors whitespace-nowrap"
                >
                    <FileDown size={16} /> Xuất Excel
                </button>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
            {displayRecords.length > 0 ? (
                <table className="w-full text-left table-fixed min-w-[1160px]">
                    <thead className="bg-white border-b border-gray-200 text-xs text-gray-500 uppercase sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="p-3 w-10 text-center">#</th>
                            <th className="p-3 w-[120px]">{renderSortHeader('Mã HS', 'code')}</th>
                            <th className="p-3 w-[180px]">{renderSortHeader('Chủ sử dụng', 'customerName')}</th>
                            <th className="p-3 w-[130px]">{renderSortHeader('Loại hồ sơ', 'recordType')}</th>
                            <th className="p-3 w-[130px]">{renderSortHeader('Ngày giao việc', 'assignedDate')}</th>
                            <th className="p-3 w-[110px]">{renderSortHeader('Ngày trình', 'submissionDate')}</th>
                            
                            <th className="p-3 w-[150px]">
                                {activeTab === 'reminder' 
                                    ? <div className="flex items-center gap-1 text-pink-600"><CalendarClock size={14}/> Thời gian nhắc</div>
                                    : renderSortHeader('Hẹn trả', 'deadline')
                                }
                            </th>
                            
                            {activeTab === 'pending_check' && (
                                <th className="p-3 w-[150px]">Người kiểm tra</th>
                            )}

                            <th className="p-3 text-center w-[120px]">Trạng thái</th>
                            <th className="p-3 text-center w-[100px]">Chỉnh lý</th>
                            <th className="p-3 text-center w-[180px]">Thao tác chính</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {paginatedDisplayRecords.map((r, index) => {
                            const deadlineStatus = getDeadlineStatus(r);
                            const rowClass = activeTab === 'reminder' ? 'hover:bg-pink-50/50 bg-pink-50/10' : 'hover:bg-blue-50/50';
                            
                            return (
                                <tr key={r.id} className={`${rowClass} transition-colors`}>
                                    <td className="p-3 text-center text-gray-400 text-xs align-middle">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                    <td className="p-3 font-medium text-blue-600 align-middle"><div className="truncate" title={r.code || ''}>{r.code}</div></td>
                                    <td className="p-3 font-medium text-gray-800 align-middle"><div className="truncate" title={r.customerName || ''}>{r.customerName}</div></td>
                                    <td className="p-3 text-gray-600 align-middle"><div className="truncate" title={r.recordType || ''}>{getShortRecordType(r.recordType || undefined)}</div></td>
                                    <td className="p-3 text-gray-600 align-middle text-center">{formatDate(r.assignedDate || undefined)}</td>
                                    <td className="p-3 text-gray-600 align-middle text-center">{formatDate(r.submissionDate || undefined)}</td>
                                    
                                    <td className="p-3 align-middle">
                                        {activeTab === 'reminder' ? (
                                            <div className="flex items-center gap-1.5 text-pink-700 font-bold bg-pink-100 px-2 py-1 rounded w-fit text-xs">
                                                <Bell size={12} className="fill-pink-700"/>
                                                {formatDateTime(r.reminderDate || undefined)}
                                            </div>
                                        ) : (
                                            <div className={`flex items-center gap-1.5 ${deadlineStatus.color}`}>
                                                {deadlineStatus.icon}
                                                <span>{formatDate(r.deadline || undefined)}</span>
                                                <span className="text-[10px] uppercase ml-1">{deadlineStatus.text}</span>
                                            </div>
                                        )}
                                    </td>

                                    {activeTab === 'pending_check' && (
                                        <td className="p-3 text-gray-600 align-middle">
                                            <div className="truncate" title={r.checkedBy ? employees.find(e => e.id === r.checkedBy)?.name : ''}>
                                                {r.checkedBy ? employees.find(e => e.id === r.checkedBy)?.name : '---'}
                                            </div>
                                        </td>
                                    )}

                                    <td className="p-3 text-center align-middle">
                                        <StatusBadge status={r.status} />
                                        {r.hasDefect && (
                                            <span className="mt-1 block text-[10px] font-bold bg-red-100 text-red-800 px-1 py-0.5 rounded border border-red-200 text-center mx-auto max-w-[100px]">
                                                Có lỗi (Trả)
                                            </span>
                                        )}
                                    </td>
                                    
                                    <td className="p-3 text-center align-middle">
                                        {onMapCorrection && (
                                            <button 
                                                onClick={() => onMapCorrection(r)}
                                                className={`flex items-center justify-center gap-1 px-2 py-1 rounded border transition-all text-[10px] font-bold shadow-sm mx-auto ${
                                                    r.needsMapCorrection 
                                                    ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 w-full' 
                                                    : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-50'
                                                }`}
                                                title={r.needsMapCorrection ? "Đang có yêu cầu. Bấm để HỦY." : "Yêu cầu chỉnh lý bản đồ"}
                                            >
                                                <Map size={14} className={r.needsMapCorrection ? "fill-orange-100" : ""} />
                                                {r.needsMapCorrection && <span>CHỈNH LÝ</span>}
                                            </button>
                                        )}
                                    </td>

                                    <td className="p-3 align-middle">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => onViewRecord(r)} className="px-2 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-white hover:border-blue-300 hover:text-blue-600 text-xs font-medium transition-all shadow-sm">
                                                Chi tiết
                                            </button>
                                            
                                            {/* Logic nút chuyển trạng thái theo từng Tab */}
                                            {activeTab === 'pending' && (
                                                <div className="flex gap-1.5 animate-fade-in">
                                                    {r.recordType === 'Cung cấp tài liệu đất đai' || r.recordType === 'Sao lục' || r.recordType === 'Công văn' ? (
                                                        <button onClick={() => handleForwardToSign(r)} title="Trình ký duyệt" className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all" id={`row-btn-sign-${r.id}`}>
                                                            <Send size={14} /> Trình ký
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => handleForwardToCheck(r)} title="Trình kiểm tra" className="px-3 py-1.5 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all" id={`row-btn-check-${r.id}`}>
                                                            <Send size={14} /> Trình kiểm tra
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleOpenReturnModal(r)} title="Trả hồ sơ yêu cầu sửa / báo lỗi" className="px-2.5 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all" id={`row-btn-return-pending-${r.id}`}>
                                                        <CornerUpLeft size={14} /> Trả hồ sơ
                                                    </button>
                                                </div>
                                            )}
                                            {activeTab === 'pending_check' && (r.status === RecordStatus.PENDING_CHECK || r.status === RecordStatus.CHECKED) && (
                                                <div className="flex gap-1.5">
                                                    {(isChecker || isDirector) && (
                                                        <button onClick={() => handleForwardToSign(r)} title="Trình ký duyệt" className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-xs font-bold flex items-center gap-2 shadow-sm transition-all" id={`row-btn-sig-check-${r.id}`}>
                                                            <Send size={14} /> Trình ký
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleOpenReturnModal(r)} title="Trả hồ sơ yêu cầu sửa" className="px-2.5 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all" id={`row-btn-return-${r.id}`}>
                                                        <CornerUpLeft size={14} /> Trả hồ sơ
                                                    </button>
                                                    {r.assignedTo === user.employeeId && r.status === RecordStatus.PENDING_CHECK && (
                                                        <button onClick={() => handleRecallRecord(r)} title="Thu hồi hồ sơ đã trình" className="px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md hover:bg-amber-100 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all" id={`row-btn-recall-${r.id}`}>
                                                            <RotateCcw size={14} /> Thu hồi
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {activeTab === 'pending_sign' && r.status === RecordStatus.PENDING_SIGN && (
                                                <div className="flex gap-1.5 animate-fade-in">
                                                    <button onClick={() => handleOpenReturnModal(r)} title="Trả hồ sơ yêu cầu sửa" className="px-2.5 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all" id={`row-btn-return-sign-${r.id}`}>
                                                        <CornerUpLeft size={14} /> Trả hồ sơ
                                                    </button>
                                                    {r.assignedTo === user.employeeId && (r.recordType === 'Cung cấp tài liệu đất đai' || r.recordType === 'Sao lục' || r.recordType === 'Công văn') && (
                                                        <button onClick={() => handleRecallRecord(r)} title="Thu hồi hồ sơ đã trình" className="px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md hover:bg-amber-100 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all" id={`row-btn-recall-sign-${r.id}`}>
                                                            <RotateCcw size={14} /> Thu hồi
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <CheckCircle size={48} className="text-gray-200 mb-2" />
                    <p>{searchTerm ? 'Không tìm thấy hồ sơ phù hợp.' : 'Không có hồ sơ nào trong danh sách này.'}</p>
                </div>
            )}
        </div>

        {/* PAGINATION FOOTER */}
        {displayRecords.length > 0 && (
            <div className="border-t border-gray-100 p-3 bg-gray-50 flex justify-between items-center shrink-0">
                <span className="text-xs text-gray-500">
                    Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, displayRecords.length)}</strong> trên tổng <strong>{displayRecords.length}</strong>
                </span>
                <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={18} /></button>
                    <span className="text-xs font-medium mx-2">Trang {currentPage} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><ChevronRight size={18} /></button>
                </div>
            </div>
        )}
      </div>

      <SubmitModal 
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          records={submitTargetRecords}
          users={users}
          employees={employees}
          onConfirm={handleConfirmSubmit}
      />

      <SubmitModal 
          isOpen={isSubmitCheckModalOpen}
          onClose={() => setIsSubmitCheckModalOpen(false)}
          records={submitTargetRecords}
          users={users}
          employees={employees}
          isCheckMode={true}
          onConfirm={async (checkerId) => {
              try {
                  for (const record of submitTargetRecords) {
                      if (record.recordType === 'Sao lục' || record.recordType === 'Công văn') {
                          // Xử lý hồ sơ lưu trữ
                          const historyEntry = {
                              action: 'Trình kiểm tra',
                              status: 'pending_check',
                              timestamp: new Date().toISOString(),
                              user: user.name
                          };

                          const currentArchive = archiveRecords.find(r => r.id === record.id);
                          if (currentArchive) {
                              const oldHistory = Array.isArray(currentArchive.data?.history) ? currentArchive.data.history : [];
                              const newHistory = [...oldHistory, historyEntry];
                              
                              await saveArchiveRecord({
                                  id: record.id,
                                  status: 'pending_check',
                                  data: { ...currentArchive.data, history: newHistory, checked_by: checkerId }
                              });
                          }
                      } else {
                          // Hồ sơ Đo đạc thường
                          await onUpdateRecord?.({
                              ...record,
                              status: RecordStatus.PENDING_CHECK,
                              completedWorkDate: record.completedWorkDate || new Date().toISOString(),
                              pendingCheckDate: new Date().toISOString(),
                              checkedBy: checkerId
                          });
                      }
                  }
                  
                  // Làm mới dữ liệu lưu trữ
                  const saoluc = await fetchArchiveRecords('saoluc');
                  const congvan = await fetchArchiveRecords('congvan');
                  setArchiveRecords([...saoluc, ...congvan]);
                  
                  setIsSubmitCheckModalOpen(false);
                  setSubmitTargetRecords([]);
              } catch (err) {
                  console.error("Lỗi khi trình kiểm tra:", err);
              }
          }}
      />

      <ReturnReasonModal 
          isOpen={isReturnModalOpen}
          onClose={() => {
              setIsReturnModalOpen(false);
              setReturnTargetRecords([]);
          }}
          records={returnTargetRecords}
          onConfirm={handleConfirmReturn}
      />

      {isAnnexModalOpen && annexTargetRecord && (
          <SystemAnnexTemplate 
              data={annexTargetRecord} 
              employees={employees}
              onClose={() => {
                  setIsAnnexModalOpen(false);
                  setAnnexTargetRecord(null);
              }}
          />
      )}
    </div>
  );
};

export default PersonalProfile;
