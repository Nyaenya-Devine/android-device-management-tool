import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { enterprises, devices, policies, enrollmentTokens } from "@/db/schema";
import { ensureEnterpriseInitialized } from "@/lib/db-seed";
import { eq, sql } from "drizzle-orm";
import { fetchGoogleAccessToken, callAmapi } from "@/lib/amapi/amapi-service";
import { encryptText, decryptText } from "@/lib/crypto";

export async function GET() {
  try {
    await ensureEnterpriseInitialized();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) {
      return NextResponse.json({ error: "Enterprise not initialized" }, { status: 404 });
    }

    const ent = entList[0];

    // Fleet summary statistics
    const [deviceCount] = await db.select({ count: sql<number>`count(*)` }).from(devices).where(eq(devices.enterpriseId, ent.id));
    const [policyCount] = await db.select({ count: sql<number>`count(*)` }).from(policies).where(eq(policies.enterpriseId, ent.id));
    const [tokenCount] = await db.select({ count: sql<number>`count(*)` }).from(enrollmentTokens).where(eq(enrollmentTokens.enterpriseId, ent.id));
    const [compliantCount] = await db.select({ count: sql<number>`count(*)` }).from(devices).where(sql`${devices.enterpriseId} = ${ent.id} AND ${devices.isCompliant} = true`);

    const hasPrivateKey = !!ent.serviceAccountPrivateKey;

    return NextResponse.json({
      enterprise: {
        id: ent.id,
        enterpriseId: ent.enterpriseId,
        name: ent.name,
        mode: ent.mode,
        gcpProjectId: ent.gcpProjectId,
        serviceAccountEmail: ent.serviceAccountEmail,
        hasPrivateKey,
        pubsubTopic: ent.pubsubTopic,
        pubsubSubscription: ent.pubsubSubscription,
        status: ent.status,
        createdAt: ent.createdAt,
        updatedAt: ent.updatedAt,
      },
      stats: {
        totalDevices: Number(deviceCount?.count || 0),
        compliantDevices: Number(compliantCount?.count || 0),
        totalPolicies: Number(policyCount?.count || 0),
        totalTokens: Number(tokenCount?.count || 0),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) {
      return NextResponse.json({ error: "Enterprise not found" }, { status: 404 });
    }

    const ent = entList[0];
    const updateData: Partial<typeof enterprises.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.name) updateData.name = body.name.trim();
    if (body.enterpriseId) updateData.enterpriseId = body.enterpriseId.trim();
    if (body.mode && ["LIVE_AMAPI", "SANDBOX"].includes(body.mode)) {
      updateData.mode = body.mode;
    }
    if (body.gcpProjectId !== undefined) updateData.gcpProjectId = body.gcpProjectId?.trim() || null;
    if (body.serviceAccountEmail !== undefined) updateData.serviceAccountEmail = body.serviceAccountEmail?.trim() || null;
    if (body.serviceAccountPrivateKey) {
      updateData.serviceAccountPrivateKey = encryptText(body.serviceAccountPrivateKey.trim());
    }
    if (body.pubsubTopic !== undefined) updateData.pubsubTopic = body.pubsubTopic?.trim() || null;
    if (body.pubsubSubscription !== undefined) updateData.pubsubSubscription = body.pubsubSubscription?.trim() || null;

    const [updated] = await db
      .update(enterprises)
      .set(updateData)
      .where(eq(enterprises.id, ent.id))
      .returning();

    return NextResponse.json({
      success: true,
      enterprise: {
        id: updated.id,
        enterpriseId: updated.enterpriseId,
        name: updated.name,
        mode: updated.mode,
        gcpProjectId: updated.gcpProjectId,
        serviceAccountEmail: updated.serviceAccountEmail,
        hasPrivateKey: !!updated.serviceAccountPrivateKey,
        pubsubTopic: updated.pubsubTopic,
        pubsubSubscription: updated.pubsubSubscription,
        status: updated.status,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update enterprise";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/enterprise -> Test Google AMAPI OAuth2 & Enterprise connectivity
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serviceAccountEmail, serviceAccountPrivateKey, enterpriseId } = body;

    let email = serviceAccountEmail;
    let key = serviceAccountPrivateKey;

    // If not provided in body, load from DB
    if (!email || !key) {
      const entList = await db.select().from(enterprises).limit(1);
      if (entList.length && entList[0].serviceAccountEmail && entList[0].serviceAccountPrivateKey) {
        email = entList[0].serviceAccountEmail;
        key = decryptText(entList[0].serviceAccountPrivateKey);
      }
    }

    if (!email || !key) {
      return NextResponse.json(
        {
          success: false,
          error: "Service Account Email and Private Key are required to test Google Cloud AMAPI connection.",
        },
        { status: 400 }
      );
    }

    // Step 1: Attempt OAuth2 Bearer token exchange
    const accessToken = await fetchGoogleAccessToken(email, key);
    if (!accessToken) {
      throw new Error("Received empty access token from Google OAuth2.");
    }

    // Step 2: Attempt AMAPI verification query
    let amapiDetails: unknown = null;
    const targetEnterpriseId = enterpriseId || "enterprises/LC03";
    try {
      amapiDetails = await callAmapi(`${targetEnterpriseId}`, {
        method: "GET",
        accessToken,
      });
    } catch (apiErr) {
      // If enterprise not yet provisioned on Google Cloud, token exchange itself was successful
      return NextResponse.json({
        success: true,
        oauthSuccess: true,
        amapiMessage: `Google OAuth2 authentication succeeded! Token generated. (Target enterprise info: ${apiErr instanceof Error ? apiErr.message : "Not found"})`,
        tokenPrefix: `${accessToken.substring(0, 10)}...`,
      });
    }

    return NextResponse.json({
      success: true,
      oauthSuccess: true,
      amapiMessage: "Successfully authenticated with Google Cloud AMAPI and verified Enterprise binding!",
      enterpriseDetails: amapiDetails,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection test failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
