const postgres =
  require("../src/postgres");

async function main() {
  if (!postgres.enabled()) {
    throw new Error(
      "DATABASE_URL is required"
    );
  }

  await postgres.query(
    `
    INSERT INTO users (
      id,
      email
    )
    VALUES
      ($1,$2),
      ($3,$4)
    ON CONFLICT (id)
    DO NOTHING
    `,
    [
      "tenant-demo",
      "demo@example.com",
      "tenant-b",
      "tenant-b@example.com"
    ]
  );

  console.log(
    "Demo tenants seeded"
  );
}

main()
  .catch(error => {
    console.error(
      error.message
    );

    process.exitCode = 1;
  })
  .finally(
    async () => {
      await postgres.close();
    }
  );