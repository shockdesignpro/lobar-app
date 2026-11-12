// APK hajmini kichraytirish: faqat haqiqiy telefonlarga kerakli protsessor turlari
// (arm64 — zamonaviy, armv7 — eski arzon telefonlar). Kompyuter emulyatorlari uchun (x86) qismlar kirmaydi.
const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withAbis(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === 'reactNativeArchitectures'));
    cfg.modResults.push({ type: 'property', key: 'reactNativeArchitectures', value: 'armeabi-v7a,arm64-v8a' });
    return cfg;
  });
};
