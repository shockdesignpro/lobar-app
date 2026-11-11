import { Alert, Platform } from 'react-native';

/** Tasdiqlash oynasi: telefonda tizim oynasi, brauzerda confirm() */
export function confirmAsk(message: string, okText = 'Ha'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(typeof window !== 'undefined' && window.confirm(message));
  return new Promise((resolve) => {
    Alert.alert('', message, [
      { text: 'Bekor qilish', style: 'cancel', onPress: () => resolve(false) },
      { text: okText, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
