import { NextRequest, NextResponse } from "next/server";
import { generateListingPdf, ListingPdfMode } from "@/lib/listing-pdf";
import { getCurrentUserProfile, getListado, getOpenDate } from "@/lib/supabase/queries";
import { canAccessCoreSystem, canAccessScope } from "@/lib/utils";

export const runtime = "nodejs";

function resolveMode(value: string | null): ListingPdfMode {
  if (value === "sexos" || value === "numeros" || value === "menciones") {
    return value;
  }
  return "listado";
}

function getPdfFileName(mode: ListingPdfMode) {
  if (mode === "sexos") {
    return "HOMBRES - MUJERES - COMANDAS.pdf";
  }

  if (mode === "numeros") {
    return "NUMERO DE PASE.pdf";
  }

  if (mode === "menciones") {
    return "MENCIONES.pdf";
  }

  return "LISTADO - AG.pdf";
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile?.active) {
    return NextResponse.json({ error: "Sesion no valida." }, { status: 401 });
  }

  if (
    !canAccessScope(
      profile.roleKey,
      profile.permissionGrants,
      "listado",
      canAccessCoreSystem(profile.roleKey, profile.moduleOnly)
    )
  ) {
    return NextResponse.json({ error: "Sin acceso al listado." }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const mode = resolveMode(searchParams.get("mode"));
  const query = searchParams.get("q");
  const openDate = await getOpenDate();
  const printDate = searchParams.get("date") || openDate?.fechaCompleta || "";

  if (!printDate) {
    return NextResponse.json({ error: "No hay fecha disponible para generar PDF." }, { status: 400 });
  }

  const listings = await getListado({ fechaVisita: printDate });
  const pdfBytes = await generateListingPdf({
    listings,
    printDate,
    mode,
    query
  });

  const fileName = getPdfFileName(mode);
  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "no-store"
    }
  });
}
