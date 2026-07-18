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

    const courses = allRecords.map((record) => {
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
        type: record.fields["Type"] || "",
        commune: record.fields["Commune"] || "",
        departement: record.fields["Département"] || "",
        challenge: record.fields["Challenge/Label"] || "",
        site: record.fields["Site d'inscription"] || "",
        contact: record.fields["Contact"] || "",
        reseaux: record.fields["Réseaux sociaux"] || "",
        affiche: posterUrl,
        statut: record.fields["Statut"] || "",
        infos: record.fields["Infos"] || "",
      };
    });

    // Tri par date, du plus proche au plus lointain.
    // Les courses sans date connue ("À définir") sont envoyées à la fin,
    // plutôt que de perturber l'ordre à cause d'une comparaison invalide.
    courses.sort((a, b) => {
      const dA = new Date(a.date);
      const dB = new Date(b.date);
      const validA = !isNaN(dA);
      const validB = !isNaN(dB);
      if (validA && validB) return dA - dB;
      if (validA) return -1;
      if (validB) return 1;
      return 0;
    });

    // Cache court : pendant la collecte des résultats d'une course ("Infos" =
    // "Incomplètes"), de nouvelles lignes peuvent être ajoutées à tout moment
    // dans Airtable. Un cache trop long affichait des données figées (ex: un
    // nombre de coureurs très en dessous de la réalité) pendant plusieurs
    // minutes après chaque mise à jour.
    response.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate");
    return response.status(200).json({ courses });
  } catch (error) {
    return response.status(500).json({ error: "Erreur serveur", details: error.message });
  }
}
