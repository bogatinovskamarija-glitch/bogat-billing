import { NextRequest, NextResponse } from "next/server";
import { deleteContract } from "../../../../lib/arena-contracts";

export async function DELETE(_req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    await deleteContract(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to delete contract" }, { status: 400 });
  }
}
