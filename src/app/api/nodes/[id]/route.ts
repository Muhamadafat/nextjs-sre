import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest, {params} : {
    params: Promise <{id: string}>
}){
    const { id: idParam } = await params;

    const id = Number(idParam);

    return NextResponse.json({msg : 'Delete Node Succed', id: id}, {status: 201});
};