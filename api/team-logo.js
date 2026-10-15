module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  if (!search) return res.status(400).json({ error: "missing_search" });
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) return res.status(500).json({ error: "server_configuration_error" });
  try {
    const url = new URL("https://v3.football.api-sports.io/teams");
    url.searchParams.set("search", search);
    const response = await fetch(url, { headers: { "x-apisports-key": apiKey } });
    const remainingHeader = response.headers.get("x-ratelimit-requests-remaining");
    const limitHeader = response.headers.get("x-ratelimit-requests-limit");
    const remaining = Number(remainingHeader), limit = Number(limitHeader);
    const quota = remainingHeader !== null && limitHeader !== null && Number.isFinite(remaining) && Number.isFinite(limit) ? { remaining, limit } : null;
    if (!response.ok) return res.status(502).json({ error: "provider_error", quota });
    const data = await response.json();
    const teams = Array.isArray(data?.response) ? data.response : [];
    const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    const query = normalize(search);
    const words = query.split(" ").filter((word) => word.length > 1);
    const ranked = teams
      .filter((item) => item?.team?.name && item?.team?.logo)
      .map((item) => {
        const name = normalize(item.team.name);
        const hasAllWords = words.length > 0 && words.every((word) => name.includes(word));
        const score = name === query ? 100 : name.startsWith(query) ? 80 : hasAllWords ? 60 : 0;
        return { item, score };
      })
      .sort((a, b) => b.score - a.score);
    const team = ranked[0]?.score > 0 ? ranked[0].item.team : null;
    if (!team?.name || !team?.logo) return res.status(404).json({ error: "not_found", quota });
    const logoUrl = new URL(team.logo);
    if (logoUrl.protocol !== "https:" || logoUrl.hostname !== "media.api-sports.io") return res.status(502).json({ error: "invalid_logo_url", quota });
    return res.status(200).json({ name: String(team.name).slice(0, 100), logo: logoUrl.toString(), quota });
  } catch {
    return res.status(502).json({ error: "lookup_failed" });
  }
};
