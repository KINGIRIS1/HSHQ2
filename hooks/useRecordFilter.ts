
import { useState, useMemo, useEffect } from 'react';
import { RecordFile, User, UserRole, RecordStatus, Employee } from '../types';
import { removeVietnameseTones, isRecordOverdue, isRecordApproaching } from '../utils/appHelpers';
import { REGISTRATION_PROCEDURES } from '../constants';

export const useRecordFilter = (
    records: RecordFile[],
    currentUser: User | null,
    currentView: string,
    employees: Employee[],
    users: User[] = []
) => {
    // Filter States
    // CẬP NHẬT: Sử dụng Object để lưu search term riêng cho từng view
    const [searchStates, setSearchStates] = useState<Record<string, string>>({});
    
    // Lấy search term của view hiện tại (mặc định rỗng nếu chưa có)
    const searchTerm = searchStates[currentView] || '';

    // Hàm set search term chỉ cập nhật cho view hiện tại
    const setSearchTerm = (term: string) => {
        setSearchStates(prev => ({
            ...prev,
            [currentView]: term
        }));
    };

    const [filterDate, setFilterDate] = useState(''); 
    const [filterSpecificDate, setFilterSpecificDate] = useState('');
    const [filterAssignedDate, setFilterAssignedDate] = useState('');
    const [filterFromDate, setFilterFromDate] = useState('');
    const [filterToDate, setFilterToDate] = useState('');
    const [showAdvancedDateFilter, setShowAdvancedDateFilter] = useState(false);
    
    const [filterWard, setFilterWard] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterEmployee, setFilterEmployee] = useState('all');
    const [warningFilter, setWarningFilter] = useState<'none' | 'overdue' | 'approaching'>('none');
    
    // Cập nhật type cho handoverTab để hỗ trợ 'returned'
    const [handoverTab, setHandoverTab] = useState<'today' | 'history' | 'returned'>('today');

    // Sorting & Pagination
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
        key: 'receivedDate',
        direction: 'desc'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [currentView, sortConfig, warningFilter, filterWard, filterStatus, filterEmployee, filterSpecificDate, filterAssignedDate, filterFromDate, filterToDate, handoverTab, searchTerm]);

    // --- WARNING CHECK LOGIC ---
    const checkWarningPermission = (r: RecordFile) => {
        if (!currentUser) return false;
        if (currentUser.role === UserRole.ONEDOOR) return false;
        if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN) return true;
        if (currentUser.role === UserRole.EMPLOYEE) {
            return r.assignedTo === currentUser.employeeId;
        }
        if (currentUser.role === UserRole.TEAM_LEADER) {
            const leaderEmp = employees.find(e => e.id === currentUser.employeeId);
            if (!leaderEmp) return false; 
            const isMyTask = r.assignedTo === currentUser.employeeId;
            const isMyWard = leaderEmp.managedWards.some((w: string) => r.ward && r.ward.includes(w));
            return isMyTask || isMyWard;
        }
        return false; 
    };

    const isDirector = useMemo(() => {
        if (!currentUser?.employeeId) return false;
        const emp = employees.find(e => e.id === currentUser.employeeId);
        return emp ? (emp.department?.trim().toLowerCase() === 'ban giám đốc' || emp.department?.trim().toLowerCase() === 'ban lãnh đạo') : false;
    }, [currentUser?.employeeId, employees]);

    // --- FILTER LOGIC ---
    const filteredRecords = useMemo(() => {
        const uniqueMap = new Map();
        records.forEach(r => { if(r.id) uniqueMap.set(r.id, r); });
        
        let result = Array.from(uniqueMap.values()) as RecordFile[];

        // --- HELPER STRATEGIES FOR SUBADMINS ---
        const isDirectorOrLeader = (employeeId: string | null | undefined) => {
            if (!employeeId) return false;
            const emp = employees.find(e => e.id === employeeId);
            if (emp) {
                const dept = (emp.department || '').toLowerCase();
                const pos = (emp.position || '').toLowerCase();
                const isDirDept = dept.includes('ban giám đốc') || dept.includes('ban lãnh đạo');
                const isDirPos = pos.includes('giám đốc') || pos.includes('phó giám đốc') || pos.includes('lãnh đạo');
                const isLeaderPos = pos.includes('tổ trưởng') || pos.includes('tổ phó') || pos.includes('trưởng phòng') || pos.includes('trưởng nhóm') || pos.includes('nhóm trưởng');
                if (isDirDept || isDirPos || isLeaderPos) return true;
            }
            const associatedUser = users.find(u => u.employeeId === employeeId);
            if (associatedUser) {
                if (associatedUser.role === UserRole.TEAM_LEADER || associatedUser.role === UserRole.ADMIN) {
                    return true;
                }
            }
            return false;
        };

        const isSubAdminAllowedRecord = (r: RecordFile, emp: Employee) => {
            if (!emp.department) return false;
            const adminDept = removeVietnameseTones(emp.department.toLowerCase());
            
            const isReg = (type: string | null | undefined): boolean => {
                if (!type) return false;
                const t = type.trim().toLowerCase();
                const REG_PROCEDURES = [
                    "đăng ký", "cấp giấy", "cấp đổi", "cấp lại", "giao đất", "thu hồi",
                    "chuyển mục đích", "gia hạn", "thừa kế", "tặng cho", "chuyển nhượng", "thế chấp", "xóa thế chấp"
                ];
                return t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REG_PROCEDURES.some(p => t.includes(p));
            };

            if (r.recordType === 'Cung cấp tài liệu đất đai' || r.recordType === 'Sao lục') {
                return adminDept.includes('luu tru') || adminDept.includes('van phong') || adminDept.includes('hanh chinh');
            }
            if (r.recordType === 'Công văn') {
                return adminDept.includes('cong van') || adminDept.includes('van phong') || adminDept.includes('hanh chinh');
            }
            if (isReg(r.recordType)) {
                return adminDept.includes('dang ky') || adminDept.includes('cap giay');
            }
            return adminDept.includes('do dac') || adminDept.includes('ky thuat') || adminDept.includes('to do') || adminDept.includes('dia chinh') || adminDept.includes('noi nghiep') || adminDept.includes('ngoai nghiep');
        };

        // View-based filtering
        const isCheckView = [
            'check_list', 'registration_check_list', 'archive_check_list', 'congvan_check_list', 'other_check_list'
        ].includes(currentView);
        const isPendingCheckView = [
            'pending_check_list', 'registration_pending_check_list', 'archive_pending_check_list', 'congvan_pending_check_list'
        ].includes(currentView);
        const isCompletedWorkView = [
            'completed_list', 'registration_completed_list', 'archive_completed_list', 'congvan_completed_list'
        ].includes(currentView);

        // --- EXCLUDE DIR/LEADER RECORDS FOR SUBADMIN ---
        if (currentUser && currentUser.role === UserRole.SUBADMIN) {
            result = result.filter(r => {
                const isLeaderOrDirAssigned = isDirectorOrLeader(r.assignedTo);
                const isLeaderOrDirChecked = isDirectorOrLeader(r.checkedBy);
                const isLeaderOrDirSubmitted = isDirectorOrLeader(r.submittedTo);
                return !isLeaderOrDirAssigned && !isLeaderOrDirChecked && !isLeaderOrDirSubmitted;
            });
            
            // --- WORKFLOW CHECK AND SIGNING DEPT BOUNDS FOR SUBADMIN ---
            if (isCheckView || isPendingCheckView || isCompletedWorkView) {
                const subAdminEmp = employees.find(e => e.id === currentUser.employeeId);
                if (subAdminEmp) {
                    result = result.filter(r => isSubAdminAllowedRecord(r, subAdminEmp));
                }
            }
        }
        const isDirectorCompletedView = [
            'director_completed', 'registration_director_completed', 'archive_director_completed', 'congvan_director_completed', 'other_director_completed'
        ].includes(currentView);
        const isHandoverView = [
            'handover_list', 'registration_handover_list', 'archive_handover_list', 'congvan_handover_list', 'other_handover_list'
        ].includes(currentView);
        const isAssignView = [
            'assign_tasks', 'registration_assign_tasks', 'archive_assign_tasks', 'congvan_assign_tasks', 'other_assign_tasks'
        ].includes(currentView);

        if (isCheckView) {
            if (isDirector) {
                // Giám đốc chỉ thấy hồ sơ trình cho mình
                result = result.filter(r => r.status === RecordStatus.PENDING_SIGN && r.submittedTo === currentUser?.employeeId);
            } else {
                result = result.filter(r => r.status === RecordStatus.PENDING_SIGN);
            }
        } else if (isPendingCheckView) {
            // Tab Kiểm tra: Hiển thị hồ sơ Chờ kiểm tra và Đã kiểm tra
            result = result.filter(r => r.status === RecordStatus.PENDING_CHECK || r.status === RecordStatus.CHECKED);
        } else if (isCompletedWorkView) {
            result = result.filter(r => r.status === RecordStatus.COMPLETED_WORK);
        } else if (isDirectorCompletedView) {
            result = result.filter(r => r.submittedTo === currentUser?.employeeId && r.status !== RecordStatus.PENDING_SIGN && r.status !== RecordStatus.RECEIVED && r.status !== RecordStatus.ASSIGNED && r.status !== RecordStatus.IN_PROGRESS && r.status !== RecordStatus.COMPLETED_WORK);
        } else if (isHandoverView) {
            if (handoverTab === 'today') {
                // Tab chờ giao: Bao gồm Đã ký HOẶC Đã có thuế HOẶC (Đã rút VÀ chưa có đợt xuất) HOẶC Hồ sơ trả (REJECTED)
                result = result.filter(r => 
                    r.status === RecordStatus.SIGNED || 
                    r.status === RecordStatus.TBT || 
                    ((r.status === RecordStatus.REJECTED || r.status === RecordStatus.WITHDRAWN) && !r.exportBatch)
                );
            } else if (handoverTab === 'returned') {
                // Tab Đã trả kết quả: Status = RETURNED
                result = result.filter(r => r.status === RecordStatus.RETURNED);
                
                // CẬP NHẬT: Lọc theo khoảng thời gian (Từ ngày - Đến ngày) thay vì 1 ngày
                if (filterFromDate || filterToDate) {
                    result = result.filter(r => {
                        if (!r.resultReturnedDate) return false;
                        const returnDate = r.resultReturnedDate;
                        if (filterFromDate && returnDate < filterFromDate) return false;
                        if (filterToDate && returnDate > filterToDate) return false;
                        return true;
                    });
                }
            } else {
                // Tab Lịch sử giao: Bao gồm Đã giao HOẶC (Đã rút VÀ đã có đợt xuất)
                result = result.filter(r => 
                    r.status === RecordStatus.HANDOVER || 
                    ((r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.REJECTED) && r.exportBatch)
                );
                // Giữ nguyên logic lọc ngày đơn cho Lịch sử giao (theo đợt)
                if (filterDate) {
                    result = result.filter(r => {
                        const dateToCheck = r.exportDate || r.completedDate;
                        return dateToCheck?.startsWith(filterDate);
                    });
                }
            }
        } else if (isAssignView) {
            result = result.filter(r => r.status === RecordStatus.RECEIVED && r.isDeptSynced === true);
        }

        // Filter by recordType based on view group
        const isRegistrationView = [
            'registration_records', 'registration_assign_tasks', 'registration_completed_list', 
            'registration_pending_check_list', 'registration_check_list', 'registration_handover_list', 
            'registration_director_completed'
        ].includes(currentView);

        const isArchiveView = [
            'archive_records', 'archive_assign_tasks', 'archive_completed_list', 
            'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 
            'archive_director_completed'
        ].includes(currentView);

        const isCongVanView = [
            'congvan_records', 'congvan_assign_tasks', 'congvan_completed_list', 
            'congvan_pending_check_list', 'congvan_check_list', 'congvan_handover_list', 
            'congvan_director_completed'
        ].includes(currentView);

        const isOtherView = [
            'other_records', 'other_assign_tasks', 'other_check_list', 'other_handover_list', 'other_director_completed'
        ].includes(currentView);

        const isMeasurementView = [
            'all_records', 'assign_tasks', 'completed_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed'
        ].includes(currentView);

        const isReg = (type: string | null | undefined): boolean => {
            if (!type) return false;
            const t = type.trim().toLowerCase();
            return t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => p.toLowerCase() === t);
        };
        
        if (isArchiveView) {
            result = result.filter(r => r.recordType === 'Cung cấp tài liệu đất đai' || r.recordType === 'Sao lục');
        } else if (isCongVanView) {
            result = result.filter(r => r.recordType === 'Công văn');
        } else if (isRegistrationView) {
            result = result.filter(r => isReg(r.recordType));
        } else if (isOtherView) {
            result = result.filter(r => ['CMD', 'Tòa án', 'Thi hành án'].includes(r.recordType || ''));
        } else if (isMeasurementView) {
            result = result.filter(r => 
                !['CMD', 'Tòa án', 'Thi hành án', 'Cung cấp tài liệu đất đai', 'Sao lục', 'Công văn'].includes(r.recordType || '') &&
                !isReg(r.recordType)
            );
        }

        // Search Term (Sử dụng searchTerm đã được tách theo view)
        if (searchTerm) {
            const lowerSearch = removeVietnameseTones(searchTerm);
            result = result.filter(r => {
                if (removeVietnameseTones(r.code).includes(lowerSearch)) return true;
                if (removeVietnameseTones(r.customerName).includes(lowerSearch)) return true;
                if (r.phoneNumber && r.phoneNumber.includes(searchTerm)) return true;
                if (removeVietnameseTones(r.ward || '').includes(lowerSearch)) return true;
                return false;
            });
        }

        // Ward, Status, Employee Filters
        if (filterWard !== 'all') {
            const wardSearch = removeVietnameseTones(filterWard);
            result = result.filter(r => {
                const targetWard = (currentView === 'handover_list' || currentView === 'other_handover_list') ? (r.handoverWard || r.ward) : r.ward;
                return removeVietnameseTones(targetWard || '').includes(wardSearch);
            });
        }
        if (filterStatus !== 'all' && currentView !== 'handover_list' && currentView !== 'other_handover_list') {
            result = result.filter(r => r.status === filterStatus);
        }
        if (filterEmployee !== 'all' && currentView !== 'assign_tasks') {
            if (filterEmployee === 'unassigned') result = result.filter(r => !r.assignedTo);
            else result = result.filter(r => r.assignedTo === filterEmployee);
        }

        // Date Filters (General for other views)
        if (currentView !== 'handover_list') {
            if (filterSpecificDate) {
                result = result.filter(r => r.receivedDate === filterSpecificDate);
            } else if (showAdvancedDateFilter) {
                if (filterFromDate || filterToDate) {
                    result = result.filter(r => {
                        if (!r.receivedDate) return false;
                        const rDate = r.receivedDate;
                        if (filterFromDate && rDate < filterFromDate) return false;
                        if (filterToDate && rDate > filterToDate) return false;
                        return true;
                    });
                }
            }
            
            if (filterAssignedDate) {
                result = result.filter(r => r.assignedDate && r.assignedDate.startsWith(filterAssignedDate));
            }
        }

        // Warning Filters
        if (warningFilter !== 'none' && currentUser) {
            if (warningFilter === 'overdue') {
                result = result.filter(r => isRecordOverdue(r) && checkWarningPermission(r));
            } else if (warningFilter === 'approaching') {
                result = result.filter(r => isRecordApproaching(r) && checkWarningPermission(r));
            }
        }

        // Sorting
        result.sort((a, b) => {
            let aVal: any = a[sortConfig.key as keyof RecordFile];
            let bVal: any = b[sortConfig.key as keyof RecordFile];
            if (!aVal) return 1; if (!bVal) return -1;
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [records, searchTerm, filterWard, filterStatus, filterEmployee, filterDate, filterSpecificDate, filterAssignedDate, filterFromDate, filterToDate, showAdvancedDateFilter, warningFilter, currentView, sortConfig, handoverTab, currentUser, employees, users]);

    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredRecords.slice(start, start + itemsPerPage);
    }, [filteredRecords, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

    // Warning Counts
    const warningCount = useMemo(() => {
        let overdue = 0;
        let approaching = 0;
        if (records.length > 0 && currentUser) {
            const isRegistrationView = [
                'registration_records', 'registration_assign_tasks', 'registration_completed_list', 
                'registration_pending_check_list', 'registration_check_list', 'registration_handover_list', 
                'registration_director_completed'
            ].includes(currentView);

            const isArchiveView = [
                'archive_records', 'archive_assign_tasks', 'archive_completed_list', 
                'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 
                'archive_director_completed'
            ].includes(currentView);

            const isCongVanView = [
                'congvan_records', 'congvan_assign_tasks', 'congvan_completed_list', 
                'congvan_pending_check_list', 'congvan_check_list', 'congvan_handover_list', 
                'congvan_director_completed'
            ].includes(currentView);

            const isOtherView = [
                'other_records', 'other_assign_tasks', 'other_check_list', 'other_handover_list', 'other_director_completed'
            ].includes(currentView);

            const isMeasurementView = [
                'all_records', 'assign_tasks', 'completed_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed'
            ].includes(currentView);

            const isReg = (type: string | null | undefined): boolean => {
                if (!type) return false;
                const t = type.trim().toLowerCase();
                return t.startsWith('3.') || t === 'đăng ký' || t === 'cấp giấy' || t === 'cấp đổi' || t === 'cấp lại' || REGISTRATION_PROCEDURES.some(p => p.toLowerCase() === t);
            };

            records.forEach(r => {
                if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.WITHDRAWN) return; 
                if (!checkWarningPermission(r)) return; 
                
                // Filter by recordType based on view group
                if (isArchiveView && r.recordType !== 'Cung cấp tài liệu đất đai' && r.recordType !== 'Sao lục') return;
                if (isCongVanView && r.recordType !== 'Công văn') return;
                if (isRegistrationView && !isReg(r.recordType)) return;
                if (isOtherView && !['CMD', 'Tòa án', 'Thi hành án'].includes(r.recordType || '')) return;
                if (isMeasurementView && (['CMD', 'Tòa án', 'Thi hành án', 'Cung cấp tài liệu đất đai', 'Sao lục', 'Công văn'].includes(r.recordType || '') || isReg(r.recordType))) return;

                if (isRecordOverdue(r)) overdue++;
                else if (isRecordApproaching(r)) approaching++;
            });
        }
        return { overdue, approaching };
    }, [records, currentUser, employees, currentView]);

    return {
        filteredRecords, paginatedRecords, totalPages, warningCount,
        searchTerm, setSearchTerm,
        filterDate, setFilterDate,
        filterSpecificDate, setFilterSpecificDate,
        filterAssignedDate, setFilterAssignedDate,
        filterFromDate, setFilterFromDate,
        filterToDate, setFilterToDate,
        showAdvancedDateFilter, setShowAdvancedDateFilter,
        filterWard, setFilterWard,
        filterStatus, setFilterStatus,
        filterEmployee, setFilterEmployee,
        warningFilter, setWarningFilter,
        handoverTab, setHandoverTab,
        sortConfig, setSortConfig,
        currentPage, setCurrentPage,
        itemsPerPage, setItemsPerPage
    };
};
