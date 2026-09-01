/**
 * pdf-generator.ts — PDF Export Service
 *
 * Render HTML template thành PDF cho Trip Report.
 * Template: thông tin nhân viên, lịch trình, bảng chi phí, lịch sử phê duyệt.
 * Chỉ export khi trip.status IN (APPROVED, ONGOING, CLOSED).
 *
 * Tài liệu tham chiếu: architecture.md §5.3 PDFService
 * Note: Puppeteer bị bỏ qua trong scaffold (cần Chromium ~300MB).
 *       Sẽ thêm lại khi implement PDF feature.
 *
 * TODO: Implement đầy đủ khi xây dựng PDF Export feature
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TripPDFData {
  tripId: string;
  employeeName: string;
  department?: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  purpose: string;
  estimatedBudget: number;
  status: string;
  itinerary: Array<{
    dayNumber: number;
    date: string;
    timeSlot: string;
    location: string;
    activity: string;
    estimatedCost: number;
  }>;
  approvalHistory: Array<{
    approverName: string;
    approvalLevel: string;
    action: string;
    actedAt: string;
    comment?: string;
  }>;
  expense?: {
    totalActual: number;
    variancePct?: number;
    status: string;
  };
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

/**
 * generateTripPDF — Render Trip Report thành PDF buffer
 * TODO: Implement với Puppeteer hoặc thư viện PDF thay thế
 */
export async function generateTripPDF(
  _data: TripPDFData
): Promise<Buffer> {
  // TODO: Implement
  // 1. Render HTML template với data
  // 2. Launch Puppeteer browser
  // 3. Load HTML → render → export PDF
  // 4. Return PDF buffer

  throw new Error('PDF generation — TODO: implement khi xây dựng PDF feature');
}

/**
 * buildTripHTMLTemplate — Tạo HTML string cho trip report
 * TODO: Implement template với Tailwind/inline CSS, hỗ trợ tiếng Việt
 */
export function buildTripHTMLTemplate(_data: TripPDFData): string {
  // TODO: Implement HTML template
  return `<!DOCTYPE html><html><body><h1>Trip Report — TODO</h1></body></html>`;
}
