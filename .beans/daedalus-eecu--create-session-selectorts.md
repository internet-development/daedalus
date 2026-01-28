---
# daedalus-eecu
title: Create session-selector.ts
status: completed
type: task
priority: normal
created_at: 2026-01-28T04:03:53Z
updated_at: 2026-01-28T04:11:55Z
parent: daedalus-gu7g
---

## Summary

Create an interactive session selector that prompts the user to continue an existing session or start a new one.

## File

`src/cli/session-selector.ts`

## Function Signature

```typescript
import type { ChatSession } from '../planning/chat-history.js';

export interface SessionSelection {
  action: 'continue' | 'new';
  sessionId?: string;  // Only set if action is 'continue'
}

export async function selectSession(
  sessions: ChatSession[],
  currentSessionId: string | null
): Promise<SessionSelection>
```

## Behavior

1. If no sessions exist, return `{ action: 'new' }` immediately
2. Display numbered list of sessions (sorted by updatedAt desc):
   ```
   Planning Sessions
   ─────────────────────────────────────
   [1] Feature planning (5 msgs, 2h ago)
   [2] Bug triage (12 msgs, yesterday)
   [3] Start new session
   
   Select [1-3]: _
   ```
3. Read single line of input
4. Parse as number
5. If valid selection, return appropriate result
6. If invalid, show error and re-prompt

## Implementation

```typescript
import * as readline from 'readline';
import { formatSessionList } from './output.js';

export async function selectSession(
  sessions: ChatSession[],
  currentSessionId: string | null
): Promise<SessionSelection> {
  // Handle empty sessions
  if (sessions.length === 0) {
    return { action: 'new' };
  }

  // Sort sessions by updatedAt descending
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Display options
  console.log(formatSessionList(sorted, currentSessionId));
  console.log(`[${sorted.length + 1}] Start new session`);
  console.log();

  // Prompt for selection
  return new Promise((resolve) => {
    const prompt = () => {
      rl.question(`Select [1-${sorted.length + 1}]: `, (answer) => {
        const num = parseInt(answer.trim(), 10);
        
        if (num >= 1 && num <= sorted.length) {
          rl.close();
          resolve({ action: 'continue', sessionId: sorted[num - 1].id });
        } else if (num === sorted.length + 1) {
          rl.close();
          resolve({ action: 'new' });
        } else {
          console.log('Invalid selection, try again.');
          prompt();
        }
      });
    };
    prompt();
  });
}
```

## Checklist

- [ ] Define SessionSelection interface
- [ ] Handle empty sessions case
- [ ] Sort sessions by updatedAt descending
- [ ] Display formatted session list
- [ ] Add "Start new session" option
- [ ] Read and validate input
- [ ] Handle invalid input gracefully
- [ ] Return appropriate SessionSelection
- [ ] Clean up readline interface