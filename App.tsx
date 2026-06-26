
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole, Message } from './types';
import { DEFAULT_WARDS as STATIC_WARDS } from './constants';
import Login from './components/Login'; 
import MainLayout from './components/layout/MainLayout';
import AppRoutes from './components/AppRoutes';
import AppModals from './components/AppModals';

import { DEFAULT_VISIBLE_COLUMNS, confirmAction, fillTimelineDatesForReturn, removeVietnameseTones } from './utils/appHelpers';
import { getEmployeeTeam } from './components/AssignModal';
import { exportReportToExcel, exportReturnedListToExcel } from './utils/excelExport';
import { generateReport } from './services/geminiService';
import { syncTemplatesFromCloud } from './services/docxService'; 
import { updateRecordApi, saveEmployeeApi, saveUserApi, forceUpdateRecordsBatchApi, updateRecordsBatchById } from './services/api';
import { migrateCungCapTaiLieu, saveArchiveRecord, fetchArchiveRecords } from './services/apiArchive';
import * as XLSX from 'xlsx-js-style';
import { CheckCircle, AlertTriangle } from 'lucide-react';

import { useAppData } from './hooks/useAppData';
import { useRecordFilter } from './hooks/useRecordFilter';
import { useReminderSystem } from './hooks/useReminderSystem';
import { useGlobalChatListener } from './hooks/useGlobalChatListener';

import { useIsMobile } from './hooks/useIsMobile';
import MobileLayout from './components/layout/MobileLayout';
import MobileRoutes from './components/mobile/MobileRoutes';
import SubmitModal from './components/receive-record/SubmitModal';
import GlobalConfirmModal from './components/GlobalConfirmModal';
import GlobalAlertModal from './components/GlobalAlertModal';
import RejectReasonModal from './components/receive-record/RejectReasonModal';

const isRegType = (type: string | null | undefined): boolean => {
    if (!type) return false;
    const t = type.trim().toLowerCase();
    const REG_PROCEDURES = [
        "đăng ký", "cấp giấy", "cấp đổi", "cấp lại", "giao đất", "thu hồi",
        "chuyển mục đích", "gia hạn", "thừa kế", "tặng cho", "chuyển nhượng", "thế chấp", "xóa thế chấp"
    ];
    return t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REG_PROCEDURES.some(p => t.includes(p));
};

