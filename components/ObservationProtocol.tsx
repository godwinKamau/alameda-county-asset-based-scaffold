"use client";

import { useMemo, useState } from "react";
import type { PldLevel } from "@/lib/elpac/types";
import {
  deriveObservationLevel,
  deriveProtocolFromPlds,
  type ObservedFrequency,
  type ObservationInput,
} from "@/lib/elpac/observation";
import { btnPrimaryClassName, labelClassName } from "@/lib/ui/styles";

const FREQUENCY_OPTIONS: { value: ObservedFrequency; label: string }[] = [
  { value: "not_observed", label: "Not observed" },
  { value: "sometimes", label: "Sometimes" },
  { value: "usually", label: "Usually" },
  { value: "consistently", label: "Consistently" },
];

interface ObservationProtocolProps {
  plds: Record<"1" | "2" | "3" | "4", PldLevel>;
  onChange: (payload: {
    observations: ObservationInput[];
    derivedLevel: number | null;
    coverageRatio: number;
    confidence: string;
    ready: boolean;
  }) => void;
}

export function ObservationProtocol({ plds, onChange }: ObservationProtocolProps) {
  const protocol = useMemo(() => deriveProtocolFromPlds(plds), [plds]);
  const [observations, setObservations] = useState<ObservationInput[]>(() =>
    protocol.map((descriptor) => ({
      level: descriptor.level,
      index: descriptor.index,
      observed: "not_observed" as ObservedFrequency,
    })),
  );
  const [contextNote, setContextNote] = useState("");

  const result = useMemo(
    () => deriveObservationLevel(protocol, observations),
    [protocol, observations],
  );

  function updateObservation(
    level: number,
    index: number,
    observed: ObservedFrequency,
  ) {
    setObservations((current) => {
      const next = current.map((item) =>
        item.level === level && item.index === index
          ? { ...item, observed }
          : item,
      );
      const derived = deriveObservationLevel(protocol, next);
      onChange({
        observations: next,
        derivedLevel: derived.level,
        coverageRatio: derived.coverageRatio,
        confidence: derived.confidence,
        ready: derived.level != null,
      });
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-soft bg-brand-soft/20 p-4">
        <p className="text-sm font-medium text-brand-dark">
          Listening observation protocol
        </p>
        <p className="mt-1 text-xs text-muted">
          After a normal listening activity, check off descriptors the student
          demonstrated. Coverage: {Math.round(result.coverageRatio * 100)}%.
        </p>
        <p className="mt-2 text-sm text-brand-dark">
          Derived level:{" "}
          {result.level != null ? (
            <span className="font-semibold">{result.level}</span>
          ) : (
            <span className="text-muted">
              {result.reason === "insufficient_coverage"
                ? "Check more descriptors to derive a level"
                : "—"}
            </span>
          )}
        </p>
      </div>

      {[1, 2, 3, 4].map((level) => (
        <section
          key={level}
          className="rounded-xl border border-brand-soft/80 bg-white p-4"
        >
          <h3 className="text-sm font-semibold text-brand-dark">
            Level {level}
          </h3>
          <ul className="mt-3 space-y-3">
            {protocol
              .filter((descriptor) => descriptor.level === level)
              .map((descriptor) => {
                const current = observations.find(
                  (item) =>
                    item.level === descriptor.level &&
                    item.index === descriptor.index,
                );
                return (
                  <li key={`${descriptor.level}-${descriptor.index}`}>
                    <p className="text-sm text-brand-dark">{descriptor.text}</p>
                    <select
                      className="mt-2 w-full rounded-lg border border-brand-soft px-3 py-2 text-sm"
                      value={current?.observed ?? "not_observed"}
                      onChange={(event) =>
                        updateObservation(
                          descriptor.level,
                          descriptor.index,
                          event.target.value as ObservedFrequency,
                        )
                      }
                    >
                      {FREQUENCY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      <div>
        <label htmlFor="observation_context" className={labelClassName}>
          Activity context (optional)
        </label>
        <textarea
          id="observation_context"
          value={contextNote}
          onChange={(event) => setContextNote(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-xl border border-brand-soft px-3 py-2 text-sm"
        />
      </div>

      <button
        type="button"
        className={btnPrimaryClassName}
        disabled={result.level == null}
        onClick={() =>
          onChange({
            observations,
            derivedLevel: result.level,
            coverageRatio: result.coverageRatio,
            confidence: result.confidence,
            ready: result.level != null,
          })
        }
      >
        Continue with derived level {result.level ?? ""}
      </button>
    </div>
  );
}
