#!/usr/bin/env bash
set -euo pipefail

# Ralph Loop - Autonomous bean executor
# Selects highest priority unblocked bean and runs agent until completion

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AGENT="${TALOS_AGENT:-opencode}"
OPENCODE_AGENT="${OPENCODE_AGENT:-code}"  # Use the 'code' agent by default
MODEL="${TALOS_MODEL:-anthropic/claude-opus-4-5}"
MAX_ITERATIONS="${MAX_ITERATIONS:-5}"
DRY_RUN=false
ONCE=false
SILENT=false
SPECIFIC_BEAN=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
  --max-iterations)
    MAX_ITERATIONS="$2"
    shift 2
    ;;
  --model|-m)
    MODEL="$2"
    shift 2
    ;;
  --dry-run)
    DRY_RUN=true
    shift
    ;;
  --once)
    ONCE=true
    shift
    ;;
  --silent|-s)
    SILENT=true
    shift
    ;;
  --help | -h)
    echo "Usage: ralph-loop.sh [bean-id] [options]"
    echo ""
    echo "Options:"
    echo "  --max-iterations N  Max iterations per bean (default: 5)"
    echo "  --model, -m MODEL  Model to use (default: anthropic/claude-sonnet-4-5)"
    echo "  --dry-run          Show what would be selected, don't run"
    echo "  --once             Complete one bean then exit"
    echo "  --silent, -s       Suppress notifications"
    echo ""
    echo "Environment:"
    echo "  TALOS_AGENT        Agent to use: opencode, claude, codex (default: opencode)"
    echo "  TALOS_MODEL        Model to use (default: anthropic/claude-sonnet-4-5)
  OPENCODE_AGENT     OpenCode agent to use (default: code)"
    exit 0
    ;;
  -*)
    echo "Unknown option: $1"
    exit 1
    ;;
  *)
    SPECIFIC_BEAN="$1"
    shift
    ;;
  esac
done

# Notifications (using terminal-notifier)
notify() {
  $SILENT && return
  local title="$1"
  local message="$2"
  local sound="${3:-Ping}"
  
  terminal-notifier -title "$title" -message "$message" -sound "$sound" 2>/dev/null || true
}

notify_iteration() {
  $SILENT && return
  # Just terminal bell for iterations - subtle
  printf '\a'
}

notify_bean_complete() {
  local bean_id="$1"
  notify "Bean Completed" "$bean_id" "Glass"
}

notify_all_done() {
  local count="$1"
  notify "Ralph Loop Done" "Completed $count bean(s)" "Ping"
}

notify_error() {
  local message="$1"
  notify "Ralph Loop Error" "$message" "Basso"
}

# Log with timestamp
log() {
  echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠${NC} $1"
}

log_error() {
  echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $1"
}

