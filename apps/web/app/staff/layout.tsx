import type { ReactNode } from 'react';
import { RequireRole } from '@/components/require-role';

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <RequireRole roles={['staff']}>{children}</RequireRole>;
}
