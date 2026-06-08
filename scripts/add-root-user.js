require('dotenv').config({ path: '.env' });
const { PrismaClient } = require("@prisma/client");
const { v4: uuidv4 } = require("uuid");

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Adding/updating root user...");

    const user = await prisma.profiles.upsert({
      where: { email: "info@talya.vc" },
      update: {
        role: "root",
        updated_at: new Date(),
      },
      create: {
        id: uuidv4(),
        email: "info@talya.vc",
        name: "Talya Admin",
        role: "root",
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    console.log("✅ Root user added/updated successfully:", user);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
