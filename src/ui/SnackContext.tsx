import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Snack } from './components';

type SnackMsg = { id: number; text: string; action?: string; onAction?: () => void };
const Ctx = createContext<(text: string, action?: { label: string; run: () => void }) => void>(() => {});

/** Butun ilova uchun bitta pastki xabar (eski ilovadagi showSnack / showUndoSnack). */
export function SnackProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<SnackMsg | null>(null);
  const show = useCallback((text: string, action?: { label: string; run: () => void }) => {
    setMsg({ id: Date.now(), text, action: action?.label, onAction: action?.run });
  }, []);
  const hide = useCallback(() => setMsg(null), []);
  return (
    <Ctx.Provider value={show}>
      <View style={{ flex: 1 }}>
        {children}
        {msg && <Snack key={msg.id} text={msg.text} action={msg.action} onAction={msg.onAction} onHide={hide} />}
      </View>
    </Ctx.Provider>
  );
}

export const useSnack = () => useContext(Ctx);
