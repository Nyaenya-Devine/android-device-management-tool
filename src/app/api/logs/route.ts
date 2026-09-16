import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, pubsubMessages, enterprises } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { ensureEnterpriseInitialized } from "@/lib/db-seed";
import { authenticateApiRequest } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const identity = authenticateApiRequest(req);
  if (!identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (identity.role !== "admin" && identity.role !== "security_analyst" && identity.role !== "operator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await ensureEnterpriseInitialized();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) return NextResponse.json({ error: "Enterprise not initialized" }, { status: 404 });
    const enterprise = entList[0];
    const rawLimit = Number(new URL(req.url).searchParams.get("limit") || 50);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.floor(rawLimit), 100)) : 50;
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.enterpriseId, enterprise.id)).orderBy(desc(auditLogs.createdAt)).limit(limit);
    const pubsubEvents = await db.select().from(pubsubMessages).where(eq(pubsubMessages.enterpriseId, enterprise.id)).orderBy(desc(pubsubMessages.publishTime)).limit(limit);
    return NextResponse.json({ auditLogs: logs, pubsubMessages: pubsubEvents }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
