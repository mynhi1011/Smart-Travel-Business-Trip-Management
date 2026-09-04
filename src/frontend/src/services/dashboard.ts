/**
 * dashboard.ts — Dashboard API Service (Frontend)
 *
 * Gọi GET /dashboard — backend trả data đã tổng hợp theo role.
 * Tài liệu: dashboard.controller.ts, dashboard.routes.ts (REQ-TR-10)
 *
 * Response shape khác nhau theo role — dùng discriminated union để type-safe.
 */

import { apiRequest } from './api';

// ─── Types theo role ──────────────────────────────────────────────────────────

export interface DashboardNotifications {
  unreadCount: number;
}

export interface EmployeeDashboard {
  role: 'EMPLOYEE';
  myTrips: {
    total: number;
    byStatus: Record<string, number>;
    recentTrips: Array<{
      id: string;
      status: string;
      destination: string;
      departureDate: string;
      estimatedBudget: number;
    }>;
  };
  myExpenses: {
    pendingSubmission: number;
    pendingApproval: number;
  };
  notifications: DashboardNotifications;
}

export interface ManagerDashboard {
  role: 'MANAGER';
  pendingApprovals: {
    count: number;
    trips: Array<{ id: string; status: string; destination: string; employee: { name: string } }>;
  };
  teamTrips: {
    total: number;
    byStatus: Record<string, number>;
  };
  notifications: DashboardNotifications;
}

export interface TravelAdminDashboard {
  role: 'TRAVEL_ADMIN';
  pendingL2Approvals: {
    count: number;
    trips: Array<{ id: string; status: string; destination: string; employee: { name: string } }>;
  };
  allTrips: {
    byStatus: Record<string, number>;
  };
  notifications: DashboardNotifications;
}

export interface FinanceDashboard {
  role: 'FINANCE';
  pendingExpenses: {
    count: number;
    expenses: Array<{ id: string; status: string; trip: { destination: string; employee: { name: string } } }>;
  };
  pendingClose: {
    count: number;
    trips: Array<{ id: string; status: string; destination: string; employee: { name: string } }>;
  };
  notifications: DashboardNotifications;
}

export interface AdminDashboard {
  role: 'ADMIN';
  stats: {
    totalTrips: number;
    totalUsers: number;
    totalExpenses: number;
  };
  notifications: DashboardNotifications;
}

export type DashboardData =
  | EmployeeDashboard
  | ManagerDashboard
  | TravelAdminDashboard
  | FinanceDashboard
  | AdminDashboard;

// ─── API Call ──────────────────────────────────────────────────────────────────

export async function getDashboard(): Promise<DashboardData> {
  return apiRequest<DashboardData>('/dashboard');
}
