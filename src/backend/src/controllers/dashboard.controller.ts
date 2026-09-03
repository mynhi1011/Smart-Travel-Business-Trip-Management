import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { Errors } from '../middlewares/error-handler';

export async function getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { next(Errors.UNAUTHORIZED()); return; }
    const { id: userId, role } = req.user;

    const unreadCount = await prisma.notification.count({ where: { recipientId: userId, isRead: false } });

    if (role === 'EMPLOYEE') {
      const trips = await prisma.trip.findMany({ where: { employeeId: userId }, select: { status: true, id: true, destination: true, departureDate: true, estimatedBudget: true } });
      const byStatus: Record<string, number> = {};
      trips.forEach(t => { byStatus[t.status] = (byStatus[t.status] ?? 0) + 1; });
      const pendingExpense = await prisma.expense.count({ where: { trip: { employeeId: userId }, status: 'DRAFT' } });
      const pendingApproval = await prisma.expense.count({ where: { trip: { employeeId: userId }, status: 'SUBMITTED' } });
      res.json({ role, myTrips: { total: trips.length, byStatus, recentTrips: trips.slice(0, 5) }, myExpenses: { pendingSubmission: pendingExpense, pendingApproval }, notifications: { unreadCount } });
      return;
    }

    if (role === 'MANAGER') {
      const pendingTrips = await prisma.trip.findMany({ where: { employee: { managerId: userId }, status: 'SUBMITTED' }, include: { employee: { select: { name: true } } }, take: 10 });
      const teamTrips = await prisma.trip.groupBy({ by: ['status'], where: { employee: { managerId: userId } }, _count: { _all: true } });
      const byStatus: Record<string, number> = {};
      teamTrips.forEach(t => { byStatus[t.status] = t._count._all; });
      const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
      res.json({ role, pendingApprovals: { count: pendingTrips.length, trips: pendingTrips }, teamTrips: { total, byStatus }, notifications: { unreadCount } });
      return;
    }

    if (role === 'TRAVEL_ADMIN') {
      const pendingL2 = await prisma.trip.findMany({ where: { status: 'PENDING_ADMIN_APPROVAL' }, include: { employee: { select: { name: true } } }, take: 10 });
      const allTrips = await prisma.trip.groupBy({ by: ['status'], _count: { _all: true } });
      const byStatus: Record<string, number> = {};
      allTrips.forEach(t => { byStatus[t.status] = t._count._all; });
      res.json({ role, pendingL2Approvals: { count: pendingL2.length, trips: pendingL2 }, allTrips: { byStatus }, notifications: { unreadCount } });
      return;
    }

    if (role === 'FINANCE') {
      const pendingExpenses = await prisma.expense.findMany({ where: { status: 'SUBMITTED' }, include: { trip: { select: { destination: true, employee: { select: { name: true } } } } }, take: 10 });
      const pendingClose = await prisma.trip.findMany({ where: { status: 'EXPENSE_APPROVED' }, include: { employee: { select: { name: true } } }, take: 10 });
      res.json({ role, pendingExpenses: { count: pendingExpenses.length, expenses: pendingExpenses }, pendingClose: { count: pendingClose.length, trips: pendingClose }, notifications: { unreadCount } });
      return;
    }

    // ADMIN
    const [totalTrips, totalUsers, totalExpenses] = await prisma.$transaction([
      prisma.trip.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.expense.count(),
    ]);
    res.json({ role, stats: { totalTrips, totalUsers, totalExpenses }, notifications: { unreadCount } });
  } catch (err) { next(err); }
}
