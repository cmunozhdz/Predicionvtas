import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Hidden test account (admin)
  const testEmail = 'abacus-abf54772@example.com';
  const testPassword = '47ntujIJH*';
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  await prisma.user.upsert({
    where: { email: testEmail },
    update: { password: hashedPassword, role: 'admin' },
    create: {
      email: testEmail,
      password: hashedPassword,
      name: 'Admin',
      role: 'admin',
    },
  });

  // Ensure AppConfig exists
  const configCount = await prisma.appConfig.count();
  if (configCount === 0) {
    await prisma.appConfig.create({
      data: {
        sheetUrl: '',
        adminEmail: '',
        refreshInterval: 24,
      },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e: any) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
