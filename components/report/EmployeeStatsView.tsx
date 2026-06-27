import React, { useState, useMemo } from 'react';
import { RecordFile, Employee, RecordStatus } from '../../types';
import { generateEmployeeEvaluation } from '../../services/geminiService';
import { User as UserIcon, AlertOctagon, Sparkles, Loader2, ListFilter, CheckCircle2, Clock, AlertTriangle, Briefcase, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { STATUS_LABELS } from '../../constants';

interface EmployeeStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    fromDate: string;
    toDate: string;
    selectedEmpId: string;
    setSelectedEmpId: (id: string) => void;
}

const EmployeeStatsView: React.FC<EmployeeStatsViewProps> = ({ 
    records, employees, fromDate, toDate, selectedEmpId, setSelectedEmpId 
}) => {
    const [aiEvaluation, setAiEvaluation] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [empFilterType, setEmpFilterType] = useState<'all' | 'completed' | 'processing' | 'overdue'>('all');

    // Filter records by date range first
    const recordsInTimeRange = useMemo(() => {
        const start = new Date(fromDate); start.setHours(0,0,0,0);
        const end = new Date(toDate); end.setHours(23,59,59,999);
        return records.filter(r => {
            if (!r.receivedDate) return false;
            const rDate = new Date(r.receivedDate);
            return rDate >= start && rDate <= end;
        });
    }, [records, fromDate, toDate]);

    // Reset card filter when date range or records change
    React.useEffect(() => {
        setEmpFilterType('all');
    }, [fromDate, toDate, records]);

    // Calculate Stats (Used for AI and Lists, visual cards are handled by parent ReportSection)
    const stats = useMemo(() => {
        const targetRecords = selectedEmpId 
            ? recordsInTimeRange.filter(r => r.assignedTo === selectedEmpId)
            : recordsInTimeRange;

        const total = targetRecords.length;
        
        let completedCount = 0;
        let processingCount = 0;
        let overduePendingCount = 0;
        let overdueCompletedCount = 0;
        
        const overdueRecords: { record: RecordFile, daysOver: number }[] = [];

        targetRecords.forEach(r => {
            // Xác định đã xong hay chưa
            const isFinished = [
                RecordStatus.HANDOVER, 
                RecordStatus.RETURNED, 
                RecordStatus.WITHDRAWN, 
                RecordStatus.SIGNED
            ].includes(r.status) || !!r.exportBatch || !!r.exportDate;

            if (isFinished) {
                completedCount++;
                if (r.deadline && (r.completedDate || r.exportDate || r.receivedDate)) {
                    const d = new Date(r.deadline); d.setHours(0,0,0,0);
                    const refDate = r.completedDate || r.exportDate || r.receivedDate;
                    const c = new Date(refDate!); c.setHours(0,0,0,0);
                    if (c > d) overdueCompletedCount++;
                }
            } else {
                processingCount++;
                if (r.deadline) {
                    const d = new Date(r.deadline); d.setHours(0,0,0,0);
                    const today = new Date(); today.setHours(0,0,0,0);
                    if (today > d) {
                        overduePendingCount++;
                        const diffTime = today.getTime() - d.getTime();
                        const daysOver = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        overdueRecords.push({ record: r, daysOver });
                    }
                }
            }
        });

        overdueRecords.sort((a, b) => b.daysOver - a.daysOver);
        const longestOverdue = overdueRecords.length > 0 ? overdueRecords[0] : null;
        const longOverdueList = overdueRecords.filter(item => item.daysOver > 10);

        return {
            total,
            completedCount,
            processingCount,
            overduePendingCount,
            overdueCompletedCount,
            longestOverdue,
            longOverdueList,
            totalOverdue: overduePendingCount + overdueCompletedCount
        };
    }, [recordsInTimeRange, selectedEmpId]);

    const handleGenerateReview = async () => {
        if (!stats || !selectedEmpId) return;
        setIsGenerating(true);
        const emp = employees.find(e => e.id === selectedEmpId);
        const empName = emp ? emp.name : "Nhân viên";
        
        const badRecordsSimple = stats.longOverdueList.map(i => ({
            code: i.record.code,
            customer: i.record.customerName,
            daysOverdue: i.daysOver
        }));

        const aiStats = {
            total: stats.total,
            onTime: stats.completedCount - stats.overdueCompletedCount,
            approaching: 0, 
            overdue: stats.overduePendingCount,
            onTimeRate: stats.total > 0 ? (((stats.completedCount - stats.overdueCompletedCount) / stats.total) * 100).toFixed(1) : 0
        };

        const result = await generateEmployeeEvaluation(
            empName,
            aiStats,
            badRecordsSimple,
            `Từ ${new Date(fromDate).toLocaleDateString('vi-VN')} đến ${new Date(toDate).toLocaleDateString('vi-VN')}`
        );
        
        setAiEvaluation(result);
        setIsGenerating(false);
    };

    const handleExportEmployeeRecords = () => {
        if (!selectedEmpId) return;
        
        const emp = employees.find(e => e.id === selectedEmpId);
        const empName = emp ? emp.name : "NhanVien";
        
        const targetRecords = recordsInTimeRange.filter(r => r.assignedTo === selectedEmpId);
        
        if (targetRecords.length === 0) {
            alert("Không có hồ sơ nào trong khoảng thời gian này.");
            return;
        }

        const dataToExport = targetRecords.map((r, idx) => ({
            'STT': idx + 1,
            'Mã hồ sơ': r.code,
            'Tên khách hàng': r.customerName,
            'Địa chỉ': r.address,
            'Xã/Phường': r.ward,
            'Ngày nhận': r.receivedDate ? new Date(r.receivedDate).toLocaleDateString('vi-VN') : '',
            'Hẹn trả': r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '',
            'Ngày xong': r.completedDate ? new Date(r.completedDate).toLocaleDateString('vi-VN') : '',
            'Trạng thái': STATUS_LABELS[r.status] || r.status,
            'Ghi chú': r.notes || r.content
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        
        // Auto-width columns
        const wscols = [
            { wch: 5 }, // STT
            { wch: 15 }, // Ma HS
            { wch: 25 }, // Ten KH
            { wch: 30 }, // Dia chi
            { wch: 15 }, // Xa
            { wch: 12 }, // Ngay nhan
            { wch: 12 }, // Hen tra
            { wch: 12 }, // Ngay xong
            { wch: 15 }, // Trang thai
            { wch: 30 }  // Ghi chu
        ];
        ws['!cols'] = wscols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DanhSachHoSo");
        
        const fileName = `DS_HoSo_${empName}_${fromDate}_${toDate}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    // Calculate stats for all employees to display in the overview list table
    const employeeStatsList = useMemo(() => {
        return employees.map(emp => {
            const empRecords = recordsInTimeRange.filter(r => r.assignedTo === emp.id);
            const total = empRecords.length;
            let completedCount = 0;
            let overduePendingCount = 0;
            let overdueCompletedCount = 0;

            empRecords.forEach(r => {
                const isFinished = [
                    RecordStatus.HANDOVER, 
                    RecordStatus.RETURNED, 
                    RecordStatus.SIGNED
                ].includes(r.status) || !!r.exportBatch || !!r.exportDate;

                if (isFinished) {
                    completedCount++;
                    if (r.deadline && (r.completedDate || r.exportDate || r.receivedDate)) {
                        const d = new Date(r.deadline); d.setHours(0,0,0,0);
                        const refDate = r.completedDate || r.exportDate || r.receivedDate;
                        const c = new Date(refDate!); c.setHours(0,0,0,0);
                        if (c > d) overdueCompletedCount++;
                    }
                } else {
                    if (r.deadline) {
                        const d = new Date(r.deadline); d.setHours(0,0,0,0);
                        const today = new Date(); today.setHours(0,0,0,0);
                        if (today > d) {
                            overduePendingCount++;
                        }
                    }
                }
            });

            return {
                employee: emp,
                total,
                completedCount,
                overduePendingCount,
                overdueCompletedCount
            };
        }).sort((a, b) => b.total - a.total); // Sort by total records assigned descending
    }, [recordsInTimeRange, employees]);

    // Filter employees based on the selected card filter
    const filteredEmployeeStatsList = useMemo(() => {
        return employeeStatsList.filter(item => {
            if (empFilterType === 'all') return true;
            if (empFilterType === 'completed') return item.completedCount > 0;
            if (empFilterType === 'processing') return (item.total - item.completedCount) > 0;
            if (empFilterType === 'overdue') return (item.overduePendingCount + item.overdueCompletedCount) > 0;
            return true;
        });
    }, [employeeStatsList, empFilterType]);

    return (
        <div className="flex flex-col h-full bg-slate-100 p-4 gap-4 overflow-y-hidden">
            
            {/* 1.5 SUMMARY CARDS AS REQUESTED */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0 animate-fade-in">
                {/* Card 1: Tổng hồ sơ */}
                <div 
                    onClick={() => setEmpFilterType('all')}
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02] ${empFilterType === 'all' ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                >
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-700"><ListFilter size={20}/></div>
                    <div>
                        <div className="text-2xl font-bold text-blue-900 leading-tight">{stats.total}</div>
                        <div className="text-[11px] text-blue-600 uppercase font-extrabold tracking-wider">Tổng hồ sơ</div>
                    </div>
                </div>

                {/* Card 2: Đã xong */}
                <div 
                    onClick={() => setEmpFilterType('completed')}
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02] ${empFilterType === 'completed' ? 'bg-green-50 border-green-400 ring-2 ring-green-300 shadow-sm' : 'bg-white border-gray-200 hover:border-green-300'}`}
                >
                    <div className="bg-green-100 p-2 rounded-lg text-green-700"><CheckCircle2 size={20}/></div>
                    <div>
                        <div className="text-2xl font-bold text-green-900 leading-tight">{stats.completedCount}</div>
                        <div className="text-[11px] text-green-600 uppercase font-extrabold tracking-wider">Đã xong</div>
                    </div>
                </div>

                {/* Card 3: Đang xử lý */}
                <div 
                    onClick={() => setEmpFilterType('processing')}
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.02] ${empFilterType === 'processing' ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-300 shadow-sm' : 'bg-white border-gray-200 hover:border-orange-300'}`}
                >
                    <div className="bg-orange-100 p-2 rounded-lg text-orange-700"><Clock size={20}/></div>
                    <div>
                        <div className="text-2xl font-bold text-orange-900 leading-tight">{stats.processingCount}</div>
                        <div className="text-[11px] text-orange-600 uppercase font-extrabold tracking-wider">Đang xử lý</div>
                    </div>
                </div>

                {/* Card 4: Tổng trễ hạn */}
                <div 
                    onClick={() => setEmpFilterType('overdue')}
                    className={`bg-red-50 border p-3 rounded-xl flex items-center gap-3 transition-all cursor-pointer hover:scale-[1.02] ${empFilterType === 'overdue' ? 'border-red-400 ring-2 ring-red-300 shadow-sm' : 'border-gray-200 hover:border-red-300'}`}
                >
                    <div className="bg-red-200 p-2 rounded-lg text-red-700"><AlertTriangle size={20}/></div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center text-red-800">
                            <span className="text-xs font-semibold">Chưa xong:</span>
                            <span className="text-base font-bold">{stats.overduePendingCount}</span>
                        </div>
                        <div className="flex justify-between items-center text-red-600/70">
                            <span className="text-xs font-semibold">Đã xong:</span>
                            <span className="text-xs font-bold">{stats.overdueCompletedCount}</span>
                        </div>
                        <div className="text-[10px] text-red-600 uppercase font-extrabold text-center mt-1 pt-1 border-t border-red-200">
                            TỔNG TRỄ HẠN: {stats.overduePendingCount + stats.overdueCompletedCount}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. DETAILED CONTENT & PERFORMANCE TABLE SIDE-BY-SIDE */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
                
                {/* LEFT COLUMN: PERFORMANCE TABLE */}
                <div className="xl:col-span-7 flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[300px]">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
                        <h3 className="font-bold text-gray-700 text-sm uppercase flex items-center gap-2">
                            <UserIcon size={16} className="text-gray-500" /> Bảng thống kê hiệu suất cán bộ
                        </h3>
                        <span className="text-xs font-mono text-gray-500 bg-gray-200/60 px-2.5 py-0.5 rounded-full font-bold">
                            {filteredEmployeeStatsList.length} Cán bộ
                        </span>
                    </div>
                    
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        {filteredEmployeeStatsList.length > 0 ? (
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase sticky top-0 border-b border-slate-100 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-3">STT</th>
                                        <th className="p-3">Cán bộ xử lý</th>
                                        <th className="p-3">Phòng ban / Tổ</th>
                                        <th className="p-3 text-center">Tổng HS</th>
                                        <th className="p-3 text-center">Đã xong</th>
                                        <th className="p-3 text-center">Trễ-Chưa xong</th>
                                        <th className="p-3 text-center">Trễ-Đã xong</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredEmployeeStatsList.map((item, idx) => {
                                        const isSelected = selectedEmpId === item.employee.id;
                                        return (
                                            <tr 
                                                key={item.employee.id} 
                                                onClick={() => {
                                                    setSelectedEmpId(item.employee.id);
                                                    setAiEvaluation('');
                                                }}
                                                className={`hover:bg-slate-50 cursor-pointer transition-all ${isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-600 font-semibold' : ''}`}
                                            >
                                                <td className={`p-3 font-mono font-bold ${isSelected ? 'text-indigo-600' : 'text-gray-400'}`}>{idx + 1}</td>
                                                <td className={`p-3 font-bold ${isSelected ? 'text-indigo-950' : 'text-gray-800'}`}>{item.employee.name}</td>
                                                <td className="p-3 text-gray-500 font-medium text-xs truncate max-w-[120px]">{item.employee.department}</td>
                                                <td className="p-3 text-center font-bold text-blue-600">
                                                    <span className="bg-blue-50 px-2 py-0.5 rounded text-xs font-extrabold">{item.total}</span>
                                                </td>
                                                <td className="p-3 text-center font-bold text-emerald-600">
                                                    <span className="bg-emerald-50 px-2 py-0.5 rounded text-xs font-extrabold">{item.completedCount}</span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    {item.overduePendingCount > 0 ? (
                                                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-extrabold">{item.overduePendingCount}</span>
                                                    ) : (
                                                        <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded text-xs font-semibold">0</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {item.overdueCompletedCount > 0 ? (
                                                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-extrabold">{item.overdueCompletedCount}</span>
                                                    ) : (
                                                        <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded text-xs font-semibold">0</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="h-48 flex flex-col items-center justify-center text-gray-400 text-sm italic">
                                <p>Không tìm thấy cán bộ nào khớp bộ lọc.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: DETAILED STATS & AI EVALUATION */}
                <div className="xl:col-span-5 flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
                    {/* Header with employee dropdown filter inside right column, like in the Overdue stats report */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center shrink-0">
                        <h4 className="font-bold text-gray-700 text-sm uppercase flex items-center gap-2">
                            <Sparkles size={16} className="text-indigo-600" /> Chi tiết & Đánh giá
                        </h4>
                        
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="flex items-center gap-1.5 bg-white px-2 py-1 border border-gray-300 rounded-lg h-[34px] flex-1 sm:w-48 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                                <select 
                                    value={selectedEmpId} 
                                    onChange={(e) => {
                                        setSelectedEmpId(e.target.value);
                                        setAiEvaluation('');
                                    }} 
                                    className="text-xs outline-none bg-transparent text-gray-700 font-bold cursor-pointer border-none focus:ring-0 p-0 w-full"
                                >
                                    <option value="">-- Chọn cán bộ --</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedEmpId && (
                                <button 
                                    onClick={handleExportEmployeeRecords}
                                    className="flex items-center justify-center gap-1 bg-green-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-green-700 transition-colors font-bold text-xs shadow-sm h-[34px] shrink-0"
                                    title="Xuất Excel hồ sơ cán bộ này"
                                >
                                    <FileSpreadsheet size={14} /> Xuất DS
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar p-4 flex flex-col gap-4">
                        {selectedEmpId ? (
                            <div className="space-y-4 animate-fade-in flex flex-col h-full">
                                {/* Selected Employee Label */}
                                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex justify-between items-center shrink-0">
                                    <div>
                                        <div className="text-sm font-bold text-indigo-950">
                                            {employees.find(e => e.id === selectedEmpId)?.name}
                                        </div>
                                        <div className="text-[11px] text-indigo-600 font-semibold uppercase tracking-wider">
                                            {employees.find(e => e.id === selectedEmpId)?.department}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setSelectedEmpId('');
                                            setAiEvaluation('');
                                        }}
                                        className="text-xs text-gray-500 hover:text-red-500 hover:underline font-semibold"
                                    >
                                        Bỏ chọn
                                    </button>
                                </div>

                                {/* Top Overdue Record Card */}
                                <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm relative overflow-hidden shrink-0">
                                    <div className="absolute top-0 right-0 p-4 opacity-5"><AlertOctagon size={100} className="text-red-500" /></div>
                                    <h4 className="font-bold text-red-700 flex items-center gap-2 mb-3 uppercase text-xs tracking-wider">
                                        <AlertOctagon size={14}/> Hồ sơ tồn đọng lâu nhất
                                    </h4>
                                    {stats.longestOverdue ? (
                                        <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="text-lg font-black text-red-800">{stats.longestOverdue.record.code}</div>
                                                <div className="bg-white text-red-600 px-2 py-0.5 rounded border border-red-200 text-[11px] font-bold shadow-sm">
                                                    Trễ {stats.longestOverdue.daysOver} ngày
                                                </div>
                                            </div>
                                            <div className="text-gray-800 font-bold text-xs mb-1">{stats.longestOverdue.record.customerName}</div>
                                            <div className="text-[10px] text-gray-500 flex gap-3">
                                                <span>Ngày nhận: {new Date(stats.longestOverdue.record.receivedDate!).toLocaleDateString('vi-VN')}</span>
                                                <span>Hẹn trả: <span className="text-red-600 font-bold">{new Date(stats.longestOverdue.record.deadline!).toLocaleDateString('vi-VN')}</span></span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-green-600 py-3 bg-green-50 rounded-lg justify-center border border-green-100 text-xs font-bold">
                                            <CheckCircle2 size={16} />
                                            <span>Không có hồ sơ nào trễ hạn.</span>
                                        </div>
                                    )}
                                </div>

                                {/* List of Long Overdue */}
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col max-h-[160px] shrink-0">
                                    <div className="p-2.5 bg-gray-50 border-b border-gray-200 flex justify-between items-center shrink-0">
                                        <h4 className="font-bold text-gray-700 text-[11px] uppercase flex items-center gap-1.5">
                                            <ListFilter size={12} /> Trễ hạn nguy cấp ({stats.longOverdueList.length})
                                        </h4>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        {stats.longOverdueList.length > 0 ? (
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-white text-gray-500 font-medium text-[10px] uppercase sticky top-0 shadow-sm z-10">
                                                    <tr>
                                                        <th className="p-2 bg-gray-50">Mã HS</th>
                                                        <th className="p-2 bg-gray-50">Khách hàng</th>
                                                        <th className="p-2 bg-gray-50 text-center">Số ngày</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {stats.longOverdueList.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-red-50 transition-colors">
                                                            <td className="p-2 font-bold text-blue-600">{item.record.code}</td>
                                                            <td className="p-2 text-gray-700 font-medium truncate max-w-[120px]">{item.record.customerName}</td>
                                                            <td className="p-2 text-center">
                                                                <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[10px]">
                                                                    {item.daysOver} ngày
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs italic p-4">
                                                <p>Không có hồ sơ trễ quá 10 ngày.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* AI ANALYSIS */}
                                <div className="flex flex-col bg-white rounded-xl border border-indigo-200 shadow-sm flex-1 overflow-hidden min-h-[220px]">
                                    <div className="p-3 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center shrink-0">
                                        <h4 className="font-bold text-indigo-800 flex items-center gap-1.5 text-xs uppercase">
                                            <Sparkles size={14} className="text-indigo-600"/> Đánh giá hiệu quả (AI)
                                        </h4>
                                        <button 
                                            onClick={handleGenerateReview} 
                                            disabled={isGenerating}
                                            className="bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold hover:bg-indigo-700 flex items-center gap-1 disabled:opacity-50 transition-all shadow-sm"
                                        >
                                            {isGenerating ? <Loader2 className="animate-spin" size={12}/> : <Sparkles size={12}/>} 
                                            {aiEvaluation ? 'Phân tích lại' : 'Phân tích'}
                                        </button>
                                    </div>
                                    <div className="p-3 flex-1 bg-white overflow-y-auto custom-scrollbar text-xs">
                                        {aiEvaluation ? (
                                            <div 
                                                className="prose prose-xs max-w-none text-gray-800 leading-relaxed font-serif"
                                                dangerouslySetInnerHTML={{ __html: aiEvaluation }}
                                            />
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60 p-4">
                                                <div className="bg-indigo-50 p-2 rounded-full mb-2">
                                                    <Sparkles size={20} className="text-indigo-400"/>
                                                </div>
                                                <p className="text-center text-[11px] font-medium leading-tight">Bấm "Phân tích" để AI đánh giá hiệu quả.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-70 py-12 px-6 border-2 border-dashed border-gray-200 rounded-xl my-auto">
                                <div className="bg-slate-50 p-4 rounded-full mb-3 text-slate-400 border border-slate-100">
                                    <UserIcon size={32} />
                                </div>
                                <h5 className="font-bold text-gray-700 text-sm mb-1 text-center">Chưa chọn cán bộ xử lý</h5>
                                <p className="text-center text-xs text-gray-500 max-w-xs leading-relaxed">
                                    Vui lòng bấm trực tiếp vào tên cán bộ ở <strong>Bảng hiệu suất bên trái</strong> hoặc chọn từ <strong>danh sách bên trên</strong> để xem thống kê chi tiết và nhận xét từ AI.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeStatsView;
