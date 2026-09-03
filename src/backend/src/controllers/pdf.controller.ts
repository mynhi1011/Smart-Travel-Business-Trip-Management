import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { Errors } from '../middlewares/error-handler';

const PDF_ALLOWED_STATUSES = ['APPROVED', 'ONGOING', 'EXPENSE_SUBMITTED', 'EXPENSE_APPROVED', 'CLOSED'];

export async function exportTripPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    const { id: userId, role } = req.user;
    const tripId = req.params['id'] ?? '';

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        employee:        { select: { name: true, department: true, jobGrade: true } },
        itineraryItems:  { orderBy: [{ dayNumber: 'asc' }, { sortOrder: 'asc' }] },
        approvalRecords: { include: { approver: { select: { name: true, role: true } } }, orderBy: { actedAt: 'asc' } },
        expense:         { include: { items: true } },
        policyCheckResult: true,
      },
    });

    if (!trip) { next(Errors.TRIP_NOT_FOUND()); return; }

    // Access check: owner or FINANCE
    if (trip.employeeId !== userId && role !== 'FINANCE' && role !== 'ADMIN')
      { next(Errors.FORBIDDEN()); return; }

    if (!PDF_ALLOWED_STATUSES.includes(trip.status))
      { next(Errors.INVALID_STATUS_TRANSITION(trip.status, `One of: ${PDF_ALLOWED_STATUSES.join(', ')}`)); return; }

    // Build plain-text/HTML report (Puppeteer not installed — deliver HTML as fallback)
    const formatVND = (n: number) => n.toLocaleString('vi-VN') + ' VNĐ';
    const formatDate = (d: Date) => new Date(d).toLocaleDateString('vi-VN');

    const itemRows = trip.itineraryItems.map(i =>
      `<tr><td>Ngày ${i.dayNumber}</td><td>${i.timeSlot}</td><td>${i.location}</td><td>${i.activity}</td><td>${formatVND(i.estimatedCost)}</td></tr>`
    ).join('');

    const approvalRows = trip.approvalRecords.map(a =>
      `<tr><td>${a.approver.name}</td><td>${a.approvalLevel}</td><td>${a.action}</td><td>${a.comment ?? ''}</td><td>${formatDate(a.actedAt)}</td></tr>`
    ).join('');

    const expenseRows = trip.expense?.items.map(e =>
      `<tr><td>${formatDate(e.expenseDate)}</td><td>${e.category}</td><td>${e.description}</td><td>${formatVND(e.amount)}</td></tr>`
    ).join('') ?? '';

    const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8">
<style>body{font-family:Arial,sans-serif;padding:24px;color:#1b2f35}h1{color:#1b2f35}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#f0f4f5}
.section{margin-bottom:24px}.badge{display:inline-block;padding:2px 8px;border-radius:4px;background:#e0f2f1;color:#00695c;font-size:12px}
</style></head><body>
<h1>Báo cáo công tác — ${trip.destination}</h1>
<div class="section">
  <h2>Thông tin chuyến đi</h2>
  <p><b>Nhân viên:</b> ${trip.employee.name} (${trip.employee.department ?? ''} — ${trip.employee.jobGrade})</p>
  <p><b>Tuyến:</b> ${trip.origin} → ${trip.destination}</p>
  <p><b>Thời gian:</b> ${formatDate(trip.departureDate)} → ${formatDate(trip.returnDate)}</p>
  <p><b>Mục đích:</b> ${trip.purpose}</p>
  <p><b>Dự toán:</b> ${formatVND(trip.estimatedBudget)}</p>
  <p><b>Trạng thái:</b> <span class="badge">${trip.status}</span></p>
</div>
<div class="section">
  <h2>Lịch trình</h2>
  <table><thead><tr><th>Ngày</th><th>Buổi</th><th>Địa điểm</th><th>Hoạt động</th><th>Chi phí</th></tr></thead>
  <tbody>${itemRows || '<tr><td colspan="5">Chưa có lịch trình</td></tr>'}</tbody></table>
</div>
${trip.expense ? `<div class="section">
  <h2>Chi phí thực tế</h2>
  <p><b>Tổng dự toán:</b> ${formatVND(trip.expense.estimatedBudgetSnapshot)}</p>
  <p><b>Tổng thực tế:</b> ${formatVND(trip.expense.totalActual)}</p>
  ${trip.expense.variancePct != null ? `<p><b>Chênh lệch:</b> ${Number(trip.expense.variancePct).toFixed(1)}%</p>` : ''}
  <table><thead><tr><th>Ngày</th><th>Danh mục</th><th>Mô tả</th><th>Số tiền</th></tr></thead>
  <tbody>${expenseRows || '<tr><td colspan="4">Chưa có khoản chi</td></tr>'}</tbody></table>
</div>` : ''}
<div class="section">
  <h2>Lịch sử phê duyệt</h2>
  <table><thead><tr><th>Người duyệt</th><th>Cấp</th><th>Hành động</th><th>Ghi chú</th><th>Thời gian</th></tr></thead>
  <tbody>${approvalRows || '<tr><td colspan="5">Chưa có lịch sử</td></tr>'}</tbody></table>
</div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="trip-report-${tripId.slice(0, 8)}.html"`);
    res.status(200).send(html);
  } catch (err) { next(err); }
}
