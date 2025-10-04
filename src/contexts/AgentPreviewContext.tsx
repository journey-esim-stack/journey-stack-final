import { createContext, useContext, useState, ReactNode } from 'react';

interface AgentPreviewContextType {
  previewAgentId: string | null;
  setPreviewAgentId: (id: string | null) => void;
}

const AgentPreviewContext = createContext<AgentPreviewContextType | undefined>(undefined);

export const AgentPreviewProvider = ({ children }: { children: ReactNode }) => {
  const [previewAgentId, _setPreviewAgentId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('previewAgentId') || null;
    } catch {
      return null;
    }
  });

  const setPreviewAgentId = (id: string | null) => {
    _setPreviewAgentId(id);
    try {
      if (id) localStorage.setItem('previewAgentId', id);
      else localStorage.removeItem('previewAgentId');
    } catch {}
  };

  return (
    <AgentPreviewContext.Provider value={{ previewAgentId, setPreviewAgentId }}>
      {children}
    </AgentPreviewContext.Provider>
  );
};

export const useAgentPreview = () => {
  const context = useContext(AgentPreviewContext);
  if (!context) {
    throw new Error('useAgentPreview must be used within AgentPreviewProvider');
  }
  return context;
};