function App() {
  const isMobile = useIsMobile(768);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [notificationEnabled, setNotificationEnabled] = useState(() => {
      const saved = localStorage.getItem('chat_notification_enabled');
      return saved === null ? true : saved === 'true';
  });

  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Feature specific states
  const [recordToLiquidate, setRecordToLiquidate] = useState<RecordFile | null>(null);
  const [recordForMapCorrection, setRecordForMapCorrection] = useState<RecordFile | null>(null);

  // Modal & UI States
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
      try { return JSON.parse(localStorage.getItem('visible_columns') || '') || DEFAULT_VISIBLE_COLUMNS; } catch { return DEFAULT_VISIBLE_COLUMNS; }
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordFile | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetRecords, setAssignTargetRecords] = useState<RecordFile[]>([]);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitCheckModalOpen, setIsSubmitCheckModalOpen] = useState(false);
  const [submitTargetRecords, setSubmitTargetRecords] = useState<RecordFile[]>([]);
  const [viewingRecord, setViewingRecord] = useState<RecordFile | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<RecordFile | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalType, setExportModalType] = useState<'handover' | 'check_list'>('handover');
  const [isAddToBatchModalOpen, setIsAddToBatchModalOpen] = useState(false);
  const [isExcelPreviewOpen, setIsExcelPreviewOpen] = useState(false);
  const [previewWorkbook, setPreviewWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [previewExcelName, setPreviewExcelName] = useState('');
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnRecord, setReturnRecord] = useState<RecordFile | null>(null);
  const [isRejectReasonModalOpen, setIsRejectReasonModalOpen] = useState(false);
  const [rejectRecordsTarget, setRejectRecordsTarget] = useState<RecordFile[]>([]);

  // States for GCN / Cấp giấy workflow additional inputs
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [taxTargetRecord, setTaxTargetRecord] = useState<RecordFile | null>(null);
  const [taxLandPlot, setTaxLandPlot] = useState('');
  const [taxMapSheet, setTaxMapSheet] = useState('');
  const [taxArea, setTaxArea] = useState('');

  const [foilModalOpen, setFoilModalOpen] = useState(false);
  const [foilTargetRecord, setFoilTargetRecord] = useState<RecordFile | null>(null);
  const [foilNumber, setFoilNumber] = useState('');

  // Helper to calculate the next sequence number for Vào sổ GCN (Sổ vô số cấp giấy)
  const calculateNextVaoSoNumber = async (): Promise<string> => {
      try {
          const archiveRecords = await fetchArchiveRecords('vaoso');
          let maxNum = 0;
          if (archiveRecords && archiveRecords.length > 0) {
              archiveRecords.forEach(r => {
                  const val = r.data?.so_vao_so || "";
                  if (val.startsWith("CN ")) {
                      const numPart = val.replace("CN ", "");
                      const num = parseInt(numPart, 10);
                      if (!isNaN(num) && num > maxNum) {
                          maxNum = num;
                      }
                  } else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num > maxNum) {
                          maxNum = num;
                      }
                  }
              });
          }
          const nextNum = maxNum + 1;
          const padded = String(nextNum).padStart(6, '0');
          return `CN ${padded}`;
      } catch (e) {
          console.error("Lỗi khi tính số vào sổ tiếp theo:", e);
          return "CN 000001";
      }
  };

  // Report States
  const [globalReportContent, setGlobalReportContent] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // --- UPDATE LOGIC STATES ---
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'downloading' | 'ready' | 'error'>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateSpeed, setUpdateSpeed] = useState(0); // Bytes per second
  const [updateDeferred, setUpdateDeferred] = useState(false); // Đã chọn cập nhật sau 10p chưa

  // Toast effect
  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 3000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  // Electron Nav Listener
  useEffect(() => {
      if (window.electronAPI && window.electronAPI.onNavigateToView) {
          window.electronAPI.onNavigateToView((viewId: string) => {
              if (currentUser) setCurrentView(viewId);
          });
      }
      return () => {
          if (window.electronAPI && window.electronAPI.removeNavigationListener) {
              window.electronAPI.removeNavigationListener();
          }
      };
  }, [currentUser]);

  // Sync Templates
  useEffect(() => { syncTemplatesFromCloud(); }, []);

  // Run migration for Cung cấp tài liệu đất đai
  useEffect(() => {
      if (currentUser) {
          migrateCungCapTaiLieu();
      }
  }, [currentUser]);

  // Save visible columns
  useEffect(() => { localStorage.setItem('visible_columns', JSON.stringify(visibleColumns)); }, [visibleColumns]);

  // --- CUSTOM HOOKS ---
  const { 
      records: rawRecords, employees, users, wards, holidays, rolePermissions, departmentPermissions, connectionStatus, 
      isUpdateAvailable, latestVersion, updateUrl,
      setEmployees, setUsers, setRecords, setWards,
      loadData, handleAddOrUpdateRecord, handleDeleteRecord, handleImportRecords,
      handleSaveEmployee, handleDeleteEmployee, handleDeleteAllData, handleUpdateUser, handleDeleteUser
  } = useAppData(currentUser);

  const records = useMemo(() => {
      let filtered = rawRecords;
      // Một cửa (ONEDOOR) có thể tiếp nhận tất cả hồ sơ không giới hạn thuộc bất cứ địa bàn nào,
      // nên không lọc theo managedWards nữa.
      if (currentUser?.role === UserRole.TEAM_LEADER && currentUser.employeeId) {
          const empId = currentUser.employeeId;
          filtered = rawRecords.filter(r => {
              // Unassigned is visible so they can assign it
              if (!r.assignedTo) return true;
              
              // Assigned to themselves or they are the checker, signer/submitter, or receiver
              return r.assignedTo === empId || 
                     r.checkedBy === empId || 
                     r.submittedTo === empId || 
                     r.receivedBy === empId;
          });
      }
      return filtered;
  }, [rawRecords, currentUser, employees]);

  // Reminder System
  const handleUpdateRecordState = useCallback((updatedRecord: RecordFile) => {
      setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
  }, [setRecords]);
  const { activeRemindersCount } = useReminderSystem(records, handleUpdateRecordState);

  // Filtering Logic
  const recordFilterProps = useRecordFilter(records, currentUser, currentView, employees, users);

  // TỰ ĐỘNG BỎ TÍCH CHỌN KHI CHUYỂN TAB ĐỂ TRÁNH NHẦM LẪN GIAO HỒ SƠ CHỒNG CHÉO
  useEffect(() => {
      setSelectedRecordIds(new Set());
  }, [currentView, recordFilterProps.handoverTab]);

  // Chat Listener
  useGlobalChatListener(currentUser, currentView, notificationEnabled, setUnreadMessages);

  // Permissions
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSubadmin = currentUser?.role === UserRole.SUBADMIN;
  const isTeamLeader = currentUser?.role === UserRole.TEAM_LEADER;
  const canPerformAction = isAdmin || isSubadmin || isTeamLeader || currentUser?.role === UserRole.ONEDOOR;

  // --- UPDATE HANDLERS ---
  
  // Lắng nghe sự kiện update từ Electron
  useEffect(() => {
      if (window.electronAPI && window.electronAPI.onUpdateStatus) {
          window.electronAPI.onUpdateStatus((data: any) => {
              if (data.status === 'downloading') {
                  setUpdateStatus('downloading');
                  setUpdateProgress(data.progress);
                  if (data.bytesPerSecond) setUpdateSpeed(data.bytesPerSecond);
              } else if (data.status === 'downloaded') {
                  setUpdateStatus('ready');
                  setUpdateProgress(100);
                  // Tự động cài đặt khi tải xong
                  window.electronAPI?.quitAndInstall();
              } else if (data.status === 'error') {
                  setUpdateStatus('error');
                  console.error("Update error:", data.message);
              }
          });
          return () => { if (window.electronAPI?.removeUpdateListener) window.electronAPI.removeUpdateListener(); };
      }
  }, []);

  const handleUpdateNow = async () => {
      if (window.electronAPI?.downloadUpdate) {
          try {
              setUpdateStatus('downloading'); // Chuyển trạng thái ngay để hiện progress bar
              await window.electronAPI.downloadUpdate();
          } catch (e: any) {
              console.error("Download update failed:", e);
              setUpdateStatus('error');
              alert("Lỗi khi tải bản cập nhật: " + (e.message || "Không xác định"));
          }
      } else {
          // Fallback cho web
          if (updateUrl) window.open(updateUrl, '_blank');
      }
  };

  const handleUpdateLater = () => {
      setUpdateDeferred(true);
      // Đặt hẹn giờ 10 phút (600,000 ms)
      setTimeout(() => {
          setToast({ type: 'success', message: 'Bắt đầu tự động cập nhật hệ thống...' });
          handleUpdateNow();
      }, 600000);
  };

  // --- LOGIC TỰ ĐỘNG CHUYỂN TAB CHO 1 CỬA ---
  useEffect(() => {
      if (currentView === 'handover_list' && currentUser?.role === UserRole.ONEDOOR && recordFilterProps.handoverTab === 'today') {
          recordFilterProps.setHandoverTab('history');
      }
  }, [currentView, currentUser, recordFilterProps.handoverTab]);

  // --- HANDLERS (Business Logic) ---

  const handleExportReportExcel = async (fromDateStr: string, toDateStr: string, ward: string, title?: string, data?: RecordFile[]) => {
      if (!currentUser) return;
      await exportReportToExcel(data || records, fromDateStr, toDateStr, ward, employees, title);
  };

  const handleUpdateCurrentAccount = async (data: { name: string; password?: string; department?: string }) => {
      if (!currentUser) return false;
      const updatedUser: User = { ...currentUser, name: data.name, ...(data.password ? { password: data.password } : {}) };
      const savedUser = await saveUserApi(updatedUser, true);
      if (!savedUser) return false;
      if (currentUser.employeeId && data.department) {
          const emp = employees.find(e => e.id === currentUser.employeeId);
          if (emp) {
              const savedEmp = await saveEmployeeApi({ ...emp, department: data.department }, true);
              if (savedEmp) setEmployees(prev => prev.map(e => e.id === emp.id ? savedEmp : e));
          }
      }
      setUsers(prev => prev.map(u => u.username === currentUser.username ? savedUser : u));
      setCurrentUser(savedUser);
      loadData();
      return true;
  };

  const handleGlobalGenerateReport = async (fromDateStr: string, toDateStr: string, title?: string, data?: RecordFile[]) => {
      if (!currentUser) return;
      setIsGeneratingReport(true);
      setGlobalReportContent(''); 
      const from = new Date(fromDateStr); from.setHours(0, 0, 0, 0); 
      const to = new Date(toDateStr); to.setHours(23, 59, 59, 999); 
      
      let filtered = data;
      if (!filtered) {
          filtered = records.filter(r => { if(!r.receivedDate) return false; const rDate = new Date(r.receivedDate); return rDate >= from && rDate <= to; });
      }

      const formatDateVN = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      try {
          const scope = currentUser.role === UserRole.EMPLOYEE ? 'personal' : 'general';
          const result = await generateReport(filtered!, `Từ ngày ${formatDateVN(from)} đến ngày ${formatDateVN(to)}`, scope, currentUser.name, title);
          setGlobalReportContent(result);
      } catch (error) { setGlobalReportContent("Không thể tạo báo cáo. Vui lòng kiểm tra API Key."); } 
      finally { setIsGeneratingReport(false); }
  };

  const onImportRecords = async (data: RecordFile[], mode: 'create' | 'update', onProgress?: (processed: number, total: number) => void) => {
      if (mode === 'create') {
          const result = await handleImportRecords(data, onProgress);
          if (result) {
              setToast({ type: 'success', message: `Đã nhập thành công ${data.length} hồ sơ mới.` });
              loadData();
              return true;
          } else {
              setToast({ type: 'error', message: "Lỗi khi nhập dữ liệu. Vui lòng thử lại." });
              return false;
          }
      } else {
          const result = await forceUpdateRecordsBatchApi(data, onProgress);
          if (result.success) {
              setToast({ type: 'success', message: `Đã cập nhật thành công ${result.count} hồ sơ.` });
              loadData();
              return true;
          } else {
              setToast({ type: 'error', message: "Lỗi khi cập nhật dữ liệu. Vui lòng thử lại." });
              return false;
          }
      }
  };

  const toggleSelectAll = useCallback(() => {
      if (selectedRecordIds.size === recordFilterProps.paginatedRecords.length && recordFilterProps.paginatedRecords.length > 0) setSelectedRecordIds(new Set());
      else setSelectedRecordIds(new Set(recordFilterProps.paginatedRecords.map(r => r.id)));
  }, [selectedRecordIds, recordFilterProps.paginatedRecords]);

  const toggleSelectRecord = useCallback((id: string) => {
      setSelectedRecordIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
          return newSet;
      });
  }, []);

  const confirmAssign = async (employeeId: string) => {
      const nowStr = new Date().toISOString();
      const updatedIds = assignTargetRecords.map(r => r.id);
      
      const updates: any = {
          assignedTo: employeeId,
          status: RecordStatus.IN_PROGRESS,
          assignedDate: nowStr,
          submissionDate: null,
          approvalDate: null,
          completedDate: null,
          resultReturnedDate: null,
          exportBatch: null,
          exportDate: null
      };

      setRecords(prev => prev.map(r => updatedIds.includes(r.id) ? { ...r, ...updates } : r));
      await Promise.all(assignTargetRecords.map(r => updateRecordApi({ ...r, ...updates } as any)));
      setIsAssignModalOpen(false); 
      setSelectedRecordIds(new Set()); 
      setToast({ type: 'success', message: `Đã giao việc và chuyển sang Đang thực hiện cho ${assignTargetRecords.length} hồ sơ thành công!` });
  };

  const handleBatchAutoAssign = async (selectedIds: Set<string>, currentViewStr: string) => {
      const targets = records.filter(r => selectedIds.has(r.id));
      if (targets.length === 0) return;
      
      const getTargetTeamForView = (view: string): string => {
         const v = view.toLowerCase();
         if (v.includes('registration')) return 'Tổ Cấp giấy';
         if (v.includes('archive')) return 'Tổ Lưu trữ';
         if (v.includes('congvan')) return 'Tổ Lưu trữ';
         if (v.includes('other')) return 'Tổ Hành chính';
         return 'Tổ Đo đạc';
      };
      
      const targetTeamName = getTargetTeamForView(currentViewStr);
      const teamEmployees = employees.filter(emp => getEmployeeTeam(emp) === targetTeamName);
      
      const nowStr = new Date().toISOString();
      const updatedRecords: RecordFile[] = [];
      const assignedCount: { [empName: string]: number } = {};
      let autoAssignedCount = 0;
      let skippedCount = 0;
      
      for (const r of targets) {
          const rWard = r.ward ? removeVietnameseTones(r.ward).toLowerCase().trim() : '';
          let matchedEmp: Employee | undefined = undefined;
          
          if (rWard) {
              matchedEmp = teamEmployees.find(emp => 
                  emp.managedWards && emp.managedWards.some(w => 
                      removeVietnameseTones(w).toLowerCase().trim() === rWard
                  )
              );
              if (!matchedEmp) {
                  matchedEmp = employees.find(emp => 
                      emp.managedWards && emp.managedWards.some(w => 
                          removeVietnameseTones(w).toLowerCase().trim() === rWard
                      )
                  );
              }
          }
          
          if (matchedEmp) {
              const updates: any = {
                  assignedTo: matchedEmp.id,
                  status: RecordStatus.IN_PROGRESS,
                  assignedDate: nowStr,
                  submissionDate: null,
                  approvalDate: null,
                  completedDate: null,
                  resultReturnedDate: null,
                  exportBatch: null,
                  exportDate: null
              };
              
              updatedRecords.push({ ...r, ...updates });
              assignedCount[matchedEmp.name] = (assignedCount[matchedEmp.name] || 0) + 1;
              autoAssignedCount++;
          } else {
              skippedCount++;
          }
      }
      
      if (autoAssignedCount === 0) {
          await confirmAction("Không tìm thấy cán bộ phụ trách phù hợp với địa bàn của các hồ sơ đã chọn. Vui lòng kiểm tra lại cấu hình địa bàn của nhân viên.", "Thông báo");
          return;
      }
      
      const confirmMsg = `Hệ thống đã tìm thấy cán bộ phụ trách phù hợp cho ${autoAssignedCount}/${targets.length} hồ sơ:\n` +
          Object.entries(assignedCount).map(([name, count]) => `- ${name}: ${count} hồ sơ`).join('\n') +
          (skippedCount > 0 ? `\n- Không tìm thấy người phụ trách cho ${skippedCount} hồ sơ (sẽ giữ nguyên chưa giao).` : '') +
          `\n\nBạn có chắc chắn muốn thực hiện giao đồng loạt không?`;
          
      if (await confirmAction(confirmMsg, "Xác nhận Giao đồng loạt")) {
          setRecords(prev => prev.map(r => {
              const updated = updatedRecords.find(ur => ur.id === r.id);
              return updated ? updated : r;
          }));
          
          await Promise.all(updatedRecords.map(r => updateRecordApi(r)));
          setSelectedRecordIds(new Set());
          setToast({ 
              type: 'success', 
              message: `Đã giao đồng loạt ${autoAssignedCount} hồ sơ thành công!` + 
                  (skippedCount > 0 ? ` (Bỏ qua ${skippedCount} hồ sơ không tìm thấy người phụ trách)` : '')
          });
      }
  };

  const getUpdatesForStatusChange = (newStatus: RecordStatus, customDateStr?: string) => {
      const targetDateStr = customDateStr || new Date().toISOString();
      const updates: any = { status: newStatus };

      switch (newStatus) {
          case RecordStatus.RECEIVED:
              updates.assignedDate = null;
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              updates.exportBatch = null;
              updates.exportDate = null;
              break;
          case RecordStatus.ASSIGNED:
          case RecordStatus.IN_PROGRESS:
              updates.assignedDate = targetDateStr;
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              updates.exportBatch = null;
              updates.exportDate = null;
              break;
          // MỚI: Trạng thái Đã thực hiện
          case RecordStatus.COMPLETED_WORK:
              // Giữ nguyên assignedDate
              updates.completedWorkDate = targetDateStr;
              updates.pendingCheckDate = null;
              updates.checkedDate = null;
              updates.submissionDate = null; 
              updates.approvalDate = null;
              updates.completedDate = null;
              break;
          case RecordStatus.PENDING_CHECK:
              updates.pendingCheckDate = targetDateStr;
              updates.checkedDate = null;
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.CHECKED:
              updates.checkedDate = targetDateStr;
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.PENDING_SIGN:
              updates.submissionDate = targetDateStr; 
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.SIGNED:
              updates.approvalDate = targetDateStr; 
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.HANDOVER:
              updates.completedDate = targetDateStr; 
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.RETURNED:
              updates.resultReturnedDate = targetDateStr;
              if (!updates.completedDate) updates.completedDate = targetDateStr;
              break;
      }
      return updates;
  };

  const handleBulkUpdate = async (field: keyof RecordFile, value: any, customDateStr?: string) => {
      const selectedIds = Array.from(selectedRecordIds);
      let baseUpdates: any = { [field]: value };
      const targetDateStr = customDateStr || new Date().toISOString();

      if (field === 'status') {
          baseUpdates = getUpdatesForStatusChange(value as RecordStatus, targetDateStr);
      } else if (field === 'deadline' || field === 'receivedDate') {
          baseUpdates[field] = targetDateStr;
      }
      
      if (field === 'assignedTo') {
          baseUpdates.assignedDate = targetDateStr;
          baseUpdates.status = RecordStatus.ASSIGNED;
          baseUpdates.submissionDate = null;
          baseUpdates.approvalDate = null;
          baseUpdates.completedDate = null;
          baseUpdates.resultReturnedDate = null;
          baseUpdates.exportBatch = null;
          baseUpdates.exportDate = null;
      }

      // Calculate the specific, fully-elaborated target records upfront
      const updatedTargets = records
          .filter(r => selectedIds.includes(r.id))
          .map(r => {
              let recordUpdates = { ...baseUpdates };
              if (field === 'status' && (value === RecordStatus.REJECTED || value === RecordStatus.WITHDRAWN)) {
                  recordUpdates.completedDate = r.completedDate || targetDateStr;
                  const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];
                  const prevIdx = flow.indexOf(r.status);
                  if (prevIdx >= 0) {
                      if (prevIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !r.assignedDate) recordUpdates.assignedDate = targetDateStr;
                      if (prevIdx >= flow.indexOf(RecordStatus.COMPLETED_WORK) && !r.completedWorkDate) recordUpdates.completedWorkDate = targetDateStr;
                      if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !r.pendingCheckDate) recordUpdates.pendingCheckDate = targetDateStr;
                      if (prevIdx >= flow.indexOf(RecordStatus.CHECKED) && !r.checkedDate) recordUpdates.checkedDate = targetDateStr;
                      if (prevIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !r.submissionDate) recordUpdates.submissionDate = targetDateStr;
                      if (prevIdx >= flow.indexOf(RecordStatus.SIGNED) && !r.approvalDate) recordUpdates.approvalDate = targetDateStr;
                  }
              }
              return { ...r, ...recordUpdates };
          });

      setRecords(prev => prev.map(r => {
          const updated = updatedTargets.find(u => u.id === r.id);
          return updated ? updated : r;
      }));
      
      await Promise.all(updatedTargets.map(r => updateRecordApi(r)));
      setToast({ type: 'success', message: `Đã cập nhật ${selectedIds.length} hồ sơ thành công!` });
      setSelectedRecordIds(new Set()); 
  };

  const handleQuickUpdate = useCallback(async (id: string, field: keyof RecordFile, value: string) => {
      const record = records.find(r => r.id === id); 
      if (!record) return;

      const nowStr = new Date().toISOString();
      let updates: any = { [field]: value };
      
      if (field === 'assignedTo') {
          updates.assignedDate = nowStr;
          updates.status = RecordStatus.ASSIGNED;
          updates.submissionDate = null;
          updates.approvalDate = null;
          updates.completedDate = null;
          updates.resultReturnedDate = null;
          updates.exportBatch = null;
          updates.exportDate = null;
      } else if (field === 'status') {
          updates = getUpdatesForStatusChange(value as RecordStatus);
          
          if (value === RecordStatus.REJECTED || value === RecordStatus.WITHDRAWN) {
              updates.completedDate = record.completedDate || nowStr;
              const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];
              const prevIdx = flow.indexOf(record.status);
              if (prevIdx >= 0) {
                  if (prevIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !record.assignedDate) updates.assignedDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.COMPLETED_WORK) && !record.completedWorkDate) updates.completedWorkDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !record.pendingCheckDate) updates.pendingCheckDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.CHECKED) && !record.checkedDate) updates.checkedDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !record.submissionDate) updates.submissionDate = nowStr;
                  if (prevIdx >= flow.indexOf(RecordStatus.SIGNED) && !record.approvalDate) updates.approvalDate = nowStr;
              }
          }
      }

      setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      try { 
          await updateRecordApi({ ...record, ...updates }); 
      } catch (e) { 
          console.error("Quick update failed", e); 
      }
  }, [records, employees]);

  const handleOpenReturnModal = useCallback((record: RecordFile) => {
      setReturnRecord(record);
      setIsReturnModalOpen(true);
  }, []);

  const handleConfirmReturnResult = useCallback(async (receiptNumber: string, receiverName: string, receiptType: 'receipt' | 'invoice', paymentAmount: number | null) => {
      if (!returnRecord) return;
      const nowStr = new Date().toISOString();
      const updates = { 
          resultReturnedDate: nowStr, 
          status: RecordStatus.RETURNED, 
          receiptNumber: receiptNumber, 
          receiverName: receiverName,
          receiptType: receiptType,
          paymentAmount: paymentAmount
      }; 
      setRecords(prev => prev.map(r => r.id === returnRecord.id ? { ...r, ...updates } : r));
      await updateRecordApi({ ...returnRecord, ...updates });
      setToast({ type: 'success', message: `Đã ghi nhận trả kết quả hồ sơ ${returnRecord.code} cho ${receiverName}.` });
      setReturnRecord(null);
  }, [returnRecord]);

  const handleMapCorrectionRequest = useCallback(async (record: RecordFile) => {
      const newValue = !record.needsMapCorrection;
      const updatedRecord = { ...record, needsMapCorrection: newValue };
      setRecords(prev => prev.map(r => r.id === record.id ? updatedRecord : r));
      await updateRecordApi(updatedRecord);
      if (newValue) {
          setRecordForMapCorrection(updatedRecord);
          setCurrentView('utilities');
          setToast({ type: 'success', message: `Đã chuyển hồ sơ ${record.code} sang tiện ích chỉnh lý bản đồ.` });
      } else {
          setToast({ type: 'success', message: `Đã HỦY yêu cầu chỉnh lý cho hồ sơ ${record.code}.` });
      }
  }, []);

  const advanceStatus = useCallback(async (record: RecordFile) => {
      if (record.status === RecordStatus.REJECTED) {
          const isReg = isRegType(record.recordType);
          const updates = getUpdatesForStatusChange(RecordStatus.IN_PROGRESS);
          updates.hasDefect = isReg;
          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));
          await updateRecordApi({ ...record, ...updates });
          setToast({ type: 'success', message: `Hồ sơ trả ${record.code} đã được tiếp nhận lại và chuyển sang Đang thực hiện.` });
          return;
      }

      if (record.status === RecordStatus.RECEIVED) { 
          setAssignTargetRecords([record]); 
          setIsAssignModalOpen(true); 
          return; 
      }

      const isGCN = !!record.recordType && (
          record.recordType.includes('Cấp giấy') || 
          record.recordType.includes('cấp giấy')
      );

      if (isGCN) {
          // 1. Bước Phiếu chuyển thuế (IN_PROGRESS -> COMPLETED_WORK): Nhập số thửa mới, tờ mới, diện tích khi trình ký thuế
          if (record.status === RecordStatus.IN_PROGRESS && record.hasTax) {
              setTaxTargetRecord(record);
              setTaxLandPlot(record.landPlot || '');
              setTaxMapSheet(record.mapSheet || '');
              setTaxArea(record.area ? String(record.area) : '');
              setTaxModalOpen(true);
              return;
          }

          // 2. Bước In GCN (PENDING_CHECK -> CHECKED hoặc IN_PROGRESS -> CHECKED nếu không thuế): Nhập số phôi mới trước khi trình thẩm tra
          if (record.status === RecordStatus.PENDING_CHECK || (record.status === RecordStatus.IN_PROGRESS && !record.hasTax)) {
              setFoilTargetRecord(record);
              setFoilNumber(record.issueNumber || '');
              setFoilModalOpen(true);
              return;
          }

          // 3. Bước Trình ký GCN (PENDING_SIGN -> SIGNED): Tự động vào sổ vô số cấp giấy và chuyển sang Chờ giao 1 cửa
          if (record.status === RecordStatus.PENDING_SIGN) {
              if (await confirmAction(`Xác nhận hoàn thành trình ký hồ sơ ${record.code}, tự động cập nhật vào sổ vô số cấp giấy và chuyển sang Chờ giao 1 cửa?`)) {
                  const nowStr = new Date().toISOString();
                  const nextVaoSoStr = await calculateNextVaoSoNumber();
                  
                  // Chuyển sang SIGNED (Chờ giao 1 cửa) thay vì HANDOVER (Đã giao)
                  const recordUpdates = {
                      ...getUpdatesForStatusChange(RecordStatus.SIGNED, nowStr),
                      entryNumber: nextVaoSoStr
                  };
                  
                  setRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...recordUpdates } : r));
                  await updateRecordApi({ ...record, ...recordUpdates });
                  
                  // Tự động tạo hồ sơ Sổ vô số cấp giấy (ArchiveRecord type 'vaoso')
                  let combinedOwner = record.customerName;
                  if (record.cccd) combinedOwner += `\nCCCD: ${record.cccd}`;
                  if (record.customerAddress) combinedOwner += `\nĐịa chỉ: ${record.customerAddress}`;
                  
                  const vaoSoRecord = {
                      type: 'vaoso' as const,
                      status: 'completed' as const,
                      so_hieu: record.code,
                      trich_yeu: `Vào sổ cấp giấy chứng nhận cho hộ ông/bà ${record.customerName}`,
                      ngay_thang: nowStr,
                      noi_nhan_gui: record.ward || '',
                      data: {
                          so_vao_so: nextVaoSoStr,
                          ma_ho_so: record.code,
                          ten_chu_su_dung: combinedOwner,
                          loai_bien_dong: record.recordType || 'Cấp mới GCN',
                          loai_gcn: 'GCN mới',
                          ngay_nhan: record.receivedDate || nowStr,
                          so_phat_hanh: record.issueNumber || '',
                          ngay_ky_gcn: nowStr
                      }
                  };
                  
                  await saveArchiveRecord(vaoSoRecord);
                  setToast({ type: 'success', message: `Hồ sơ ${record.code} đã được trình ký và đưa vào Chờ giao 1 cửa, đồng thời tự động cập nhật vào sổ vô số cấp giấy với số hiệu: ${nextVaoSoStr}!` });
              }
              return;
          }
      }

      if (record.status === RecordStatus.IN_PROGRESS) {
          // Tất cả các loại hồ sơ (kể cả Lưu trữ, Công văn) đều đồng bộ đi sang Trình kiểm tra
          setSubmitTargetRecords([record]);
          setIsSubmitCheckModalOpen(true);
          return;
      }
      if (record.status === RecordStatus.PENDING_CHECK) {
          // Trực tiếp sang Trình ký (bỏ qua bước Đã kiểm tra trung gian)
          setSubmitTargetRecords([record]);
          setIsSubmitModalOpen(true);
          return;
      }
      if (record.status === RecordStatus.COMPLETED_WORK) {
          setSubmitTargetRecords([record]);
          setIsSubmitCheckModalOpen(true);
          return;
      }
      if (record.status === RecordStatus.CHECKED) {
          setSubmitTargetRecords([record]);
          setIsSubmitModalOpen(true);
          return;
      }
      
      const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];
      const idx = flow.indexOf(record.status);
      if (idx < flow.length - 1) {
          let nextStatus = flow[idx + 1];
          if (nextStatus === RecordStatus.HANDOVER && record.hasDefect) {
              nextStatus = RecordStatus.REJECTED;
          }
          const updates = getUpdatesForStatusChange(nextStatus);
          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));
          await updateRecordApi({ ...record, ...updates });
      }
  }, []);

  const executeBatchExport = async (batchNumber: number, batchDate: string, handoverWard?: string, updatedRecords?: RecordFile[]) => {
      const nowStr = new Date().toISOString();
      const candidates = selectedRecordIds.size > 0 ? records.filter(r => selectedRecordIds.has(r.id)) : recordFilterProps.filteredRecords;
      const recordsToExport = candidates.filter(r => r.status === RecordStatus.SIGNED || r.hasDefect || ((r.status === RecordStatus.REJECTED || r.status === RecordStatus.WITHDRAWN) && !r.exportBatch));
      if (recordsToExport.length === 0) return;
      const updatesToApply = recordsToExport.map(r => {
          const nextStatus = r.status === RecordStatus.WITHDRAWN 
              ? RecordStatus.WITHDRAWN 
              : (r.status === RecordStatus.REJECTED || r.hasDefect) 
                  ? RecordStatus.REJECTED 
                  : RecordStatus.HANDOVER;
          
          const localUpdate = updatedRecords?.find(u => u.id === r.id);
          const transferToDNLis = localUpdate ? localUpdate.transferToDNLis : r.transferToDNLis;

          return { 
              ...r, 
              exportBatch: batchNumber, 
              exportDate: batchDate, 
              status: nextStatus, 
              completedDate: r.completedDate || nowStr, 
              handoverWard: handoverWard || r.handoverWard,
              transferToDNLis
          };
      });
      setRecords(prev => prev.map(r => {
          const updated = updatesToApply.find(u => u.id === r.id);
          return updated ? updated : r;
      }));
      const results = await Promise.all(updatesToApply.map(r => updateRecordApi(r)));
      if (results.some(res => res === null)) {
          loadData(); // Revert on failure
          return;
      }
      setSelectedRecordIds(new Set()); 
      setToast({ type: 'success', message: `Đã chốt danh sách ĐỢT ${batchNumber} thành công.` });
  };

  const handleConfirmSignBatch = async () => {
      if (!canPerformAction) return;
      const pendingSign = recordFilterProps.filteredRecords.filter(r => r.status === RecordStatus.PENDING_SIGN);
      if (pendingSign.length === 0) { alert("Không có hồ sơ nào đang chờ ký."); return; }
      if(await confirmAction(`Xác nhận chuyển ${pendingSign.length} hồ sơ sang "Đã ký"?`)) {
          const nowStr = new Date().toISOString();
          const updates = { status: RecordStatus.SIGNED, approvalDate: nowStr, completedDate: null };
          setRecords(prev => prev.map(r => pendingSign.find(p => p.id === r.id) ? { ...r, ...updates } : r));
          await Promise.all(pendingSign.map(r => updateRecordApi({ ...r, ...updates })));
          setToast({ type: 'success', message: `Đã chuyển ${pendingSign.length} hồ sơ sang "Đã ký".` });
      }
  };

  const handleExportReturnedList = () => {
      if (!canPerformAction) return;
      exportReturnedListToExcel(recordFilterProps.filteredRecords, recordFilterProps.filterFromDate, recordFilterProps.filterToDate, recordFilterProps.filterWard);
  };

  const handleMarkAsRejected = async () => {
      if (selectedRecordIds.size === 0) return;
      const targets = records.filter(r => selectedRecordIds.has(r.id));
      setRejectRecordsTarget(targets);
      setIsRejectReasonModalOpen(true);
  };

  const handleConfirmRejectRecords = async (reason: string) => {
      if (rejectRecordsTarget.length === 0) return;
      const nowStr = new Date().toISOString();
      const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_CHECK, RecordStatus.CHECKED, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];

      // Format Vietnamese date
      const formattedDate = new Date().toLocaleDateString('vi-VN');
      const rejectPrefix = `[Trả hồ sơ ngày ${formattedDate}]: ${reason}`;

      const updatesToApply = rejectRecordsTarget.map(r => {
         const isReg = isRegType(r.recordType);
         const updates: any = { 
             status: RecordStatus.REJECTED, 
             completedDate: r.completedDate || nowStr,
             rejectDate: nowStr,
             rejectReason: reason,
             hasDefect: isReg
         };
         
         let currentNotesObj: any = {};
         if (r.notes && r.notes.startsWith('{') && r.notes.endsWith('}')) {
             try {
                 currentNotesObj = JSON.parse(r.notes);
             } catch (e) {
                 // ignore
             }
         }
         const updatedNotesObj = {
             ...currentNotesObj,
             rejectReason: reason,
             rejectDate: nowStr
         };
         updates.notes = JSON.stringify(updatedNotesObj);
         
         updates.privateNotes = r.privateNotes 
             ? `${rejectPrefix}\n${r.privateNotes}` 
             : rejectPrefix;

         const prevIdx = flow.indexOf(r.status);
         if (prevIdx >= 0) {
             if (prevIdx >= flow.indexOf(RecordStatus.ASSIGNED) && !r.assignedDate) updates.assignedDate = nowStr;
             if (prevIdx >= flow.indexOf(RecordStatus.COMPLETED_WORK) && !r.completedWorkDate) updates.completedWorkDate = nowStr;
             if (prevIdx >= flow.indexOf(RecordStatus.PENDING_CHECK) && !r.pendingCheckDate) updates.pendingCheckDate = nowStr;
             if (prevIdx >= flow.indexOf(RecordStatus.CHECKED) && !r.checkedDate) updates.checkedDate = nowStr;
             if (prevIdx >= flow.indexOf(RecordStatus.PENDING_SIGN) && !r.submissionDate) updates.submissionDate = nowStr;
             if (prevIdx >= flow.indexOf(RecordStatus.SIGNED) && !r.approvalDate) updates.approvalDate = nowStr;
         }
         return { ...r, ...updates };
      });
      
      setRecords(prev => prev.map(r => {
          const updated = updatesToApply.find(u => u.id === r.id);
          return updated ? updated : r;
      }));
      
      await Promise.all(updatesToApply.map(r => updateRecordApi(r)));
      
      setSelectedRecordIds(new Set());
      setIsRejectReasonModalOpen(false);
      setRejectRecordsTarget([]);
      setToast({ type: 'success', message: `Đã trả ${updatesToApply.length} hồ sơ về Bộ phận 1 cửa thành công!` });
  };

  const renderGcnWorkflowModals = () => {
      return (
          <>
              {/* Tax Info Modal */}
              {taxModalOpen && taxTargetRecord && (
                  <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
                      <div className="bg-white rounded-xl shadow-2xl border border-indigo-100 w-full max-w-md overflow-hidden animate-fade-in-up text-left">
                          <div className="bg-indigo-600 px-5 py-3 text-white font-bold text-sm flex items-center justify-between">
                               <span>NHẬP THÔNG TIN TRÌNH KÝ THUẾ</span>
                               <button onClick={() => { setTaxModalOpen(false); setTaxTargetRecord(null); }} className="text-white/80 hover:text-white font-bold">✕</button>
                          </div>
                          <div className="p-5 space-y-4">
                              <p className="text-xs text-gray-600 leading-relaxed">
                                  Vui lòng nhập thông tin số thửa mới, tờ mới, diện tích cho hồ sơ <strong>{taxTargetRecord.code}</strong>:
                              </p>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Số thửa mới</label>
                                  <input 
                                      type="text" 
                                      value={taxLandPlot} 
                                      onChange={e => setTaxLandPlot(e.target.value)} 
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                      placeholder="Ví dụ: 124"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tờ bản đồ mới</label>
                                  <input 
                                      type="text" 
                                      value={taxMapSheet} 
                                      onChange={e => setTaxMapSheet(e.target.value)} 
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                      placeholder="Ví dụ: 45"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Diện tích (m²)</label>
                                  <input 
                                      type="number" 
                                      value={taxArea} 
                                      onChange={e => setTaxArea(e.target.value)} 
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                      placeholder="Ví dụ: 150"
                                  />
                              </div>
                              <div className="flex justify-end gap-2 pt-2">
                                  <button
                                      onClick={() => { setTaxModalOpen(false); setTaxTargetRecord(null); }}
                                      className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                  >
                                      Hủy bỏ
                                  </button>
                                  <button
                                      onClick={async () => {
                                          if (!taxTargetRecord) return;
                                          const nowStr = new Date().toISOString();
                                          const updates = {
                                              status: RecordStatus.COMPLETED_WORK,
                                              landPlot: taxLandPlot,
                                              mapSheet: taxMapSheet,
                                              area: taxArea ? parseFloat(taxArea) : null,
                                              completedWorkDate: nowStr
                                          };
                                          setRecords(prev => prev.map(r => r.id === taxTargetRecord.id ? { ...r, ...updates } : r));
                                          await updateRecordApi({ ...taxTargetRecord, ...updates });
                                          setToast({ type: 'success', message: `Đã cập nhật thông tin thửa mới và chuyển sang Trình ký Thuế!` });
                                          setTaxModalOpen(false);
                                          setTaxTargetRecord(null);
                                      }}
                                      className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                                  >
                                      Xác nhận
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {/* Foil Info Modal */}
              {foilModalOpen && foilTargetRecord && (
                  <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
                      <div className="bg-white rounded-xl shadow-2xl border border-teal-100 w-full max-w-md overflow-hidden animate-fade-in-up text-left">
                          <div className="bg-teal-600 px-5 py-3 text-white font-bold text-sm flex items-center justify-between">
                               <span>NHẬP SỐ PHÔI GCN MỚI</span>
                               <button onClick={() => { setFoilModalOpen(false); setFoilTargetRecord(null); }} className="text-white/80 hover:text-white font-bold">✕</button>
                          </div>
                          <div className="p-5 space-y-4">
                              <p className="text-xs text-gray-600 leading-relaxed">
                                  Vui lòng nhập số phôi GCN mới cho hồ sơ <strong>{foilTargetRecord.code}</strong> trước khi trình thẩm tra:
                              </p>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Số phôi GCN mới</label>
                                  <input 
                                      type="text" 
                                      value={foilNumber} 
                                      onChange={e => setFoilNumber(e.target.value)} 
                                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                      placeholder="Ví dụ: CO 123456"
                                  />
                              </div>
                              <div className="flex justify-end gap-2 pt-2">
                                  <button
                                      onClick={() => { setFoilModalOpen(false); setFoilTargetRecord(null); }}
                                      className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                  >
                                      Hủy bỏ
                                  </button>
                                  <button
                                      onClick={async () => {
                                          if (!foilTargetRecord) return;
                                          const nowStr = new Date().toISOString();
                                          const updates = {
                                              status: RecordStatus.CHECKED,
                                              issueNumber: foilNumber,
                                              checkedDate: nowStr
                                          };
                                          setRecords(prev => prev.map(r => r.id === foilTargetRecord.id ? { ...r, ...updates } : r));
                                          await updateRecordApi({ ...foilTargetRecord, ...updates });
                                          setToast({ type: 'success', message: `Đã cập nhật số phôi GCN mới và chuyển sang Thẩm tra!` });
                                          setFoilModalOpen(false);
                                          setFoilTargetRecord(null);
                                      }}
                                      className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                                  >
                                      Xác nhận
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </>
      );
  };

  if (!currentUser) return <Login onLogin={setCurrentUser} users={users} />;

  if (isMobile) {
    return (
      <MobileLayout
        currentUser={currentUser}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onLogout={() => setCurrentUser(null)}
        unreadMessages={unreadMessages}
        activeRemindersCount={activeRemindersCount}
      >
        <MobileRoutes
          currentView={currentView}
          setCurrentView={setCurrentView}
          currentUser={currentUser}
          records={records}
          employees={employees}
          users={users}
          wards={wards}
          holidays={holidays}
          handleViewRecord={(r) => setViewingRecord(r)}
          setEditingRecord={setEditingRecord}
          setIsModalOpen={setIsModalOpen}
          setDeletingRecord={setDeletingRecord}
          setIsDeleteModalOpen={setIsDeleteModalOpen}
          handleUpdateCurrentAccount={handleUpdateCurrentAccount}
          notificationEnabled={notificationEnabled}
          setNotificationEnabled={setNotificationEnabled}
          setUnreadMessages={setUnreadMessages}
          onLogout={() => setCurrentUser(null)}
          onAddUser={(u) => { saveUserApi(u, false).then(res => { if(res) { setUsers(prev => [...prev, res]); loadData(); } }); }}
          onUpdateUser={(u) => handleUpdateUser(u, true)}
          onDeleteUser={handleDeleteUser}
          onSaveEmployee={handleSaveEmployee}
          onDeleteEmployee={handleDeleteEmployee}
          onDeleteAllData={handleDeleteAllData}
          onHolidaysChanged={loadData}
        />
        
        <AppModals 
            isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen}
            isImportModalOpen={isImportModalOpen} setIsImportModalOpen={setIsImportModalOpen}
            isSettingsOpen={false} setIsSettingsOpen={() => {}} 
            isAssignModalOpen={isAssignModalOpen} setIsAssignModalOpen={setIsAssignModalOpen}
            isDeleteModalOpen={isDeleteModalOpen} setIsDeleteModalOpen={setIsDeleteModalOpen}
            isExportModalOpen={isExportModalOpen} setIsExportModalOpen={setIsExportModalOpen}
            isAddToBatchModalOpen={isAddToBatchModalOpen} setIsAddToBatchModalOpen={setIsAddToBatchModalOpen}
            isExcelPreviewOpen={isExcelPreviewOpen} setIsExcelPreviewOpen={setIsExcelPreviewOpen}
            isBulkUpdateModalOpen={isBulkUpdateModalOpen} setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
            isReturnModalOpen={isReturnModalOpen} setIsReturnModalOpen={setIsReturnModalOpen}
            
            editingRecord={editingRecord} setEditingRecord={setEditingRecord}
            viewingRecord={viewingRecord} setViewingRecord={setViewingRecord}
            deletingRecord={deletingRecord} setDeletingRecord={setDeletingRecord}
            returnRecord={returnRecord} setReturnRecord={setReturnRecord}
            assignTargetRecords={assignTargetRecords}
            exportModalType={exportModalType}
            
            previewWorkbook={previewWorkbook} previewExcelName={previewExcelName}

            handleAddOrUpdate={handleAddOrUpdateRecord}
            handleImportRecords={onImportRecords}
            handleSaveEmployee={handleSaveEmployee}
            handleDeleteEmployee={handleDeleteEmployee}
            handleDeleteAllData={handleDeleteAllData}
            onRefreshData={loadData}
            confirmAssign={confirmAssign}
            handleDeleteRecord={() => { if(deletingRecord) handleDeleteRecord(deletingRecord.id); }}
            confirmDelete={(r) => handleDeleteRecord(r.id)}
            handleExcelPreview={(wb, name) => { setPreviewWorkbook(wb); setPreviewExcelName(name); setIsExcelPreviewOpen(true); }}
            executeBatchExport={executeBatchExport}
            onCreateLiquidation={(r) => { setRecordToLiquidate(r); setCurrentView('receive_contract'); }}
            handleBulkUpdate={handleBulkUpdate}
            confirmReturnResult={handleConfirmReturnResult}

            employees={employees}
            users={users}
            currentUser={currentUser}
            wards={wards}
            filteredRecords={recordFilterProps.filteredRecords}
            records={records}
            selectedCount={selectedRecordIds.size}
            canPerformAction={canPerformAction}
            selectedRecordsForBulk={records.filter(r => selectedRecordIds.has(r.id))}
            currentView={currentView}
            holidays={holidays}
        />

        {toast && (
            <div className={`fixed bottom-20 right-4 px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up z-50 flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                {toast.message}
            </div>
        )}
        {renderGcnWorkflowModals()}
        <GlobalConfirmModal />
        <GlobalAlertModal />
      </MobileLayout>
    );
  }

  return (
    <MainLayout
        currentUser={currentUser}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onLogout={() => setCurrentUser(null)}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isGeneratingReport={isGeneratingReport}
        isUpdateAvailable={false} 
        latestVersion={latestVersion}
        updateUrl={updateUrl}
        unreadMessages={unreadMessages}
        warningCount={recordFilterProps.warningCount}
        activeRemindersCount={activeRemindersCount}
        connectionStatus={connectionStatus}
        onSyncSuccess={loadData}
        rolePermissions={rolePermissions}
        departmentPermissions={departmentPermissions}
        employees={employees}
        showUpdateModal={isUpdateAvailable && !updateDeferred}
        updateVersion={latestVersion}
        updateDownloadStatus={updateStatus}
        updateProgress={updateProgress}
        updateSpeed={updateSpeed}
        onUpdateNow={handleUpdateNow}
        onUpdateLater={handleUpdateLater}
    >
        <AppRoutes 
            currentView={currentView}
            setCurrentView={setCurrentView}
            currentUser={currentUser}
            records={records}
            employees={employees}
            users={users}
            wards={wards}
            holidays={holidays}
            rolePermissions={rolePermissions}
            departmentPermissions={departmentPermissions}
            
            setUnreadMessages={setUnreadMessages}
            notificationEnabled={notificationEnabled}
            setNotificationEnabled={setNotificationEnabled}
            recordToLiquidate={recordToLiquidate}
            setRecordToLiquidate={setRecordToLiquidate}
            recordForMapCorrection={recordForMapCorrection}
            
            handleViewRecord={(r) => setViewingRecord(r)}
            handleMapCorrectionRequest={handleMapCorrectionRequest}
            handleAddOrUpdateRecord={handleAddOrUpdateRecord}
            handleDeleteRecord={handleDeleteRecord}
            handleUpdateUser={handleUpdateUser}
            handleDeleteUser={handleDeleteUser}
            handleSaveEmployee={handleSaveEmployee}
            handleDeleteEmployee={handleDeleteEmployee}
            handleDeleteAllData={handleDeleteAllData}
            onRefreshData={loadData}
            setWards={setWards}
            onResetWards={() => setWards(STATIC_WARDS)}
            handleQuickUpdate={handleQuickUpdate}
            handleUpdateCurrentAccount={handleUpdateCurrentAccount}
            
            globalReportContent={globalReportContent}
            isGeneratingReport={isGeneratingReport}
            handleGlobalGenerateReport={handleGlobalGenerateReport}
            handleExportReportExcel={handleExportReportExcel}

            {...recordFilterProps}
            
            selectedRecordIds={selectedRecordIds}
            toggleSelectAll={toggleSelectAll}
            toggleSelectRecord={toggleSelectRecord}
            visibleColumns={visibleColumns}
            setVisibleColumns={setVisibleColumns}
            
            setIsModalOpen={setIsModalOpen}
            setEditingRecord={setEditingRecord}
            handleMarkAsRejected={handleMarkAsRejected}
            setIsImportModalOpen={setIsImportModalOpen}
            setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
            setIsAddToBatchModalOpen={setIsAddToBatchModalOpen}
            handleExportReturnedList={handleExportReturnedList}
            handleConfirmSignBatch={handleConfirmSignBatch}
            setAssignTargetRecords={setAssignTargetRecords}
            setIsAssignModalOpen={setIsAssignModalOpen}
            handleBatchAutoAssign={handleBatchAutoAssign}
            setSubmitTargetRecords={setSubmitTargetRecords}
            setIsSubmitModalOpen={setIsSubmitModalOpen}
            setIsSubmitCheckModalOpen={setIsSubmitCheckModalOpen}
            setExportModalType={setExportModalType}
            setIsExportModalOpen={setIsExportModalOpen}
            setDeletingRecord={setDeletingRecord}
            setIsDeleteModalOpen={setIsDeleteModalOpen}
            advanceStatus={advanceStatus}
            handleOpenReturnModal={handleOpenReturnModal}
        />

        <AppModals 
            isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen}
            isImportModalOpen={isImportModalOpen} setIsImportModalOpen={setIsImportModalOpen}
            isSettingsOpen={false} setIsSettingsOpen={() => {}} 
            isAssignModalOpen={isAssignModalOpen} setIsAssignModalOpen={setIsAssignModalOpen}
            isDeleteModalOpen={isDeleteModalOpen} setIsDeleteModalOpen={setIsDeleteModalOpen}
            isExportModalOpen={isExportModalOpen} setIsExportModalOpen={setIsExportModalOpen}
            isAddToBatchModalOpen={isAddToBatchModalOpen} setIsAddToBatchModalOpen={setIsAddToBatchModalOpen}
            isExcelPreviewOpen={isExcelPreviewOpen} setIsExcelPreviewOpen={setIsExcelPreviewOpen}
            isBulkUpdateModalOpen={isBulkUpdateModalOpen} setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
            isReturnModalOpen={isReturnModalOpen} setIsReturnModalOpen={setIsReturnModalOpen}
            
            editingRecord={editingRecord} setEditingRecord={setEditingRecord}
            viewingRecord={viewingRecord} setViewingRecord={setViewingRecord}
            deletingRecord={deletingRecord} setDeletingRecord={setDeletingRecord}
            returnRecord={returnRecord} setReturnRecord={setReturnRecord}
            assignTargetRecords={assignTargetRecords}
            exportModalType={exportModalType}
            
            previewWorkbook={previewWorkbook} previewExcelName={previewExcelName}

            handleAddOrUpdate={handleAddOrUpdateRecord}
            handleImportRecords={onImportRecords}
            handleSaveEmployee={handleSaveEmployee}
            handleDeleteEmployee={handleDeleteEmployee}
            handleDeleteAllData={handleDeleteAllData}
            onRefreshData={loadData}
            confirmAssign={confirmAssign}
            handleDeleteRecord={() => { if(deletingRecord) handleDeleteRecord(deletingRecord.id); }}
            confirmDelete={(r) => handleDeleteRecord(r.id)}
            handleExcelPreview={(wb, name) => { setPreviewWorkbook(wb); setPreviewExcelName(name); setIsExcelPreviewOpen(true); }}
            executeBatchExport={executeBatchExport}
            onCreateLiquidation={(r) => { setRecordToLiquidate(r); setCurrentView('receive_contract'); }}
            handleBulkUpdate={handleBulkUpdate}
            confirmReturnResult={handleConfirmReturnResult}

            employees={employees}
            users={users}
            currentUser={currentUser}
            wards={wards}
            filteredRecords={recordFilterProps.filteredRecords}
            records={records}
            selectedCount={selectedRecordIds.size}
            canPerformAction={canPerformAction}
            selectedRecordsForBulk={records.filter(r => selectedRecordIds.has(r.id))}
            currentView={currentView}
            holidays={holidays}
        />

        <SubmitModal 
            isOpen={isSubmitModalOpen}
            onClose={() => setIsSubmitModalOpen(false)}
            records={submitTargetRecords}
            users={users}
            employees={employees}
            currentUser={currentUser || undefined}
            onConfirm={async (directorId) => {
                try {
                    const nowStr = new Date().toISOString();
                    const updates = submitTargetRecords.map(r => {
                        const isLuuTru = r.recordType === 'Cung cấp tài liệu đất đai' || 
                                         r.recordType === 'Sao lục' || 
                                         r.recordType === 'Công văn';
                        if (isLuuTru) {
                            const responsibleId = r.assignedTo || currentUser?.employeeId || null;
                            return {
                                ...r,
                                status: RecordStatus.PENDING_SIGN,
                                completedWorkDate: r.completedWorkDate || nowStr,
                                pendingCheckDate: r.pendingCheckDate || nowStr,
                                checkedDate: r.checkedDate || nowStr,
                                checkedBy: r.checkedBy || responsibleId,
                                submissionDate: nowStr,
                                submittedTo: directorId
                            };
                        } else {
                            return {
                                ...r,
                                status: RecordStatus.PENDING_SIGN,
                                checkedDate: r.checkedDate || nowStr,
                                checkedBy: r.checkedBy || currentUser?.employeeId || null,
                                submissionDate: nowStr,
                                submittedTo: directorId
                            };
                        }
                    });
                    await updateRecordsBatchById(updates);
                    setToast({ type: 'success', message: `Đã trình ký ${updates.length} hồ sơ thành công!` });
                    setIsSubmitModalOpen(false);
                    setSubmitTargetRecords([]);
                    setSelectedRecordIds(new Set());
                    loadData();
                } catch (error) {
                    console.error("Lỗi khi trình ký:", error);
                    setToast({ type: 'error', message: 'Có lỗi xảy ra khi trình ký.' });
                }
            }}
        />

        <SubmitModal 
            isOpen={isSubmitCheckModalOpen}
            onClose={() => setIsSubmitCheckModalOpen(false)}
            records={submitTargetRecords}
            users={users}
            employees={employees}
            isCheckMode={true}
            currentUser={currentUser || undefined}
            onConfirm={async (checkerId) => {
                try {
                    const nowStr = new Date().toISOString();
                    const updates = submitTargetRecords.map(r => ({
                        ...r,
                        status: RecordStatus.PENDING_CHECK,
                        completedWorkDate: r.completedWorkDate || nowStr,
                        pendingCheckDate: nowStr,
                        checkedBy: checkerId
                    }));
                    await updateRecordsBatchById(updates);
                    setToast({ type: 'success', message: `Đã trình kiểm tra ${updates.length} hồ sơ thành công!` });
                    setIsSubmitCheckModalOpen(false);
                    setSubmitTargetRecords([]);
                    setSelectedRecordIds(new Set());
                    loadData();
                } catch (error) {
                    console.error("Lỗi khi trình kiểm tra:", error);
                    setToast({ type: 'error', message: 'Có lỗi xảy ra khi trình kiểm tra.' });
                }
            }}
        />

        <RejectReasonModal
            isOpen={isRejectReasonModalOpen}
            onClose={() => { setIsRejectReasonModalOpen(false); setRejectRecordsTarget([]); }}
            record={rejectRecordsTarget}
            onConfirm={handleConfirmRejectRecords}
        />

        {toast && (
            <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up z-50 flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                {toast.message}
            </div>
        )}
        {renderGcnWorkflowModals()}
        <GlobalConfirmModal />
        <GlobalAlertModal />
    </MainLayout>
  );
}

export default App;
