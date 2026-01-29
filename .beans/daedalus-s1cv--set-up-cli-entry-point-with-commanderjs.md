---
# daedalus-s1cv
title: Set up CLI entry point with commander.js
status: in-progress
type: task
priority: normal
created_at: 2026-01-29T00:30:43Z
updated_at: 2026-01-29T05:30:19Z
parent: daedalus-qkep
blocking:
    - daedalus-6vtz
    - daedalus-oc7p
    - daedalus-twz7
    - daedalus-ben5
    - daedalus-yayo
    - daedalus-7q48
---

Create the talos CLI entry point and command structure using commander.js.

## Prerequisites
- Logging infrastructure ready (daedalus-99yj blocks qkep)

## Tasks

### 1. Install commander.js
```bash
npm install commander
```

### 2. Create CLI Entry Point
Create `src/cli/talos.ts`:
```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('talos')
  .description('Talos daemon management CLI')
  .version(packageJson.version);

// Commands will be added in subsequent tasks
program
  .command('start')
  .description('Start the Talos daemon')
  .option('-c, --config <path>', 'Path to config file')
  .option('-d, --detach', 'Run as background daemon', true)
  .action(async (options) => {
    console.log('start command - to be implemented');
  });

program
  .command('stop')
  .description('Stop the Talos daemon')
  .action(async () => {
    console.log('stop command - to be implemented');
  });

program
  .command('status')
  .description('Show daemon status')
  .action(async () => {
    console.log('status command - to be implemented');
  });

program
  .command('logs')
  .description('Show daemon logs')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(async (options) => {
    console.log('logs command - to be implemented');
  });

program
  .command('config')
  .description('Show current configuration')
  .option('--validate', 'Validate configuration without starting')
  .action(async (options) => {
    console.log('config command - to be implemented');
  });

program.parse();
```

### 3. Update package.json
Add talos binary:
```json
{
  "bin": {
    "daedalus": "./dist/cli.js",
    "talos": "./dist/cli/talos.js"
  }
}
```

### 4. Update tsconfig.json
Ensure CLI files are included in build.

### 5. Test CLI Structure
```bash
npm run build
./dist/cli/talos.js --help
./dist/cli/talos.js start --help
```

## Files to Create/Modify
- `src/cli/talos.ts` (new)
- `package.json` (update bin)
- `tsconfig.json` (verify includes)

## Acceptance Criteria
- [x] commander.js installed
- [x] CLI entry point created with shebang
- [x] All 5 commands defined (start/stop/status/logs/config)
- [x] Help text works for each command
- [x] Binary compiles and is executable
- [x] --version flag works
- [x] Command structure is ready for implementation

## Changelog

### Implemented
- Installed commander.js v14.0.2
- Created `src/cli/talos.ts` with all 5 commands (start, stop, status, logs, config)
- Added talos binary to package.json bin field
- Created comprehensive test suite with 18 tests covering all commands and options

### Files Modified
- `package.json` - Added commander dependency and talos binary
- `src/cli/talos.ts` - NEW: CLI entry point with commander.js
- `src/cli/talos.test.ts` - NEW: Test suite for CLI

### Deviations from Spec
- None - implementation matches spec exactly

### Decisions Made
- Used tsx for running tests against TypeScript source directly (consistent with existing test patterns)
- Added test file to verify CLI behavior via subprocess execution (real integration tests)

### Known Limitations
- Compiled binary requires manual `chmod +x` after build (standard for Node.js CLIs)
- tsconfig.json already includes `src/**/*` so no changes needed there