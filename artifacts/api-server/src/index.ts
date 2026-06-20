import net from "net";
import app from "./app";
import { logger } from "./lib/logger";
import { validateEnv } from "./lib/validateEnv";

validateEnv();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const desiredPort = Number(rawPort);

if (Number.isNaN(desiredPort) || desiredPort <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => tester.close(() => resolve(true)));
    tester.listen(port, "0.0.0.0");
  });
}

async function findAvailablePort(start: number, maxAttempts = 20): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = start + i;
    if (await isPortAvailable(candidate)) {
      if (i > 0) {
        logger.warn(
          { desiredPort: start, selectedPort: candidate },
          `Port ${start} was in use — automatically selected port ${candidate}`,
        );
      }
      return candidate;
    }
  }
  throw new Error(
    `No available port found in range ${start}–${start + maxAttempts - 1}`,
  );
}

const port = await findAvailablePort(desiredPort);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info(
    {
      port,
      env: process.env["NODE_ENV"] ?? "development",
      service: "api-server",
    },
    `API Server listening on port ${port}`,
  );
});
