import React, { useRef } from 'react';
import Barcode from 'react-barcode';
import { RecordFile } from '../../types';
import { getNormalizedWard } from '../../constants';
import { Printer } from 'lucide-react';

interface SystemReceiptTemplateProps {
    data: Partial<RecordFile>;
    receivingWard: string;
    onClose: () => void;
}

const SystemReceiptTemplate: React.FC<SystemReceiptTemplateProps> = ({ data, receivingWard, onClose }) => {
    const receiptRef = useRef<HTMLDivElement>(null);
    const controlSlipRef = useRef<HTMLDivElement>(null);

    const printHtml = (htmlContent: string, title: string) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>${title}</title>
                    <style>
                        @page { margin: 15mm; }
                        body { 
                            font-family: 'Times New Roman', Times, serif; 
                            font-size: 14px;
                            line-height: 1.3;
                            color: #000;
                            -webkit-print-color-adjust: exact;
                        }
                        .flex { display: flex; }
                        .flex-col { flex-direction: column; }
                        .justify-between { justify-content: space-between; }
                        .items-center { align-items: center; }
                        .items-end { align-items: flex-end; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        .italic { font-style: italic; }
                        .underline { text-decoration: underline; }
                        .uppercase { text-transform: uppercase; }
                        .mb-1 { margin-bottom: 4px; }
                        .mb-2 { margin-bottom: 8px; }
                        .mb-4 { margin-bottom: 16px; }
                        .mt-4 { margin-top: 16px; }
                        .mt-8 { margin-top: 32px; }
                        .text-lg { font-size: 16px; }
                        .text-xl { font-size: 18px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 8px; }
                        th, td { border: 1px solid #000; padding: 4px 8px; text-align: left; }
                        th { text-align: center; font-weight: bold; }
                        .text-gray { color: #666; }
                        .footer-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 10px; }
                        .print-page-break { page-break-before: always; }
                        .avoid-break { page-break-inside: avoid; }
                    </style>
                </head>
                <body>
                    ${htmlContent}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 1500);
        }
    };

    const handlePrintAll = () => {
        if (!receiptRef.current || !controlSlipRef.current) return;
        const printContent = receiptRef.current.innerHTML + '<div style="page-break-before: always; margin-top: 20px;" class="print-page-break"></div>' + controlSlipRef.current.innerHTML;
        printHtml(printContent, 'In Tất Cả');
    };

    const handlePrintReceipt = () => {
        if (!receiptRef.current) return;
        printHtml(receiptRef.current.innerHTML, 'In Biên Nhận');
    };

    const handlePrintControlSlip = () => {
        if (!controlSlipRef.current) return;
        printHtml(controlSlipRef.current.innerHTML, 'In Phiếu Kiểm Soát');
    };

    const now = new Date();
    
    const safeParseDate = (dateVal: any, fallback: Date = new Date()) => {
        if (!dateVal) return fallback;
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? fallback : d;
    };

    const rDate = safeParseDate(data.receivedDate, now);
    const dDate = safeParseDate(data.deadline, now);

    // Set time to current time for exact receipt time
    if (!isNaN(rDate.getTime())) {
        rDate.setHours(now.getHours(), now.getMinutes());
    }
    if (!isNaN(dDate.getTime())) {
        dDate.setHours(now.getHours(), now.getMinutes());
    }

    const formatDateTime = (d: Date) => {
        if (!d || isNaN(d.getTime())) {
            return '..... giờ ..... phút, ngày ..... tháng ..... năm .........';
        }
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${hours} giờ ${minutes} phút, ngày ${day} tháng ${month} năm ${year}`;
    };

    const formatDateOnly = (d: Date) => {
        if (!d || isNaN(d.getTime())) {
            return 'ngày ..... tháng ..... năm .........';
        }
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `ngày ${day} tháng ${month} năm ${year}`;
    };

    const wardName = getNormalizedWard(data.ward || '');

    const emptyRows = Array(6).fill(0).map((_, i) => (
        <tr key={i} className="avoid-break">
            <td style={{ width: '12%', border: '1px solid black' }}></td>
            <td style={{ width: '58%', border: '1px solid black', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                        <tr>
                            <td colSpan={3} style={{ borderBottom: '1px solid black', padding: '4px 6px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                                1.Giao &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ..... giờ ..... phút, ngày..... tháng ..... năm......
                            </td>
                        </tr>
                        <tr>
                            <td style={{ width: '15%', borderRight: '1px solid black', padding: '4px 6px', textAlign: 'left', verticalAlign: 'top' }}>2.Nhận</td>
                            <td style={{ width: '42.5%', borderRight: '1px solid black', padding: '4px 6px', textAlign: 'center', verticalAlign: 'top' }}>Người giao<br/><br/><br/></td>
                            <td style={{ width: '42.5%', padding: '4px 6px', textAlign: 'center', verticalAlign: 'top' }}>Người nhận<br/><br/><br/></td>
                        </tr>
                    </tbody>
                </table>
            </td>
            <td style={{ width: '15%', border: '1px solid black' }}></td>
            <td style={{ width: '15%', border: '1px solid black' }}></td>
        </tr>
    ));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-bold">In Biên Nhận & Phiếu Kiểm Soát</h2>
                    <div className="flex space-x-2">
                        <button onClick={handlePrintReceipt} className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                            <Printer className="w-4 h-4 mr-2" /> In Biên Nhận
                        </button>
                        <button onClick={handlePrintControlSlip} className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                            <Printer className="w-4 h-4 mr-2" /> In Phiếu Quy Trình
                        </button>
                        <button onClick={handlePrintAll} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            <Printer className="w-4 h-4 mr-2" /> In Tất Cả
                        </button>
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                            Đóng
                        </button>
                    </div>
                </div>
                
                <div className="p-8 overflow-y-auto flex-1 bg-gray-50">
                    <div>
                        <div ref={receiptRef} className="bg-white p-10 shadow-sm border border-gray-200 mx-auto text-black" style={{ maxWidth: '210mm', minHeight: '297mm', fontFamily: "'Times New Roman', Times, serif", fontSize: '14px', lineHeight: '1.3' }}>
                            
                            {/* Header */}
                        <div className="flex justify-between mb-4">
                            <div className="text-center" style={{ width: '45%' }}>
                                <div className="font-bold text-[15px]">SỞ NÔNG NGHIỆP VÀ MÔI TRƯỜNG</div>
                                <div className="font-bold text-[16px]">BỘ PHẬN TIẾP NHẬN VÀ TRẢ KẾT QUẢ</div>
                                
                                {data.code && (
                                    <div className="mt-2 text-center" style={{ display: 'block' }}>
                                        <div className="font-bold text-[15px]" style={{ display: 'block', whiteSpace: 'nowrap' }}>{data.code}</div>
                                        <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center', marginTop: '-4px', display: 'inline-block' }}>
                                            <Barcode value={data.code} height={30} displayValue={false} margin={0} width={1.5} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="text-center" style={{ width: '50%' }}>
                                <div className="font-bold text-[15px]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                <div className="font-bold underline mb-2">Độc lập - Tự do - Hạnh phúc</div>
                                <div className="italic mt-4">{getNormalizedWard(receivingWard)}, {formatDateOnly(new Date())}</div>
                            </div>
                        </div>

                        {/* Title */}
                        <div className="text-center mt-6 mb-4">
                            <div className="font-bold text-[18px]">GIẤY TIẾP NHẬN HỒ SƠ VÀ HẸN TRẢ KẾT QUẢ</div>
                        </div>

                        {/* Content */}
                        <div className="space-y-[6px]">
                            <div>Bộ phận tiếp nhận và trả kết quả: <span className="font-bold">Sở Nông nghiệp và Môi trường</span></div>
                            <div>Tiếp nhận hồ sơ của: <span className="font-bold">{data.customerName}</span></div>
                            <div>CCCD/MST: <span className="font-bold">{data.cccd || ''}</span></div>
                            <div>Số điện thoại: {data.phoneNumber}</div>
                            <div className="flex">
                                <div style={{ marginRight: '2cm' }}>Tờ: {data.mapSheet}</div>
                                <div>Thửa: {data.landPlot}</div>
                            </div>
                            <div>Địa chỉ thửa đất: <span className="font-bold uppercase">XÃ {getNormalizedWard(data.ward || '').toUpperCase()}</span></div>
                            <div>Thủ tục hành chính cần giải quyết: <span className="font-bold">{data.recordType}</span></div>
                            
                            <div>1. Thành phần hồ sơ, yêu cầu và số lượng mỗi loại giấy tờ gồm:</div>
                            <table className="w-full border-collapse border border-black mt-1 mb-2">
                                <thead>
                                    <tr>
                                        <th className="border border-black p-1 text-center w-12">STT</th>
                                        <th className="border border-black p-1 text-center">Tên giấy tờ</th>
                                        <th className="border border-black p-1 text-center w-24">Loại giấy tờ</th>
                                        <th className="border border-black p-1 text-center w-20">Số lượng</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border border-black p-1 text-center">1</td>
                                        <td className="border border-black p-1">Phiếu yêu cầu lập hợp đồng đo đạc dịch vụ; trích lục ; Cung cấp thông tin thửa đất</td>
                                        <td className="border border-black p-1 text-center">Bản chính</td>
                                        <td className="border border-black p-1 text-center">1</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black p-1 text-center">2</td>
                                        <td className="border border-black p-1">Giấy chứng nhận đã cấp.</td>
                                        <td className="border border-black p-1 text-center">Bản sao</td>
                                        <td className="border border-black p-1 text-center">1</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black p-1 text-center">3</td>
                                        <td className="border border-black p-1">{data.authDocType?.split('|')[0] || ''}</td>
                                        <td className="border border-black p-1 text-center">{data.authDocType?.split('|')[0] ? (data.authDocType.split('|')[1] || 'Bản chính') : ''}</td>
                                        <td className="border border-black p-1 text-center">{data.authDocType?.split('|')[0] ? '1' : ''}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-black p-1 text-center">4</td>
                                        <td className="border border-black p-1">{data.otherDocs?.split('|')[0] || ''}</td>
                                        <td className="border border-black p-1 text-center">{data.otherDocs?.split('|')[0] ? (data.otherDocs.split('|')[1] || 'Bản chính') : ''}</td>
                                        <td className="border border-black p-1 text-center">{data.otherDocs?.split('|')[0] ? '1' : ''}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div>2. Số lượng hồ sơ: 01 (bộ)</div>
                            <div>3. Thời gian nhận hồ sơ: <span className="font-bold">{formatDateTime(rDate)}</span></div>
                            <div>4. Thời gian trả kết quả giải quyết hồ sơ: <span className="font-bold">{formatDateTime(dDate)}</span></div>
                            <div>5. Đăng ký trả kết quả tại: Trung tâm phục vụ hành chính công xã {getNormalizedWard(receivingWard)}</div>
                            <div>6. Phí, lệ phí (nếu có): <span className="font-bold">Chưa thanh toán</span></div>
                            <div>Vào sổ theo dõi hồ sơ, Quyển số: .................... Số thứ tự:............(nếu có)</div>
                        </div>

                        {/* Signatures */}
                        <div className="flex justify-between mt-8 text-center">
                            <div className="w-1/2">
                                <div className="font-bold">NGƯỜI NỘP HỒ SƠ</div>
                                <div className="italic">(Ký và ghi rõ họ tên)</div>
                            </div>
                            <div className="w-1/2">
                                <div className="font-bold">NGƯỜI TIẾP NHẬN HỒ SƠ</div>
                                <div className="italic">(Ký và ghi rõ họ tên)</div>
                            </div>
                        </div>

                        {/* Spacer for signatures to ensure it shows in print */}
                        <div style={{ height: '120px' }}></div>

                        {/* Footer */}
                        <div className="pt-4 border-t border-gray-400">
                            <div><span className="font-bold">Chú ý:</span> Công dân đến nhận kết quả mang theo phiếu hẹn, CMTND/CCCD, lệ phí và giấy ủy quyền</div>
                            <div className="mt-1">(Trong trường hợp không phải chính chủ đến nhận)</div>
                            
                            <div className="flex justify-between items-end mt-4">
                                <div className="text-gray-500 text-sm">Phiên bản mẫu phiếu: TNTKQ-V5.1</div>
                                <div className="font-bold">TỔNG ĐÀI 0271.3636.836</div>
                            </div>
                        </div>

                    </div>

                    <div style={{ pageBreakBefore: 'always', marginTop: '20px' }} className="print-page-break"></div>
                    
                    <div ref={controlSlipRef} className="bg-white p-10 shadow-sm border border-gray-200 mx-auto text-black mt-8" style={{ maxWidth: '210mm', minHeight: '297mm', fontFamily: "'Times New Roman', Times, serif", fontSize: '14px', lineHeight: '1.3' }}>
                        {/* Control Slip Header */}
                        <div className="flex justify-between mb-4">
                            <div className="text-center" style={{ width: '45%' }}>
                                <div className="font-bold text-[15px]">VĂN PHÒNG ĐKĐĐ TỈNH BÌNH PHƯỚC</div>
                                <div className="font-bold text-[16px]">CHI NHÁNH HỚN QUẢN</div>
                            </div>
                            <div className="text-center" style={{ width: '50%' }}>
                                <div className="font-bold text-[15px]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                <div className="font-bold underline mb-2">Độc lập - Tự do - Hạnh phúc</div>
                            </div>
                        </div>

                        {/* Control Slip Title */}
                        <div className="text-center mt-6 mb-4">
                            <div className="font-bold text-[18px]">PHIẾU KIỂM SOÁT QUÁ TRÌNH GIẢI QUYẾT HỒ SƠ</div>
                            <div className="font-bold mt-2">Mã hồ sơ: {data.code || data.id}</div>
                        </div>

                        {/* Control Slip Table */}
                        <table className="w-full border-collapse border border-black mt-4">
                            <thead>
                                <tr>
                                    <th style={{ width: '12%', border: '1px solid black', padding: '6px', textAlign: 'center' }}>TÊN CƠ<br/>QUAN</th>
                                    <th style={{ width: '58%', border: '1px solid black', padding: '6px', textAlign: 'center' }}>THỜI GIAN GIAO, NHẬN HỒ SƠ</th>
                                    <th style={{ width: '15%', border: '1px solid black', padding: '6px', textAlign: 'center' }}>KẾT QUẢ</th>
                                    <th style={{ width: '15%', border: '1px solid black', padding: '6px', textAlign: 'center' }}>Ghi chú</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="avoid-break">
                                    <td style={{ width: '12%', border: '1px solid black' }}></td>
                                    <td style={{ width: '58%', border: '1px solid black', padding: 0 }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                <tr>
                                                    <td colSpan={3} style={{ borderBottom: '1px solid black', padding: '4px 6px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                                                        1.Giao &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {formatDateTime(rDate)}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style={{ width: '15%', borderRight: '1px solid black', padding: '4px 6px', textAlign: 'left', verticalAlign: 'top' }}>2.Nhận</td>
                                                    <td style={{ width: '42.5%', borderRight: '1px solid black', padding: '4px 6px', textAlign: 'center', verticalAlign: 'top' }}>Người giao<br/><br/><br/></td>
                                                    <td style={{ width: '42.5%', padding: '4px 6px', textAlign: 'center', verticalAlign: 'top' }}>Người nhận<br/><br/><br/></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                    <td style={{ width: '15%', border: '1px solid black' }}></td>
                                    <td style={{ width: '15%', border: '1px solid black' }}></td>
                                </tr>
                                {emptyRows}
                            </tbody>
                        </table>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemReceiptTemplate;
