import { Suspense } from 'react';
import type { Metadata } from 'next';
import { RegisterForm } from './form';
import { getPublicPlans } from '@/lib/public';

export const metadata: Metadata = { title: 'Crear cuenta — prueba gratis', description: 'Registra tu negocio y comienza tu prueba gratis. Sin tarjeta.' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const plans = await getPublicPlans();
  return <Suspense><RegisterForm plans={plans ?? []} /></Suspense>;
}
