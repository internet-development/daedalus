import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
    
    // CRITICAL: Set reasonable timeout for agent operations
    // Default is 10s, but beans CLI and agent operations can take longer
    testTimeout: 60000,  // 60 seconds
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{js,ts,tsx}']
    },
  },
  
  // Resolve TypeScript path aliases from tsconfig.json
  resolve: {
    alias: {
      '@talos': resolve(__dirname, './src/talos'),
      '@config': resolve(__dirname, './src/config'),
      '@cli': resolve(__dirname, './src/cli'),
    }
  }
})
