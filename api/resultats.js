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
    // On ne demande à Airtable que les champs réellement utilisés par le
    // site : le champ lookup "Nom de la course (from Course)" (inutilisé)
    // est exclu, ce qui allège chaque page de la pagination.
    const usedFields = [
      "Distance / Épreuve",
      "Course",
      "Nom du coureur",
      "Prénom du coureur",
      "Club",
      "Temps",
      "Classement général",
      "Classement catégorie",
      "Sexe",
      "Département",
      "Dossard",
      "Vitesse",
    ];
    const fieldsParam = usedFields.map((f) => `fields%5B%5D=${encodeURIComponent(f)}`).join("&");
    let airtableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?pageSize=100&${fieldsParam}`;

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

    let resultats = allRecords
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
        dossard: record.fields["Dossard"] || "",
        vitesse: record.fields["Vitesse"] || "",
      }));

    // Filtre par course fait ici (pas via formule Airtable) : ARRAYJOIN sur un
    // champ lié renvoie le texte du champ principal de la course liée, pas son
    // identifiant, donc une formule SEARCH/ARRAYJOIN ne peut pas matcher un recXXX.
    if (courseId) {
      resultats = resultats.filter((r) => r.courseId === courseId);
    }

    resultats.sort((a, b) => (a.classementGeneral ?? 9999) - (b.classementGeneral ?? 9999));

    // Stratégie de cache "stale-while-revalidate" : la réponse est
    // considérée fraîche 60s, puis pendant 24h le CDN Vercel continue de
    // servir INSTANTANÉMENT la version en cache tout en la rafraîchissant
    // en arrière-plan. Sans valeur explicite après stale-while-revalidate,
    // la directive était ignorée : passé 30s, chaque visiteur repayait la
    // pagination complète d'Airtable (~66 requêtes séquentielles, 10-20s).
    // Coût du compromis : des résultats fraîchement importés peuvent mettre
    // ~1-2 min à apparaître, mais le site répond toujours immédiatement.
    response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=86400");
    return response.status(200).json({ resultats });
  } catch (error) {
    return response.status(500).json({ error: "Erreur serveur", details: error.message });
  }
}
