/**
 * UI Components
 *
 * Ink-based terminal UI components for Daedalus.
 * These are React components that render to the terminal.
 */

export const UI_VERSION = '2.0.0';

// Core components
export { App } from './App.js';
export { Header, type ViewType } from './Header.js';
export { StatusBar } from './StatusBar.js';

// Context
export { TalosProvider, useTalos } from './TalosContext.js';

// Views
export { MonitorView, ExecuteView, PlanView } from './views/index.js';
