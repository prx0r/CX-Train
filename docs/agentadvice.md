# Agent CPU Conservation Discipline

CX23 is a shared VPS. Heavy operations slow down everyone and can get the agent killed.

## Golden Rule

**Do not make the server hotter than you found it.**

Before every heavy operation, ask: "Is this necessary right now, or can I verify a lighter way first?"

---

## Search Discipline

### Bad (hammers disk + CPU)

```bash
grep -R "something" .                    # crawls node_modules, .next, .git
grep -R --include="*.ts" "something" .   # still hits node_modules
find . -name "*.ts" | xargs grep ...    # even worse
```

### Good (targeted, fast)

```bash
# Never search node_modules, .next, data, or .git
grep -R --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=data "pattern" .

# Even better: scope to known directories
grep -n "pattern" lib/mvp/db.ts
grep -rn "pattern" lib/ app/ components/
```

### Best (use the tools)

```bash
# Use the Grep tool with specific include patterns
# Use Glob to find files by name first, then read them directly
```

Read the file you need. Do not search for what you can look up.

---

## Build Discipline

```bash
# Do NOT run repeatedly
npm run build   # heavy: webpack compiles everything

# Do NOT run unless:
#   1. You changed code that needs compilation verification
#   2. You are at the end of a task and need final confirmation
#   3. package.json or tsconfig.json changed

# Run ONCE per task session, at the end.
```

### Lighter alternatives to full build

```bash
# Check for TypeScript errors (fast)
npx tsc --noEmit --skipLibCheck   # 2-5s

# Check single file compiles
npx tsc --noEmit lib/mvp/analysis/scoring.ts --skipLibCheck

# Check lint on changed files only
npx next lint --dir app/mvp --dir lib/mvp 2>/dev/null | tail -5
```

Only run `npm run build` once at the end. Use targeted type checks during development.

---

## Install Discipline

```bash
# Do NOT run unless package.json changed
npm install     # slow, I/O heavy

# Check first
git diff HEAD -- package.json

# If no changes, skip it. node_modules is already populated.
```

---

## Dev Server Discipline

```bash
# Sequence for edit-test cycles:
pkill -f "next dev"            # 1. Stop server (frees memory + CPU)

# Agent edits files...

npx tsc --noEmit --skipLibCheck  # 2. Lightweight type check

npm run dev &                    # 3. Start server only when you need to
sleep 5                          #    test via curl/browser

# After testing:
pkill -f "next dev"            # 4. Stop server when done
```

Do not leave the dev server running between tasks. It idles at 200-500MB RAM and periodic CPU.

---

## Test Discipline

```bash
# Fastest: targeted test file
node --test .test-dist/tests/assessment-scoring.test.js

# Medium: full unit suite
npm test                        # compiles + runs, ~5-10s

# Heaviest: integration + build
npm run test:mvp-flow           # hits SQLite
npm run build                   # full webpack

# Order of running: targeted -> unit -> integration -> build
# Stop at the first level that catches the issue.
```

---

## Docker / Coolify Awareness

```bash
# Check if something else is eating CPU
docker stats --no-stream

# If Coolify or an unused container is running hard:
docker ps
docker stop CONTAINER_ID

# Check overall load
htop
# or
top -bn1 | head -10
```

If the server is already hot (load > 2.0), stop. Do not add more load. Wait or ask.

---

## File Read Discipline

```bash
# BAD: scans entire repo
ls -R lib/

# GOOD: read only what you need
read lib/mvp/db.ts
read lib/mvp/query.ts

# BAD: glob all the things
glob "**/*.ts"

# GOOD: targeted globs
glob "lib/mvp/**/*.ts"
glob "app/api/mvp/**/*.ts"
```

Context budget is real. Every unnecessary file read wastes tokens and CPU.

---

## Summary Checklist

Before any operation, ask:

- [ ] Am I searching node_modules? → Stop. Use `--exclude-dir`.
- [ ] Am I running npm install? → Did package.json change? If no, skip.
- [ ] Am I running npm run build? → Is this the final verification? If not, use `npx tsc --noEmit`.
- [ ] Is the dev server running? → Should it be? Stop when not in use.
- [ ] Is Docker/Coolify eating resources? → Check `docker stats`.
- [ ] Is the server load high? → Wait or ask before adding load.
- [ ] Can I read one file instead of searching 1000? → Yes. Read the file.
- [ ] Can I verify with one grep instead of full test suite? → If yes, do that first.
