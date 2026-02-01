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
ROOT_BEAN=""
ROOT_FILE=".talos/ralph-root"
BRANCH_ENABLED="${TALOS_BRANCH:-true}"
DEFAULT_BRANCH="${TALOS_DEFAULT_BRANCH:-main}"

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
  --no-branch)
    BRANCH_ENABLED=false
    shift
    ;;
  --root)
    ROOT_BEAN="$2"
    shift 2
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
    echo "  --root BEAN_ID     Override root bean for DFS (auto-detected if omitted)"
    echo "  --no-branch        Disable branch-per-bean (work on current branch)"
    echo ""
    echo "Environment:"
    echo "  TALOS_AGENT        Agent to use: opencode, claude, codex (default: opencode)"
    echo "  TALOS_MODEL        Model to use (default: anthropic/claude-sonnet-4-5)"
    echo "  OPENCODE_AGENT     OpenCode agent to use (default: code)"
    echo "  TALOS_BRANCH       Enable branch-per-bean (default: true)"
    echo "  TALOS_DEFAULT_BRANCH  Default branch name (default: main)"
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

# Resolve the root bean for DFS traversal.
# Priority: --root flag > stored root (if still incomplete) > auto-detect.
# Stores the active root in .talos/ralph-root so it persists across restarts.
resolve_root() {
  # --root flag takes priority
  if [[ -n "$ROOT_BEAN" ]]; then
    mkdir -p "$(dirname "$ROOT_FILE")"
    echo "$ROOT_BEAN" > "$ROOT_FILE"
    log "Root set: $ROOT_BEAN"
    return
  fi

  # Check stored root
  if [[ -f "$ROOT_FILE" ]]; then
    local stored
    stored=$(cat "$ROOT_FILE")
    if [[ -n "$stored" ]]; then
      local status
      status=$(beans query "{ bean(id: \"$stored\") { status } }" --json 2>/dev/null | jq -r '.bean.status // empty')
      if [[ -n "$status" && "$status" != "completed" && "$status" != "scrapped" ]]; then
        ROOT_BEAN="$stored"
        log "Resuming root: $ROOT_BEAN"
        return
      fi
      log "Previous root $stored is $status, selecting new root"
    fi
  fi

  # Auto-detect: find highest-priority incomplete bean with no parent
  # Prefer by type hierarchy (milestone > epic > feature > task/bug), then priority
  local root_id
  root_id=$(beans query '{ beans(filter: { status: ["todo", "in-progress"] }) { id type priority status parentId } }' --json 2>/dev/null | jq -r '
    .beans
    | map(select(.parentId == null or .parentId == ""))
    | sort_by(
        (if .type == "milestone" then 0
         elif .type == "epic" then 1
         elif .type == "feature" then 2
         else 3 end),
        (if .priority == "critical" then 0
         elif .priority == "high" then 1
         elif .priority == "normal" then 2
         elif .priority == "low" then 3
         else 4 end)
      )
    | .[0].id // empty
  ')

  if [[ -z "$root_id" ]]; then
    log "No actionable root bean found"
    return
  fi

  ROOT_BEAN="$root_id"
  mkdir -p "$(dirname "$ROOT_FILE")"
  echo "$ROOT_BEAN" > "$ROOT_FILE"
  log "Auto-selected root: $ROOT_BEAN"
}

# Select next actionable bean via depth-first traversal from ROOT_BEAN.
# Always picks the deepest incomplete unblocked leaf, preventing jumps
# to branches with stale bean data.
# Falls back to flat priority-based selection if no root is set.
select_bean() {
  if [[ -n "$SPECIFIC_BEAN" ]]; then
    echo "$SPECIFIC_BEAN"
    return
  fi

  if [[ -z "$ROOT_BEAN" ]]; then
    select_bean_flat
    return
  fi

  # DFS: fetch full tree from root (5 levels deep covers any hierarchy)
  local query
  query=$(cat <<'GRAPHQL'
{ bean(id: "ROOT_ID") { id type status priority tags blockedBy { id status } children { id type status priority tags blockedBy { id status } children { id type status priority tags blockedBy { id status } children { id type status priority tags blockedBy { id status } children { id type status priority tags blockedBy { id status } } } } } } }
GRAPHQL
)
  query="${query//ROOT_ID/$ROOT_BEAN}"

  local result
  result=$(beans query "$query" --json 2>/dev/null)

  if [[ -z "$result" ]] || [[ "$(echo "$result" | jq -r '.bean')" == "null" ]]; then
    return
  fi

  # Walk depth-first:
  #   - Skip completed/scrapped/draft
  #   - Skip stuck (blocked/failed tags)
  #   - Skip beans with incomplete blockers
  #   - If bean has incomplete children, recurse into first child (sorted by status/priority)
  #   - If bean is a leaf (or all children done), pick it
  echo "$result" | jq -r '
    def dfs:
      if .status == "completed" or .status == "scrapped" or .status == "draft" then
        empty
      elif ((.tags // []) | any(. == "blocked" or . == "failed")) then
        empty
      elif ((.blockedBy // []) | length > 0) and ((.blockedBy // []) | any(.status != "completed" and .status != "scrapped")) then
        empty
      else
        ((.children // []) | map(select(.status != "completed" and .status != "scrapped" and .status != "draft"))) as $ic |
        if ($ic | length) > 0 then
          $ic
          | sort_by(
              (if .status == "in-progress" then 0 else 1 end),
              (if .priority == "critical" then 0
               elif .priority == "high" then 1
               elif .priority == "normal" then 2
               elif .priority == "low" then 3
               elif .priority == "deferred" then 4
               else 2 end),
              .id
            )
          | .[0] | dfs
        else
          .id
        end
      end;
    .bean | dfs
  '
}

# Flat bean selection (original behavior, for --no-branch or no --root)
select_bean_flat() {
  local query='{ beans(filter: { status: ["todo", "in-progress"] }) { id title type priority status tags blockedBy { status } children { status } } }'
  local result
  result=$(beans query "$query" --json 2>/dev/null)

  echo "$result" | jq -r '
    .beans
    | map(select(.id != null))
    | map(select(
        ((.tags // []) | map(select(. == "blocked" or . == "failed")) | length == 0) and
        ((.blockedBy | length == 0) or
         (.blockedBy | all(.status == "completed" or .status == "scrapped"))) and
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

# =============================================================================
# Branch Management
# =============================================================================

# Get the branch name for a bean: {type}/{id}
bean_branch() {
  local bean_id="$1"
  local bean_type="${2:-}"

  # If type not provided, look it up
  if [[ -z "$bean_type" ]]; then
    bean_type=$(beans query "{ bean(id: \"$bean_id\") { type } }" --json 2>/dev/null | jq -r '.bean.type // "task"')
  fi

  echo "${bean_type}/${bean_id}"
}

# Get the merge target for a bean (parent's branch or default branch)
get_merge_target() {
  local bean_id="$1"
  local result
  result=$(beans query "{ bean(id: \"$bean_id\") { parentId parent { type } } }" --json 2>/dev/null)
  local parent_id
  parent_id=$(echo "$result" | jq -r '.bean.parentId // empty')

  if [[ -n "$parent_id" ]]; then
    local parent_type
    parent_type=$(echo "$result" | jq -r '.bean.parent.type // "feature"')
    echo "${parent_type}/${parent_id}"
  else
    echo "$DEFAULT_BRANCH"
  fi
}

# Get the merge strategy for a bean type (merge or squash)
get_merge_strategy() {
  local bean_type="$1"
  case "$bean_type" in
    milestone|epic|feature) echo "merge" ;;
    task|bug) echo "squash" ;;
    *) echo "squash" ;;
  esac
}

# Extract changelog section from a bean's body
extract_changelog() {
  local bean_id="$1"
  beans query "{ bean(id: \"$bean_id\") { body } }" --json 2>/dev/null \
    | jq -r ".bean.body" \
    | sed -n "/^## Changelog/,/^## [^C]/p" \
    | sed "1d" \
    | sed "/^## /d"
}

# Format a squash commit message with conventional commit prefix
format_squash_commit() {
  local bean_id="$1" bean_type="$2" bean_title="$3"
  local type_prefix="chore"
  case "$bean_type" in
    feature) type_prefix="feat" ;;
    bug) type_prefix="fix" ;;
    task) type_prefix="chore" ;;
  esac

  local changelog
  changelog=$(extract_changelog "$bean_id")

  if [[ -n "$changelog" ]]; then
    printf "%s: %s\n\n%s\n\nBean: %s" "$type_prefix" "$bean_title" "$changelog" "$bean_id"
  else
    printf "%s: %s\n\nBean: %s" "$type_prefix" "$bean_title" "$bean_id"
  fi
}

# Ensure ancestor branch chain exists (top-down)
ensure_ancestor_branches() {
  local bean_id="$1"

  # Build ancestor chain by walking up parent IDs
  local ancestors=()
  local current_id="$bean_id"

  while true; do
    local parent_id
    parent_id=$(beans query "{ bean(id: \"$current_id\") { parentId } }" --json 2>/dev/null | jq -r '.bean.parentId // empty')
    [[ -z "$parent_id" ]] && break
    ancestors=("$parent_id" "${ancestors[@]}")
    current_id="$parent_id"
  done

  # Create branches top-down
  for ancestor_id in "${ancestors[@]}"; do
    local branch_name
    branch_name=$(bean_branch "$ancestor_id")
    if ! git rev-parse --verify "refs/heads/$branch_name" >/dev/null 2>&1; then
      local base
      base=$(get_merge_target "$ancestor_id")
      log "Creating ancestor branch: $branch_name from $base"
      git branch "$branch_name" "$base" 2>/dev/null || true
    fi
  done
}

# Discard bean file modifications before switching branches.
# Bean status changes (todo→in-progress, updated_at) are ephemeral bookkeeping
# that don't need to be committed — the DFS merge flow ensures each branch has
# accurate status data from its children's squash/merge commits.
# New (untracked) bean files ARE committed, since the agent may have created
# blocker beans that need to be visible on other branches.
discard_bean_changes() {
  # Commit any NEW bean files (agent may have created blocker beans)
  local new_files
  new_files=$(git status --porcelain .beans/ 2>/dev/null | grep '^?' || true)
  if [[ -n "$new_files" ]]; then
    log "Committing new bean files before branch switch"
    git add .beans/ 2>/dev/null
    git commit --no-verify -m "chore: add new bean files" 2>/dev/null || true
  fi

  # Discard modifications to existing bean files (status/timestamp changes)
  git checkout -- .beans/ 2>/dev/null || true
}

# Create and checkout bean branch
setup_bean_branch() {
  local bean_id="$1"
  local bean_type="${2:-}"

  [[ "$BRANCH_ENABLED" != "true" ]] && return 0

  # Recover from interrupted git state
  if [[ -f .git/MERGE_HEAD ]]; then
    log_warn "Detected interrupted merge, aborting"
    git merge --abort 2>/dev/null || true
  fi

  # Discard bean status changes (bookkeeping) before switching
  discard_bean_changes

  # Check for dirty working tree (after committing bean files)
  if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
    log_warn "Dirty working tree, stashing changes"
    git stash push -m "ralph-loop: auto-stash before branch switch" 2>/dev/null || true
  fi

  # Ensure ancestor branches exist
  ensure_ancestor_branches "$bean_id"

  local branch_name
  branch_name=$(bean_branch "$bean_id" "$bean_type")
  local base
  base=$(get_merge_target "$bean_id")

  if git rev-parse --verify "refs/heads/$branch_name" >/dev/null 2>&1; then
    log "Checking out existing branch: $branch_name"
    git checkout "$branch_name" 2>/dev/null
  else
    log "Creating branch: $branch_name from $base"
    git checkout -b "$branch_name" "$base" 2>/dev/null
  fi
}

# Merge bean branch back to target on completion
merge_bean_branch() {
  local bean_id="$1"
  local bean_type="$2"
  local bean_title="${3:-}"

  [[ "$BRANCH_ENABLED" != "true" ]] && return 0

  local branch_name
  branch_name=$(bean_branch "$bean_id" "$bean_type")
  local target
  target=$(get_merge_target "$bean_id")
  local strategy
  strategy=$(get_merge_strategy "$bean_type")

  # Ensure we're on the bean branch
  local current
  current=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [[ "$current" != "$branch_name" ]]; then
    log_warn "Not on bean branch ($current), skipping merge"
    return 0
  fi

  # Check if there are any commits to merge
  if git diff --quiet "$target..$branch_name" 2>/dev/null; then
    log "No changes to merge for $bean_id"
    git checkout "$target" 2>/dev/null
    return 0
  fi

  log "Merging $branch_name into $target (strategy: $strategy)"
  git checkout "$target" 2>/dev/null

  case "$strategy" in
    squash)
      if git merge --squash "$branch_name" 2>/dev/null; then
        local commit_msg
        commit_msg=$(format_squash_commit "$bean_id" "$bean_type" "$bean_title")
        git commit --no-verify -m "$commit_msg" 2>/dev/null || true
        log_success "Squash-merged $branch_name into $target"
      else
        log_error "Merge conflict, aborting"
        git reset --hard HEAD 2>/dev/null || true
        git checkout "$branch_name" 2>/dev/null
        return 1
      fi
      ;;
    merge)
      if git merge --no-ff "$branch_name" -m "merge: ${bean_type}/${bean_id} - ${bean_title}" 2>/dev/null; then
        log_success "Merged $branch_name into $target"
      else
        log_error "Merge conflict, aborting"
        git merge --abort 2>/dev/null || true
        git checkout "$branch_name" 2>/dev/null
        return 1
      fi
      ;;
  esac

  # Delete branch after successful merge
  git branch -D "$branch_name" 2>/dev/null || true
}

# Fallback commit for any uncommitted changes after agent runs.
# Smart about bean files:
#   - If only .beans/ changed and last commit touched the same file → amend
#   - If only .beans/ changed but last commit didn't → new chore commit
#   - If real implementation files changed too → wip commit (includes everything)
#   - Timestamp-only .beans/ changes are discarded as noise
fallback_commit() {
  local bean_id="$1"
  local iteration="$2"

  # Discard timestamp-only .beans/ changes (updated_at noise)
  # Keep substantive changes like status: completed
  local bean_diff
  bean_diff=$(git diff .beans/ 2>/dev/null \
    | grep '^[+-]' \
    | grep -v '^[+-][+-][+-]' \
    | grep -v 'updated_at' \
    || true)
  if [[ -z "$bean_diff" ]]; then
    # Only timestamp changes — discard them
    git checkout -- .beans/ 2>/dev/null || true
  fi

  # Check what's dirty
  local dirty
  dirty=$(git status --porcelain 2>/dev/null)
  [[ -z "$dirty" ]] && return

  # Separate bean files from other changes
  local bean_changes other_changes
  bean_changes=$(echo "$dirty" | grep '\.beans/' || true)
  other_changes=$(echo "$dirty" | grep -v '\.beans/' || true)

  if [[ -n "$other_changes" ]]; then
    # Real implementation files left uncommitted — commit everything together
    log_warn "Agent left uncommitted changes, creating WIP commit"
    git add -A
    git commit -m "wip($bean_id): ralph loop iteration $iteration" --no-verify || true
  elif [[ -n "$bean_changes" ]]; then
    # Only bean files changed (e.g. status: completed)
    # Check if the last commit already touched this bean's file
    local bean_file_pattern
    bean_file_pattern=".beans/${bean_id}"
    local last_commit_touched
    last_commit_touched=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep "$bean_file_pattern" || true)

    if [[ -n "$last_commit_touched" ]]; then
      # Last commit touched the same bean file — amend it in
      git add .beans/
      git commit --amend --no-edit --no-verify 2>/dev/null || true
    else
      # Last commit didn't touch this bean — new clean commit
      git add .beans/
      git commit -m "chore($bean_id): mark bean as completed" --no-verify 2>/dev/null || true
    fi
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

  # Check bean type and title for mode and merge messages
  local bean_info bean_type bean_title
  bean_info=$(beans query "{ bean(id: \"$bean_id\") { type title } }" --json 2>/dev/null)
  bean_type=$(echo "$bean_info" | jq -r '.bean.type')
  bean_title=$(echo "$bean_info" | jq -r '.bean.title')

  if is_review_mode "$bean_type"; then
    log "Reviewing ${bean_type}: $bean_id"
  else
    log "Working on bean: $bean_id"
  fi

  # Mark as in-progress
  beans update "$bean_id" --status in-progress >/dev/null 2>&1 || true

  # Set up bean branch
  setup_bean_branch "$bean_id" "$bean_type" || log_warn "Branch setup failed, continuing on current branch"

  while [[ $iteration -lt $MAX_ITERATIONS ]]; do
    iteration=$((iteration + 1))
    log "Iteration $iteration/$MAX_ITERATIONS"

    # Fetch fresh bean data
    local bean_json
    bean_json=$(get_bean "$bean_id")

    if [[ -z "$bean_json" ]] || [[ "$(echo "$bean_json" | jq -r '.bean')" == "null" ]]; then
      log_error "Failed to fetch bean: $bean_id"

      # Leave branch for inspection, checkout parent's branch
      if [[ "$BRANCH_ENABLED" == "true" ]]; then
        local branch_name base_branch
        branch_name=$(bean_branch "$bean_id" "$bean_type")
        base_branch=$(get_merge_target "$bean_id")
        log_warn "Leaving branch $branch_name for inspection"
        git checkout "$base_branch" 2>/dev/null || true
      fi

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

        # Leave branch for inspection, checkout parent's branch
        if [[ "$BRANCH_ENABLED" == "true" ]]; then
          local branch_name base_branch
          branch_name=$(bean_branch "$bean_id" "$bean_type")
          base_branch=$(get_merge_target "$bean_id")
          log_warn "Leaving branch $branch_name for inspection"
          git checkout "$base_branch" 2>/dev/null || true
        fi

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

      # Merge bean branch on completion
      merge_bean_branch "$bean_id" "$bean_type" "$bean_title" || log_warn "Branch merge failed"

      log_success "Bean completed: $bean_id (${iteration} iterations, ${duration}s)"
      notify_bean_complete "$bean_id"
      return 0
    fi

    if is_stuck "$bean_id"; then
      local end_time duration
      end_time=$(date +%s)
      duration=$((end_time - start_time))
      log_warn "Bean is stuck (blocked/failed): $bean_id (${iteration} iterations, ${duration}s)"

      # Leave branch for inspection, checkout parent's branch
      if [[ "$BRANCH_ENABLED" == "true" ]]; then
        local branch_name base_branch
        branch_name=$(bean_branch "$bean_id" "$bean_type")
        base_branch=$(get_merge_target "$bean_id")
        log_warn "Leaving branch $branch_name for inspection"
        git checkout "$base_branch" 2>/dev/null || true
      fi

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

  # Leave branch for inspection, checkout parent's branch
  if [[ "$BRANCH_ENABLED" == "true" ]]; then
    local branch_name base_branch
    branch_name=$(bean_branch "$bean_id" "$bean_type")
    base_branch=$(get_merge_target "$bean_id")
    log_warn "Leaving branch $branch_name for inspection"
    git checkout "$base_branch" 2>/dev/null || true
  fi

  return 0
}

# Main loop
main() {
  local beans_completed=0

  log "Ralph Loop started (agent: $AGENT, model: $MODEL, max iterations: $MAX_ITERATIONS)"

  # Resolve the root bean for DFS (unless running a specific bean)
  if [[ -z "$SPECIFIC_BEAN" ]]; then
    resolve_root
  fi

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
