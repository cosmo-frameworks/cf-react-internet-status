import React, { createContext, useContext } from 'react';
import useInternetStatus from '../hooks/useInternetStatus';

// Definimos el tipo para el contexto
interface InternetStatusContextType {
  isOnline: boolean;
}

// Creamos el contexto
const InternetStatusContext = createContext<
  InternetStatusContextType | undefined
>(undefined);

export const InternetStatusProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const isOnline = useInternetStatus();

  return (
    <InternetStatusContext.Provider value={{ isOnline }}>
      {children}
    </InternetStatusContext.Provider>
  );
};

// Hook para consumir el contexto
export const useInternetStatusContext = (): InternetStatusContextType => {
  const context = useContext(InternetStatusContext);
  if (!context) {
    throw new Error(
      'useInternetStatusContext must be used within an InternetStatusProvider'
    );
  }
  return context;
};
