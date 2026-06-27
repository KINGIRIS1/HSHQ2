import React, { useState, useMemo, useEffect } from 'react';
import { Employee, RecordFile, User, UserRole } from '../types';
import { X, Check, MapPin, User as UserIcon, Users, Search, FolderOpen, Compass, Award, FileCheck } from 'lucide-react';
import { removeVietnameseTones } from '../utils/appHelpers';

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (employeeId: string) => void;
  employees: Employee[];
  selectedRecords: RecordFile[];
  filterDepartment?: string; // Lọc theo phòng ban mặc định dưa trên luồng
  currentUser?: User; // Thông tin người dùng hiện tại để lấy Tổ trực thuộc
}

interface EmployeeItemProps {
    emp: Employee;
    isRecommended?: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
    isSurveyTeam?: boolean;
}

// Component hiển thị cá nhân nhân viên
const EmployeeItem: React.FC<EmployeeItemProps> = ({ emp, isRecommended, isSelected, onSelect, isSurveyTeam }) => (
    <div 
        onClick={() => onSelect(emp.id)}
        className={`relative flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-200 group ${
            isSelected 
                ? 'bg-blue-50/80 border-blue-600 shadow-sm ring-2 ring-blue-100' 
                : isRecommended
                  ? 'bg-green-50/50 border-green-500 hover:border-green-600 shadow-sm ring-1 ring-green-100 hover:shadow-md animate-pulse-subtle'
                  : 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-md'
        }`}
    >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 shadow-sm transition-colors ${
            isSelected 
                ? 'bg-blue-600 text-white' 
                : isRecommended 
                    ? 'bg-green-600 text-white animate-pulse' 
                    : 'bg-slate-100 text-gray-600'
        }`}>
            {emp.name.charAt(0).toUpperCase()}
        </div>
        
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className={`font-black text-sm truncate ${isSelected ? 'text-blue-700' : isRecommended ? 'text-green-800' : 'text-slate-800'}`}>
                    {emp.name}
                </span>
                {emp.position && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                        isSelected 
                          ? 'text-blue-750 bg-blue-100/50 border-blue-200' 
                          : isRecommended 
                            ? 'text-green-750 bg-green-100/60 border-green-250 font-black' 
                            : 'text-amber-700 bg-amber-50 border-amber-200'
                    }`}>
                        {emp.position}
                    </span>
                )}
                {isRecommended && (
                    <span className="text-[8px] font-black uppercase text-green-700 bg-green-100 border border-green-200 px-1 py-0.2 rounded-full inline-flex items-center gap-0.5 shrink-0 animate-bounce-subtle">
                      Đề xuất
                    </span>
                )}
            </div>
            
            <div className={`text-xs truncate mb-1 flex items-center gap-1 ${
                isSelected 
                  ? 'text-blue-600 font-semibold' 
                  : isRecommended 
                    ? 'text-green-700 font-medium' 
                    : 'text-gray-500'
            }`}>
                {emp.department || 'Chưa phân Tổ'}
            </div>

            {/* Hiển thị tags địa bàn quản lý */}
            {emp.managedWards && emp.managedWards.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {emp.managedWards.slice(0, 2).map((w, idx) => (
                        <span key={idx} className={`text-[9px] px-1.5 py-0.5 rounded border truncate max-w-[85px] transition-colors ${
                            isSelected 
                              ? 'bg-blue-100/30 text-blue-700 border-blue-150' 
                              : isRecommended 
                                ? 'bg-green-100/30 text-green-700 border-green-150' 
                                : 'bg-slate-50 text-gray-500 hover:text-gray-700 border-gray-150'
                        }`}>
                            {w}
                        </span>
                    ))}
                    {emp.managedWards.length > 2 && (
                        <span className={`text-[9px] font-medium ${isRecommended ? 'text-green-600' : 'text-gray-400'}`}>
                            +{emp.managedWards.length - 2} địa bàn
                        </span>
                    )}
                </div>
            )}
        </div>

        {isSelected && (
            <div className="absolute top-3 right-3 bg-blue-600 text-white rounded-full p-0.5 shadow">
                <Check size={10} strokeWidth={3} />
            </div>
        )}
    </div>
);