# Select next actionable bean
select_bean() {
  if [[ -n "$SPECIFIC_BEAN" ]]; then
    echo "$SPECIFIC_BEAN"
    return
  fi

  # Query for todo and in-progress beans (including epics/milestones)
  # Include blockedBy and children to check eligibility
  local query='{ beans(filter: { status: ["todo", "in-progress"] }) { id title type priority status tags blockedBy { status } children { status } } }'
  local result
  result=$(beans query "$query" --json 2>/dev/null)

  # Filter out stuck beans (blocked/failed tags) and beans with incomplete blockers
  # For epic/milestone: also require all children to be completed
  # Prioritize in-progress over todo, then by priority
  echo "$result" | jq -r '
    .beans
    | map(select(.id != null))
    | map(select(
        # Not stuck (no blocked/failed tags)
        ((.tags // []) | map(select(. == "blocked" or . == "failed")) | length == 0) and
        # Not blocked by incomplete beans
        ((.blockedBy | length == 0) or
         (.blockedBy | all(.status == "completed" or .status == "scrapped"))) and
        # For epic/milestone: all children must be complete
        (if .type == "epic" or .type == "milestone" then
           (.children | length == 0) or (.children | all(.status == "completed" or .status == "scrapped"))
         else true end)
      ))
    | sort_by(
        (if .status == "in-progress" then 0 else 1 end),
        (if .priority == "critical" then 0
         elif .priority == "high" then 1
         elif .priority == "normal" then 2
         elif .priority == "low" then 3
         elif .priority == "deferred" then 4
         else 2 end)
      )
    | .[0].id // empty
  '
}

# Get bean details
get_bean() {
  local bean_id="$1"
  beans query "{ bean(id: \"$bean_id\") { id title status type priority body parent { id title type body } children { id title status type body } } }" --json 2>/dev/null
}

# Check if bean is epic or milestone (needs review mode)
is_review_mode() {
  local bean_type="$1"
  [[ "$bean_type" == "epic" || "$bean_type" == "milestone" ]]
}

# Check if bean is stuck (has blocked or failed tag)
is_stuck() {
  local bean_id="$1"
  local result
  result=$(beans query "{ bean(id: \"$bean_id\") { tags } }" --json 2>/dev/null)
  local tags
  tags=$(echo "$result" | jq -r '.bean.tags // [] | .[]' 2>/dev/null)

  if echo "$tags" | grep -qE '^(blocked|failed)$'; then
    return 0
  fi
  return 1
}

# Get bean status
get_status() {
  local bean_id="$1"
  beans query "{ bean(id: \"$bean_id\") { status } }" --json 2>/dev/null | jq -r '.bean.status'
}

# Generate prompt for agent (implementation mode)
generate_impl_prompt() {
  local bean_json="$1"
  local bean_id bean_title bean_body parent_title parent_body children

  bean_id=$(echo "$bean_json" | jq -r '.bean.id')
  bean_title=$(echo "$bean_json" | jq -r '.bean.title')
  bean_body=$(echo "$bean_json" | jq -r '.bean.body')
  parent_title=$(echo "$bean_json" | jq -r '.bean.parent.title // empty')
  parent_body=$(echo "$bean_json" | jq -r '.bean.parent.body // empty' | head -20)
  children=$(echo "$bean_json" | jq -r '.bean.children // [] | .[] | "- [\(.status)] \(.id): \(.title)"' 2>/dev/null)

  cat <<EOF
# Ralph Loop - Autonomous Implementation

You are in a ralph loop implementing bean **$bean_id**. You will be re-prompted
until the bean is marked complete. Your previous work persists in the codebase
and git history.

EOF

  if [[ -n "$parent_title" ]]; then
    cat <<EOF
## Parent Context: $parent_title
$parent_body

EOF
  fi

  cat <<EOF
## Bean: $bean_id
### $bean_title

$bean_body

EOF

  if [[ -n "$children" ]]; then
    cat <<EOF
### Sub-tasks
$children

EOF
  fi

  cat <<EOF
---

## Ralph Loop Protocol

1. **Check git log** to see what you did in previous iterations
2. **Implement** following TDD (your agent has the workflow built-in)
3. **Update the bean** as you complete checklist items
4. **Write changelog** before marking complete (document deviations from spec!)
5. **Mark complete** when ALL checklist items are done AND changelog is written

## If Blocked

If you hit a blocker you cannot resolve:
\`\`\`bash
beans update $bean_id --tag blocked
beans create "Blocker: {description}" -t bug --blocking $bean_id -d "..."
\`\`\`
Then exit cleanly - the loop will pause for human help.

## Key Reminders

- You WILL be re-run if the bean isn't complete
- Check \`git log --oneline -10\` to see previous iteration work
- The changelog is MANDATORY before completion
EOF
}

# Generate prompt for agent (review mode for epic/milestone)
generate_review_prompt() {
  local bean_json="$1"
  local bean_id bean_title bean_type bean_body

  bean_id=$(echo "$bean_json" | jq -r '.bean.id')
  bean_title=$(echo "$bean_json" | jq -r '.bean.title')
  bean_type=$(echo "$bean_json" | jq -r '.bean.type')
  bean_body=$(echo "$bean_json" | jq -r '.bean.body')

  # Get children with their bodies for review
  local children_details
  children_details=$(echo "$bean_json" | jq -r '
    .bean.children // [] | .[] |
    "### \(.id): \(.title)\nType: \(.type) | Status: \(.status)\n\n\(.body)\n\n---\n"
  ' 2>/dev/null)

  cat <<EOF
# Ralph Loop - ${bean_type^} Review

You are reviewing **$bean_id** before marking it complete. All children are done.

## ${bean_type^}: $bean_id
### $bean_title

$bean_body

---

## Completed Children

$children_details

---

## Review Process

1. **Read each child's changelog** - understand what was actually implemented
2. **Verify the code** - check files mentioned in changelogs exist and make sense
3. **Run the test suite**: \`npm test\`
4. **Check for integration issues** - do the pieces work together?

## Outcome

**All good?**
\`\`\`bash
beans update $bean_id --status completed
\`\`\`

**Found issues?**
\`\`\`bash
beans create "Issue: {description}" -t bug --parent $bean_id -d "..."
\`\`\`
Then exit - the ${bean_type} will wait for fixes.

## Review Guidelines

- Focus on correctness and integration, not style
- Check changelogs for deviations from spec
- Verify tests actually run and pass
- Be practical - ship if it works
EOF
}

# Generate prompt based on bean type
generate_prompt() {
  local bean_json="$1"
  local bean_type
  bean_type=$(echo "$bean_json" | jq -r '.bean.type')

  if is_review_mode "$bean_type"; then
    generate_review_prompt "$bean_json"
  else
    generate_impl_prompt "$bean_json"
  fi
}

# Run the agent
run_agent() {
  local prompt="$1"

  case "$AGENT" in
  opencode)
    # Use the 'code' agent which has TDD workflow and changelog requirements built-in
    opencode run "$prompt" -m "$MODEL" --agent "$OPENCODE_AGENT"
    ;;
  claude)
    claude -p "$prompt" --dangerously-skip-permissions
    ;;
  codex)
    codex "$prompt"
    ;;
  *)
    log_error "Unknown agent: $AGENT"
    return 1
    ;;
  esac
}

# Fallback WIP commit if there are uncommitted changes
fallback_commit() {
  local bean_id="$1"
  local iteration="$2"

  if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
    log_warn "Agent left uncommitted changes, creating WIP commit"
    git add -A
    git commit -m "wip($bean_id): ralph loop iteration $iteration" --no-verify || true
  fi
}

# Work on a single bean until completion
work_on_bean() {
  local bean_id="$1"
  local iteration=0
  local consecutive_failures=0
  local max_consecutive_failures=3
  local start_time
  start_time=$(date +%s)

  # Check bean type for mode
  local bean_type
  bean_type=$(beans query "{ bean(id: \"$bean_id\") { type } }" --json 2>/dev/null | jq -r '.bean.type')

  if is_review_mode "$bean_type"; then
    log "Reviewing ${bean_type}: $bean_id"
  else
    log "Working on bean: $bean_id"
  fi

  # Mark as in-progress
  beans update "$bean_id" --status in-progress >/dev/null 2>&1 || true

  while [[ $iteration -lt $MAX_ITERATIONS ]]; do
    iteration=$((iteration + 1))
    log "Iteration $iteration/$MAX_ITERATIONS"

    # Fetch fresh bean data
    local bean_json
    bean_json=$(get_bean "$bean_id")

    if [[ -z "$bean_json" ]] || [[ "$(echo "$bean_json" | jq -r '.bean')" == "null" ]]; then
      log_error "Failed to fetch bean: $bean_id"
      return 1
    fi

    # Generate and run
    local prompt
    prompt=$(generate_prompt "$bean_json")

    if $DRY_RUN; then
      echo "=== PROMPT ==="
      echo "$prompt"
      echo "=============="
      return 0
    fi

    log "Running $AGENT..."
    local agent_exit_code=0
    run_agent "$prompt" || agent_exit_code=$?

    # Track consecutive failures
    if [[ $agent_exit_code -ne 0 ]]; then
      consecutive_failures=$((consecutive_failures + 1))
      log_warn "Agent failed (exit code $agent_exit_code, $consecutive_failures consecutive failures)"
      
      if [[ $consecutive_failures -ge $max_consecutive_failures ]]; then
        log_error "Too many consecutive failures, stopping"
        return 1
      fi
      
      # Brief pause before retry
      sleep 2
      continue
    fi
    
    # Reset failure counter on success
    consecutive_failures=0

    # Fallback commit
    fallback_commit "$bean_id" "$iteration"

    # Check status
    local status
    status=$(get_status "$bean_id")

    if [[ "$status" == "completed" ]]; then
      local end_time duration
      end_time=$(date +%s)
      duration=$((end_time - start_time))
      log_success "Bean completed: $bean_id (${iteration} iterations, ${duration}s)"
      notify_bean_complete "$bean_id"
      return 0
    fi

    if is_stuck "$bean_id"; then
      local end_time duration
      end_time=$(date +%s)
      duration=$((end_time - start_time))
      log_warn "Bean is stuck (blocked/failed): $bean_id (${iteration} iterations, ${duration}s)"
      notify_error "Bean stuck: $bean_id"
      return 0
    fi

    log "Status: $status - continuing..."
    notify_iteration
  done

  local end_time duration
  end_time=$(date +%s)
  duration=$((end_time - start_time))
  log_warn "Max iterations reached for $bean_id (${iteration} iterations, ${duration}s)"
  return 0
}

# Main loop
main() {
  local beans_completed=0

  log "Ralph Loop started (agent: $AGENT, model: $MODEL, max iterations: $MAX_ITERATIONS)"

  while true; do
    # Select next bean
    local bean_id
    bean_id=$(select_bean)

    if [[ -z "$bean_id" ]]; then
      if [[ $beans_completed -eq 0 ]]; then
        log "No actionable beans found"
      else
        log_success "All done! Completed $beans_completed bean(s)"
        notify_all_done "$beans_completed"
      fi
      break
    fi

    local bean_title
    bean_title=$(beans query "{ bean(id: \"$bean_id\") { title } }" --json 2>/dev/null | jq -r '.bean.title')
    log "Selected: ${YELLOW}$bean_id${NC} - $bean_title"

    if $DRY_RUN; then
      work_on_bean "$bean_id"
      break
    fi

    # Work on the bean
    work_on_bean "$bean_id"
    beans_completed=$((beans_completed + 1))

    # If specific bean or --once, exit after one
    if [[ -n "$SPECIFIC_BEAN" ]] || $ONCE; then
      log_success "Completed $beans_completed bean(s)"
      notify_all_done "$beans_completed"
      break
    fi
  done
}

main
