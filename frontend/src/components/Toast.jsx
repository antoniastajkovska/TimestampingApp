import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const labels = { success: 'Success', error: 'Error', info: 'Info', warning: 'Warning' };

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span className="toast-label">{labels[t.type]}</span>
            <span>{t.msg}</span>
            <span
              onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))}
              style={{ marginLeft: 'auto', cursor: 'pointer', opacity: .5, fontSize: 16, lineHeight: 1 }}
            >
              x
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
