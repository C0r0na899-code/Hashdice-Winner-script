# Script 5.5 – Changelog

## Bug Fixes

- **`log.warn` removed** – The NanoGames API does not expose `log.warn`. All warning calls replaced with `log.info("WARNING: ...")` to prevent runtime errors.
- **Config validation order fixed** – `validateConfiguration()` was previously registered after `game.onBet`, meaning an invalid config could reach the betting loop. Validation now runs first.
- **Stop-loss check uses correct bet** – `checkStopConditions()` now accepts the bet amount as a parameter. It is called both before placing a bet and after `calculateNextBet()`, ensuring the stop-loss is always evaluated against the actual next bet rather than a stale value.

## Improvements

- **Recovery sequence cap** (`maxRecoverySteps`, default: 10) – Previously, the recovery sequence could grow without limit during a loss streak, causing runaway bet escalation and bankroll destruction (observed in log at games #515–521). When the cap is reached, the script now accepts the loss and resets to normal mode instead of continuing to escalate.
- **`recoveryThreshold` default raised** – Changed from `2` to `4` to reflect real-world usage observed in session logs.
- **`winStreakLimit` label clarified** – Renamed from `"Max win streak increases"` to `"Cap bet after N wins"` to accurately describe the behavior.

## New Features

- **Session summary on stop** – `logFinalStats()` is now called at every exit point, printing total games played, wins/losses, win rate, cycles completed, and final profit.
