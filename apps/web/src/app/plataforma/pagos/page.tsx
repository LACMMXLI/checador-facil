'use client';
import { useState } from 'react';
import { PaymentsList } from '@/components/platform/payments';
import { cn } from '@/components/ui';

export default function Page() {
  const [status, setStatus] = useState('PENDING');
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Pagos</h1>
      <div className="flex gap-2">
        {[['PENDING', 'Por revisar'], ['APPROVED', 'Aprobados'], ['REJECTED', 'Rechazados'], ['', 'Todos']].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)} className={cn('rounded-full px-4 py-2 text-sm font-semibold', status === k ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200')}>{l}</button>
        ))}
      </div>
      <PaymentsList key={status} status={status || undefined} />
    </div>
  );
}
