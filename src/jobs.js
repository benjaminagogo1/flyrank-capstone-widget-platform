const jobs = [];
let running = false;

async function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

async function processJobs() {
  if (running) return;

  running = true;

  try {
    while (jobs.length > 0) {
      const job = jobs.shift();

      let success = false;

      for (
        let attempt = 1;
        attempt <= job.maxAttempts;
        attempt += 1
      ) {
        try {
          await job.run();
          success = true;
          break;
        } catch (error) {
          console.error(
            `job ${job.name} failed on attempt ${attempt}:`,
            error.message
          );

          if (attempt < job.maxAttempts) {
            await sleep(job.retryDelayMs);
          }
        }
      }

      if (!success) {
        console.error(
          `ALERT: background job permanently failed: ${job.name}`
        );
      }
    }
  } finally {
    running = false;
  }
}

function enqueue({
  name,
  run,
  maxAttempts = 3,
  retryDelayMs = 250
}) {
  jobs.push({
    name,
    run,
    maxAttempts,
    retryDelayMs
  });

  setImmediate(processJobs);
}

module.exports = {
  enqueue
};