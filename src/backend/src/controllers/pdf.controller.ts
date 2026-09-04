/**
 * pdf.controller.ts — Trip Report PDF Export
 *
 * BUG-08 fix: trả application/pdf thật thay vì text/html.
 * Dùng pdfkit (pure JS, không cần Puppeteer/Chrome).
 *
 * REQ-TR-12: Export báo cáo chuyến đi dạng PDF phục vụ kế toán.
 * Access: Trip owner | FINANCE | ADMIN
 */

import { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import prisma from '../prisma/client';
import { Errors } from '../middlewares/error-handler';

const PDF_ALLOWED_STATUSES = ['APPROVED', 'ONGOING', 'EXPENSE_SUBMITTED', 'EXPENSE_APPROVED', 'CLOSED'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVND(n: number): string {
  return n.toLocaleString('vi-VN') + ' VND';
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('vi-VN');
}

function fmtTimeSlot(s: string): string {
  const map: Record<string, string> = { MORNING: 'Sang', AFTERNOON: 'Chieu', EVENING: 'Toi', ALL_DAY: 'Ca ngay' };
  return map[s] ?? s;
}

function fmtCategory(c: string): string {
  const map: Record<string, string> = {
    MEETING: 'Hop', ACCOMMODATION: 'Luu tru', TRANSPORT: 'Di chuyen', MEAL: 'An uong', OTHER: 'Khac',
    FLIGHT: 'Ve may bay', HOTEL: 'Khach san', PER_DIEM: 'Phu cap',
  };
  return map[c] ?? c;
}

function fmtApprovalLevel(l: string): string {
  return l === 'LEVEL_1' ? 'Cap 1' : l === 'LEVEL_2' ? 'Cap 2' : l;
}

function fmtAction(a: string): string {
  return a === 'APPROVED' ? 'Phe duyet' : a === 'REJECTED' ? 'Tu choi' : a;
}

// ─── PDF builder helpers ──────────────────────────────────────────────────────

const COL = { margin: 50, right: 545 };
const GRAY   = '#6b7280';
const DARK   = '#1b2f35';
const LIGHT  = '#f0f4f5';
const BORDER = '#d1d5db';
const GREEN  = '#059669';
const RED    = '#dc2626';

function sectionHeader(doc: PDFKit.PDFDocument, title: string): void {
  doc.moveDown(0.6);
  doc
    .fillColor(DARK).fontSize(11).font('Helvetica-Bold')
    .text(title, COL.margin, doc.y);
  doc.moveDown(0.2);
  doc
    .moveTo(COL.margin, doc.y)
    .lineTo(COL.right, doc.y)
    .lineWidth(0.5).strokeColor(BORDER).stroke();
  doc.moveDown(0.4);
}

function labelValue(doc: PDFKit.PDFDocument, label: string, value: string, indent = 0): void {
  const x = COL.margin + indent;
  const labelW = 130;
  const y = doc.y;
  doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(label, x, y, { width: labelW, continued: false });
  doc.fillColor(DARK).fontSize(9).font('Helvetica').text(value, x + labelW, y, { width: COL.right - x - labelW });
}

/**
 * Đơn giản hóa table bằng manual x positioning.
 * cols: array of { header, width, align? }
 * rows: string[][]
 */
function drawTable(
  doc: PDFKit.PDFDocument,
  cols: { header: string; width: number; align?: 'left' | 'right' }[],
  rows: string[][],
  emptyText = 'Chua co du lieu'
): void {
  const rowHeight = 18;
  const headerH  = 20;
  const startX   = COL.margin;
  let y = doc.y;

  // Header row
  doc.rect(startX, y, COL.right - startX, headerH).fill(LIGHT);
  let x = startX;
  for (const col of cols) {
    doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
      .text(col.header, x + 4, y + 5, { width: col.width - 8, align: col.align ?? 'left' });
    x += col.width;
  }
  y += headerH;

  if (rows.length === 0) {
    doc.rect(startX, y, COL.right - startX, rowHeight).stroke(BORDER);
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
      .text(emptyText, startX + 4, y + 4, { width: COL.right - startX - 8, align: 'center' });
    y += rowHeight;
    doc.y = y + 4;
    return;
  }

  for (let r = 0; r < rows.length; r++) {
    // Page break guard
    if (y + rowHeight > doc.page.height - 60) {
      doc.addPage();
      y = 50;
    }
    const bg = r % 2 === 1 ? '#f9fafb' : '#ffffff';
    doc.rect(startX, y, COL.right - startX, rowHeight).fill(bg);
    // Border
    doc.rect(startX, y, COL.right - startX, rowHeight).lineWidth(0.3).stroke(BORDER);

    x = startX;
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c];
      const cell = rows[r]?.[c] ?? '';
      doc.fillColor(DARK).fontSize(8).font('Helvetica')
        .text(cell, x + 4, y + 4, { width: col.width - 8, align: col.align ?? 'left' });
      x += col.width;
    }
    y += rowHeight;
  }
  doc.y = y + 6;
}

