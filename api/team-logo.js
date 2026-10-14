module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const search = typeof req.query.search === "string"
    ? req.query.search.trim().slice(0, 100)
    : "";

  if (!search) {
    return res.status(400).json({ error: "missing_search" });
  }

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "server_configuration_error" });
  }

  try {
    const url = new URL("https://v3.football.api-sports.io/teams");
    url.searchParams.set("search", search);

    const response = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
    });

    if (!response.ok) {
      return res.status(502).json({ error: "provider_error" });
    }

    const data = await response.json();
    const team = data?.response?.[0]?.team;

    if (!team?.name || !team?.logo) {
      return res.status(404).json({ error: "not_found" });
    }

    const logoUrl = new URL(team.logo);
    if (logoUrl.protocol !== "https:" || logoUrl.hostname !== "media.api-sports.io") {
      return res.status(502).json({ error: "invalid_logo_url" });
    }

    return res.status(200).json({
      name: String(team.name).slice(0, 100),
      logo: logoUrl.toString(),
    });
  } catch {
    return res.status(502).json({ error: "lookup_failed" });
  }
};
