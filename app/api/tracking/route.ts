import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack1: "Snack 1",
  snack2: "Snack 2",
};

// Hidden honeypot field name (see app/page.tsx). Real users never fill this;
// bots that blindly complete every field do. This is only cheap deterrence —
// the real fix for this public, unauthenticated email endpoint is a rate
// limiter (KV/Upstash) or a Turnstile challenge in front of the POST.
const HONEYPOT_FIELD = "company";

// Per-field and total-payload caps. Free-text fields (notes, meals, workout)
// get the larger cap; short cover fields are capped tighter below.
const MAX_FIELD_LENGTH = 2000;
const MAX_SHORT_FIELD_LENGTH = 200;
const MAX_TOTAL_LENGTH = 60_000;

const SHORT_FIELDS = new Set(["clientName", "weekOf"]);

// Whitelist of every field the form can legitimately submit. Anything else is
// rejected outright rather than forwarded into the email.
const ALLOWED_FIELDS: Set<string> = buildAllowedFields();

function buildAllowedFields(): Set<string> {
  const fields = new Set<string>(["clientName", "weekOf", HONEYPOT_FIELD]);
  const meals = Object.keys(MEAL_LABELS);
  for (const day of DAYS) {
    fields.add(`${day}-date`);
    for (const meal of meals) {
      fields.add(`${day}-${meal}`);
      fields.add(`${day}-${meal}-cal`);
      fields.add(`${day}-${meal}-protein`);
      fields.add(`${day}-${meal}-carbs`);
      fields.add(`${day}-${meal}-fat`);
    }
    fields.add(`${day}-water`);
    fields.add(`${day}-caffeine`);
    fields.add(`${day}-other-bev`);
    fields.add(`${day}-calories`);
    fields.add(`${day}-protein`);
    fields.add(`${day}-carbs`);
    fields.add(`${day}-fat`);
    fields.add(`${day}-sleep-hrs`);
    fields.add(`${day}-steps`);
    fields.add(`${day}-sleep-quality`);
    fields.add(`${day}-energy`);
    fields.add(`${day}-workout-type`);
    fields.add(`${day}-workout-intensity`);
    fields.add(`${day}-notes`);
  }
  return fields;
}

type ValidationResult =
  | { ok: true; data: Record<string, string> }
  | { ok: false; error: string };

function validateBody(raw: unknown): ValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Malformed request body." };
  }

  const data: Record<string, string> = {};
  let total = 0;

  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_FIELDS.has(key)) {
      return { ok: false, error: `Unexpected field: ${key}` };
    }
    if (typeof value !== "string") {
      return { ok: false, error: `Field ${key} must be a string.` };
    }
    const limit = SHORT_FIELDS.has(key)
      ? MAX_SHORT_FIELD_LENGTH
      : MAX_FIELD_LENGTH;
    if (value.length > limit) {
      return { ok: false, error: `Field ${key} is too long.` };
    }
    total += value.length;
    if (total > MAX_TOTAL_LENGTH) {
      return { ok: false, error: "Payload too large." };
    }
    data[key] = value;
  }

  if (!data.clientName) {
    return { ok: false, error: "Name is required." };
  }

  return { ok: true, data };
}

// Strip characters that would let a submitted value inject additional email
// headers, then truncate so the subject line stays sane.
function sanitizeSubjectPart(value: string, max = 100): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Malformed request body." },
        { status: 400 }
      );
    }

    const result = validateBody(raw);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    // Honeypot: silently accept (so bots can't distinguish success from
    // rejection) but never actually send the email.
    if (data[HONEYPOT_FIELD]) {
      return NextResponse.json({ success: true });
    }

    const text = Object.entries(data)
      .filter(([k, v]) => k !== HONEYPOT_FIELD && v)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    const html = buildHtmlEmail(data);

    const clientName = sanitizeSubjectPart(data.clientName);
    const weekOf = sanitizeSubjectPart(data.weekOf || "N/A");

    await sendEmail({
      subject: `Wellness Tracker: ${clientName} — ${weekOf}`,
      text,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email send failed:", err);
    return NextResponse.json({ error: "Failed to send." }, { status: 500 });
  }
}

function val(data: Record<string, string>, key: string): string {
  return data[key] || "";
}

