"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  filterSubjectSuggestions,
  matchExistingSubject,
} from "@/lib/roster/subject";

interface SubjectInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  existingSubjects: string[];
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  onBlurCanonicalize?: boolean;
}

export function SubjectInput({
  id,
  name,
  value,
  onChange,
  existingSubjects,
  placeholder = "e.g. ELA - Period 3",
  maxLength = 80,
  disabled = false,
  className,
  inputClassName,
  onBlurCanonicalize = true,
}: SubjectInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-suggestions`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const suggestions = useMemo(
    () => filterSubjectSuggestions(value, existingSubjects),
    [value, existingSubjects],
  );

  useEffect(() => {
    setHighlightIndex(-1);
  }, [value, suggestions.length]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectSuggestion(subject: string) {
    onChange(subject);
    setIsOpen(false);
    setHighlightIndex(-1);
  }

  function canonicalizeValue() {
    if (!onBlurCanonicalize || !value.trim()) return;
    const matched = matchExistingSubject(value, existingSubjects);
    if (matched !== value) {
      onChange(matched);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      if (suggestions.length > 0) {
        setIsOpen(true);
        setHighlightIndex(0);
        event.preventDefault();
      }
      return;
    }

    if (!isOpen || suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((current) =>
        current < suggestions.length - 1 ? current + 1 : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((current) =>
        current > 0 ? current - 1 : suggestions.length - 1,
      );
    } else if (event.key === "Enter" && highlightIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[highlightIndex]);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setHighlightIndex(-1);
    }
  }

  const showSuggestions = isOpen && suggestions.length > 0 && !disabled;

  return (
    <div ref={containerRef} className={className ?? "relative"}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (existingSubjects.length > 0) setIsOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            canonicalizeValue();
            setIsOpen(false);
          }, 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={showSuggestions ? listboxId : undefined}
        aria-autocomplete="list"
        className={
          inputClassName ??
          "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        }
      />
      {showSuggestions ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((subject, index) => (
            <li
              key={subject}
              role="option"
              aria-selected={index === highlightIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(subject)}
              onMouseEnter={() => setHighlightIndex(index)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === highlightIndex
                  ? "bg-blue-50 text-blue-900"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {subject}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
