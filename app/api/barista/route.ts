import {
  createBaristaHandler,
  defaultDeps,
} from "../../../lib/experience/server/barista-handler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

let handler: ReturnType<typeof createBaristaHandler> | null = null;
const get = () => (handler ??= createBaristaHandler(defaultDeps()));

/** Whether the AI Barista is available (no secrets are returned). */
export function GET() {
  return get().GET();
}
/** One Barista answer, streamed as NDJSON events. */
export function POST(request: Request) {
  return get().POST(request);
}
