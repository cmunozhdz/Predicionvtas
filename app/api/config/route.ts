export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    // Check admin
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores pueden acceder a la configuración' }, { status: 403 });
    }

    let config = await prisma.appConfig.findFirst();
    if (!config) {
      config = await prisma.appConfig.create({ data: {} });
    }
    return NextResponse.json(config);
  } catch (err: any) {
    console.error('Config GET error:', err);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores pueden modificar la configuración' }, { status: 403 });
    }

    const body = await request.json();
    const { sheetUrl, adminEmail, refreshInterval } = body ?? {};

    let config = await prisma.appConfig.findFirst();
    if (config) {
      config = await prisma.appConfig.update({
        where: { id: config.id },
        data: {
          ...(sheetUrl !== undefined ? { sheetUrl } : {}),
          ...(adminEmail !== undefined ? { adminEmail } : {}),
          ...(refreshInterval !== undefined ? { refreshInterval: parseInt(refreshInterval, 10) || 24 } : {}),
        },
      });
    } else {
      config = await prisma.appConfig.create({
        data: { sheetUrl: sheetUrl ?? '', adminEmail: adminEmail ?? '' },
      });
    }

    return NextResponse.json(config);
  } catch (err: any) {
    console.error('Config PUT error:', err);
    return NextResponse.json({ error: 'Error al guardar configuración' }, { status: 500 });
  }
}
