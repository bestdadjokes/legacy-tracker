import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  const data = await request.json();

  if (!data.clientName) {
    return NextResponse.json(
      { error: "Name is required." },
      { status: 400 }
    );
  }

  const fields = Object.entries(data)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  try {
    await sendEmail({
      subject: `Tracking Data: ${data.clientName} (${data.trackingDates || "N/A"})`,
      text: fields,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email send failed:", err);
    return NextResponse.json({ error: "Failed to send." }, { status: 500 });
  }
}
