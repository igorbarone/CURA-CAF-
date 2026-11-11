"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatClock,
  formatNumber,
  timerPosition,
  type TimedStep,
} from "../../lib/experience/brew";
import { trackExperience } from "../../lib/experience/analytics";

type Status = "idle" | "running" | "paused" | "done";

function beep() {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.4);
    oscillator.onended = () => context.close();
  } catch {
    /* sound is optional */
  }
}

/**
 * Brew timer. Elapsed time is derived from timestamps (not from counting
 * ticks), so it stays correct when the browser throttles a background tab.
 */
export function BrewTimer({
  schedule,
  totalSeconds,
  methodId,
  onStepChange,
  onFinish,
}: {
  schedule: TimedStep[];
  totalSeconds: number;
  methodId: string;
  onStepChange?: (index: number) => void;
  onFinish?: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [sound, setSound] = useState(false);
  const [alert, setAlert] = useState("");
  const startedAt = useRef(0);
  const offset = useRef(0);
  const lastStep = useRef(-1);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const reset = useCallback(() => {
    setStatus("idle");
    setElapsed(0);
    setAlert("");
    offset.current = 0;
    lastStep.current = -1;
    onStepChange?.(-1);
  }, [onStepChange]);
  // A new recipe (other method or amounts) restarts the timer.
  useEffect(() => reset(), [schedule, reset]);

  useEffect(() => {
    if (status !== "running") return;
    const tick = () => {
      const seconds = offset.current + (Date.now() - startedAt.current) / 1000;
      setElapsed(Math.min(seconds, totalSeconds));
      const { current, step } = timerPosition(schedule, Math.floor(seconds));
      if (current !== lastStep.current && step) {
        lastStep.current = current;
        onStepChange?.(current);
        setAlert(
          `${formatClock(step.at)} · ${step.title}${step.targetGrams ? `: até ${formatNumber(step.targetGrams)} g` : ""}`,
        );
        if (soundRef.current) {
          beep();
          navigator.vibrate?.(150);
        }
      }
      if (seconds >= totalSeconds) {
        setStatus("done");
        setAlert("Tempo concluído. Hora de degustar!");
        if (soundRef.current) beep();
        trackExperience("tutorial_complete", {
          method: methodId,
          via: "timer",
        });
        onFinish?.();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [status, schedule, totalSeconds, methodId, onStepChange, onFinish]);

  const { step, next, secondsToNext } = timerPosition(
    schedule,
    Math.floor(elapsed),
  );
  const progress = totalSeconds ? elapsed / totalSeconds : 0;
  const circumference = 2 * Math.PI * 54;
  return (
    <div className={`xp-timer is-${status}`}>
      <div className="xp-timer-dial">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="54" className="xp-timer-track" />
          {schedule.map((item) => {
            const angle = (item.at / totalSeconds) * Math.PI * 2 - Math.PI / 2;
            return (
              <circle
                key={`${item.at}-${item.title}`}
                cx={60 + 54 * Math.cos(angle)}
                cy={60 + 54 * Math.sin(angle)}
                r="3"
                className={
                  item.at <= elapsed ? "xp-timer-mark is-past" : "xp-timer-mark"
                }
              />
            );
          })}
          <circle
            cx="60"
            cy="60"
            r="54"
            className="xp-timer-progress"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>
        <div className="xp-timer-readout">
          <span className="xp-timer-clock mono" role="timer" aria-live="off">
            {formatClock(elapsed)}
          </span>
          <span className="mono xp-timer-total">
            de {formatClock(totalSeconds)}
          </span>
        </div>
      </div>
      <div className="xp-timer-info">
        <p className="xp-timer-now">
          {status === "idle" ? (
            "Prepare tudo e toque em iniciar no primeiro despejo."
          ) : step ? (
            <>
              <strong>{step.title}</strong>
              {step.targetGrams
                ? ` · até ${formatNumber(step.targetGrams)} g`
                : ""}
            </>
          ) : null}
        </p>
        {next && status !== "done" && (
          <p className="xp-timer-next mono">
            Próximo: {next.title}
            {next.targetGrams
              ? ` (${formatNumber(next.targetGrams)} g)`
              : ""}{" "}
            em {formatClock(secondsToNext ?? 0)}
          </p>
        )}
        <p className="xp-visually-hidden" role="status" aria-live="assertive">
          {alert}
        </p>
        {alert && status !== "idle" && (
          <p className="xp-timer-alert" key={alert} aria-hidden="true">
            {alert}
          </p>
        )}
        <div className="xp-timer-controls">
          {status === "running" ? (
            <button
              type="button"
              className="button"
              onClick={() => {
                offset.current += (Date.now() - startedAt.current) / 1000;
                setStatus("paused");
              }}
            >
              Pausar
            </button>
          ) : (
            <button
              type="button"
              className="button"
              disabled={status === "done"}
              onClick={() => {
                startedAt.current = Date.now();
                if (status === "idle")
                  trackExperience("timer_start", { method: methodId });
                setStatus("running");
              }}
            >
              {status === "paused" ? "Continuar" : "Iniciar"}
            </button>
          )}
          <button
            type="button"
            className="xp-button-ghost"
            onClick={reset}
            disabled={status === "idle"}
          >
            Reiniciar
          </button>
          <label className="xp-toggle">
            <input
              type="checkbox"
              checked={sound}
              onChange={(event) => setSound(event.target.checked)}
            />
            <span>Som nos avisos</span>
          </label>
        </div>
      </div>
    </div>
  );
}
