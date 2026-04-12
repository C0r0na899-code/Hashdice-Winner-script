var config = {
    initialBet: { value: currency.minAmount, type: "number", label: "Initial Bet" },
    cashout: { value: 2.0, type: "number", label: "Cashout Multiplier" },
    maxBet: { value: 10000, type: "number", label: "Maximum Bet Limit" },
    stopLoss: { value: -5000, type: "number", label: "Stop Loss (negative value)" },
    profitTarget: { value: 10000, type: "number", label: "Profit Target (auto stop)" },
    maxCycles: { value: 0, type: "number", label: "Max Cycles (0 = unlimited)" },
    recoveryThreshold: { value: 4, type: "number", label: "Consecutive losses before recovery" },
    maxRecoverySteps: { value: 10, type: "number", label: "Max recovery steps (0 = unlimited)" },
    winMultiplier: { value: 1.5, type: "number", label: "Win Streak Multiplier (1.5 = +50% per win)" },
    winStreakLimit: { value: 3, type: "number", label: "Cap bet after N wins (0 = unlimited)" },
    restartStrategy: {
        value: true, type: "radio", label: "Restart after cycle?",
        options: [{ value: true, label: "Restart" }, { value: false, label: "Stop" }]
    }
};

function main() {
    var PREC = 8;
    var minBet = currency.minAmount;
    var initBet = config.initialBet.value;
    var maxBet = config.maxBet.value;
    var stopLossLimit = config.stopLoss.value;
    var profitTarget = config.profitTarget.value;
    var maxCycles = config.maxCycles.value;
    var recoveryThreshold = config.recoveryThreshold.value;
    var maxRecoverySteps = config.maxRecoverySteps.value;
    var winMult = config.winMultiplier.value;
    var winLimit = config.winStreakLimit.value;
    var cashoutMult = config.cashout.value;
    var restartAfterCycle = config.restartStrategy.value;

    var sequence = [];
    var currentBet = initBet;
    var consecutiveLosses = 0;
    var consecutiveWins = 0;
    var inRecovery = false;
    var recoverySteps = 0;
    var totalGames = 0;
    var totalWins = 0;
    var totalLosses = 0;
    var totalProfit = 0;
    var cyclesCompleted = 0;
    var isStopped = false;

    function fmt(n) { return n.toFixed(PREC); }

    function seqStr() {
        if (sequence.length === 0) return "empty";
        var p = [];
        for (var i = 0; i < sequence.length; i++) { p.push(fmt(sequence[i])); }
        return p.join(", ");
    }

    function logStart(n) {
        var ws = inRecovery ? "" : " | WinStreak: " + consecutiveWins;
        log.info("Game #" + n + " | Mode: " + (inRecovery ? "RECOVERY" : "NORMAL") +
            " | Bet: " + fmt(currentBet) + ws + " | Profit: " + fmt(totalProfit));
    }

    function logFinalStats() {
        var wr = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(2) + "%" : "N/A";
        log.info("=== SESSION ENDED ===");
        log.info("Total games: " + totalGames);
        log.info("Wins / Losses: " + totalWins + " / " + totalLosses);
        log.info("Win rate: " + wr);
        log.info("Cycles done: " + cyclesCompleted);
        log.info("Final profit: " + fmt(totalProfit));
    }

    function stopScript(reason) {
        log.info(reason);
        logFinalStats();
        isStopped = true;
        game.stop();
    }

    function validateConfig() {
        var i, errors = [], warnings = [];
        if (initBet < minBet) errors.push("Initial bet below minimum");
        if (initBet > maxBet) errors.push("Initial bet exceeds maximum");
        if (stopLossLimit > 0) errors.push("Stop loss must be negative");
        if (profitTarget <= 0) errors.push("Profit target must be positive");
        if (recoveryThreshold < 1) errors.push("Recovery threshold must be >= 1");
        if (cashoutMult <= 1) errors.push("Cashout multiplier must be > 1");
        if (winMult <= 1.0 && winLimit > 0) warnings.push("Win multiplier <= 1.0, cap will never apply");
        if (maxCycles < 0) warnings.push("Max cycles negative, treating as unlimited");
        if (maxRecoverySteps === 0) warnings.push("Max recovery steps 0 (unlimited): runaway losses possible");
        if (errors.length > 0) {
            log.error("Config validation failed:");
            for (i = 0; i < errors.length; i++) { log.error("  - " + errors[i]); }
            game.stop();
            return false;
        }
        for (i = 0; i < warnings.length; i++) { log.info("WARNING: " + warnings[i]); }
        return true;
    }

    function checkStop(bet) {
        if (totalProfit <= stopLossLimit) {
            log.error("Stop loss triggered at " + fmt(totalProfit) + ". Stopping.");
            return true;
        }
        if (totalProfit - bet < stopLossLimit) {
            log.error("Next bet would breach stop loss (" + fmt(totalProfit - bet) + " < " + fmt(stopLossLimit) + "). Stopping.");
            return true;
        }
        if (totalProfit >= profitTarget) {
            log.success("Profit target reached at " + fmt(totalProfit) + ". Stopping.");
            return true;
        }
        return false;
    }

    function resetState() {
        inRecovery = false; consecutiveLosses = 0; consecutiveWins = 0;
        sequence = []; recoverySteps = 0; currentBet = initBet;
    }

    function calcNextBet() {
        if (inRecovery) {
            if (inRecovery && sequence.length === 0) { resetState(); return initBet; }
            if (sequence.length === 1) return sequence[0];
            if (sequence.length >= 2) return sequence[0] + sequence[sequence.length - 1];
            return initBet;
        }
        if (winMult <= 1.0) return initBet;
        var ew = (winLimit > 0) ? Math.min(consecutiveWins, winLimit) : consecutiveWins;
        return Math.min(Math.max(initBet * Math.pow(winMult, ew), minBet), maxBet);
    }

    function handleWin() {
        var wa = currentBet * (cashoutMult - 1);
        totalProfit += wa; totalWins++;
        log.success("WIN +" + fmt(wa) + " | Total profit: " + fmt(totalProfit));
        if (inRecovery) {
            if (sequence.length >= 2) { sequence.shift(); sequence.pop(); }
            else { sequence = []; }
            consecutiveLosses = 0;
            if (sequence.length === 0) {
                cyclesCompleted++; recoverySteps = 0;
                log.success("=== CYCLE " + cyclesCompleted + " COMPLETED ===");
                if (maxCycles > 0 && cyclesCompleted >= maxCycles) { stopScript("Max cycles reached. Stopping."); return; }
                if (!restartAfterCycle) { stopScript("Restart disabled. Stopping after cycle."); return; }
                resetState();
            }
        } else {
            consecutiveLosses = 0; consecutiveWins++;
            var note = (winLimit > 0 && consecutiveWins >= winLimit) ? " (cap reached)" : "";
            log.info("Win streak: " + consecutiveWins + note);
        }
    }

    function handleLoss() {
        totalProfit -= currentBet; totalLosses++;
        log.error("LOSS -" + fmt(currentBet) + " | Total profit: " + fmt(totalProfit));
        if (inRecovery) {
            recoverySteps++;
            if (maxRecoverySteps > 0 && recoverySteps >= maxRecoverySteps) {
                log.error("Recovery reached max steps (" + maxRecoverySteps + "). Resetting.");
                resetState(); return;
            }
            sequence.push(currentBet);
            log.info("Recovery loss -> appended " + fmt(currentBet) + ". Sequence: [" + seqStr() + "]");
        } else {
            consecutiveWins = 0; consecutiveLosses++;
            if (consecutiveLosses >= recoveryThreshold) {
                inRecovery = true; recoverySteps = 0; sequence = [];
                for (var i = 0; i < consecutiveLosses; i++) { sequence.push(initBet); }
                log.info(consecutiveLosses + " consecutive losses -> Recovery activated. Sequence: [" + seqStr() + "]");
            }
        }
    }

    if (!validateConfig()) { return; }

    game.onBet = function () {
        if (isStopped) return;
        if (checkStop(currentBet)) { logFinalStats(); isStopped = true; game.stop(); return; }
        if (currentBet > maxBet || currentBet < minBet) {
            log.error("Bet " + fmt(currentBet) + " out of range. Stopping.");
            logFinalStats(); isStopped = true; game.stop(); return;
        }
        logStart(totalGames + 1);
        game.bet(currentBet, cashoutMult).then(function (result) {
            if (isStopped) return;
            totalGames++;
            if (result >= cashoutMult) { handleWin(); } else { handleLoss(); }
            if (isStopped) return;
            currentBet = Math.max(calcNextBet(), minBet);
            if (currentBet > maxBet) {
                log.error("Next bet " + fmt(currentBet) + " exceeds max. Stopping.");
                logFinalStats(); isStopped = true; game.stop(); return;
            }
            if (checkStop(currentBet)) { logFinalStats(); isStopped = true; game.stop(); return; }
            log.info("Next bet: " + fmt(currentBet) + " | Sequence: [" + seqStr() + "]");
        }).catch(function (err) {
            log.error("Bet error on game #" + (totalGames + 1) + ": " + err);
            logFinalStats(); isStopped = true; game.stop();
        });
    };
}
