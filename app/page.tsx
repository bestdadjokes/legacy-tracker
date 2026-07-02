"use client";

import { useState, type FormEvent } from "react";
import { Section, SectionLabel } from "@/components/section";
import { Reveal } from "@/components/reveal";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function TrackingPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please email us directly.");
    }
  }

  return (
    <>
      <section className="pt-36 pb-16 px-6">
        <div className="mx-auto max-w-4xl">
          <SectionLabel>Weekly Wellness</SectionLabel>
          <Reveal>
            <h1 className="text-4xl md:text-[48px] font-normal tracking-tight leading-[1.08]">
              Wellness Tracker
            </h1>
          </Reveal>
          <Reveal>
            <p className="mt-4 text-cream/40 leading-[1.8] text-[15px] max-w-lg">
              Complete this tracker each week. It gives Ali a clear picture of
              your nutrition, movement, sleep, and energy so your coaching stays
              dialed in.
            </p>
          </Reveal>
        </div>
      </section>

      <Section>
        <div className="max-w-4xl mx-auto">
          {submitted ? (
            <Reveal>
              <div className="bg-surface-light border border-lime/10 p-10">
                <h2 className="text-2xl font-normal text-lime">
                  Tracker Submitted
                </h2>
                <p className="mt-4 text-cream/40 leading-[1.7] text-[15px]">
                  Ali will review your data before your next session. No further
                  action needed.
                </p>
              </div>
            </Reveal>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-10">
              {/*
                Honeypot: hidden from real users but visible to naive bots that
                fill every field. The server silently drops any submission where
                this is non-empty. This is only cheap deterrence — a rate limiter
                (KV/Upstash) or Turnstile is the real fix for this public,
                unauthenticated endpoint.
              */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "-9999px",
                  width: "1px",
                  height: "1px",
                  overflow: "hidden",
                }}
              >
                <label htmlFor="company">Company (leave blank)</label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Cover Fields */}
              <div className="grid md:grid-cols-2 gap-5">
                <Field
                  label="Client Name"
                  name="clientName"
                  required
                  placeholder="Your name"
                />
                <Field
                  label="Week Of"
                  name="weekOf"
                  required
                  placeholder="e.g. May 19–25, 2026"
                />
              </div>

              {/* Days */}
              {DAYS.map((day) => (
                <DaySection key={day} day={day} />
              ))}

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                className="w-full px-8 py-4 bg-lime text-background text-[13px] font-normal tracking-[0.1em] uppercase hover:bg-lime-dark transition-colors duration-200"
              >
                Submit Tracker &rarr;
              </button>
            </form>
          )}
        </div>
      </Section>
    </>
  );
}

