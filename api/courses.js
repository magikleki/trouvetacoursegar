// Fonction serveur sécurisée pour récupérer les courses depuis Airtable.
// Supporte le filtre optionnel ?departement=Gard (ou Vaucluse, Hérault, Bouches-du-Rhône).
// Sans ce paramètre, retourne les courses de tous les départements.

export default async function handler(request, response) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || "Courses";
  const departement = request.query.departement;

  if (!apiKey || !baseId) {
    return response.status(500).json({
      error: "Configuration manquante : vérifie AIRTABLE_API_KEY et AIRTABLE_BASE_ID dans les variables d'environnement Vercel.",
    });
  }

  try {
    let airtableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?pageSize=100`;
    if (departement && departement !== "Tous") {
      const formula = `{Département}="${departement}"`;
      airtableUrl += `&filterByFormula=${encodeURIComponent(formula)}`;
    }

    const airtableResponse = await fetch(airtableUrl, {
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

    const courses = data.records.map((record) => {
      const posterAttachment = record.fields["Affiche"];
      const posterUrl =
        Array.isArray(posterAttachment) && posterAttachment.length > 0
          ? posterAttachment[0].url
          : null;

      return {
        id: record.id,
        nom: record.fields["Nom de la course"] || "",
        date: record.fields["Date de la course"] || "",
        heure: record.fields["Heure de départ"] || "",
        distances: record.fields["Distances"] || "",
        denivele: record.fields["Denivelé"] || "",
        type: record.fields["Type"] || "",
        commune: record.fields["Commune"] || "",
        departement: record.fields["Département"] || "",
        challenge: record.fields["Challenge/Label"] || "",
        site: record.fields["Site d'inscription"] || "",
        contact: record.fields["Contact"] || "",
        reseaux: record.fields["Réseaux sociaux"] || "",
        affiche: posterUrl,
      };
    });

    courses.sort((a, b) => new Date(a.date) - new Date(b.date));

    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    return response.status(200).json({ courses });
  } catch (error) {
    return response.status(500).json({ error: "Erreur serveur", details: error.message });
  }
}
