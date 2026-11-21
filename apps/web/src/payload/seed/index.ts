/** CLI seeda: `npm run payload:seed`. Logika w ./seed.ts (używana też przy starcie serwera, patrz payload.config.ts). */
import { getPayload } from "payload";
import config from "../../payload.config";
import { seed } from "./seed";

const payload = await getPayload({ config });
try {
  await seed(payload);
} finally {
  await payload.destroy();
}
process.exit(0);