function DaySection({ day }: { day: string }) {
  const id = day.toLowerCase();

  return (
    <fieldset className="bg-surface-light p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <legend className="text-[13px] tracking-[0.2em] uppercase text-lime font-normal">
          {day}
        </legend>
        <Field
          label=""
          name={`${id}-date`}
          type="date"
          className="w-40"
          compact
        />
      </div>

      {/* Meals */}
      <div>
        <h3 className="text-[11px] tracking-[0.15em] uppercase text-gray-mid mb-3">
          Meals
        </h3>
        <div className="space-y-4">
          <MealEntry id={id} meal="breakfast" label="Breakfast" />
          <MealEntry id={id} meal="lunch" label="Lunch" />
          <MealEntry id={id} meal="dinner" label="Dinner" />
        </div>
      </div>

      {/* Snacks */}
      <div>
        <h3 className="text-[11px] tracking-[0.15em] uppercase text-gray-mid mb-3">
          Snacks
        </h3>
        <div className="space-y-4">
          <MealEntry id={id} meal="snack1" label="Snack 1" placeholder="e.g. apple & almond butter" />
          <MealEntry id={id} meal="snack2" label="Snack 2" placeholder="e.g. protein bar, Greek yogurt" />
        </div>
      </div>

      {/* Beverages */}
      <div>
        <h3 className="text-[11px] tracking-[0.15em] uppercase text-gray-mid mb-3">
          Beverages
        </h3>
        <div className="grid md:grid-cols-3 gap-3">
          <Field name={`${id}-water`} label="" placeholder="Water (oz) — e.g. 80 oz" compact />
          <Field name={`${id}-caffeine`} label="" placeholder="Caffeine — e.g. 2 coffees" compact />
          <Field name={`${id}-other-bev`} label="" placeholder="Other (incl. alcohol)" compact />
        </div>
      </div>

      {/* Daily Macros Total */}
      <div>
        <h3 className="text-[11px] tracking-[0.15em] uppercase text-gray-mid mb-3">
          Daily Macro Totals (including beverages)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field name={`${id}-calories`} label="" placeholder="Calories" compact />
          <Field name={`${id}-protein`} label="" placeholder="Protein (g)" compact />
          <Field name={`${id}-carbs`} label="" placeholder="Carbs (g)" compact />
          <Field name={`${id}-fat`} label="" placeholder="Fat (g)" compact />
        </div>
      </div>

      {/* Sleep & Energy */}
      <div>
        <h3 className="text-[11px] tracking-[0.15em] uppercase text-gray-mid mb-3">
          Sleep & Energy
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field name={`${id}-sleep-hrs`} label="" placeholder="Sleep (hrs) — e.g. 7.5" compact />
          <Field name={`${id}-steps`} label="" placeholder="Steps — e.g. 8,450" compact />
          <RangeField name={`${id}-sleep-quality`} label="Sleep Quality" />
          <RangeField name={`${id}-energy`} label="Energy Level" />
        </div>
      </div>

      {/* Workout */}
      <div>
        <h3 className="text-[11px] tracking-[0.15em] uppercase text-gray-mid mb-3">
          Workout
        </h3>
        <div className="space-y-3">
          <TextArea
            name={`${id}-workout-type`}
            placeholder="Type / Description — e.g. Upper body – bench press, rows, shoulder press..."
          />
          <Field
            name={`${id}-workout-intensity`}
            label=""
            placeholder="Duration & Intensity — e.g. 55 min · moderate-high · RPE 7"
            compact
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <h3 className="text-[11px] tracking-[0.15em] uppercase text-gray-mid mb-3">
          Notes
        </h3>
        <TextArea
          name={`${id}-notes`}
          placeholder="Energy levels, mood, stress, wins, struggles, anything worth noting..."
        />
      </div>
    </fieldset>
  );
}

function MealEntry({
  id,
  meal,
  label,
  placeholder,
}: {
  id: string;
  meal: string;
  label: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <TextArea
        name={`${id}-${meal}`}
        placeholder={placeholder ?? `${label} — What did you eat?`}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Field name={`${id}-${meal}-cal`} label="" placeholder="Calories" compact />
        <Field name={`${id}-${meal}-protein`} label="" placeholder="Protein (g)" compact />
        <Field name={`${id}-${meal}-carbs`} label="" placeholder="Carbs (g)" compact />
        <Field name={`${id}-${meal}-fat`} label="" placeholder="Fat (g)" compact />
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  className = "",
  compact = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={name}
          className="block text-[11px] tracking-[0.15em] uppercase text-gray-mid mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        type={type}
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        className={`w-full bg-[#1c1c1c] border border-white/5 px-3 ${
          compact ? "py-2 text-[13px]" : "py-3 text-[15px]"
        } text-cream placeholder:text-gray-mid/30 focus:outline-none focus:border-lime/30 transition-colors duration-200`}
      />
    </div>
  );
}

function TextArea({
  name,
  placeholder,
}: {
  name: string;
  placeholder?: string;
}) {
  return (
    <textarea
      id={name}
      name={name}
      rows={2}
      placeholder={placeholder}
      className="w-full bg-[#1c1c1c] border border-white/5 px-3 py-2 text-[13px] text-cream placeholder:text-gray-mid/30 focus:outline-none focus:border-lime/30 transition-colors duration-200 resize-none"
    />
  );
}

function RangeField({ name, label }: { name: string; label: string }) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[11px] tracking-[0.1em] text-gray-mid/60 mb-1.5"
      >
        {label} (1–10)
      </label>
      <select
        id={name}
        name={name}
        className="w-full bg-[#1c1c1c] border border-white/5 px-3 py-2 text-[13px] text-cream focus:outline-none focus:border-lime/30 transition-colors duration-200"
      >
        <option value="">—</option>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  );
}
