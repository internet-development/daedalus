/**
 * TalosContext
 *
 * React Context for providing the Talos instance to all components.
 * Components can use the useTalos hook to access the daemon.
 */
import React, { createContext, useContext, type ReactNode } from 'react';
import type { Talos } from '../talos/talos.js';

// Context for the Talos instance
const TalosContext = createContext<Talos | null>(null);

export interface TalosProviderProps {
  talos: Talos;
  children: ReactNode;
}

/**
 * Provider component that wraps the app with Talos instance
 */
export function TalosProvider({ talos, children }: TalosProviderProps) {
  return (
    <TalosContext.Provider value={talos}>{children}</TalosContext.Provider>
  );
}

/**
 * Hook to access the Talos instance
 * @throws Error if used outside of TalosProvider
 */
export function useTalos(): Talos {
  const talos = useContext(TalosContext);
  if (!talos) {
    throw new Error('useTalos must be used within a TalosProvider');
  }
  return talos;
}

export default TalosContext;
