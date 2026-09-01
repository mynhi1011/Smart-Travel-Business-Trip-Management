/**
 * date.utils.ts — Date Utility Functions
 *
 * Helper functions cho date calculations dùng trong business rules.
 */

/**
 * calculateTripDays — Tính số ngày công tác
 * Bám đúng data-model.md: trip_days = returnDate - departureDate + 1
 */
export function calculateTripDays(departureDate: Date, returnDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const departure = new Date(departureDate);
  const returning = new Date(returnDate);
  departure.setHours(0, 0, 0, 0);
  returning.setHours(0, 0, 0, 0);
  const diffDays = Math.round((returning.getTime() - departure.getTime()) / msPerDay);
  return diffDays + 1; // Inclusive of both departure and return day
}

/**
 * formatCurrencyVND — Format số tiền VNĐ
 * Ví dụ: 1500000 → "1.500.000 VNĐ"
 */
export function formatCurrencyVND(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} VNĐ`;
}

/**
 * isWeekend — Kiểm tra ngày có phải cuối tuần không
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * addWorkingDays — Thêm N ngày làm việc vào một ngày
 */
export function addWorkingDays(date: Date, workingDays: number): Date {
  const result = new Date(date);
  let daysAdded = 0;

  while (daysAdded < workingDays) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) {
      daysAdded++;
    }
  }

  return result;
}
