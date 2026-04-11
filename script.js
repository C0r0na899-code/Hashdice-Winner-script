// ============================================================
//  Winners Method v5.2
//  New in v5.2:
//  [NEW] Win streak bet increase (normal mode only)
//        winMultiplier: factor applied to the bet after each
//        consecutive win (e.g. 1.5 = +50% per win in a row).
//        winStreakLimit: max number of increases (0 = unlimited).
//        On any loss or entry into recovery mode the bet is
//        immediately reset to initialBet.
//
//  All fixes from v5.1 are retained.
// ============================================================

var config = {
    initialBet: {
        value: currency.minAmount,
        type: "number",
        label: "Initial Bet"
    },
    cashout: {
        value: 2.0,
        type: "number",
        label: "Cashout Multiplier"
    },
    maxBet: {
        value: 10000,
        type: "number",
        label: "Maximum Bet Limit"
    },
    stopLoss: {
        value: -5000,
        type: "number",
        label: "Stop Loss (negative value)"
    },
    profitTarget: {
        value: 10000,
        type: "number",
        label: "Profit Target (auto stop)"
    },
    maxCycles: {
        value: 0,
        type: "number",
        label: "Max Cycles (0 = unlimited)"
    },
    recoveryThreshold: {
        value: 2,
        type: "number",
        label: "Consecutive losses before recovery"
    },
    winMultiplier: {
        value: 1.5,
        type: "number",
        label: "Win Streak Multiplier (e.g. 1.5 = +50% per win)"
    },
    winStreakLimit: {
        value: 3,
        type: "number",
        label: "Max win streak increases (0 = unlimited)"
    },
    restartStrategy: {
        value: true,
        type: "radio",
        label: "Restart after cycle?",
        options: [
            { value: true,  label: "Restart" },
            { value: false, label: "Stop"    }
        ]
    }
};