function buildHtmlEmail(data: Record<string, string>): string {
  const days = DAYS.map((day) => buildDaySection(data, day)).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#121212;color:#E2E2DE;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">
  <div style="max-width:640px;margin:0 auto;padding:32px 24px;">
    <!-- Header -->
    <div style="text-align:center;padding-bottom:32px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <h1 style="margin:0;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#CEFF00;font-weight:400;">
        Legacy Training
      </h1>
      <h2 style="margin:12px 0 0;font-size:28px;font-weight:400;text-transform:uppercase;letter-spacing:0.02em;color:#E2E2DE;">
        Wellness Tracker
      </h2>
    </div>

    <!-- Client Info -->
    <table style="width:100%;margin-top:24px;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 0;color:#737370;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;width:120px;">Client</td>
        <td style="padding:8px 0;color:#E2E2DE;">${esc(val(data, "clientName"))}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#737370;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;">Week Of</td>
        <td style="padding:8px 0;color:#E2E2DE;">${esc(val(data, "weekOf"))}</td>
      </tr>
    </table>

    <!-- Days -->
    ${days}

    <!-- Footer -->
    <div style="margin-top:40px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
      <p style="margin:0;font-size:12px;color:#737370;">
        Submitted via Legacy Training Wellness Tracker
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildDaySection(data: Record<string, string>, day: string): string {
  const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
  const date = val(data, `${day}-date`);

  const meals = Object.keys(MEAL_LABELS)
    .map((meal) => buildMealRow(data, day, meal, MEAL_LABELS[meal]))
    .join("");

  const water = val(data, `${day}-water`);
  const caffeine = val(data, `${day}-caffeine`);
  const otherBev = val(data, `${day}-other-bev`);
  const hasBeverages = water || caffeine || otherBev;

  const calories = val(data, `${day}-calories`);
  const protein = val(data, `${day}-protein`);
  const carbs = val(data, `${day}-carbs`);
  const fat = val(data, `${day}-fat`);
  const hasDailyMacros = calories || protein || carbs || fat;

  const sleepHrs = val(data, `${day}-sleep-hrs`);
  const steps = val(data, `${day}-steps`);
  const sleepQuality = val(data, `${day}-sleep-quality`);
  const energy = val(data, `${day}-energy`);
  const hasSleep = sleepHrs || steps || sleepQuality || energy;

  const workoutType = val(data, `${day}-workout-type`);
  const workoutIntensity = val(data, `${day}-workout-intensity`);
  const hasWorkout = workoutType || workoutIntensity;

  const notes = val(data, `${day}-notes`);

  return `
    <div style="margin-top:32px;padding:24px;background:#181818;border-radius:4px;">
      <!-- Day Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.05);">
        <h3 style="margin:0;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#CEFF00;font-weight:400;">
          ${dayLabel}
        </h3>
        ${date ? `<span style="font-size:13px;color:#737370;">${esc(date)}</span>` : ""}
      </div>

      <!-- Meals -->
      ${meals}

      <!-- Beverages -->
      ${hasBeverages ? `
      <div style="margin-top:16px;">
        ${sectionHeader("Beverages")}
        <table style="width:100%;border-collapse:collapse;">
          ${water ? metricRow("Water", water) : ""}
          ${caffeine ? metricRow("Caffeine", caffeine) : ""}
          ${otherBev ? metricRow("Other", otherBev) : ""}
        </table>
      </div>` : ""}

      <!-- Daily Macro Totals -->
      ${hasDailyMacros ? `
      <div style="margin-top:16px;">
        ${sectionHeader("Daily Macro Totals")}
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            ${macroCell("Cal", calories)}
            ${macroCell("Protein", protein)}
            ${macroCell("Carbs", carbs)}
            ${macroCell("Fat", fat)}
          </tr>
        </table>
      </div>` : ""}

      <!-- Sleep & Energy -->
      ${hasSleep ? `
      <div style="margin-top:16px;">
        ${sectionHeader("Sleep & Energy")}
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            ${macroCell("Sleep", sleepHrs ? sleepHrs + " hrs" : "")}
            ${macroCell("Steps", steps)}
            ${macroCell("Sleep Quality", sleepQuality ? sleepQuality + "/10" : "")}
            ${macroCell("Energy", energy ? energy + "/10" : "")}
          </tr>
        </table>
      </div>` : ""}

      <!-- Workout -->
      ${hasWorkout ? `
      <div style="margin-top:16px;">
        ${sectionHeader("Workout")}
        ${workoutType ? `<p style="margin:4px 0;color:#E2E2DE;font-size:14px;">${esc(workoutType)}</p>` : ""}
        ${workoutIntensity ? `<p style="margin:4px 0;color:#737370;font-size:13px;">${esc(workoutIntensity)}</p>` : ""}
      </div>` : ""}

      <!-- Notes -->
      ${notes ? `
      <div style="margin-top:16px;">
        ${sectionHeader("Notes")}
        <p style="margin:4px 0;color:rgba(226,226,222,0.5);font-size:14px;font-style:italic;">${esc(notes)}</p>
      </div>` : ""}
    </div>`;
}

function buildMealRow(data: Record<string, string>, day: string, meal: string, label: string): string {
  const food = val(data, `${day}-${meal}`);
  const cal = val(data, `${day}-${meal}-cal`);
  const protein = val(data, `${day}-${meal}-protein`);
  const carbs = val(data, `${day}-${meal}-carbs`);
  const fat = val(data, `${day}-${meal}-fat`);
  const hasMacros = cal || protein || carbs || fat;

  if (!food && !hasMacros) return "";

  return `
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.03);">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#737370;">${label}</p>
      ${food ? `<p style="margin:0;color:#E2E2DE;font-size:14px;">${esc(food)}</p>` : ""}
      ${hasMacros ? `
      <table style="width:100%;border-collapse:collapse;margin-top:6px;">
        <tr>
          ${macroCell("Cal", cal)}
          ${macroCell("P", protein)}
          ${macroCell("C", carbs)}
          ${macroCell("F", fat)}
        </tr>
      </table>` : ""}
    </div>`;
}

function sectionHeader(label: string): string {
  return `<p style="margin:0 0 8px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#737370;">${label}</p>`;
}

function macroCell(label: string, value: string): string {
  if (!value) return `<td style="width:25%;padding:4px 8px 4px 0;"></td>`;
  return `<td style="width:25%;padding:4px 8px 4px 0;">
    <span style="font-size:11px;color:#737370;">${label}</span><br/>
    <span style="font-size:14px;color:#CEFF00;">${esc(value)}</span>
  </td>`;
}

function metricRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:4px 0;color:#737370;font-size:12px;width:100px;">${label}</td>
    <td style="padding:4px 0;color:#E2E2DE;font-size:14px;">${esc(value)}</td>
  </tr>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
