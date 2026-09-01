import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, pubsubMessages, enterprises } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { ensureEnterpriseInitialized } from "@/lib/db-seed";

export async function GET(req: NextRequest) {
  try {
    await ensureEnterpriseInitialized();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) {
      return NextResponse.json({ error: "Enterprise not initialized" }, { status: 404 });
    }
    const enterprise = entList[0];

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.enterpriseId, enterprise.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    const pubsubEvents = await db
      .select()
      .from(pubsubMessages)
      .where(eq(pubsubMessages.enterpriseId, enterprise.id))
      .orderBy(desc(pubsubMessages.publishTime))
      .limit(limit);

    return NextResponse.json({
      auditLogs: logs,
      pubsubMessages: pubsubEvents,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch logs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
