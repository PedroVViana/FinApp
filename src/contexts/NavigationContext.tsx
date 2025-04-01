import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { useNavigate as useReactRouterNavigate, useLocation } from 'react-router-dom';

interface NavigationContextType {
  currentPath: string;
  navigateTo: (path: string) => void;
  goBack: () => void;
  registerCleanupFunction: (path: string, cleanup: () => void) => void;
  unregisterCleanupFunction: (path: string) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation deve ser usado dentro de um NavigationProvider');
  }
  return context;
};

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Usar o hook de navegação do React Router para garantir integração adequada
  const navigate = useReactRouterNavigate();
  const location = useLocation();
  
  // Referência para evitar chamadas desnecessárias
  const isNavigatingRef = useRef(false);
  
  const [currentPath, setCurrentPath] = useState<string>(location.pathname);
  const [cleanupFunctions, setCleanupFunctions] = useState<Record<string, () => void>>({});

  // Atualizar path quando a localização mudar pelo React Router
  useEffect(() => {
    setCurrentPath(location.pathname);
  }, [location.pathname]);

  // Registrar função de limpeza para uma página específica
  const registerCleanupFunction = (path: string, cleanup: () => void) => {
    setCleanupFunctions(prev => ({
      ...prev,
      [path]: cleanup
    }));
  };

  // Remover função de limpeza
  const unregisterCleanupFunction = (path: string) => {
    setCleanupFunctions(prev => {
      const newFunctions = { ...prev };
      delete newFunctions[path];
      return newFunctions;
    });
  };

  // Função para navegar para um caminho específico
  const navigateTo = (path: string) => {
    // Evitar navegações duplicadas ou durante navegação em progresso
    if (path === currentPath || isNavigatingRef.current) {
      console.log(`Navegação ignorada: já estamos na rota ${path} ou navegação em progresso`);
      return;
    }
    
    // Marcar que estamos navegando
    isNavigatingRef.current = true;
    
    // Executar limpeza da página atual, se houver
    if (cleanupFunctions[currentPath]) {
      console.log(`Executando limpeza para ${currentPath} antes de navegar para ${path}`);
      cleanupFunctions[currentPath]();
    }

    // Usar o navegador do React Router para garantir comportamento consistente
    navigate(path);
    
    // Liberar a navegação após um pequeno delay
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 100);
  };

  // Função para voltar na história
  const goBack = () => {
    navigate(-1);
  };

  return (
    <NavigationContext.Provider value={{ 
      currentPath, 
      navigateTo, 
      goBack,
      registerCleanupFunction,
      unregisterCleanupFunction
    }}>
      {children}
    </NavigationContext.Provider>
  );
}; 