import { useState } from 'react';
import { can, isAdmin, type Access } from '../../lib/auth';
import { Intro, Segmented } from '../../ui/components';
import { AtelierTab } from './AtelierTab';
import { HistoryTab } from './HistoryTab';
import { PermsTab } from './PermsTab';
import { StaffTab } from './StaffTab';

type Tab = 'staff' | 'perms' | 'atelier' | 'history';

export function AdminScreen({ access }: { access: Access }) {
  const [tab, setTab] = useState<Tab>('staff');
  const items: { key: Tab; label: string }[] = [{ key: 'staff', label: 'Xodimlar' }];
  if (isAdmin(access)) items.push({ key: 'perms', label: 'Ruxsatlar' });
  if (isAdmin(access)) items.push({ key: 'atelier', label: 'Atelye' });
  if (isAdmin(access) || can(access, 'audit.view')) items.push({ key: 'history', label: 'Tarix' });

  const titles: Record<Tab, [string, string]> = {
    staff: ['Xodimlar', 'Kim tizimga kira olishini boshqaring.'],
    perms: ['Ruxsatlar', 'Har bir rol nimani ko‘ra va qila olishini belgilang. Admin doim hammasiga ega.'],
    atelier: ['Atelye', 'Mijozlarga ko‘rinadigan telefon va manzil.'],
    history: ['Tarix', 'Kim, qachon, nimani o‘zgartirgani.'],
  };

  return (
    <>
      <Intro overline="TIZIM BOSHQARUVI" title={titles[tab][0]} sub={titles[tab][1]} />
      {items.length > 1 && <Segmented label="Admin panel bo‘limlari" items={items} value={tab} onChange={setTab} />}
      {tab === 'staff' && <StaffTab access={access} />}
      {tab === 'perms' && <PermsTab />}
      {tab === 'atelier' && <AtelierTab />}
      {tab === 'history' && <HistoryTab />}
    </>
  );
}
