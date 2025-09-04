import { AdminAuthGuard } from '@/components/auth/admin-auth-guard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthGuard>
      {children}
    </AdminAuthGuard>
  );
}