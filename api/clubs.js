// Fonction serveur sécurisée pour récupérer les clubs depuis Airtable.
// Même principe que /api/courses.js : la clé API reste côté serveur.

export default async function handler(request, response) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = "Clubs";
  const departement = request.query.departement;

  if (!apiKey || !baseId) {
    return response.status(500).json({
      error: "Configuration manquante : vérifie AIRTABLE_API_KEY et AIRTABLE_BASE_ID dans les variables d'environnement Vercel.",
    });
  }

  try {
    let airtableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?pageSize=100`;
    if (departement) {
      const formula = `{Département}="${departement}"`;
      airtableUrl += `&filterByFormula=${encodeURIComponent(formula)}`;
    }

    let allRecords = [];
    let offset;
    do {
      let pageUrl = airtableUrl;
      if (offset) pageUrl += `&offset=${offset}`;
      const airtableResponse = await fetch(pageUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!airtableResponse.ok) {
        const errorText = await airtableResponse.text();
        return response.status(airtableResponse.status).json({
          error: "Erreur lors de la récupération des données Airtable",
          details: errorText,
        });
      }

      const data = await airtableResponse.json();
      allRecords = allRecords.concat(data.records);
      offset = data.offset;
    } while (offset);

    const clubs = allRecords.map((record) => {
      const logoAttachment = record.fields["Logo"];
      const logoUrl =
        Array.isArray(logoAttachment) && logoAttachment.length > 0
          ? logoAttachment[0].url
          : null;

      return {
        id: record.id,
        nom: record.fields["Nom du club"] || "",
        commune: record.fields["Commune"] || "",
        departement: record.fields["Département"] || "",
        discipline: record.fields["Discipline(s)"] || "",
        site: record.fields["Site web"] || "",
        reseaux: record.fields["Facebook/Instagram"] || "",
        contact: record.fields["Contact"] || "",
        logo: logoUrl,
      };
    });

    // Tri alphabétique par nom de club
    clubs.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    return response.status(200).json({ clubs });
  } catch (error) {
    return response.status(500).json({ error: "Erreur serveur", details: error.message });
  }
}
