export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body ?? {};
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.password) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }
    return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
