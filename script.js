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
    const PRECISION = 8;
    const WIN_MULTIPLIER_MIN = 1.0;
    const SEQUENCE_LENGTH_SINGLE = 1;
    const SEQUENCE_LENGTH_DOUBLE = 2;

    const minBet = currency.minAmount;
    const initBet = config.initialBet.value;
    const maxBet = config.maxBet.value;
    const stopLossLimit = config.stopLoss.value;
    const profitTarget = config.profitTarget.value;
    const maxCycles = config.maxCycles.value;
    const recoveryThreshold = config.recoveryThreshold.value;
    const winMult = config.winMultiplier.value;
    const winLimit = config.winStreakLimit.value;
    const cashoutMult = config.cashout.value;
    const restartAfterCycle = config.restartStrategy.value;

    let sequence = [];
    let currentBet = initBet;
    let consecutiveLosses = 0;
    let consecutiveWins = 0;
    let inRecovery = false;
    let totalGames = 0;
    let totalProfit = 0;
    let cyclesCompleted = 0;
    let isStopped = false;

    function formatBet(amount) {
        return amount.toFixed(PRECISION);
    }

    function getSequenceStr() {
        if (sequence.length === 0) return "empty";
        return sequence.map(function (b) { return formatBet(b); }).join(", ");
    }

    function getModeStr() {
        return inRecovery ? "RECOVERY" : "NORMAL";
    }

    function logGameStart(gameNumber) {
        const winStreakInfo = inRecovery ? "" : " | WinStreak: " + consecutiveWins;
        log.info(
            "Game #" + gameNumber +
            " | Mode: " + getModeStr() +
            " | Bet: " + formatBet(currentBet) +
            winStreakInfo +
            " | Profit: " + formatBet(totalProfit)
        );
    }

    function logWin(winAmount) {
        log.success(
            "WIN +" + formatBet(winAmount) +
            " | Total profit: " + formatBet(totalProfit)
        );
    }

    function logLoss() {
        log.error(
            "LOSS -" + formatBet(currentBet) +
            " | Total profit: " + formatBet(totalProfit)
        );
    }

    function logSequenceUpdate(message) {
        log.info(message + " Sequence: [" + getSequenceStr() + "]");
    }

    function logStoppingReason(reason) {
        log.info(reason);
    }

    function validateConfiguration() {
        const errors = [];
        const warnings = [];

        if (initBet < minBet) {
            errors.push("Initial bet (" + formatBet(initBet) + ") is below minimum (" + formatBet(minBet) + ")");
        }
        if (initBet > maxBet) {
            errors.push("Initial bet (" + formatBet(initBet) + ") exceeds maximum (" + formatBet(maxBet) + ")");
        }
        if (stopLossLimit > 0) {
            errors.push("Stop loss should be a negative value, got: " + stopLossLimit);
        }
        if (profitTarget <= 0) {
            errors.push("Profit target should be positive, got: " + profitTarget);
        }
        if (recoveryThreshold < 1) {
            errors.push("Recovery threshold must be at least 1, got: " + recoveryThreshold);
        }
        if (cashoutMult <= 1) {
            errors.push("Cashout multiplier must be > 1, got: " + cashoutMult);
        }

        if (winMult <= WIN_MULTIPLIER_MIN && winLimit > 0) {
            warnings.push("Win multiplier <= 1.0 but win streak limit > 0: limit will never apply");
        }
        if (maxCycles < 0) {
            warnings.push("Max cycles is negative; treating as unlimited");
        }

        if (errors.length > 0) {
            log.error("Configuration validation failed:");
            errors.forEach(function (err) {
                log.error("  - " + err);
            });
            game.stop();
            return false;
        }

        if (warnings.length > 0) {
            log.warn("Configuration warnings:");
            warnings.forEach(function (warn) {
                log.warn("  - " + warn);
            });
        }

        return true;
    }

    function isNextBetValid(bet) {
        if (bet > maxBet) {
            log.error(
                "Next bet " + formatBet(bet) +
                " exceeds maximum (" + formatBet(maxBet) + "). Stopping."
            );
            return false;
        }
        if (bet < minBet) {
            log.error(
                "Next bet " + formatBet(bet) +
                " is below minimum (" + formatBet(minBet) + "). Stopping."
            );
            return false;
        }
        return true;
    }

    function checkStopConditions() {
        if (totalProfit <= stopLossLimit) {
            log.error("Stop loss triggered at " + formatBet(totalProfit) + ". Stopping.");
            return true;
        }
        if (totalProfit - currentBet < stopLossLimit) {
            log.error(
                "Next bet would breach stop loss (" +
                formatBet(totalProfit - currentBet) + " < " +
                formatBet(stopLossLimit) + "). Stopping."
            );
            return true;
        }
        if (totalProfit >= profitTarget) {
            log.success("Profit target reached at " + formatBet(totalProfit) + ". Stopping.");
            return true;
        }
        return false;
    }

    function resetState() {
        inRecovery = false;
        consecutiveLosses = 0;
        consecutiveWins = 0;
        sequence = [];
        currentBet = initBet;
    }

    function validateStateConsistency() {
        if (inRecovery && sequence.length === 0) {
            log.info("Inconsistent state: inRecovery=true but empty sequence. Resetting to normal mode.");
            inRecovery = false;
            consecutiveLosses = 0;
            consecutiveWins = 0;
            return initBet;
        }
        return null;
    }

    function calcLabouchereBet() {
        const stateCheck = validateStateConsistency();
        if (stateCheck !== null) return stateCheck;

        if (sequence.length === SEQUENCE_LENGTH_SINGLE) {
            return sequence[0];
        }
        if (sequence.length >= SEQUENCE_LENGTH_DOUBLE) {
            return sequence[0] + sequence[sequence.length - 1];
        }
        return initBet;
    }

    function calcWinStreakBet() {
        if (winMult <= WIN_MULTIPLIER_MIN) return initBet;

        const effectiveWins = (winLimit > 0)
            ? Math.min(consecutiveWins, winLimit)
            : consecutiveWins;

        const bet = initBet * Math.pow(winMult, effectiveWins);
        return Math.min(Math.max(bet, minBet), maxBet);
    }

    function calculateNextBet() {
        let nextBet;
        if (inRecovery) {
            nextBet = calcLabouchereBet();
        } else {
            nextBet = calcWinStreakBet();
        }
        return Math.max(nextBet, minBet);
    }

    function handleWin() {
        const winAmount = currentBet * (cashoutMult - 1);
        totalProfit += winAmount;
        logWin(winAmount);

        if (inRecovery) {
            handleRecoveryWin();
        } else {
            handleNormalWin();
        }
    }

    function handleNormalWin() {
        consecutiveLosses = 0;
        consecutiveWins++;

        const limitNote = (winLimit > 0 && consecutiveWins >= winLimit)
            ? " (limit reached)"
            : "";
        log.info("Win streak: " + consecutiveWins + limitNote);
    }

    function handleRecoveryWin() {
        if (sequence.length >= SEQUENCE_LENGTH_DOUBLE) {
            sequence.shift();
            sequence.pop();
        } else if (sequence.length === SEQUENCE_LENGTH_SINGLE) {
            sequence = [];
        }
        consecutiveLosses = 0;

        if (sequence.length === 0) {
            cyclesCompleted++;
            log.success("=== CYCLE " + cyclesCompleted + " COMPLETED ===");

            if (maxCycles > 0 && cyclesCompleted >= maxCycles) {
                logStoppingReason("Max cycles reached. Stopping.");
                isStopped = true;
                return;
            }
            if (!restartAfterCycle) {
                logStoppingReason("Restart disabled. Stopping after cycle.");
                isStopped = true;
                return;
            }
            resetState();
        }
    }

    function handleLoss() {
        totalProfit -= currentBet;
        logLoss();

        if (inRecovery) {
            handleRecoveryLoss();
        } else {
            handleNormalLoss();
        }
    }

    function handleNormalLoss() {
        consecutiveWins = 0;
        consecutiveLosses++;

        if (consecutiveLosses >= recoveryThreshold) {
            inRecovery = true;
            sequence = Array(consecutiveLosses).fill(initBet);
            logSequenceUpdate(
                consecutiveLosses + " consecutive losses -> Recovery activated."
            );
        }
    }

    function handleRecoveryLoss() {
        sequence.push(currentBet);
        logSequenceUpdate(
            "Recovery loss -> appended " + formatBet(currentBet) + "."
        );
    }

    game.onBet = function () {
        if (isStopped) return;

        if (checkStopConditions()) {
            isStopped = true;
            game.stop();
            return;
        }

        if (!isNextBetValid(currentBet)) {
            isStopped = true;
            game.stop();
            return;
        }

        logGameStart(totalGames + 1);

        game.bet(currentBet, cashoutMult).then(function (result) {
            if (isStopped) return;

            totalGames++;
            const won = result >= cashoutMult;

            if (won) {
                handleWin();
            } else {
                handleLoss();
            }

            if (isStopped) {
                game.stop();
                return;
            }

            currentBet = calculateNextBet();

            if (currentBet > maxBet) {
                log.error(
                    "Calculated next bet " + formatBet(currentBet) +
                    " exceeds maximum (" + formatBet(maxBet) + "). Stopping."
                );
                isStopped = true;
                game.stop();
                return;
            }

            log.info(
                "Next bet: " + formatBet(currentBet) +
                " | Sequence: [" + getSequenceStr() + "]"
            );

        }).catch(function (err) {
            log.error("Bet error on game #" + (totalGames + 1) + ": " + err);
            isStopped = true;
            game.stop();
        });
    };

    if (!validateConfiguration()) {
        return;
    }
}