// Định nghĩa 5 Tổ chuyên môn theo yêu cầu
const TEAMS_LIST = [
  { name: 'Tổ Cấp giấy', description: 'Đăng ký, biến động, cấp GCN', icon: FileCheck },
  { name: 'Tổ Lưu trữ', description: 'Khai thác hồ sơ & dữ liệu lưu trữ', icon: FolderOpen },
  { name: 'Tổ Đo đạc', description: 'Đo vẽ bản đồ, trích đo thửa đất', icon: Compass },
  { name: 'Tổ Hành chính', description: 'Một cửa, tổng hợp, hành chính', icon: Users },
  { name: 'Ban Giám đốc', description: 'Ban Giám đốc & Phối hợp Lãnh đạo', icon: Award },
];

// Hàm chuyển đổi/Phân nhóm nhân viên vào từng Tổ chuẩn xác
export const getEmployeeTeam = (emp: Employee): string => {
  const dept = removeVietnameseTones(emp.department || '').toLowerCase().trim();
  const pos = removeVietnameseTones(emp.position || '').toLowerCase().trim();

  // 1. Phân vào Ban Giám đốc
  if (
    dept.includes('giam doc') || 
    dept.includes('lanh dao') || 
    dept.includes('director') || 
    dept.includes('ban giam doc') || 
    pos.includes('giam doc') || 
    pos.includes('pho giam doc') || 
    pos.includes('truong phong')
  ) {
    return 'Ban Giám đốc';
  }

  // 2. Phân vào Tổ Lưu trữ
  if (dept.includes('luu tru') || dept.includes('sao luc') || dept.includes('thong tin')) {
    return 'Tổ Lưu trữ';
  }

  // 3. Phân vào Tổ Đo đạc (Chuyên môn đo vẽ, địa chính, kỹ thuật)
  if (
    dept.includes('do dac') || 
    dept.includes('do') || 
    dept.includes('ky thuat') || 
    dept.includes('dia chinh') || 
    dept.includes('noi nghiep') || 
    dept.includes('ngoai nghiep') || 
    dept.includes('do hinh') || 
    dept.includes('ban do') ||
    dept.includes('to do')
  ) {
    return 'Tổ Đo đạc';
  }

  // 4. Phân vào Tổ Cấp giấy
  if (
    dept.includes('cap giay') || 
    dept.includes('dang ky') || 
    dept.includes('bien dong') || 
    dept.includes('cap qsd') || 
    dept.includes('tham dinh')
  ) {
    return 'Tổ Cấp giấy';
  }

  // 5. Tổ Hành chính (Bộ phận còn lại: một cửa, hành chính, văn thư,...)
  return 'Tổ Hành chính';
};

// Hàm xác định loại chức vụ/vai trò của nhân viên để phân nhóm
export const getRoleCategory = (position?: string): { key: string; label: string; colorClass: string; order: number } => {
  if (!position) return { key: 'staff', label: 'Chuyên viên / Nhân viên', colorClass: 'border-slate-200 bg-slate-50 text-slate-700', order: 4 };
  const p = removeVietnameseTones(position).toLowerCase().trim();
  
  if (p.includes('giam doc') || p.includes('lanh dao') || p.includes('director') || p.includes('truong phong') || p.includes('pho giam doc') || p.includes('pho phong')) {
    return { key: 'director', label: 'Ban Giám đốc & Lãnh đạo', colorClass: 'border-rose-150 bg-rose-50 text-rose-800', order: 1 };
  }
  if (p.includes('to truong') || p.includes('truong nhom') || p.includes('lead') || p.includes('truong to')) {
    return { key: 'leader', label: 'Tổ trưởng / Trưởng phòng', colorClass: 'border-amber-150 bg-amber-50 text-amber-800', order: 2 };
  }
  if (p.includes('to pho') || p.includes('pho to') || p.includes('pho nhom') || p.includes('sup')) {
    return { key: 'vice_leader', label: 'Tổ phó / Phó phòng', colorClass: 'border-orange-150 bg-orange-50 text-orange-850', order: 3 };
  }
  return { key: 'staff', label: 'Chuyên viên / Nhân viên', colorClass: 'border-blue-150 bg-blue-50 text-blue-800', order: 4 };
};

