"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
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
] as const;

function getWeekMonday(offset = 0): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff + offset * 7);
  // Format from local date parts — toISOString() converts to UTC, which
  // rolled the week key to Tuesday for sessions after 8pm ET.
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${monday.getFullYear()}-${m}-${d}`;
}

function isPreview() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

export default function TrackingPage() {
  const preview = isPreview();

  const [email, setEmail] = useState(preview ? "preview@test.com" : "");
  const [clientName, setClientName] = useState(preview ? "Preview" : "");
  const [identified, setIdentified] = useState(preview);
  const [activeDay, setActiveDay] = useState(0);
  const [data, setData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rowId, setRowId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [unsubmittedWeeks, setUnsubmittedWeeks] = useState<string[]>([]);

  const weekOf = getWeekMonday(weekOffset);
  const isCurrentWeek = weekOffset === 0;

  // Load existing data for this email + week
  const loadData = useCallback(async (em: string) => {
    setLoading(true);
    setData({});
    setRowId(null);
    setSubmitted(false);

    const { data: rows, error: err } = await supabase
      .from("tracker_weeks")
      .select("*")
      .eq("email", em.toLowerCase().trim())
      .eq("week_of", weekOf)
      .limit(1);

    if (err) {
      console.error(err);
      setLoading(false);
      return;
    }

    if (rows && rows.length > 0) {
      const row = rows[0];
      setData(row.data || {});
      setRowId(row.id);
      if (row.data?.clientName) setClientName(row.data.clientName);
      if (row.submitted) setSubmitted(true);
    }
    setLoading(false);
  }, [weekOf]);

  // Check for unsubmitted previous weeks
  const checkUnsubmitted = useCallback(async (em: string) => {
    const { data: rows } = await supabase
      .from("tracker_weeks")
      .select("week_of")
      .eq("email", em.toLowerCase().trim())
      .eq("submitted", false)
      .lt("week_of", getWeekMonday(0))
      .order("week_of", { ascending: false });

    if (rows && rows.length > 0) {
      setUnsubmittedWeeks(rows.map((r: { week_of: string }) => r.week_of));
    }
  }, []);

  // Auto-save to Supabase (debounced via caller)
  const saveData = useCallback(async (currentData: Record<string, string>) => {
    if (!email || submitted) return;

    setSaving(true);
    const payload = {
      email: email.toLowerCase().trim(),
      week_of: weekOf,
      data: { ...currentData, clientName },
      updated_at: new Date().toISOString(),
    };

    if (rowId) {
      await supabase.from("tracker_weeks").update(payload).eq("id", rowId);
    } else {
      const { data: inserted } = await supabase
        .from("tracker_weeks")
        .upsert(payload, { onConflict: "email,week_of" })
        .select("id")
        .single();
      if (inserted) setRowId(inserted.id);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [email, weekOf, rowId, submitted]);

  // Reload data when week changes
  useEffect(() => {
    if (identified && email) {
      loadData(email);
    }
  }, [weekOf, identified, email, loadData]);

  // Debounced save
  useEffect(() => {
    if (!identified || Object.keys(data).length === 0) return;
    const timer = setTimeout(() => saveData(data), 1500);
    return () => clearTimeout(timer);
  }, [data, identified, saveData]);

  function handleFieldChange(name: string, value: string) {
    setData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleIdentify(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !clientName.trim()) return;
    setIdentified(true);
    await loadData(email);
    checkUnsubmitted(email);
  }

  async function handleSubmit() {
    setError("");
    if (!rowId) return;

    // Mark as submitted in Supabase
    await supabase
      .from("tracker_weeks")
      .update({ submitted: true, data })
      .eq("id", rowId);

    // Send email notification via existing API
    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, clientName, clientEmail: email, weekOf }),
      });
      if (!res.ok) throw new Error("Email failed");
    } catch {
      // Submission saved to DB even if email fails
      console.error("Email notification failed, but data is saved");
    }

    setSubmitted(true);
    setUnsubmittedWeeks((prev) => prev.filter((w) => w !== weekOf));
  }

  // Count filled fields per day
  function dayHasData(day: string): boolean {
    const id = day.toLowerCase();
    return Object.keys(data).some((k) => k.startsWith(id) && data[k]?.trim());
  }

  // Email entry screen
  if (!identified) {
    return (
      <>
        <section className="pt-36 pb-16 px-6">
          <div className="mx-auto max-w-md">
            <SectionLabel>Weekly Wellness</SectionLabel>
            <Reveal>
              <h1 className="text-4xl md:text-[48px] font-normal tracking-tight leading-[1.08]">
                Your Weekly Tracker
              </h1>
            </Reveal>
            <Reveal>
              <p className="mt-4 text-cream/60 leading-[1.8] text-[15px]">
                Log your nutrition, movement, sleep, and energy each day. The
                more consistent you are, the more Ali can dial in your coaching.
              </p>
            </Reveal>
            <Reveal>
              <form onSubmit={handleIdentify} className="mt-10 space-y-4">
                <div>
                  <label
                    htmlFor="clientName"
                    className="block text-[11px] tracking-[0.15em] uppercase text-gray-mid mb-1.5"
                  >
                    Your Name
                  </label>
                  <input
                    type="text"
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                    placeholder="Your name"
                    className="w-full bg-[#1c1c1c] border border-white/5 px-4 py-3 text-[15px] text-cream placeholder:text-gray-mid/50 focus:outline-none focus:border-lime/30 transition-colors duration-200"
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block text-[11px] tracking-[0.15em] uppercase text-gray-mid mb-1.5"
                  >
                    Your Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full bg-[#1c1c1c] border border-white/5 px-4 py-3 text-[15px] text-cream placeholder:text-gray-mid/50 focus:outline-none focus:border-lime/30 transition-colors duration-200"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-8 py-4 bg-lime text-background text-[13px] font-normal tracking-[0.1em] uppercase hover:bg-lime-dark transition-colors duration-200"
                >
                  Open Tracker &rarr;
                </button>
              </form>
            </Reveal>
          </div>
        </section>
      </>
    );
  }

  // Loading state
  if (loading) {
    return (
      <section className="pt-36 pb-16 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-cream/60 text-[15px]">Loading your tracker...</p>
        </div>
      </section>
    );
  }

  // Submitted state
  if (submitted) {
    return (
      <section className="pt-36 pb-16 px-6">
        <div className="mx-auto max-w-md">
          <Reveal>
            <div className="bg-surface-light border border-lime/10 p-10">
              <h2 className="text-2xl font-normal text-lime">
                Tracker Submitted
              </h2>
              <p className="mt-4 text-cream/60 leading-[1.7] text-[15px]">
                Ali will review everything before your next session. Great work
                showing up for yourself.
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    );
  }

  const currentDay = DAYS[activeDay];
  const id = currentDay.toLowerCase();

  return (
    <>
      <section className="pt-36 pb-4 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <SectionLabel>Weekly Wellness</SectionLabel>
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => setWeekOffset((n) => n - 1)}
                  className="text-cream/40 hover:text-lime transition-colors duration-200 text-lg"
                  aria-label="Previous week"
                >
                  &larr;
                </button>
                <h1 className="text-2xl md:text-3xl font-normal tracking-tight leading-[1.08]">
                  {new Date(weekOf + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </h1>
                <button
                  onClick={() => setWeekOffset((n) => n + 1)}
                  disabled={isCurrentWeek}
                  className={`text-lg transition-colors duration-200 ${
                    isCurrentWeek
                      ? "text-cream/10 cursor-not-allowed"
                      : "text-cream/40 hover:text-lime"
                  }`}
                  aria-label="Next week"
                >
                  &rarr;
                </button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-cream/40">{clientName}</p>
              {saving && (
                <p className="text-[11px] text-lime/60 mt-1">Saving...</p>
              )}
              {saved && !saving && (
                <p className="text-[11px] text-lime mt-1">Saved</p>
              )}
            </div>
          </div>

          {/* Unsubmitted previous weeks banner */}
          {isCurrentWeek && unsubmittedWeeks.length > 0 && (
            <div className="mt-4 bg-lime/5 border border-lime/20 px-4 py-3 flex items-center justify-between">
              <p className="text-[13px] text-cream/70">
                You have an unsubmitted week ({new Date(unsubmittedWeeks[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })})
              </p>
              <button
                onClick={() => {
                  const currentMonday = getWeekMonday(0);
                  const diff = (new Date(currentMonday).getTime() - new Date(unsubmittedWeeks[0]).getTime()) / (7 * 24 * 60 * 60 * 1000);
                  setWeekOffset(-Math.round(diff));
                }}
                className="text-[12px] tracking-[0.1em] uppercase text-lime hover:text-lime-dark transition-colors duration-200"
              >
                View &amp; Submit &rarr;
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Day Tabs */}
      <section className="px-6 pb-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {DAYS.map((day, i) => (
              <button
                key={day}
                onClick={() => setActiveDay(i)}
                className={`relative flex-1 min-w-[44px] py-3 text-[11px] md:text-[12px] tracking-[0.1em] uppercase transition-colors duration-200 ${
                  i === activeDay
                    ? "bg-lime text-background"
                    : dayHasData(day)
                      ? "bg-surface-light text-lime border border-lime/20"
                      : "bg-surface-light text-cream/40 hover:text-cream/60"
                }`}
              >
                <span className="hidden md:inline">{day.slice(0, 3)}</span>
                <span className="md:hidden">{day.slice(0, 1)}</span>
                {dayHasData(day) && i !== activeDay && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-lime rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Active Day Form */}
      <Section>
        <div className="max-w-4xl mx-auto">
          <fieldset className="bg-surface-light p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <legend className="text-[13px] tracking-[0.2em] uppercase text-lime font-normal">
                {currentDay}
              </legend>
              <TrackerField
                value={data[`${id}-date`] || ""}
                onChange={(v) => handleFieldChange(`${id}-date`, v)}
                type="date"
                className="w-40"
                compact
              />
            </div>

            {/* Meals */}
            <div>
              <h3 className="text-[11px] tracking-[0.15em] uppercase text-cream/60 mb-3">
                Meals
              </h3>
              <div className="space-y-4">
                <MealEntry id={id} meal="breakfast" label="Breakfast" data={data} onChange={handleFieldChange} />
                <MealEntry id={id} meal="lunch" label="Lunch" data={data} onChange={handleFieldChange} />
                <MealEntry id={id} meal="dinner" label="Dinner" data={data} onChange={handleFieldChange} />
              </div>
            </div>

            {/* Snacks */}
            <div>
              <h3 className="text-[11px] tracking-[0.15em] uppercase text-cream/60 mb-3">
                Snacks
              </h3>
              <div className="space-y-4">
                <MealEntry id={id} meal="snack1" label="Snack 1" placeholder="e.g. apple & almond butter" data={data} onChange={handleFieldChange} />
                <MealEntry id={id} meal="snack2" label="Snack 2" placeholder="e.g. protein bar, Greek yogurt" data={data} onChange={handleFieldChange} />
              </div>
            </div>

            {/* Beverages */}
            <div>
              <h3 className="text-[11px] tracking-[0.15em] uppercase text-cream/60 mb-3">
                Beverages
              </h3>
              <div className="grid md:grid-cols-3 gap-3">
                <TrackerField value={data[`${id}-water`] || ""} onChange={(v) => handleFieldChange(`${id}-water`, v)} placeholder="Water (oz) — e.g. 80 oz" compact />
                <TrackerField value={data[`${id}-caffeine`] || ""} onChange={(v) => handleFieldChange(`${id}-caffeine`, v)} placeholder="Caffeine — e.g. 2 coffees" compact />
                <TrackerField value={data[`${id}-other-bev`] || ""} onChange={(v) => handleFieldChange(`${id}-other-bev`, v)} placeholder="Other (incl. alcohol)" compact />
              </div>
            </div>

            {/* Daily Macros Total */}
            <div>
              <h3 className="text-[11px] tracking-[0.15em] uppercase text-cream/60 mb-3">
                Daily Macro Totals (including beverages)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <TrackerField value={data[`${id}-calories`] || ""} onChange={(v) => handleFieldChange(`${id}-calories`, v)} placeholder="Calories" compact />
                <TrackerField value={data[`${id}-protein`] || ""} onChange={(v) => handleFieldChange(`${id}-protein`, v)} placeholder="Protein (g)" compact />
                <TrackerField value={data[`${id}-carbs`] || ""} onChange={(v) => handleFieldChange(`${id}-carbs`, v)} placeholder="Carbs (g)" compact />
                <TrackerField value={data[`${id}-fat`] || ""} onChange={(v) => handleFieldChange(`${id}-fat`, v)} placeholder="Fat (g)" compact />
              </div>
            </div>

            {/* Sleep & Energy */}
            <div>
              <h3 className="text-[11px] tracking-[0.15em] uppercase text-cream/60 mb-3">
                Sleep & Energy
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <TrackerField value={data[`${id}-sleep-hrs`] || ""} onChange={(v) => handleFieldChange(`${id}-sleep-hrs`, v)} placeholder="Sleep (hrs) — e.g. 7.5" compact />
                <TrackerField value={data[`${id}-steps`] || ""} onChange={(v) => handleFieldChange(`${id}-steps`, v)} placeholder="Steps — e.g. 8,450" compact />
                <RangeField value={data[`${id}-sleep-quality`] || ""} onChange={(v) => handleFieldChange(`${id}-sleep-quality`, v)} label="Sleep Quality" />
                <RangeField value={data[`${id}-energy`] || ""} onChange={(v) => handleFieldChange(`${id}-energy`, v)} label="Energy Level" />
              </div>
            </div>

            {/* Workout */}
            <div>
              <h3 className="text-[11px] tracking-[0.15em] uppercase text-cream/60 mb-3">
                Workout
              </h3>
              <div className="space-y-3">
                <TrackerTextArea value={data[`${id}-workout-type`] || ""} onChange={(v) => handleFieldChange(`${id}-workout-type`, v)} placeholder="Type / Description — e.g. Upper body – bench press, rows, shoulder press..." />
                <TrackerField value={data[`${id}-workout-intensity`] || ""} onChange={(v) => handleFieldChange(`${id}-workout-intensity`, v)} placeholder="Duration & Intensity — e.g. 55 min · moderate-high · RPE 7" compact />
              </div>
            </div>

            {/* Notes */}
            <div>
              <h3 className="text-[11px] tracking-[0.15em] uppercase text-cream/60 mb-3">
                Notes
              </h3>
              <TrackerTextArea value={data[`${id}-notes`] || ""} onChange={(v) => handleFieldChange(`${id}-notes`, v)} placeholder="Energy levels, mood, stress, wins, struggles, anything worth noting..." />
            </div>
          </fieldset>

          {/* Day Navigation */}
          <div className="flex gap-3 mt-6">
            {activeDay > 0 && (
              <button
                onClick={() => setActiveDay(activeDay - 1)}
                className="flex-1 px-6 py-3 border border-white/10 text-[13px] tracking-[0.1em] uppercase text-cream/60 hover:text-cream transition-colors duration-200"
              >
                &larr; {DAYS[activeDay - 1]}
              </button>
            )}
            {activeDay < 6 ? (
              <button
                onClick={() => setActiveDay(activeDay + 1)}
                className="flex-1 px-6 py-3 bg-surface-light text-[13px] tracking-[0.1em] uppercase text-cream hover:bg-lime/10 transition-colors duration-200"
              >
                {DAYS[activeDay + 1]} &rarr;
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex-1 px-6 py-4 bg-lime text-background text-[13px] font-normal tracking-[0.1em] uppercase hover:bg-lime-dark transition-colors duration-200"
              >
                Submit Week &rarr;
              </button>
            )}
          </div>

          {/* Submit always visible after filling some days */}
          {activeDay < 6 && Object.keys(data).length > 5 && (
            <button
              onClick={handleSubmit}
              className="w-full mt-3 px-6 py-3 border border-lime/20 text-[12px] tracking-[0.1em] uppercase text-lime/60 hover:text-lime hover:border-lime/40 transition-colors duration-200"
            >
              Submit Week Early
            </button>
          )}

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </div>
      </Section>
    </>
  );
}

function MealEntry({
  id,
  meal,
  label,
  placeholder,
  data,
  onChange,
}: {
  id: string;
  meal: string;
  label: string;
  placeholder?: string;
  data: Record<string, string>;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <TrackerTextArea
        value={data[`${id}-${meal}`] || ""}
        onChange={(v) => onChange(`${id}-${meal}`, v)}
        placeholder={placeholder ?? `${label} — What did you eat?`}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <TrackerField value={data[`${id}-${meal}-cal`] || ""} onChange={(v) => onChange(`${id}-${meal}-cal`, v)} placeholder="Calories" compact />
        <TrackerField value={data[`${id}-${meal}-protein`] || ""} onChange={(v) => onChange(`${id}-${meal}-protein`, v)} placeholder="Protein (g)" compact />
        <TrackerField value={data[`${id}-${meal}-carbs`] || ""} onChange={(v) => onChange(`${id}-${meal}-carbs`, v)} placeholder="Carbs (g)" compact />
        <TrackerField value={data[`${id}-${meal}-fat`] || ""} onChange={(v) => onChange(`${id}-${meal}-fat`, v)} placeholder="Fat (g)" compact />
      </div>
    </div>
  );
}

function TrackerField({
  value,
  onChange,
  type = "text",
  placeholder,
  className = "",
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={className}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-[#1c1c1c] border border-white/5 px-3 ${
          compact ? "py-2 text-[13px]" : "py-3 text-[15px]"
        } text-cream placeholder:text-gray-mid/50 focus:outline-none focus:border-lime/30 transition-colors duration-200`}
      />
    </div>
  );
}

function TrackerTextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      placeholder={placeholder}
      className="w-full bg-[#1c1c1c] border border-white/5 px-3 py-2 text-[13px] text-cream placeholder:text-gray-mid/50 focus:outline-none focus:border-lime/30 transition-colors duration-200 resize-none"
    />
  );
}

function RangeField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div>
      <label className="block text-[11px] tracking-[0.1em] text-gray-mid/80 mb-1.5">
        {label} (1-10)
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
