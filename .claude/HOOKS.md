# Claude Code Hooks Configuration

This project uses Claude Code hooks to automate CI/CD workflows. Hooks are configured in `.claude/settings.local.json`.

## Current Hooks

### SessionStart Hook

Shows available project commands when starting a new session:

- `/fix-ci` - Fix all CI/CD issues
- `/release [type]` - Create a new release
- `/check-release` - Monitor release status

### PostToolUse Hook

Reminds you to run `/fix-ci` after writing significant code changes (triggered by `Write` or `Edit` tool usage).

## Available Hook Events

Claude Code supports these hook events:

### Lifecycle Hooks

- **SessionStart**: Runs when a new session starts
- **SessionEnd**: Runs when a session ends
- **SubagentStart**: Runs when a subagent/task starts
- **SubagentStop**: Runs when a subagent/task completes

### Tool Hooks

- **PreToolUse**: Runs before a tool is executed
- **PostToolUse**: Runs after a tool succeeds
- **PostToolUseFailure**: Runs when a tool fails
- **PermissionRequest**: Runs when permission is requested

### Other Hooks

- **UserPromptSubmit**: Runs when user submits a prompt
- **Notification**: Runs on notifications
- **Stop**: Runs when session is stopped
- **PreCompact**: Runs before conversation context is compacted

## Hook Types

### 1. Command Hook

Execute a bash command:

```json
{
  "type": "command",
  "command": "echo 'Hello!'",
  "timeout": 30,
  "statusMessage": "Running check...",
  "once": false
}
```

### 2. Prompt Hook

Run a quick LLM evaluation:

```json
{
  "type": "prompt",
  "prompt": "Check if tests passed in output: $ARGUMENTS",
  "model": "claude-sonnet-4-5-20250929",
  "timeout": 60,
  "statusMessage": "Analyzing...",
  "once": false
}
```

### 3. Agent Hook

Run a full agentic verifier:

```json
{
  "type": "agent",
  "prompt": "Verify that all tests passed and coverage is >80%",
  "model": "claude-sonnet-4-5-20250929",
  "timeout": 120,
  "statusMessage": "Verifying test results...",
  "once": false
}
```

## Using Matchers

Hooks can use matchers to filter when they run:

```json
{
  "matcher": "Write|Edit",
  "hooks": [...]
}
```

Common matchers:

- `"Write"` - Only on Write tool usage
- `"Edit"` - Only on Edit tool usage
- `"Write|Edit"` - On Write OR Edit
- `"Bash"` - On any Bash command
- `"Bash(git:*)"` - On git commands only
- Leave empty to match all events

## Example: Auto-run Tests After Code Changes

Add this to `PostToolUse` in `.claude/settings.local.json`:

```json
"PostToolUse": [
  {
    "matcher": "Write|Edit",
    "hooks": [
      {
        "type": "command",
        "command": "pnpm run test",
        "statusMessage": "Running tests after code change...",
        "timeout": 120
      }
    ]
  }
]
```

## Example: Verify Commit Messages

Add this to `PreToolUse`:

```json
"PreToolUse": [
  {
    "matcher": "Bash(git commit:*)",
    "hooks": [
      {
        "type": "prompt",
        "prompt": "Check if the git commit message follows conventional commits format. Input: $ARGUMENTS",
        "statusMessage": "Validating commit message..."
      }
    ]
  }
]
```

## Example: Auto-fix CI Issues

Add this to `PostToolUse`:

```json
"PostToolUse": [
  {
    "matcher": "Write|Edit",
    "hooks": [
      {
        "type": "agent",
        "prompt": "After code changes, automatically run linting and formatting to fix CI issues. Use /fix-ci command.",
        "timeout": 300,
        "statusMessage": "Auto-fixing CI issues...",
        "once": false
      }
    ]
  }
]
```

## The $ARGUMENTS Placeholder

In prompt and agent hooks, use `$ARGUMENTS` to access:

- Tool name
- Tool parameters
- Tool results
- Any other context passed to the hook

Example:

```json
{
  "type": "prompt",
  "prompt": "Analyze this tool result for errors: $ARGUMENTS"
}
```

## Hook Options

### timeout

Maximum seconds the hook can run (default varies by type)

### statusMessage

Custom message shown while hook runs

### once

If `true`, hook runs once then is removed (useful for one-time setup)

### model

Override the model for prompt/agent hooks (defaults to fast models)

## Disabling Hooks

To temporarily disable all hooks:

```json
{
  "disableAllHooks": true
}
```

Or remove specific hooks from the `hooks` object.

## Debugging Hooks

Run Claude Code with hook debugging:

```bash
claude --debug hooks
```

This shows:

- When hooks trigger
- Hook execution output
- Any errors

## Best Practices

1. **Keep hooks fast**: Use `command` hooks for speed, `agent` hooks when you need intelligence
2. **Use matchers**: Filter to only relevant tool calls to avoid noise
3. **Set timeouts**: Prevent hooks from hanging your workflow
4. **Test incrementally**: Add one hook at a time to verify behavior
5. **Use statusMessage**: Give users feedback while hooks run
6. **Leverage $ARGUMENTS**: Access full context for smarter automation

## Common Use Cases

### 1. Welcome Message

Show project info on session start

### 2. Auto-formatting

Run formatters after code changes

### 3. Test Automation

Run tests after modifying test files

### 4. Commit Validation

Verify commit message format

### 5. CI/CD Reminders

Remind to check CI after changes

### 6. Documentation Updates

Prompt to update docs when APIs change

### 7. Security Checks

Run security scans on new dependencies

### 8. Performance Monitoring

Track build times and warn on regressions

## Troubleshooting

**Hook not running:**

- Check matcher pattern
- Verify hook syntax with `--debug hooks`
- Ensure `disableAllHooks` is not set

**Hook too slow:**

- Reduce timeout
- Switch from `agent` to `prompt` or `command`
- Add specific matchers to reduce triggers

**Too many hook triggers:**

- Use more specific matchers
- Add logic to check if hook already ran recently
- Use `once: true` for one-time actions
