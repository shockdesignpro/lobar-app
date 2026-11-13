// app.json asosiy sozlama. Bu fayl faqat Firebase faylini (bildirishnomalar uchun) ulaydi:
// google-services.json loyiha papkasida bo'lsa — Android ilovasiga qo'shiladi.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const file = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(file)) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  } else if (process.env.EAS_BUILD && process.env.EAS_BUILD_PLATFORM === 'android') {
    throw new Error('google-services.json topilmadi: Firebase faylini loyiha papkasiga (app.json yoniga) qo‘ying.');
  }
  return config;
};