// ─── Controller ───────────────────────────────────────────────────────────────

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

    // Access check: owner | FINANCE | ADMIN
    if (trip.employeeId !== userId && role !== 'FINANCE' && role !== 'ADMIN') {
      next(Errors.FORBIDDEN()); return;
    }

    if (!PDF_ALLOWED_STATUSES.includes(trip.status)) {
      next(Errors.INVALID_STATUS_TRANSITION(trip.status, `One of: ${PDF_ALLOWED_STATUSES.join(', ')}`)); return;
    }

    // ── Build PDF ─────────────────────────────────────────────────────────────
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // ── Cover / header ────────────────────────────────────────────────────────
    doc
      .rect(0, 0, doc.page.width, 80).fill(DARK);
    doc
      .fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
      .text('BAO CAO CONG TAC', COL.margin, 22);
    doc
      .fillColor('#94a3b8').fontSize(9).font('Helvetica')
      .text(`${trip.origin} -> ${trip.destination}  |  ${fmtDate(trip.departureDate)} - ${fmtDate(trip.returnDate)}`, COL.margin, 48);
    doc
      .fillColor('#64748b').fontSize(8)
      .text(`Tao luc: ${new Date().toLocaleString('vi-VN')}  |  Ma phieu: ${(trip as unknown as { tripCode?: string }).tripCode ?? tripId}`, COL.margin, 62);
    doc.y = 100;

    // ── Section 1: Trip info ──────────────────────────────────────────────────
    sectionHeader(doc, '1. THONG TIN CHUYEN DI');
    labelValue(doc, 'Nhan vien:',  `${trip.employee.name} (${trip.employee.department ?? ''} - ${trip.employee.jobGrade})`);
    labelValue(doc, 'Tuyen duong:', `${trip.origin} -> ${trip.destination}`);
    labelValue(doc, 'Thoi gian:',  `${fmtDate(trip.departureDate)} den ${fmtDate(trip.returnDate)}`);
    labelValue(doc, 'Muc dich:',   trip.purpose);
    labelValue(doc, 'Du toan:',    fmtVND(trip.estimatedBudget));
    labelValue(doc, 'Trang thai:', trip.status);
    if (trip.isUrgent && trip.urgencyReason) {
      labelValue(doc, 'Khan cap:', trip.urgencyReason);
    }

    // ── Section 2: Itinerary ──────────────────────────────────────────────────
    sectionHeader(doc, '2. LICH TRINH');
    const totalW = COL.right - COL.margin;
    drawTable(
      doc,
      [
        { header: 'Ngay', width: Math.round(totalW * 0.08) },
        { header: 'Buoi', width: Math.round(totalW * 0.12) },
        { header: 'Dia diem', width: Math.round(totalW * 0.30) },
        { header: 'Hoat dong', width: Math.round(totalW * 0.34) },
        { header: 'Chi phi', width: Math.round(totalW * 0.16), align: 'right' },
      ],
      trip.itineraryItems.map(i => [
        String(i.dayNumber),
        fmtTimeSlot(i.timeSlot),
        i.location,
        i.activity,
        fmtVND(i.estimatedCost),
      ]),
      'Chua co lich trinh'
    );

    // ── Section 3: Expense ────────────────────────────────────────────────────
    if (trip.expense) {
      sectionHeader(doc, '3. CHI PHI THUC TE');
      const exp = trip.expense;
      labelValue(doc, 'Tong du toan:',  fmtVND(exp.estimatedBudgetSnapshot));
      labelValue(doc, 'Tong thuc te:',  fmtVND(exp.totalActual));
      if (exp.variancePct != null) {
        const pct = Number(exp.variancePct);
        const color = pct > 10 ? RED : GREEN;
        const y = doc.y;
        doc.fillColor(GRAY).fontSize(9).font('Helvetica').text('Chenh lech:', COL.margin, y, { width: 130 });
        doc.fillColor(color).fontSize(9).font('Helvetica-Bold')
          .text(`${pct.toFixed(1)}%${pct > 10 ? ' (VUOT 10%)' : ''}`, COL.margin + 130, y);
      }
      doc.moveDown(0.5);
      drawTable(
        doc,
        [
          { header: 'Ngay', width: Math.round(totalW * 0.14) },
          { header: 'Danh muc', width: Math.round(totalW * 0.18) },
          { header: 'Mo ta', width: Math.round(totalW * 0.46) },
          { header: 'So tien', width: Math.round(totalW * 0.22), align: 'right' },
        ],
        exp.items.map(e => [
          fmtDate(e.expenseDate),
          fmtCategory(e.category),
          e.description,
          fmtVND(e.amount),
        ]),
        'Chua co khoan chi'
      );
    }

    // ── Section 4: Approval history ───────────────────────────────────────────
    sectionHeader(doc, trip.expense ? '4. LICH SU PHE DUYET' : '3. LICH SU PHE DUYET');
    drawTable(
      doc,
      [
        { header: 'Nguoi duyet', width: Math.round(totalW * 0.24) },
        { header: 'Cap', width: Math.round(totalW * 0.12) },
        { header: 'Hanh dong', width: Math.round(totalW * 0.16) },
        { header: 'Ghi chu', width: Math.round(totalW * 0.30) },
        { header: 'Thoi gian', width: Math.round(totalW * 0.18) },
      ],
      trip.approvalRecords.map(a => [
        a.approver.name,
        fmtApprovalLevel(a.approvalLevel),
        fmtAction(a.action),
        a.comment ?? '',
        fmtDate(a.actedAt),
      ]),
      'Chua co lich su'
    );

    // ── Footer on each page ───────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fillColor(GRAY).fontSize(7).font('Helvetica')
        .text(
          `Smart Travel — Bao cao cong tac | Trang ${i - range.start + 1}/${range.count} | ${new Date().toLocaleDateString('vi-VN')}`,
          COL.margin, doc.page.height - 30,
          { align: 'center', width: COL.right - COL.margin }
        );
    }

    doc.end();

    // Collect all chunks then send
    await new Promise<void>((resolve, reject) => {
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        const filename = `trip-report-${(trip as unknown as { tripCode?: string }).tripCode ?? tripId.slice(0, 8)}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', String(pdfBuffer.length));
        res.status(200).send(pdfBuffer);
        resolve();
      });
      doc.on('error', reject);
    });
  } catch (err) { next(err); }
}
