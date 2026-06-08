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

export async function POST(request: Request) {
  const data = await request.json();

  if (!data.clientName) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const text = Object.entries(data)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const html = buildHtmlEmail(data);

  try {
    await sendEmail({
      subject: `Wellness Tracker: ${data.clientName} — ${data.weekOf || "N/A"}`,
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
    .replace(/"/g, "&quot;");
}
