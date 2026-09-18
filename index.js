const axios = require("axios");
const cheerio = require("cheerio");

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  try {
    const uid = String(req.query.uid || "").trim();

    if (!uid || !/^\d+$/.test(uid)) {
      return res.status(400).json({
        success: false,
        error: "Valid UID required",
        example: "/?uid=1503005347"
      });
    }

    const url =
      `https://www.freefiremania.com.br/profile/${encodeURIComponent(uid)}.html?region=ind`;

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    const $ = cheerio.load(response.data);

    // Page ke visible text se common profile values find karne ki
    // basic attempt. Exact selectors site ke current HTML par depend karte hain.
    const text = $("body").text().replace(/\s+/g, " ").trim();

    function findValue(label) {
      const regex = new RegExp(
        label + "\\s*[:\\-]?\\s*([^|]+?)(?=\\s+(?:UID|Level|Likes|Region|Name|EXP)\\b|$)",
        "i"
      );

      const match = text.match(regex);
      return match ? match[1].trim() : null;
    }

    const result = {
      uid: uid,
      name: findValue("Name"),
      level: findValue("Level"),
      likes: findValue("Likes"),
      region: "IND"
    };

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Failed to fetch profile",
      details: error.message
    });
  }
};
