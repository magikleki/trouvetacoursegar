// Cette fonction s'exécute côté serveur (jamais dans le navigateur du visiteur).
// La clé Airtable reste donc secrète : elle n'est jamais visible par les visiteurs du site.

export default async function handler(request, response) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME || "Courses";

  if (!apiKey || !baseId) {
    return response.status(500).json({
      error: "Configuration manquante : vérifie AIRTABLE_API_KEY et AIRTABLE_BASE_ID dans les variables d'environnement Vercel.",
    });
  }

  try {
    const airtableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?pageSize=100`;

    const airtableResponse = await fetch(airtableUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!airtableResponse.ok) {
      const errorText = await airtableResponse.text();
      return response.status(airtableResponse.status).json({
        error: "Erreur lors de la récupération des données Airtable",
        details: errorText,
      });
    }

    const data = await airtableResponse.json();

    // On ne renvoie que les champs utiles, dans un format simple pour le site.
    const courses = data.records.map((record) => ({
      id: record.id,
      nom: record.fields["Nom de la course"] || "",
      date: record.fields["Date de la course"] || "",
      distances: record.fields["Distances"] || "",
      type: record.fields["Type"] || "",
      commune: record.fields["Commune"] || "",
      site: record.fields["Site source"] || "",
    }));

    // Tri par date, du plus proche au plus lointain
    courses.sort((a, b) => new Date(a.date) - new Date(b.date));

    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate");
    return response.status(200).json({ courses });
  } catch (error) {
    return response.status(500).json({ error: "Erreur serveur", details: error.message });
  }
}