// Hàm kiểm tra quyền xem view/tab tương ứng với Tổ & Vai trò
export const isViewAllowedForUser = (currentUser: User | null, viewId: string, employees: Employee[]): boolean => {
  if (!currentUser) return true;
  if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN) return true;

  // Lấy thông tin nhân viên tương ứng
  const emp = employees?.find(e => e.id === currentUser.employeeId);
  const teamName = emp ? getEmployeeTeam(emp) : '';
  const cat = emp ? getRoleCategory(emp.position) : { key: 'staff' };

  // Ngoại lệ: "đối với tổ hành chính, ban giám đốc và nhân viên một cửa được quyền coi hết"
  if (
    teamName === 'Tổ Hành chính' || 
    teamName === 'Ban Giám đốc' || 
    currentUser.role === UserRole.ONEDOOR
  ) {
    return true;
  }

  const isLeaderOrVice = cat.key === 'leader' || cat.key === 'vice_leader' || currentUser.role === UserRole.TEAM_LEADER;
  const isStaff = !isLeaderOrVice;

  const congvanViews = ['congvan_records', 'congvan_assign_tasks', 'congvan_completed_list', 'congvan_pending_check_list', 'congvan_check_list', 'congvan_handover_list', 'congvan_director_completed'];

  // 1. "đối với nhân viên chỉ xem được cá nhân, tiện ích và lịch công tác của tổ mình"
  if (isStaff) {
    const allowedStaffViews = [
      'personal_profile',
      'utilities',
      'work_schedule',
      'dashboard',
      'internal_chat',
      'account_settings'
    ];
    if (teamName === 'Tổ Lưu trữ' && congvanViews.includes(viewId)) {
      return true;
    }
    return allowedStaffViews.includes(viewId);
  }

  // 2. "tổ trưởng/tổ phó sẽ xem được: báo cáo, tất cả của cá nhân và tab hồ sơ của tổ mình không xem qua tổ khác được"
  if (isLeaderOrVice) {
    const allowedGeneralLeaderViews = [
      'reports',
      'personal_profile',
      'dashboard',
      'internal_chat',
      'work_schedule',
      'utilities',
      'account_settings'
    ];

    if (allowedGeneralLeaderViews.includes(viewId)) {
      return true;
    }

    const measurementViews = ['all_records', 'assign_tasks', 'completed_list', 'pending_check_list', 'check_list', 'handover_list', 'director_completed'];
    const registrationViews = ['registration_records', 'registration_assign_tasks', 'registration_completed_list', 'registration_pending_check_list', 'registration_check_list', 'registration_handover_list', 'registration_director_completed'];
    const archiveViews = ['archive_records', 'archive_assign_tasks', 'archive_completed_list', 'archive_pending_check_list', 'archive_check_list', 'archive_handover_list', 'archive_director_completed'];
    const otherViews = ['other_records', 'other_assign_tasks', 'other_completed_list', 'other_pending_check_list', 'other_check_list', 'other_handover_list', 'other_director_completed'];

    if (teamName === 'Tổ Đo đạc') {
      return measurementViews.includes(viewId);
    } else if (teamName === 'Tổ Cấp giấy') {
      return registrationViews.includes(viewId);
    } else if (teamName === 'Tổ Lưu trữ') {
      return archiveViews.includes(viewId) || viewId === 'excerpt_management' || congvanViews.includes(viewId);
    }

    // Mặc định chặn các tab hồ sơ khác của tổ khác
    const allRecordTabs = [...measurementViews, ...registrationViews, ...archiveViews, ...congvanViews, ...otherViews, 'excerpt_management'];
    if (allRecordTabs.includes(viewId)) {
      return false;
    }
  }

  return true;
};

