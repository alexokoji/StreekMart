import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { awardPoints } from "@/lib/referrals";

// Points granted per check-in. Streak bonus on the 7th consecutive day.
const POINTS_DAILY = 10;
const POINTS_WEEKLY_BONUS = 50;

function utcStartOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// GET /api/points/check-in -- read state. Returns whether the user can
// claim today, the current streak length, and their balance.
export async function GET() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const userId = guard.session.sub;
  const today = utcStartOfDay(new Date());
  const todayRow = await prisma.dailyCheckIn.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  const recent = await prisma.dailyCheckIn.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 14,
    select: { date: true },
  });
  // Walk recent backwards counting consecutive days ending today (or yesterday if today isn't yet claimed).
  let streak = 0;
  const cursor = todayRow ? new Date(today) : new Date(today.getTime() - 24 * 60 * 60 * 1000);
  for (const row of recent) {
    if (row.date.getTime() === cursor.getTime()) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { pointsBalance: true } });
  return NextResponse.json({
    canClaimToday: !todayRow,
    streak,
    pointsBalance: me?.pointsBalance ?? 0,
    todayPoints: POINTS_DAILY,
    weeklyBonus: POINTS_WEEKLY_BONUS,
  });
}

// POST /api/points/check-in -- claim today's points. Idempotent --
// repeated calls on the same UTC day return 409.
export async function POST() {
  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const userId = guard.session.sub;
  const today = utcStartOfDay(new Date());

  const existing = await prisma.dailyCheckIn.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already checked in today." }, { status: 409 });
  }

  // Determine streak BEFORE inserting today's row.
  let streak = 1;
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  let cursor = yesterday;
  for (let i = 0; i < 30; i++) {
    const row = await prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date: cursor } },
    });
    if (!row) break;
    streak++;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  // Award points: base + bonus every 7 days.
  let points = POINTS_DAILY;
  let bonusEarned = false;
  if (streak > 0 && streak % 7 === 0) {
    points += POINTS_WEEKLY_BONUS;
    bonusEarned = true;
  }

  const row = await prisma.dailyCheckIn.create({
    data: { userId, date: today, pointsAwarded: points },
  });
  await awardPoints({ userId, delta: points, reason: "check-in:daily", refId: row.id });

  return NextResponse.json({
    ok: true,
    awarded: points,
    streak,
    bonusEarned,
  });
}