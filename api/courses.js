// Fonction serveur sécurisée pour récupérer les courses depuis Airtable.
// Supporte le filtre ?departement=Gard (ou Vaucluse, Hérault, Bouches-du-Rhône).

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
    if (departement) {
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

    const courses = data.records.map((record) => ({
      id: record.id,
      nom: record.fields["Nom de la course"] || "",
      date: record.fields["Date de la course"] || "",
      distances: record.fields["Distances"] || "",
      type: record.fields["Type"] || "",
      commune: record.fields["Commune"] || "",
      departement: record.fields["Département"] || "",
      site: record.fields["Site d'inscription"] || "",
      contact: record.fields["Contact"] || "",
      reseaux: record.fields["Réseaux sociaux"] || "",
    }));

    courses.sort((a, b) => new Date(a.date) - new Date(b.date));

    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    return response.status(200).json({ courses });
  } catch (error) {
    return response.status(500).json({ error: "Erreur serveur", details: error.message });
  }
}
