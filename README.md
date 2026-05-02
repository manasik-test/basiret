# Basiret

AI-powered social media analytics platform for SMEs. See `CLAUDE.md` for full project context.

## Setup

After cloning, enable the repo's git hooks once:

```sh
git config core.hooksPath .githooks
```

This activates `.githooks/pre-push`, which runs `npx tsc -b` before every push and blocks it if the strict TypeScript build fails. Production uses the same command, so this catches errors locally that would otherwise fail the CI deploy and trigger a rollback.

To skip the hook in an emergency: `git push --no-verify`.
