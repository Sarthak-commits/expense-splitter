import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const groups = await prisma.group.findMany({
    where: {
      OR: [
        { createdById: userId },
        { members: { some: { userId } } },
      ],
    },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const group = await prisma.group.create({
    data: {
      name,
      createdById: userId,
      members: {
        create: { userId, role: "OWNER" },
      },
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({ group }, { status: 201 });
}
