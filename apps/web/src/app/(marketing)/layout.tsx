import { SiteHeader } from '@/components/marketing/header';
import { SiteFooter } from '@/components/marketing/footer';
import { getPublicConfig } from '@/lib/public';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const cfg = await getPublicConfig();
  return (
    <>
      <SiteHeader />
      <main id="contenido">{children}</main>
      <SiteFooter contactEmail={cfg?.contactEmail} whatsapp={cfg?.contactWhatsapp} />
    </>
  );
}
