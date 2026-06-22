import React from 'react';
import { RecordFile, Employee } from '../../types';
import { User, MapPin, FileText, Trash2 } from 'lucide-react';

interface SimpleRecordFormProps {
  formData: Partial<RecordFile>;
  handleChange: (field: keyof RecordFile, value: any) => void;
  applicantName: string;
  setApplicantName: (v: string) => void;
  applicantPhone: string;
  setApplicantPhone: (v: string) => void;
  applicantCccd: string;
  setApplicantCccd: (v: string) => void;
  wards: string[];
  employees: Employee[];
  isMeas: boolean;
  hasAdminRights: boolean;
  dateVal: (v: any) => string;
  labelClass: string;
  plainInputClass: string;
  selectClass: string;
  
  // New props for dynamic document table
  otherDocRows: Array<{ name: string; type: 'Bản chính' | 'Bản sao' }>;
  handleOtherDocRowChange: (index: number, field: 'name' | 'type', value: string) => void;
  addOtherDocRow: () => void;
  removeOtherDocRow: (index: number) => void;

  showAuthSection: boolean;
  setShowAuthSection: (v: boolean) => void;
  authDocNumber: string;
  setAuthDocNumber: (v: string) => void;
}

const SimpleRecordForm: React.FC<SimpleRecordFormProps> = ({
  formData,
  handleChange,
  applicantName,
  setApplicantName,
  applicantPhone,
  setApplicantPhone,
  applicantCccd,
  setApplicantCccd,
  wards,
  employees,
  isMeas,
  hasAdminRights,
  dateVal,
  labelClass,
  plainInputClass,
  selectClass,
  otherDocRows,
  handleOtherDocRowChange,
  addOtherDocRow,
  removeOtherDocRow,
  showAuthSection,
  setShowAuthSection,
  authDocNumber,
  setAuthDocNumber
}) => {
  return (
    <div className="space-y-6">
      {/* 1. CHỦ SỬ DỤNG & ỦY QUYỀN */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 md:p-5">
        <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2 w-full">
          <User size={16} /> Chủ sử dụng & Ủy quyền
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>Tên chủ sử dụng <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              required 
              className={plainInputClass} 
              value={applicantName} 
              onChange={(e) => setApplicantName(e.target.value)} 
            />
          </div>
          <div>
            <label className={labelClass}>Số điện thoại</label>
            <input 
              type="text" 
              className={plainInputClass} 
              value={applicantPhone} 
              onChange={(e) => setApplicantPhone(e.target.value)} 
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Địa chỉ chủ sử dụng</label>
            <input 
              type="text" 
              className={plainInputClass} 
              value={formData.customerAddress || ''} 
              onChange={(e) => handleChange('customerAddress', e.target.value)} 
            />
          </div>
          <div>
            <label className={labelClass}>CCCD</label>
            <input 
              type="text" 
              className={plainInputClass} 
              value={applicantCccd} 
              onChange={(e) => setApplicantCccd(e.target.value)} 
            />
          </div>
        </div>
      </div>

      {/* 2. VỊ TRÍ & THỬA ĐẤT */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 md:p-5">
        <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2 w-full">
          <MapPin size={16} /> Vị trí & Thửa đất
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Xã / Phường</label>
            <select 
              className={selectClass} 
              value={formData.ward || ''} 
              onChange={(e) => handleChange('ward', e.target.value)}
            >
              <option value="">-- Chọn Xã/Phường --</option>
              {wards.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Địa chỉ chi tiết</label>
            <input 
              type="text" 
              className={plainInputClass} 
              value={formData.address || ''} 
              onChange={(e) => handleChange('address', e.target.value)} 
              placeholder="Số nhà, đường, ấp..." 
            />
          </div>
          <div>
            <label className={labelClass}>Khu vực (Nhóm)</label>
            <select 
              className={selectClass} 
              value={formData.group || 'Nhóm 1'} 
              onChange={(e) => handleChange('group', e.target.value)}
            >
              <option value="Nhóm 1">Nhóm 1</option>
              <option value="Nhóm 2">Nhóm 2</option>
              <option value="Nhóm 3">Nhóm 3</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4 md:col-span-4">
            <div>
              <label className={labelClass}>Tờ bản đồ</label>
              <input 
                type="text" 
                className={`${plainInputClass} text-center font-mono`} 
                value={formData.mapSheet || ''} 
                onChange={(e) => handleChange('mapSheet', e.target.value)} 
              />
            </div>
            <div>
              <label className={labelClass}>Thửa đất</label>
              <input 
                type="text" 
                className={`${plainInputClass} text-center font-mono`} 
                value={formData.landPlot || ''} 
                onChange={(e) => handleChange('landPlot', e.target.value)} 
              />
            </div>
            <div>
              <label className={labelClass}>Diện tích (m2)</label>
              <input 
                type="number" 
                step="any" 
                className={`${plainInputClass} text-right`} 
                value={formData.area || 0} 
                onChange={(e) => handleChange('area', parseFloat(e.target.value) || 0)} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. GIẤY TỜ KÈM THEO KHÁC (NẾU CÓ) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-white text-[#007bff] border-b border-slate-200 px-4 py-2.5 font-bold uppercase text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} />
            GIẤY TỜ KÈM THEO KHÁC (NẾU CÓ)
          </div>
          <button 
            type="button" 
            onClick={addOtherDocRow} 
            className="px-3 py-1 bg-white hover:bg-blue-50 text-[#007bff] border border-[#007bff]/30 hover:border-[#007bff] rounded text-xs font-bold flex items-center gap-1 active:scale-95 shadow-sm transition-all cursor-pointer uppercase"
          >
            <span>+ Thêm mới</span>
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-[#f8f9fa]">
                <tr>
                  <th className="px-3 py-2.5 text-center text-xs font-bold text-slate-500 uppercase w-12 border-r border-slate-200">#</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-500 uppercase border-r border-slate-200">Tên giấy tờ khác nộp kèm</th>
                  <th className="px-3 py-2.5 text-center text-xs font-bold text-slate-500 uppercase w-60 border-r border-slate-200">Hình thức nộp</th>
                  <th className="px-3 py-2.5 text-center text-xs font-bold text-slate-500 uppercase w-16">Xóa</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {otherDocRows.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-center font-medium text-slate-500 border-r border-slate-200">{index + 1}</td>
                    <td className="px-3 py-2 border-r border-slate-200">
                      <input 
                        type="text" 
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white focus:border-blue-500 outline-none transition-colors" 
                        value={row.name} 
                        onChange={(e) => handleOtherDocRowChange(index, 'name', e.target.value)} 
                        placeholder="Nhập tên giấy tờ..." 
                      />
                    </td>
                    <td className="px-3 py-2 text-center border-r border-slate-200">
                      <div className="flex items-center justify-center gap-6 h-[32px]">
                        <label className="flex items-center gap-1.5 text-sm cursor-pointer font-semibold text-slate-700 select-none">
                          <input 
                            type="radio" 
                            name={`simpleOtherDocsCopy-${index}`} 
                            value="Bản chính" 
                            checked={row.type === 'Bản chính'} 
                            onChange={(e) => handleOtherDocRowChange(index, 'type', e.target.value)} 
                            className="text-[#007bff] focus:ring-blue-500 h-4 w-4" 
                          />
                          Bản chính
                        </label>
                        <label className="flex items-center gap-1.5 text-sm cursor-pointer font-semibold text-slate-700 select-none">
                          <input 
                            type="radio" 
                            name={`simpleOtherDocsCopy-${index}`} 
                            value="Bản sao" 
                            checked={row.type === 'Bản sao'} 
                            onChange={(e) => handleOtherDocRowChange(index, 'type', e.target.value)} 
                            className="text-[#007bff] focus:ring-blue-500 h-4 w-4" 
                          />
                          Bản sao
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button 
                        type="button" 
                        onClick={() => removeOtherDocRow(index)} 
                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors inline-flex items-center justify-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {otherDocRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400 text-xs font-semibold italic">
                      Không có giấy tờ kèm theo khác (Click nút "Thêm mới" để nhập liệu)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* THÔNG TIN NGƯỜI ĐƯỢC ỦY QUYỀN (NẾU CÓ) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mt-4">
        <div 
          onClick={() => setShowAuthSection(!showAuthSection)} 
          className="bg-white hover:bg-slate-50 text-[#007bff] border-b border-slate-200 px-4 py-2.5 font-bold uppercase text-sm flex items-center justify-between cursor-pointer select-none transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText size={16} />
            THÔNG TIN NGƯỜI ĐƯỢC ỦY QUYỀN (NẾU CÓ)
          </div>
          <span className="text-xs font-bold bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded flex items-center gap-1 uppercase select-none active:scale-95 transition-all text-blue-600 shadow-sm">
            {showAuthSection ? '▲ Ẩn nhập liệu' : '▶ CLICK ĐỂ NHẬP'}
          </span>
        </div>
        {showAuthSection && (
          <div className="p-4 space-y-4 animate-fade-in border-t border-slate-200 bg-slate-50/30">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className={labelClass}>Người được ủy quyền</label>
                <input 
                  type="text" 
                  placeholder="Họ tên người được ủy quyền..." 
                  className={plainInputClass} 
                  value={formData.authorizedBy || ''} 
                  onChange={(e) => handleChange('authorizedBy', e.target.value)} 
                />
              </div>
              <div>
                <label className={labelClass}>Số giấy tờ tùy thân</label>
                <input 
                  type="text" 
                  placeholder="Số CCCD/CMND..." 
                  className={plainInputClass} 
                  value={authDocNumber} 
                  onChange={(e) => setAuthDocNumber(e.target.value)} 
                />
              </div>
              <div>
                <label className={labelClass}>Loại giấy tờ ủy quyền</label>
                <select 
                  className={selectClass} 
                  value={(formData.authDocType || '').split('|')[0] || ''} 
                  onChange={(e) => handleChange('authDocType', e.target.value ? `${e.target.value}|${(formData.authDocType || '').split('|')[1] || 'Bản chính'}` : '')}
                >
                  <option value="">-- Chọn loại giấy tờ --</option>
                  <option value="Hợp đồng ủy quyền">Hợp đồng ủy quyền</option>
                  <option value="Giấy ủy quyền">Giấy ủy quyền</option>
                  <option value="Văn bản ủy quyền">Văn bản ủy quyền</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Hình thức nộp</label>
                <div className="flex items-center gap-6 h-[38px] px-2">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer font-semibold text-slate-700">
                    <input 
                      type="radio" 
                      name="simpleAuthDocCopy" 
                      value="Bản chính" 
                      checked={((formData.authDocType || '').split('|')[1] || 'Bản chính') === 'Bản chính'} 
                      onChange={(e) => handleChange('authDocType', (formData.authDocType || '').split('|')[0] ? `${(formData.authDocType || '').split('|')[0]}|${e.target.value}` : '')} 
                      className="text-[#007bff] focus:ring-blue-500 h-4 w-4" 
                    />
                    Bản chính
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer font-semibold text-slate-700">
                    <input 
                      type="radio" 
                      name="simpleAuthDocCopy" 
                      value="Bản sao" 
                      checked={((formData.authDocType || '').split('|')[1] || 'Bản chính') === 'Bản sao'} 
                      onChange={(e) => handleChange('authDocType', (formData.authDocType || '').split('|')[0] ? `${(formData.authDocType || '').split('|')[0]}|${e.target.value}` : '')} 
                      className="text-[#007bff] focus:ring-blue-500 h-4 w-4" 
                    />
                    Bản sao
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleRecordForm;