const AssignModal: React.FC<AssignModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  employees, 
  selectedRecords, 
  filterDepartment,
  currentUser 
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Tự động xác định địa bàn mục tiêu từ các hồ sơ được chọn để đề xuất cá nhân phụ trách đúng tuyến
  const targetWardName = useMemo(() => {
      if (selectedRecords.length === 0) return null;
      const firstWard = selectedRecords[0].ward;
      if (!firstWard) return null;

      const normFirst = removeVietnameseTones(firstWard);
      const isUniform = selectedRecords.every(r => 
          r.ward && removeVietnameseTones(r.ward) === normFirst
      );

      return isUniform ? firstWard : null;
  }, [selectedRecords]);

  // Phân chia nhân viên trực thuộc của từng Tổ
  const teamsData = useMemo(() => {
    const map: Record<string, Employee[]> = {
      'Tổ Cấp giấy': [],
      'Tổ Lưu trữ': [],
      'Tổ Đo đạc': [],
      'Tổ Hành chính': [],
      'Ban Giám đốc': []
    };

    employees.forEach(emp => {
      const t = getEmployeeTeam(emp);
      if (map[t]) {
        map[t].push(emp);
      } else {
        map['Tổ Hành chính'].push(emp);
      }
    });

    return map;
  }, [employees]);

  // Tìm tổ trực thuộc của tài khoản hiện tại
  const userTeam = useMemo(() => {
    if (!currentUser || !currentUser.employeeId) return null;
    const empObj = employees.find(e => e.id === currentUser.employeeId);
    if (!empObj) return null;
    return getEmployeeTeam(empObj);
  }, [currentUser, employees]);

  // Khởi dựng Tổ mặc định khi mở Modal
  useEffect(() => {
    if (isOpen) {
      setSelectedEmpId('');
      setSearchTerm('');
      
      let defaultTeam = '';
      if (currentUser && currentUser.employeeId) {
        const empObj = employees.find(e => e.id === currentUser.employeeId);
        if (empObj) {
          defaultTeam = getEmployeeTeam(empObj);
        }
      }
      
      // Nếu không có, thử suy đoán dựa trên filterDepartment truyền vào (đáp ứng tương thích ngược)
      if (!defaultTeam && filterDepartment) {
        const fdNorm = removeVietnameseTones(filterDepartment).toLowerCase();
        if (fdNorm.includes('dang ky') || fdNorm.includes('cap giay')) defaultTeam = 'Tổ Cấp giấy';
        else if (fdNorm.includes('luu tru')) defaultTeam = 'Tổ Lưu trữ';
        else if (fdNorm.includes('do dac')) defaultTeam = 'Tổ Đo đạc';
        else if (fdNorm.includes('hanh chinh') || fdNorm.includes('cong van')) defaultTeam = 'Tổ Hành chính';
      }
      
      // Nếu vẫn không tìm ra -> mặc định Tổ Cấp Giấy
      if (!defaultTeam) {
        defaultTeam = 'Tổ Cấp giấy';
      }
      
      setSelectedTeam(defaultTeam);
    }
  }, [isOpen, currentUser, employees, filterDepartment]);

  // Lọc danh sách nhân viên trong Tổ được chọn dưa theo thanh tìm kiếm
  const filteredEmployeesOfTeam = useMemo(() => {
    const list = teamsData[selectedTeam] || [];
    if (!searchTerm.trim()) return list;
    
    return list.filter(e => 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.position || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teamsData, selectedTeam, searchTerm]);

  // Chia nhân viên trong Tổ thành: Đề xuất đúng địa bàn (Recommended) & Các nhân viên khác (Others)
  const { recommended, others } = useMemo(() => {
    const rec: Employee[] = [];
    const oth: Employee[] = [];

    filteredEmployeesOfTeam.forEach(emp => {
      let isRecommended = false;
      if (targetWardName) {
        const targetNorm = removeVietnameseTones(targetWardName);
        isRecommended = emp.managedWards && emp.managedWards.some(w => removeVietnameseTones(w) === targetNorm);
      }

      if (isRecommended) {
        rec.push(emp);
      } else {
        oth.push(emp);
      }
    });

    rec.sort((a, b) => a.name.localeCompare(b.name));
    oth.sort((a, b) => a.name.localeCompare(b.name));

    return { recommended: rec, others: oth };
  }, [filteredEmployeesOfTeam, targetWardName]);

  // Hợp nhất danh sách nhân viên (đề xuất hiển thị trước, các cá nhân khác theo sau)
  const sortedEmployees = useMemo(() => {
    return [...recommended, ...others];
  }, [recommended, others]);

  const isSurveyTeamMember = (emp: Employee) => {
      const dept = (emp.department || '').toLowerCase();
      return ['kỹ thuật', 'đo đạc', 'tổ đo', 'địa chính', 'nội nghiệp', 'ngoại nghiệp'].some(k => dept.includes(k));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col h-[85vh] animate-fade-in-up overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50/70 shrink-0">
            <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600 shadow-sm shadow-blue-100">
                    <Users size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Cấu hình & Phân công xử lý</h3>
                    <p className="text-sm text-gray-500 font-medium">
                        {selectedRecords.length === 1 
                            ? `Đang giao: ${selectedRecords[0].code} - ${selectedRecords[0].customerName}` 
                            : `Đang phân công phối hợp ${selectedRecords.length} hồ sơ`
                        }
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Tìm nhân viên trong Tổ..." 
                        className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg">
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* Main Body Layout: Split into Left Sidebar (Vertical Teams) and Right Panel (Staff details) */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          
          {/* LEFT COLUMN: Sidebar Navigation for TEAMS */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50/50 flex flex-col p-4 shrink-0 overflow-y-auto no-scrollbar gap-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5 mb-1">
              <Users size={12} className="text-gray-400" /> Danh sách Tổ chuyên môn
            </h4>
            {TEAMS_LIST.map((team) => {
              const Icon = team.icon;
              const isSelected = selectedTeam === team.name;
              const isUserDirectTeam = userTeam === team.name;
              const count = teamsData[team.name]?.length || 0;
              
              return (
                <button
                  key={team.name}
                  type="button"
                  onClick={() => {
                    setSelectedTeam(team.name);
                    setSelectedEmpId('');
                  }}
                  className={`relative flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all duration-200 outline-none w-full ${
                    isSelected 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-100 scale-[1.01]' 
                      : 'bg-white border-gray-200 hover:bg-slate-50 hover:border-blue-300 hover:shadow-xs'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                    isSelected ? 'bg-blue-750 text-white' : 'bg-slate-100 text-gray-500'
                  }`}>
                    <Icon size={14} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                        {team.name}
                      </span>
                      {isUserDirectTeam && (
                        <span 
                          className={`text-[8px] font-black px-1.5 py-0.2 uppercase rounded border shrink-0 ${
                            isSelected ? 'bg-white/20 text-white border-white/20' : 'bg-indigo-50 text-indigo-600 border-indigo-150'
                          }`}
                        >
                          Của bạn
                        </span>
                      )}
                    </div>
                    <p className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                      {team.description}
                    </p>
                  </div>

                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                    isSelected ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* RIGHT COLUMN: Interactive Personnel Grid */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/20">
            
            {/* Content Panel (Lists) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              
              {/* Dynamic Ward Detection Banner */}
              {targetWardName && (
                <div className="bg-green-50 border border-green-150 p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-green-800 font-bold">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse"></span>
                    <span>Hệ thống tự động phát hiện địa bàn hồ sơ: <strong className="text-green-900 font-black">{targetWardName}</strong></span>
                  </div>
                  <span className="bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                    Cán bộ phụ trách đúng tuyến được xếp ở đầu
                  </span>
                </div>
              )}

              {sortedEmployees.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
                  {sortedEmployees.map(emp => {
                    const isRecObj = recommended.some(r => r.id === emp.id);
                    return (
                      <EmployeeItem 
                        key={emp.id} 
                        emp={emp}
                        isRecommended={isRecObj}
                        isSelected={selectedEmpId === emp.id}
                        onSelect={setSelectedEmpId}
                        isSurveyTeam={isSurveyTeamMember(emp)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-white p-6 shadow-sm">
                  <Users size={32} className="mb-2 text-slate-300" />
                  <p className="text-sm font-bold text-gray-400">Không tìm thấy cán bộ nào trong Tổ</p>
                  <p className="text-xs text-gray-400 mt-1">Vui lòng kiểm tra lại thanh tìm kiếm hoặc cấu hình.</p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold italic">
                <MapPin size={13} className="text-gray-400 animate-bounce" />
                <span>Hệ thống tự động đề xuất dựa dải địa bàn phụ trách thực tế.</span>
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={onClose} 
                    className="px-5 py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl text-sm font-bold transition-all"
                >
                    Hủy bỏ
                </button>
                <button 
                    onClick={() => selectedEmpId && onConfirm(selectedEmpId)}
                    disabled={!selectedEmpId}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-black shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 transition-all active:scale-95 flex items-center gap-2"
                >
                    <Check size={18} strokeWidth={2.5} /> Xác nhận phân giao
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AssignModal;
