// Fonction serveur sécurisée pour récupérer les résultats depuis Airtable.
// Supporte le filtre optionnel ?courseId=recXXXXXXXXXXXXXX pour ne récupérer
// que les résultats liés à une course précise.

export default async function handler(request, response) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = "Résultats";
  const courseId = request.query.courseId;

  if (!apiKey || !baseId) {
    return response.status(500).json({
      error: "Configuration manquante : vérifie AIRTABLE_API_KEY et AIRTABLE_BASE_ID dans les variables d'environnement Vercel.",
    });
  }

  try {
    let airtableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?pageSize=100`;
    if (courseId) {
      const formula = `SEARCH("${courseId}", ARRAYJOIN({Course}))`;
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

    const resultats = allRecords
      .filter((record) => record.fields && record.fields["Course"])
      .map((record) => ({
        id: record.id,
        courseId: (record.fields["Course"] || [])[0] || null,
        distance: record.fields["Distance / Épreuve"] || "",
        nom: record.fields["Nom du coureur"] || "",
        prenom: record.fields["Prénom du coureur"] || "",
        club: record.fields["Club"] || "",
        temps: record.fields["Temps"] || "",
        classementGeneral: record.fields["Classement général"] ?? null,
        classementCategorie: record.fields["Classement catégorie"] || "",
        sexe: record.fields["Sexe"] || "",
        departement: record.fields["Département"] || "",
      }));

    resultats.sort((a, b) => (a.classementGeneral ?? 9999) - (b.classementGeneral ?? 9999));

    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    return response.status(200).json({ resultats });
  } catch (error) {
    return response.status(500).json({ error: "Erreur serveur", details: error.message });
  }
}
