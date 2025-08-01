import { Config } from "@netlify/functions";

export default async (req: Request) => {
  if (process.env.DISABLE_SCHEDULED_FUNCTIONS === "true") {
    return;
  }

  try {
    const { next_run } = await req.json();
    console.log("Received event! Next invocation at:", next_run);
    await fetch(
      process.env.SER_LPP_CALCULATION_URL ?? "http://app.seer.pm/.netlify/functions/ser-lpp-calculation-background",
    );
  } catch (e) {
    console.log(e);
  }
};

export const config: Config = {
  schedule: "0 */12 * * *",
};
