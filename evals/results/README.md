# Eval Results

Check in story-specific eval runs here.

## Naming

- Use `YYYY-MM-DD-<story-id>.md` for the human-readable run note.
- Use `YYYY-MM-DD...-<story-id>-*.json` for machine-readable runner artifacts.

## Minimum contents

- dataset slices used
- stories or changes covered
- cases run
- expected vs actual outcomes
- measured latency, or an explicit `dry-run only` note when no provider job was submitted
- blocked live assets, if any
- regressions found
- next action
- For JSON artifacts, include at least the story id, generation time, mode (`dry-run` or `live`), model, case count, and any aggregate summary the runner produced.
