# NanoGames Betting Script — Version 5.5

A Labouchere-based recovery script with win streak multiplier for [NanoGames](https://nanogames.io). Runs on Hash Dice and any compatible game.

---

## How It Works

The script operates in two modes:

**NORMAL mode** — Bets start at the initial bet. Each consecutive win multiplies the bet by the win streak multiplier. A loss resets the streak back to the initial bet. After a set number of consecutive losses the script switches to RECOVERY mode.

**RECOVERY mode** — Uses a Labouchere sequence to recover losses. The next bet is always the sum of the first and last numbers in the sequence. A win removes those two numbers; a loss appends the lost amount to the sequence. When the sequence is cleared the cycle is complete and the script returns to NORMAL mode.

---

## Configuration

| Setting | Default | Description |
|---|---|---|
| Initial Bet | currency min | The base bet amount to start each cycle with |
| Cashout Multiplier | 2.0 | The target multiplier to cash out at |
| Maximum Bet Limit | 10000 | Hard cap — script stops if next bet would exceed this |
| Stop Loss | -5000 | Negative value — script stops if profit drops to or below this |
| Profit Target | 10000 | Script stops automatically when this profit is reached |
| Max Cycles | 0 | Number of recovery cycles before stopping. 0 = unlimited |
| Consecutive losses before recovery | 4 | How many losses in a row trigger RECOVERY mode |
| Max recovery steps | 10 | How many times the recovery sequence can grow before the script accepts the loss and resets. 0 = unlimited (dangerous) |
| Win Streak Multiplier | 1.5 | Multiplies the bet by this amount after each consecutive win (e.g. 1.5 = +50%) |
| Cap bet after N wins | 3 | Stops increasing the bet after this many consecutive wins. 0 = unlimited |
| Restart after cycle? | Restart | Whether to restart in NORMAL mode after a cycle completes, or stop |

---

## Session Log Output

Every game is logged in the format:

```
Game #N | Mode: NORMAL/RECOVERY | Bet: X | WinStreak: N | Profit: X
WIN +X | Total profit: X
LOSS -X | Total profit: X
Next bet: X | Sequence: [X, X, ...]
```

When the script stops for any reason a session summary is printed:

```
=== SESSION ENDED ===
Total games: N
Wins / Losses: N / N
Win rate: N%
Cycles done: N
Final profit: N
```

---

## Stopping Conditions

The script stops automatically when any of the following occur:

- Profit drops to or below the stop loss value
- The next bet would breach the stop loss
- Profit reaches the profit target
- The next bet would exceed the maximum bet limit
- Max cycles have been completed (if set)
- Recovery mode reaches the max recovery steps limit (resets to normal instead of stopping)
- Restart after cycle is set to Stop and a cycle completes

---

## Changelog

### v5.5
- Fixed: `log.warn` does not exist in the NanoGames API — replaced with `log.info("WARNING: ...")`
- Fixed: Config validation now runs before `game.onBet` is registered, preventing invalid configs from reaching the betting loop
- Fixed: Stop-loss check now uses the correct next bet value instead of a stale one
- Added: `maxRecoverySteps` setting to cap runaway recovery sequences
- Added: Session summary printed on every stop (total games, win rate, cycles, final profit)
- Changed: `recoveryThreshold` default raised from 2 to 4 to match real-world usage
- Changed: `winStreakLimit` label clarified to "Cap bet after N wins"
- Changed: Script compacted for NanoGames character limit compatibility
