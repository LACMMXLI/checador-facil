import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Portal del empleado', robots: { index: false, follow: false } };

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-white"><div className="mx-auto min-h-dvh w-full max-w-md px-4 pb-10 pt-6">{children}</div></div>;
}
