// Ruxsatlar ro'yxati: kalit (bazadagi `permissions.action`) va ekrandagi nomi.
export type PermDef = { key: string; label: string; hint?: string; limit?: 'percent' };
export type PermGroup = { title: string; items: PermDef[] };

export const PERM_GROUPS: PermGroup[] = [
  {
    title: 'Buyurtmalar',
    items: [
      { key: 'orders.view_all', label: 'Hamma buyurtmalarni ko‘rish', hint: 'O‘chiq bo‘lsa, faqat o‘ziga biriktirilganlarni ko‘radi' },
      { key: 'orders.edit', label: 'Buyurtma yaratish va tahrirlash' },
      { key: 'orders.assign', label: 'Tikuvchi va usta biriktirish' },
      { key: 'clients.contact_view', label: 'Mijoz telefoni va manzilini ko‘rish' },
    ],
  },
  {
    title: 'Pul va narxlar',
    items: [
      { key: 'prices.view', label: 'Narx va summalarni ko‘rish' },
      { key: 'catalog.edit', label: 'Katalog va narxlarni o‘zgartirish' },
      { key: 'payments.view', label: 'To‘lovlarni ko‘rish' },
      { key: 'payments.add', label: 'To‘lov kiritish' },
      { key: 'payments.cancel', label: 'To‘lovni bekor qilish', hint: 'O‘chiq: faqat Admin bekor qiladi' },
      { key: 'discount.give', label: 'Chegirma berish', limit: 'percent' },
      { key: 'reports.view', label: 'Moliyaviy hisobotlar' },
      { key: 'payroll.manage', label: 'Ishchilar ish haqi', hint: 'Hammaning ish haqini ko‘rish va pul berish. O‘chiq: faqat o‘zinikini ko‘radi' },
    ],
  },
  {
    title: 'Boshqaruv',
    items: [
      { key: 'staff.manage_workers', label: 'Tikuvchi va ustalarni boshqarish' },
      { key: 'steps.all', label: 'Hamma ish bosqichlarini belgilash' },
      { key: 'steps.tikish', label: 'Tikish bosqichlarini belgilash', hint: 'Faqat o‘ziga biriktirilgan buyurtmalarda' },
      { key: 'steps.ornatish', label: 'O‘rnatish bosqichlarini belgilash', hint: 'Faqat o‘ziga biriktirilgan buyurtmalarda' },
      { key: 'archive.send', label: 'Arxivga yuborish' },
      { key: 'audit.view', label: 'O‘zgarishlar tarixini ko‘rish' },
    ],
  },
];

export const ROLE_TONE: Record<string, 'teal' | 'blue' | 'amber' | 'purple' | 'grey'> = {
  admin: 'teal', direktor: 'blue', tikuvchi: 'amber', usta: 'purple',
};
