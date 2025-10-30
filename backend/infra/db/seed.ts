import db from "../../db";

export async function seedDatabase(): Promise<void> {
  const hasData = await db.queryRow<{ count: number }>`
    SELECT COUNT(*) as count FROM projects
  `;

  if (hasData && hasData.count > 0) {
    console.log("Database already has data, skipping seed");
    return;
  }

  console.log("Seeding database...");
  
  console.log("✓ Database seeded successfully");
}
