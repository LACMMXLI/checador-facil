import 'server-only';

const API = process.env.API_INTERNAL_URL || 'http://localhost:4000';

export interface PublicPlan {
  code: string; name: string; description: string; priceMonthlyCents: number; currency: string;
  maxEmployees: number; maxBranches: number; trialDays: number; historyDays: number; canExport: boolean;
  features: string[]; highlighted: boolean;
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}/api${path}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const getPublicPlans = () => get<PublicPlan[]>('/public/plans');
export const getPublicConfig = () => get<{ brandName: string; contactEmail: string; contactWhatsapp: string }>('/public/config');
