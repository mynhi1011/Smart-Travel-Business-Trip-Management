/**
 * seed.ts — Database Seed Data
 *
 * Tạo dữ liệu mẫu đại diện đủ 5 roles để test toàn bộ luồng nghiệp vụ.
 * Personas bám đúng user-stories.md và persona-jtbd.md.
 *
 * Chạy: npm run db:seed
 *
 * Dữ liệu tạo:
 *   - 6 users (đủ 5 roles + 1 admin)
 *   - 3 trips (DRAFT, SUBMITTED, APPROVED) với các trạng thái khác nhau
 *   - 1 PolicyCheckResult (trip SUBMITTED)
 *   - 1 ApprovalRecord (trip APPROVED)
 *   - 3 ItineraryItems (trip APPROVED)
 *   - 1 Expense + 2 ExpenseItems (trip APPROVED)
 *   - 3 Notifications mẫu
 *
 * Mật khẩu tất cả users: "Password123!" (bcrypt hash, cost=12)
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

// ─── Seed Data Constants ──────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const DEMO_PASSWORD = 'Password123!';

// IDs cố định để dễ reference trong dev/test
const IDS = {
  // Users
  ADMIN:        'aaaaaaaa-0000-4000-a000-000000000001',
  MANAGER:      'bbbbbbbb-0000-4000-b000-000000000002',
  EMPLOYEE_1:   'cccccccc-0000-4000-c000-000000000003',
  EMPLOYEE_2:   'dddddddd-0000-4000-d000-000000000004',
  TRAVEL_ADMIN: 'eeeeeeee-0000-4000-e000-000000000005',
  FINANCE:      'ffffffff-0000-4000-f000-000000000006',

  // Trips
  TRIP_DRAFT:     '11111111-0000-4000-a000-000000000001',
  TRIP_SUBMITTED: '22222222-0000-4000-a000-000000000002',
  TRIP_APPROVED:  '33333333-0000-4000-a000-000000000003',

  // PolicyCheckResult
  POLICY_RESULT_1: 'p1111111-0000-4000-a000-000000000001',

  // ApprovalRecord
  APPROVAL_1: 'ap111111-0000-4000-a000-000000000001',

  // Expense
  EXPENSE_1: 'ex111111-0000-4000-a000-000000000001',
} as const;

// ─── Seed Functions ───────────────────────────────────────────────────────────

async function seedUsers(passwordHash: string): Promise<void> {
  console.log('  → Seeding users...');

  await prisma.user.createMany({
    data: [
      // ── ADMIN ──────────────────────────────────────────────────────────────
      {
        id:           IDS.ADMIN,
        name:         'System Admin',
        email:        'admin@smarttravel.dev',
        passwordHash,
        role:         'ADMIN',
        jobGrade:     'DIRECTOR',
        department:   'IT',
        managerId:    null,
        isActive:     true,
      },

      // ── MANAGER — Trần Đình Hùng (Persona 2) ──────────────────────────────
      {
        id:           IDS.MANAGER,
        name:         'Trần Đình Hùng',
        email:        'hung.tran@smarttravel.dev',
        passwordHash,
        role:         'MANAGER',
        jobGrade:     'MANAGER_GRADE',
        department:   'Engineering',
        managerId:    IDS.ADMIN, // Manager báo cáo lên Admin trong seed
        isActive:     true,
      },

      // ── EMPLOYEE 1 — Nguyễn Văn Nam (Persona 1 — US-01..07) ───────────────
      {
        id:           IDS.EMPLOYEE_1,
        name:         'Nguyễn Văn Nam',
        email:        'nam.nguyen@smarttravel.dev',
        passwordHash,
        role:         'EMPLOYEE',
        jobGrade:     'STAFF',
        department:   'Sales',
        managerId:    IDS.MANAGER, // Nam báo cáo lên Hùng
        isActive:     true,
      },

      // ── EMPLOYEE 2 — Nhân viên thứ 2 (để test multi-employee) ─────────────
      {
        id:           IDS.EMPLOYEE_2,
        name:         'Trần Thị Bảo',
        email:        'bao.tran@smarttravel.dev',
        passwordHash,
        role:         'EMPLOYEE',
        jobGrade:     'STAFF',
        department:   'Marketing',
        managerId:    IDS.MANAGER,
        isActive:     true,
      },

      // ── TRAVEL_ADMIN — Lê Thị Mai (Persona 3) ─────────────────────────────
      {
        id:           IDS.TRAVEL_ADMIN,
        name:         'Lê Thị Mai',
        email:        'mai.le@smarttravel.dev',
        passwordHash,
        role:         'TRAVEL_ADMIN',
        jobGrade:     'MANAGER_GRADE',
        department:   'Administration',
        managerId:    IDS.ADMIN,
        isActive:     true,
      },

      // ── FINANCE — Phạm Thu Trang (Persona 4) ──────────────────────────────
      {
        id:           IDS.FINANCE,
        name:         'Phạm Thu Trang',
        email:        'trang.pham@smarttravel.dev',
        passwordHash,
        role:         'FINANCE',
        jobGrade:     'MANAGER_GRADE',
        department:   'Finance & Accounting',
        managerId:    IDS.ADMIN,
        isActive:     true,
      },
    ],
  });

  console.log('  ✓ 6 users created');
}

async function seedTrips(): Promise<void> {
  console.log('  → Seeding trips...');

  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);
  const nextWeekPlus3 = new Date(nextWeek);
  nextWeekPlus3.setDate(nextWeek.getDate() + 3);

  const twoWeeksLater = new Date(now);
  twoWeeksLater.setDate(now.getDate() + 14);
  const twoWeeksPlus2 = new Date(twoWeeksLater);
  twoWeeksPlus2.setDate(twoWeeksLater.getDate() + 2);

  const threeWeeksLater = new Date(now);
  threeWeeksLater.setDate(now.getDate() + 21);
  const threeWeeksPlus4 = new Date(threeWeeksLater);
  threeWeeksPlus4.setDate(threeWeeksLater.getDate() + 4);

  await prisma.trip.createMany({
    data: [
      // ── Trip 1: DRAFT — Nguyễn Văn Nam đang soạn ─────────────────────────
      {
        id:               IDS.TRIP_DRAFT,
        employeeId:       IDS.EMPLOYEE_1,
        origin:           'Hà Nội',
        destination:      'Đà Nẵng',
        destinationType:  'TIER1_CITY',
        departureDate:    nextWeek,
        returnDate:       nextWeekPlus3,
        purpose:          'Gặp gỡ khách hàng tiềm năng tại Đà Nẵng, thuyết trình demo sản phẩm và ký kết hợp đồng Q4',
        estimatedBudget:  8_500_000,   // 8.5 triệu VNĐ
        hotelCostPerNight: 900_000,    // Dưới hạn mức STAFF (1M/đêm) — BR-TR-01
        hotelNights:      3,
        perDiemBudget:    1_200_000,   // 3 ngày × 400k = đúng hạn mức TIER1_CITY — BR-TR-02
        transportBudget:  2_000_000,
        otherBudget:      700_000,
        status:           'DRAFT',
        isUrgent:         false,
        urgencyReason:    null,
        requiresLevel2:   false,
      },

      // ── Trip 2: SUBMITTED — Nguyễn Văn Nam đã nộp (có policy violation) ───
      {
        id:               IDS.TRIP_SUBMITTED,
        employeeId:       IDS.EMPLOYEE_1,
        origin:           'Hà Nội',
        destination:      'TP. Hồ Chí Minh',
        destinationType:  'TIER1_CITY',
        departureDate:    twoWeeksLater,
        returnDate:       twoWeeksPlus2,
        purpose:          'Họp chiến lược Q1 với Ban Giám đốc khu vực phía Nam và đối tác chiến lược',
        estimatedBudget:  15_000_000,  // 15 triệu VNĐ — dưới ngưỡng 20M
        hotelCostPerNight: 1_200_000,  // VƯỢT hạn mức STAFF (1M) → policy violation BR-TR-01
        hotelNights:      2,
        perDiemBudget:    800_000,     // 2 ngày × 400k = đúng hạn mức
        transportBudget:  3_500_000,
        otherBudget:      1_500_000,
        status:           'SUBMITTED',
        isUrgent:         false,
        urgencyReason:    null,
        requiresLevel2:   true,        // Do có violation → cần level 2
        submittedAt:      new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 tiếng trước
      },

      // ── Trip 3: APPROVED — Trần Thị Bảo, trip đã được duyệt ──────────────
      {
        id:               IDS.TRIP_APPROVED,
        employeeId:       IDS.EMPLOYEE_2,
        origin:           'Hà Nội',
        destination:      'Cần Thơ',
        destinationType:  'OTHER',
        departureDate:    threeWeeksLater,
        returnDate:       threeWeeksPlus4,
        purpose:          'Khảo sát thị trường khu vực Đồng bằng sông Cửu Long, gặp 3 đại lý phân phối',
        estimatedBudget:  12_000_000,
        hotelCostPerNight: 800_000,    // Dưới hạn mức STAFF (1M) — BR-TR-01
        hotelNights:      4,
        perDiemBudget:    1_200_000,   // 4 ngày × 300k = đúng hạn mức OTHER — BR-TR-02
        transportBudget:  2_500_000,
        otherBudget:      1_500_000,
        status:           'APPROVED',
        isUrgent:         false,
        urgencyReason:    null,
        requiresLevel2:   false,
        submittedAt:      new Date(now.getTime() - 48 * 60 * 60 * 1000), // 2 ngày trước
        approvedAt:       new Date(now.getTime() - 24 * 60 * 60 * 1000), // 1 ngày trước
      },
    ],
  });

  console.log('  ✓ 3 trips created (DRAFT, SUBMITTED, APPROVED)');
}

async function seedPolicyCheckResults(): Promise<void> {
  console.log('  → Seeding policy check results...');

  // Policy result cho Trip SUBMITTED (có violation)
  const violations = JSON.stringify([
    {
      code:     'POLICY_VIOLATION_ACCOMMODATION_OVER_BUDGET',
      detail:   'Chi phí khách sạn 1.200.000 VNĐ/đêm vượt hạn mức STAFF (1.000.000 VNĐ/đêm)',
      severity: 'WARNING',
      rule:     'BR-TR-01',
      limit:    1_000_000,
      actual:   1_200_000,
    },
  ]);

  await prisma.policyCheckResult.createMany({
    data: [
      {
        id:                    IDS.POLICY_RESULT_1,
        tripId:                IDS.TRIP_SUBMITTED,
        passed:                false,
        violations,
        violationCount:        1,
        requiresLevel2Approval: true,
        checkedAt:             new Date(),
      },
    ],
  });

  console.log('  ✓ 1 policy check result created');
}

async function seedApprovalRecords(): Promise<void> {
  console.log('  → Seeding approval records...');

  // Approval record cho Trip APPROVED (Manager đã duyệt)
  await prisma.approvalRecord.createMany({
    data: [
      {
        id:                   IDS.APPROVAL_1,
        tripId:               IDS.TRIP_APPROVED,
        approverId:           IDS.MANAGER,
        approvalLevel:        'LEVEL_1',
        action:               'APPROVED',
        comment:             'Chuyến đi hợp lý, ngân sách trong hạn mức, lịch trình rõ ràng. Approved.',
        budgetSnapshot:       12_000_000,
        hadViolationsSnapshot: false,
        actedAt:              new Date(new Date().getTime() - 24 * 60 * 60 * 1000),
      },
    ],
  });

  console.log('  ✓ 1 approval record created');
}

async function seedItineraryItems(): Promise<void> {
  console.log('  → Seeding itinerary items...');

  const threeWeeksLater = new Date();
  threeWeeksLater.setDate(new Date().getDate() + 21);

  const day2 = new Date(threeWeeksLater);
  day2.setDate(threeWeeksLater.getDate() + 1);

  const day3 = new Date(threeWeeksLater);
  day3.setDate(threeWeeksLater.getDate() + 2);

  await prisma.itineraryItem.createMany({
    data: [
      // Ngày 1 — Di chuyển + Check-in
      {
        id:            'it111111-0000-4000-a000-000000000001',
        tripId:        IDS.TRIP_APPROVED,
        itemDate:      threeWeeksLater,
        dayNumber:     1,
        timeSlot:      'MORNING',
        location:      'Sân bay Nội Bài, Hà Nội',
        activity:      'Bay chuyến HAN-VCA, khởi hành 7:30',
        category:      'TRANSPORT',
        estimatedCost: 1_200_000,
        notes:         'Vé máy bay đã book trước',
        isAiGenerated: false,
        sortOrder:     1,
      },
      {
        id:            'it222222-0000-4000-a000-000000000002',
        tripId:        IDS.TRIP_APPROVED,
        itemDate:      threeWeeksLater,
        dayNumber:     1,
        timeSlot:      'AFTERNOON',
        location:      'Khách sạn Mường Thanh Cần Thơ',
        activity:      'Check-in khách sạn, chuẩn bị tài liệu họp',
        category:      'ACCOMMODATION',
        estimatedCost: 800_000,
        notes:         'Phòng Superior, bao gồm bữa sáng',
        isAiGenerated: true,
        sortOrder:     2,
      },

      // Ngày 2 — Gặp đại lý
      {
        id:            'it333333-0000-4000-a000-000000000003',
        tripId:        IDS.TRIP_APPROVED,
        itemDate:      day2,
        dayNumber:     2,
        timeSlot:      'MORNING',
        location:      'Đại lý ABC - 15 Hùng Vương, Cần Thơ',
        activity:      'Họp thương thảo hợp đồng phân phối Q1 với đại lý ABC',
        category:      'MEETING',
        estimatedCost: 0,
        notes:         'Mang theo catalog và bảng giá mới',
        isAiGenerated: false,
        sortOrder:     3,
      },
    ],
  });

  console.log('  ✓ 3 itinerary items created');
}

async function seedExpenses(): Promise<void> {
  console.log('  → Seeding expense data...');

  // Expense DRAFT cho Trip APPROVED (Trần Thị Bảo đang kê khai)
  await prisma.expense.createMany({
    data: [
      {
        id:                       IDS.EXPENSE_1,
        tripId:                   IDS.TRIP_APPROVED,
        totalActual:              3_800_000,     // Tổng 2 items bên dưới
        estimatedBudgetSnapshot:  12_000_000,   // Snapshot từ trip.estimatedBudget
        variancePct:              null,          // Chưa submit → chưa tính
        varianceAmount:           null,
        justification:            null,
        managerReapprovalRequired: false,
        managerReapproved:         false,
        managerReapproverId:       null,
        managerReapprovedAt:       null,
        status:                   'DRAFT',
        submittedAt:              null,
        approvedAt:               null,
      },
    ],
  });

  await prisma.expenseItem.createMany({
    data: [
      {
        id:          'ei111111-0000-4000-a000-000000000001',
        expenseId:   IDS.EXPENSE_1,
        expenseDate: new Date(new Date().getTime() + 21 * 24 * 60 * 60 * 1000),
        category:    'TRANSPORT',
        amount:      1_200_000,
        description: 'Vé máy bay HAN-VCA khứ hồi',
        receiptUrl:  null,
      },
      {
        id:          'ei222222-0000-4000-a000-000000000002',
        expenseId:   IDS.EXPENSE_1,
        expenseDate: new Date(new Date().getTime() + 21 * 24 * 60 * 60 * 1000),
        category:    'ACCOMMODATION',
        amount:      2_600_000,   // 800k × ~ 3 đêm (tạm tính)
        description: 'Khách sạn Mường Thanh Cần Thơ - 3 đêm',
        receiptUrl:  null,
      },
    ],
  });

  console.log('  ✓ 1 expense + 2 expense items created');
}

async function seedNotifications(): Promise<void> {
  console.log('  → Seeding notifications...');

  await prisma.notification.createMany({
    data: [
      // Thông báo cho Nguyễn Văn Nam: trip submitted
      {
        id:            'nf111111-0000-4000-a000-000000000001',
        recipientId:   IDS.EMPLOYEE_1,
        type:          'PENDING_LEVEL1_APPROVAL',
        message:       'Yêu cầu công tác "Họp chiến lược Q1 tại TP.HCM" đã được gửi thành công và đang chờ Manager phê duyệt.',
        referenceId:   IDS.TRIP_SUBMITTED,
        referenceType: 'TRIP',
        isRead:        false,
        readAt:        null,
      },

      // Thông báo cho Manager Trần Đình Hùng: có trip cần duyệt
      {
        id:            'nf222222-0000-4000-a000-000000000002',
        recipientId:   IDS.MANAGER,
        type:          'PENDING_LEVEL1_APPROVAL',
        message:       'Nguyễn Văn Nam vừa gửi yêu cầu công tác "Họp chiến lược Q1 tại TP.HCM". Vui lòng xem xét và phê duyệt.',
        referenceId:   IDS.TRIP_SUBMITTED,
        referenceType: 'TRIP',
        isRead:        false,
        readAt:        null,
      },

      // Thông báo cho Trần Thị Bảo: trip approved
      {
        id:            'nf333333-0000-4000-a000-000000000003',
        recipientId:   IDS.EMPLOYEE_2,
        type:          'TRIP_APPROVED',
        message:       'Yêu cầu công tác "Khảo sát thị trường ĐBSCL" đã được Manager phê duyệt. Chúc bạn chuyến đi thành công!',
        referenceId:   IDS.TRIP_APPROVED,
        referenceType: 'TRIP',
        isRead:        true,
        readAt:        new Date(new Date().getTime() - 23 * 60 * 60 * 1000),
      },
    ],
  });

  console.log('  ✓ 3 notifications created');
}

// ─── Main Seed Runner ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🌱 Starting database seed...\n');

  // Xóa dữ liệu cũ theo thứ tự ngược FK để tránh constraint error
  console.log('  → Cleaning existing seed data...');
  await prisma.notification.deleteMany({});
  await prisma.expenseItem.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.itineraryItem.deleteMany({});
  await prisma.approvalRecord.deleteMany({});
  await prisma.policyCheckResult.deleteMany({});
  await prisma.trip.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('  ✓ Database cleaned\n');

  // Hash password một lần dùng cho tất cả users
  console.log('  → Hashing demo password...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
  console.log('  ✓ Password hash ready\n');

  // Chạy theo thứ tự để tránh FK constraint violations
  await seedUsers(passwordHash);
  await seedTrips();
  await seedPolicyCheckResults();
  await seedApprovalRecords();
  await seedItineraryItems();
  await seedExpenses();
  await seedNotifications();

  console.log('\n✅ Seed completed successfully!\n');
  console.log('Demo accounts (password: Password123!):');
  console.log('  Employee 1:   nam.nguyen@smarttravel.dev   (Nguyễn Văn Nam - STAFF)');
  console.log('  Employee 2:   bao.tran@smarttravel.dev     (Trần Thị Bảo - STAFF)');
  console.log('  Manager:      hung.tran@smarttravel.dev    (Trần Đình Hùng - MANAGER_GRADE)');
  console.log('  Travel Admin: mai.le@smarttravel.dev       (Lê Thị Mai - TRAVEL_ADMIN)');
  console.log('  Finance:      trang.pham@smarttravel.dev   (Phạm Thu Trang - FINANCE)');
  console.log('  Admin:        admin@smarttravel.dev        (System Admin - ADMIN)\n');
}

main()
  .catch((err: unknown) => {
    console.error('\n❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
