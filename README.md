# 🎯 Winners Method

A JavaScript betting script implementing a **Labouchère-based recovery strategy** with configurable stop-loss, profit targets, and cycle management.

> ⚠️ **Disclaimer:** This script is for educational purposes only. Gambling involves significant financial risk. Never bet more than you can afford to lose.

---

## 📋 Features

- **Labouchère Recovery System** — Automatically activates after consecutive losses to recover losses systematically
- **Configurable Thresholds** — Set your own bet limits, stop-loss, and profit targets
- **Cycle Management** — Define max cycles or run indefinitely with auto-restart
- **Pre-bet Validation** — Checks bet validity *before* placing, not after
- **Detailed Logging** — Every game state is logged for full transparency

---

## ⚙️ Configuration

| Parameter | Default | Description |
|---|---|---|
| `initialBet` | `minAmount` | Starting bet size |
| `cashout` | `2.0` | Target cashout multiplier |
| `maxBet` | `10000` | Maximum allowed bet |
| `stopLoss` | `-5000` | Stop script at this total loss |
| `profitTarget` | `10000` | Auto-stop when this profit is reached |
| `maxCycles` | `0` | Max recovery cycles (0 = unlimited) |
| `recoveryThreshold` | `2` | Consecutive losses before entering recovery mode |
| `restartStrategy` | `true` | Restart after a completed cycle (`true`) or stop (`false`) |

---

## 🔄 How It Works

### Normal Mode
The script bets the `initialBet` each round at the configured `cashout` multiplier.

### Recovery Mode
After `recoveryThreshold` consecutive losses, the script switches to **Labouchère recovery**:

1. A sequence is initialised from the losing bets
2. Each bet = **first + last** element of the sequence
3. On a **win** → remove first and last elements
4. On a **loss** → append the lost bet to the sequence
5. When the sequence is empty → cycle complete, reset to normal mode

---

## 🛑 Stop Conditions

The script stops automatically when any of the following occur:

- Total profit drops to or below `stopLoss`
- Total profit reaches or exceeds `profitTarget`
- Next bet would exceed `maxBet` or go below `minAmount`
- `maxCycles` is reached (if set > 0)
- `restartStrategy` is set to `false` after a completed cycle

---

## 🚀 Usage

1. Copy the script into your platform's custom script editor
2. Adjust the config values at the top to match your strategy and bankroll
3. Run and monitor the logs for real-time status

---

## 📊 Logging

Every round outputs:
- Game number and current mode (`NORMAL` / `RECOVERY`)
- Current bet and total profit
- Win/loss result and updated sequence
- Next bet preview

---

## 📁 File Overview

```
script.js   — Main script file
README.md       — This file
```

---

## 📜 License

MIT License — free to use, modify, and distribute.

---

## Improvements

- **Bug Fixes**: Resolved known issues that caused errors during script execution.
- **Statistics Tracking**: Added features to collect and report on various statistics, allowing for better insights into the script's performance.
- **Enhanced Logging**: Improved the logging system to provide more detailed and useful output when running the script, aiding in debugging and monitoring.
- **Safety Features**: Implemented additional safety mechanisms to prevent unintended actions and ensure script reliability.
- **Configuration Validation**: Added checks to validate configuration settings before running the script, ensuring that incorrect settings do not lead to errors.