function main() {
    log.info("=== Winners Method v5.2 - Starting ===");

    const minBet   = currency.minAmount;
    const initBet  = config.initialBet.value;
    const winMult  = config.winMultiplier.value;
    const winLimit = config.winStreakLimit.value; // 0 = no limit

    let sequence          = [];
    let currentBet        = initBet;
    let consecutiveLosses = 0;
    let consecutiveWins   = 0;  // counts consecutive wins in normal mode
    let inRecovery        = false;
    let totalGames        = 0;
    let totalProfit       = 0;
    let cyclesCompleted   = 0;

    // ----------------------------------------------------------
    // Validates a bet amount against min and max limits
    // ----------------------------------------------------------
    function isNextBetValid(bet) {
        if (bet > config.maxBet.value) {
            log.error(
                "Next bet " + bet.toFixed(8) +
                " exceeds maximum (" + config.maxBet.value.toFixed(8) + "). Stopping."
            );
            return false;
        }
        if (bet < minBet) {
            log.error(
                "Next bet " + bet.toFixed(8) +
                " is below minimum (" + minBet.toFixed(8) + "). Stopping."
            );
            return false;
        }
        return true;
    }

    // ----------------------------------------------------------
    // Full state reset after a completed cycle
    // ----------------------------------------------------------
    function resetState() {
        inRecovery        = false;
        consecutiveLosses = 0;
        consecutiveWins   = 0;
        sequence          = [];
        currentBet        = initBet;
    }

    // ----------------------------------------------------------
    // Labouchère next-bet calculation (recovery mode)
    //   sequence.length === 0  ->  initBet  (inconsistent state, healed)
    //   sequence.length === 1  ->  sequence[0]            (single unit)
    //   sequence.length >= 2   ->  sequence[0] + sequence[last]  (standard)
    // ----------------------------------------------------------
    function calcLabouchereBet() {
        if (sequence.length === 0) {
            // Heal inconsistent state: inRecovery=true but empty sequence
            log.info("Sequence empty in recovery — resetting to normal mode.");
            inRecovery        = false;
            consecutiveLosses = 0;
            consecutiveWins   = 0;
            return initBet;
        }
        if (sequence.length === 1) {
            return sequence[0];
        }
        return sequence[0] + sequence[sequence.length - 1];
    }

    // ----------------------------------------------------------
    // Win streak bet calculation (normal mode only)
    //   Multiplies initialBet by winMultiplier^consecutiveWins,
    //   capped at winStreakLimit steps and at maxBet.
    // ----------------------------------------------------------
    function calcWinStreakBet() {
        // No increase configured -> always return initialBet
        if (winMult <= 1.0) return initBet;

        const effectiveWins = (winLimit > 0)
            ? Math.min(consecutiveWins, winLimit)
            : consecutiveWins;

        const bet = initBet * Math.pow(winMult, effectiveWins);
        return Math.min(Math.max(bet, minBet), config.maxBet.value);
    }

    // ----------------------------------------------------------
    // Main bet loop
    // ----------------------------------------------------------
    game.onBet = function () {

        // Stop-loss: check current profit and whether the next
        // bet alone would breach the limit
        if (totalProfit <= config.stopLoss.value) {
            log.error("Stop loss triggered at " + totalProfit.toFixed(8) + ". Stopping.");
            game.stop();
            return;
        }
        if (totalProfit - currentBet < config.stopLoss.value) {
            log.error(
                "Next bet would breach stop loss (" +
                (totalProfit - currentBet).toFixed(8) + " < " +
                config.stopLoss.value.toFixed(8) + "). Stopping."
            );
            game.stop();
            return;
        }

        if (totalProfit >= config.profitTarget.value) {
            log.success("Profit target reached at " + totalProfit.toFixed(8) + ". Stopping.");
            game.stop();
            return;
        }

        if (!isNextBetValid(currentBet)) {
            game.stop();
            return;
        }

        log.info(
            "Game #" + (totalGames + 1) +
            " | Mode: "      + (inRecovery ? "RECOVERY" : "NORMAL") +
            " | Bet: "       + currentBet.toFixed(8) +
            (inRecovery ? "" : " | WinStreak: " + consecutiveWins) +
            " | Profit: "    + totalProfit.toFixed(8)
        );

        game.bet(currentBet, config.cashout.value).then(function (result) {
            totalGames++;
            const won = result >= config.cashout.value;

            if (won) {
                const winAmount = currentBet * (config.cashout.value - 1);
                totalProfit += winAmount;
                log.success(
                    "WIN +" + winAmount.toFixed(8) +
                    " | Total profit: " + totalProfit.toFixed(8)
                );

                if (inRecovery) {
                    // Labouchere win: remove first and last element
                    if (sequence.length >= 2) {
                        sequence.shift();
                        sequence.pop();
                    } else {
                        sequence = [];
                    }
                    consecutiveLosses = 0;
                    // No win streak increase during recovery

                    if (sequence.length === 0) {
                        cyclesCompleted++;
                        log.success("=== CYCLE " + cyclesCompleted + " COMPLETED ===");

                        if (config.maxCycles.value > 0 && cyclesCompleted >= config.maxCycles.value) {
                            log.info("Max cycles reached. Stopping.");
                            game.stop();
                            return;
                        }
                        if (!config.restartStrategy.value) {
                            log.info("Restart disabled. Stopping after cycle.");
                            game.stop();
                            return;
                        }
                        resetState();
                    }

                } else {
                    // Normal mode win: increment win streak
                    consecutiveLosses = 0;
                    consecutiveWins++;

                    const limitNote = (winLimit > 0 && consecutiveWins >= winLimit)
                        ? " (limit reached)"
                        : "";
                    log.info("Win streak: " + consecutiveWins + limitNote);
                }

            } else {
                // ---- LOSS ----
                totalProfit -= currentBet;
                log.error(
                    "LOSS -" + currentBet.toFixed(8) +
                    " | Total profit: " + totalProfit.toFixed(8)
                );

                if (inRecovery) {
                    // Standard Labouchere: append the actual bet so that
                    // sequence values grow and future bets escalate properly
                    sequence.push(currentBet);
                    log.info(
                        "Recovery loss -> appended " + currentBet.toFixed(8) +
                        ". Sequence: [" +
                        sequence.map(function(b){ return b.toFixed(8); }).join(", ") + "]"
                    );
                } else {
                    // Normal mode loss: reset win streak
                    consecutiveWins = 0;
                    consecutiveLosses++;

                    if (consecutiveLosses >= config.recoveryThreshold.value) {
                        inRecovery = true;
                        sequence = Array(consecutiveLosses).fill(initBet);
                        log.info(
                            consecutiveLosses + " consecutive losses -> Recovery activated. " +
                            "Sequence: [" +
                            sequence.map(function(b){ return b.toFixed(8); }).join(", ") + "]"
                        );
                    }
                }
            }

            // ------ Calculate and validate next bet ------
            if (inRecovery) {
                currentBet = calcLabouchereBet();
            } else {
                currentBet = calcWinStreakBet();
            }

            // Enforce minimum bet
            currentBet = Math.max(currentBet, minBet);

            // Validate maxBet immediately after calculation
            if (currentBet > config.maxBet.value) {
                log.error(
                    "Calculated next bet " + currentBet.toFixed(8) +
                    " exceeds maximum (" + config.maxBet.value.toFixed(8) + "). Stopping."
                );
                game.stop();
                return;
            }

            const seqStr = sequence.length
                ? sequence.map(function(b) { return b.toFixed(8); }).join(", ")
                : "empty";
            log.info(
                "Next bet: " + currentBet.toFixed(8) +
                " | Sequence: [" + seqStr + "]"
            );

        }).catch(function (err) {
            log.error("Bet error: " + err);
            game.stop();
        });
    };
}
