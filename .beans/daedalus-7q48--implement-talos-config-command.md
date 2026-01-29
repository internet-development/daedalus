---
# daedalus-7q48
title: Implement 'talos config' command
status: todo
type: task
created_at: 2026-01-29T00:32:29Z
updated_at: 2026-01-29T00:32:29Z
parent: daedalus-qkep
---

Implement the config command to display and validate Talos configuration.

## Prerequisites
- Process management ready (daedalus-6vtz)

## Implementation

Update `src/cli/talos.ts`:

```typescript
import { loadConfig } from '../config/index.js';
import { dirname } from 'path';
import { existsSync } from 'fs';

program
  .command('config')
  .description('Show and validate configuration')
  .option('-c, --config <path>', 'Path to config file (default: talos.yml)')
  .option('--validate', 'Only validate, don\'t display')
  .option('--json', 'Output as JSON')
  .option('--paths', 'Show discovered paths')
  .action(async (options) => {
    try {
      const startDir = options.config ? dirname(options.config) : process.cwd();
      const { config, paths } = loadConfig(startDir);

      if (options.validate) {
        console.log('Configuration is valid ✓');
        if (options.paths) {
          console.log('\nDiscovered paths:');
          console.log('  Project root: %s', paths.projectRoot);
          console.log('  Beans path: %s', paths.beansPath);
          console.log('  Config file: %s', paths.configPath || 'none (using defaults)');
        }
        process.exit(0);
      }

      if (options.json) {
        console.log(JSON.stringify({
          config,
          paths: options.paths ? paths : undefined,
        }, null, 2));
      } else {
        console.log('Configuration:');
        console.log('─'.repeat(60));
        
        // Agent config
        console.log('\nAgent:');
        console.log('  Backend: %s', config.agent.backend);
        if (config.agent.opencode) {
          console.log('  OpenCode command: %s', config.agent.opencode.command);
        }
        if (config.agent.claude) {
          console.log('  Claude command: %s', config.agent.claude.command);
        }

        // Scheduler config
        console.log('\nScheduler:');
        console.log('  Max parallel: %d', config.scheduler.max_parallel);
        console.log('  Poll interval: %dms', config.scheduler.poll_interval);
        console.log('  Auto-enqueue on startup: %s', config.scheduler.auto_enqueue_on_startup);

        // Logging config
        if (config.logging) {
          console.log('\nLogging:');
          console.log('  Level: %s', config.logging.level);
          console.log('  Pretty print: %s', config.logging.prettyPrint);
          console.log('  Redact fields: %s', config.logging.redact.join(', '));
        }

        // Paths
        if (options.paths) {
          console.log('\nDiscovered paths:');
          console.log('  Project root: %s', paths.projectRoot);
          console.log('  Beans path: %s', paths.beansPath);
          console.log('  Config file: %s', paths.configPath || 'none (using defaults)');
        }

        console.log('\n' + '─'.repeat(60));
        console.log('Configuration is valid ✓');
      }
    } catch (error) {
      console.error('Configuration error:');
      console.error(error.message);
      process.exit(1);
    }
  });
```

## Features

### Display Configuration (default)
```bash
talos config
# Shows formatted config
```

### Validate Only
```bash
talos config --validate
# Configuration is valid ✓
```

### Show Paths
```bash
talos config --paths
# Shows project root, beans path, config file
```

### JSON Output
```bash
talos config --json
# {
#   "config": { ... },
#   "paths": { ... }
# }
```

### Custom Config File
```bash
talos config -c /path/to/talos.yml
```

## Display Format
- Organized by section (Agent, Scheduler, Logging)
- Human-readable formatting
- Shows discovered paths
- Validation status

## Error Handling
- Handle missing config file
- Handle invalid YAML
- Handle schema validation errors
- Clear error messages

## Files to Modify
- `src/cli/talos.ts`

## Acceptance Criteria
- [ ] Displays formatted configuration
- [ ] --validate flag only validates
- [ ] --json outputs valid JSON
- [ ] --paths shows discovered paths
- [ ] -c flag loads custom config
- [ ] Handles missing config gracefully
- [ ] Shows validation errors clearly
- [ ] Exit code 0 for valid config
- [ ] Exit code 1 for invalid config