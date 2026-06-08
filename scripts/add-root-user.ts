import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Adding/updating root user: info@talya.vc");

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

    console.log("✅ Root user added/updated successfully!");
    console.log("User ID:", user.id);
    console.log("Email:", user.email);
    console.log("Role:", user.role);
  } catch (error: any) {
    console.error("❌ Error:", error?.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
