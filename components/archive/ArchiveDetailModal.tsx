import React, { useState } from "react";
import { ArchiveRecord } from "../../services/apiArchive";
import {
  X,
  MapPin,
  FileText,
  User as UserIcon,
  CheckCircle2,
  Circle,
  Send,
  FileSignature,
  CheckSquare,
  CalendarClock,
  Trash2,
  Pencil,
  Printer,
  StickyNote,
  Info,
  Receipt,
  DollarSign,
} from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS } from "../../constants";
import { RecordStatus } from "../../types";
import StatusBadge from "../StatusBadge";

interface ArchiveDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: ArchiveRecord | null;
  getEmployeeName: (id: string) => string;
  currentUser?: any;
}

const ArchiveDetailModal: React.FC<ArchiveDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  getEmployeeName,
  currentUser,
}) => {
  if (!isOpen || !record) return null;

  const history = record.data?.history || [];

  // Helper to map Archive status to RecordStatus enum for labels/colors
  const mapStatus = (s: string): RecordStatus => {
    switch (s) {
      case "draft":
        return RecordStatus.RECEIVED;
      case "assigned":
        return RecordStatus.ASSIGNED;
      case "executed":
        return RecordStatus.COMPLETED_WORK;
      case "pending_sign":
        return RecordStatus.PENDING_SIGN;
      case "signed":
        return RecordStatus.SIGNED;
      case "completed":
        return RecordStatus.RETURNED;
      case "rejected":
        return RecordStatus.REJECTED;
      default:
        return RecordStatus.RECEIVED;
    }
  };

  const currentStatus = mapStatus(record.status);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "---";
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();

    if (dateStr.includes("T")) {
      const h = String(date.getHours()).padStart(2, "0");
      const min = String(date.getMinutes()).padStart(2, "0");
      return `${h}:${min} - ${d}/${m}/${y}`;
    }
    return `${dateStr.split("-").reverse().join("/")}`;
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const typeLabel = record.type === "saoluc" ? "SAO LỤC, TRÍCH LỤC" : "CÔNG VĂN";
    const recordStatusText = STATUS_LABELS[currentStatus] || "";
    
    const historyRows = history
      .map(
        (h: any, idx: number) => `
        <tr>
          <td>${idx + 1}</td>
          <td><b>${h.status ? STATUS_LABELS[mapStatus(h.status)] : h.action}</b></td>
          <td>${new Date(h.timestamp).toLocaleString("vi-VN")}</td>
          <td>${h.user || "Hệ thống"}</td>
          <td>${h.note || h.reason || "---"}</td>
        </tr>
      `
      )
      .join("");

    const wardDetail = record.type === "saoluc"
      ? `<p><b>Vị trí đất:</b> Xã/Phường: ${record.data?.xa_phuong || "-"}, Tờ: ${record.data?.to_ban_do || "-"}, Thửa: ${record.data?.thua_dat || "-"}</p>`
      : "";

    const nonGeographicDetail = record.data?.is_non_geographic && record.data?.handover_ward
      ? `<p style="color: #6b21a8;"><b>Địa bàn giao phi địa giới:</b> ${record.data.handover_ward}</p>`
      : "";

    const resultReturnedDetail = record.status === "completed"
      ? `
        <div style="margin-top: 15px; padding: 10px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
          <p style="margin: 3px 0;"><b>Hóa đơn/Biên lai:</b> ${record.data?.receipt_number || "---"}</p>
          <p style="margin: 3px 0;"><b>Hẹn trả kết quả:</b> ${formatDate(record.data?.hen_tra)}</p>
          <p style="margin: 3px 0;"><b>Đợt giao 1 cửa:</b> ${record.data?.danh_sach || "---"}</p>
          <p style="margin: 3px 0;"><b>Trạng thái thu tiền:</b> ${record.data?.payment_status || "Chưa thu"}</p>
          <p style="margin: 3px 0;"><b>Ngày trả kết quả thực tế:</b> ${formatDate(record.data?.result_returned_date)}</p>
        </div>
      `
      : "";

    printWindow.document.write(`
      <html>
        <head>
          <title>In Phiếu Bộ Hồ Sơ ${record.so_hieu}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
            body {
              font-family: 'Roboto', sans-serif;
              padding: 40px;
              color: #333;
              line-height: 1.5;
            }
            .header-table {
              width: 100%;
              border: none;
              margin-bottom: 20px;
            }
            .header-table td {
              border: none;
              padding: 0;
            }
            .title {
              text-align: center;
              font-size: 20px;
              font-weight: bold;
              margin-top: 30px;
              margin-bottom: 5px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .subtitle {
              text-align: center;
              font-size: 14px;
              margin-bottom: 30px;
              font-weight: 500;
            }
            .section-title {
              font-size: 14px;
              font-weight: bold;
              text-transform: uppercase;
              border-left: 4px solid #1d4ed8;
              padding-left: 8px;
              margin-top: 25px;
              margin-bottom: 12px;
              color: #1e3a8a;
            }
            .info-box {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 15px;
            }
            .info-box p {
              margin: 6px 0;
              font-size: 14px;
            }
            table.data-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            table.data-table th, table.data-table td {
              border: 1px solid #cbd5e1;
              padding: 10px;
              font-size: 13px;
              text-align: left;
            }
            table.data-table th {
              background-color: #f1f5f9;
              font-weight: bold;
              color: #334155;
            }
            .sign-section {
              margin-top: 40px;
              width: 100%;
              border: none;
            }
            .sign-section td {
              border: none;
              text-align: center;
              font-size: 14px;
              width: 50%;
              vertical-align: top;
            }
            .sign-space {
              height: 80px;
            }
            @media print {
              body { padding: 10px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="text-align: left; font-weight: bold; font-size: 13px; width: 50%;">
                VĂN PHÒNG ĐĂNG KÝ ĐẤT ĐAI
              </td>
              <td style="text-align: center; font-weight: bold; font-size: 12px; width: 50%;">
                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br>
                <span style="font-weight: normal; text-decoration: underline;">Độc lập - Tự do - Hạnh phúc</span>
              </td>
            </tr>
          </table>

          <div class="title">PHIẾU THEO DÕI TIẾN TRÌNH HỒ SƠ</div>
          <div class="subtitle">Mã hồ sơ: ${record.so_hieu} | Loại: ${typeLabel}</div>

          <div class="section-title">Thông tin chung</div>
          <div class="info-box">
            <p><b>Mã hồ sơ:</b> <span style="font-weight: bold; color: #1d4ed8;">${record.so_hieu}</span></p>
            <p><b>Nơi nhận / Gửi:</b> ${record.noi_nhan_gui || "Chủ sử dụng"}</p>
            <p><b>Ngày ghi nhận hồ sơ:</b> ${formatDate(record.ngay_thang)}</p>
            <p><b>Hạn trả dự kiến:</b> ${formatDate(record.data?.hen_tra || record.ngay_thang)}</p>
            <p><b>Trạng thái hiện tại:</b> <span style="font-weight: bold; color: #047857;">${recordStatusText}</span></p>
            ${wardDetail}
            ${nonGeographicDetail}
            ${resultReturnedDetail}
          </div>

          <div class="section-title">Nội dung chi tiết/Trích yếu</div>
          <div class="info-box" style="font-style: italic;">
            ${record.trich_yeu || "Không có trích yếu nội dung."}
          </div>

          <div class="section-title">Lịch sử quá trình xử lý</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 5%;">STT</th>
                <th style="width: 25%;">Thao tác / Trạng thái</th>
                <th style="width: 25%;">Mốc thời gian</th>
                <th style="width: 20%;">Người thực hiện</th>
                <th style="width: 25%;">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${historyRows || '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Chưa ghi nhận lịch sử xử lý</td></tr>'}
            </tbody>
          </table>

          <table class="sign-section">
            <tr>
              <td>
                <b>NGƯỜI XỬ LÝ HỒ SƠ</b><br>
                <span style="font-size: 12px; color: #64748b;">(Ký và ghi rõ họ tên)</span>
                <div class="sign-space"></div>
                <b>${record.data?.assigned_to ? getEmployeeName(record.data.assigned_to) : "Chưa giao"}</b>
              </td>
              <td>
                <b>NGƯỜI GIAO/TRA CỨU VÀ IN</b><br>
                <span style="font-size: 12px; color: #64748b;">(Ký và ghi rõ họ tên)</span>
                <div class="sign-space"></div>
                <b>${currentUser?.name || "Hệ thống"}</b>
              </td>
            </tr>
          </table>

          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => { window.close(); }, 1000);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col animate-fade-in-up">
        {/* HEADER */}
        <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded text-sm border border-blue-200">
              {record.so_hieu}
            </span>
            <h2 className="text-lg font-bold text-gray-800 uppercase">
              {record.type === "saoluc" ? "SAO LỤC, TRÍCH LỤC" : "CÔNG VĂN"}
            </h2>
            <StatusBadge status={currentStatus} />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3.5 py-1.5 text-sm font-bold shadow-md transition-all mr-2 hover:scale-[1.02]"
              title="Xem và In Phiếu"
            >
              <Printer size={16} />
              <span>Xem và In</span>
            </button>
            <div className="w-px h-6 bg-gray-300 mx-1"></div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COLUMN 1: THÔNG TIN CHUNG */}
            <div className="space-y-6">
              {/* KHÁCH HÀNG */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-bold text-blue-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-blue-600 pl-2">
                  <UserIcon size={16} /> Thông tin tổ chức/cá nhân
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                      Nơi nhận / Gửi (Chủ sử dụng)
                    </label>
                    <p className="text-base font-bold text-gray-800">
                      {record.noi_nhan_gui}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                      Thời gian ghi nhận
                    </label>
                    <p className="text-base font-bold text-gray-800">
                      {formatDate(record.ngay_thang)}
                    </p>
                  </div>
                </div>
              </div>

              {/* ĐỊA CHÍNH (NẾU LÀ SAO LỤC) */}
              {record.type === "saoluc" && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-xs font-bold text-green-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-green-600 pl-2">
                    <MapPin size={16} /> Thông tin địa chính
                  </h3>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                        Xã/Phường
                      </label>
                      <p className="font-bold text-gray-800 text-sm">
                        {record.data?.xa_phuong || "-"}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                        Tờ bản đồ
                      </label>
                      <p className="font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-center">
                        {record.data?.to_ban_do || "-"}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                        Thửa đất
                      </label>
                      <p className="font-bold text-gray-800 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-center">
                        {record.data?.thua_dat || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* NGƯỜI XỬ LÝ */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <label className="text-[10px] text-gray-400 uppercase font-bold block mb-2">
                  Người xử lý hồ sơ
                </label>
                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                    <UserIcon size={16} />
                  </div>
                  <span className="font-bold text-sm text-gray-700">
                    {record.data?.assigned_to
                      ? getEmployeeName(record.data.assigned_to)
                      : "Chưa giao"}
                  </span>
                </div>
              </div>
            </div>

            {/* COLUMN 2: CHI TIẾT & TÀI CHÍNH */}
            <div className="space-y-6">
              {/* NỘI DUNG */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
                <h3 className="text-xs font-bold text-purple-600 uppercase mb-4 flex items-center gap-2 border-l-4 border-purple-600 pl-2">
                  <FileText size={16} /> Nội dung chi tiết
                </h3>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-gray-800 text-sm font-medium mb-6 min-h-[80px]">
                  {record.trich_yeu || "Không có nội dung chi tiết."}
                </div>

                <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                    <div className="bg-blue-200 p-1.5 rounded text-blue-700">
                      <Receipt size={16} />
                    </div>
                    <div>
                      <label className="text-[10px] text-blue-500 uppercase font-bold block">
                        Số biên lai / Hóa đơn
                      </label>
                      <p className="text-sm font-bold text-blue-800">
                        {record.data?.receipt_number || "---"}
                      </p>
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex items-center gap-3">
                    <div className="bg-green-200 p-1.5 rounded text-green-700">
                      <DollarSign size={16} />
                    </div>
                    <div>
                      <label className="text-[10px] text-green-500 uppercase font-bold block">
                        Số tiền
                      </label>
                      <p className="text-sm font-bold text-green-800">
                        {record.data?.payment_amount != null
                          ? Number(record.data.payment_amount).toLocaleString("vi-VN") + " đ"
                          : "---"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMN 3: TIẾN ĐỘ & NHẮC VIỆC */}
            <div className="space-y-6">
              {/* TIMELINE */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-indigo-600 px-5 py-3 flex items-center gap-2">
                  <CalendarClock size={16} className="text-white" />
                  <span className="text-xs font-bold text-white uppercase">
                    Tiến độ xử lý
                  </span>
                </div>

                <div className="p-6 text-center border-b border-gray-100">
                  <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">
                    Hạn trả kết quả
                  </label>
                  <p className="text-2xl font-black text-gray-800">
                    {formatDate(record.data?.hen_tra || record.ngay_thang)}
                  </p>
                </div>

                <div className="p-6 space-y-6 relative">
                  {/* Line */}
                  <div className="absolute left-[34px] top-6 bottom-6 w-0.5 bg-gray-100 -z-10"></div>

                  {history.length > 0 ? (
                    history.map((h: any, idx: number) => {
                      const isRejected = h.status === 'rejected';
                      return (
                        <div key={idx} className="flex gap-4 relative">
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 ${
                                isRejected 
                                  ? "bg-red-600 border-red-600 text-white animate-pulse" 
                                  : idx === history.length - 1 
                                  ? "bg-blue-600 border-blue-600 text-white" 
                                  : "bg-white border-gray-300 text-gray-400"
                              }`}
                            >
                              <CheckCircle2 size={16} />
                            </div>
                          </div>
                          <div className="pb-2">
                            <p
                              className={`text-xs font-bold uppercase mb-0.5 ${
                                isRejected 
                                  ? "text-red-600" 
                                  : idx === history.length - 1 
                                  ? "text-blue-700" 
                                  : "text-gray-500"
                              }`}
                            >
                              {h.status
                                ? STATUS_LABELS[mapStatus(h.status)] || "Hồ sơ trả"
                                : h.action}
                            </p>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-medium ${isRejected ? "text-red-800" : idx === history.length - 1 ? "text-gray-800" : "text-gray-500"}`}
                              >
                                {new Date(h.timestamp).toLocaleString("vi-VN")}
                              </span>
                            </div>
                            <p className="text-[11px] text-indigo-600 mt-1 italic">
                              Bởi: {h.user || "Hệ thống"}
                            </p>
                            {(h.note || h.reason) && (
                              <div className={`text-xs italic mt-1 p-2.5 rounded ${isRejected ? 'text-red-700 bg-red-50 border border-red-100 font-medium' : 'text-gray-500 bg-gray-50'}`}>
                                "{h.note || h.reason}"
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-sm text-gray-400 italic text-center">
                      Chưa có lịch sử ghi nhận.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArchiveDetailModal;
