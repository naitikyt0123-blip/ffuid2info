const express = require('express');
const axios = require('axios');
const qs = require('qs');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('json spaces', 2);

app.get('/api/check', async (req, res) => {
    const uid = req.query.uid;

    if (!uid) {
        return res.status(400).json({ error: "UID parameter is required" });
    }

    try {
        // High-level fake headers to bypass basic Cloudflare block
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'max-age=0',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        };

        // 1. Homepage hit karke Nonce nikalna
        console.log("🔍 Fetching nonce from website...");
        const pageResponse = await axios.get('https://freefirenation.com/free-fire-player-info-tool/', { 
            headers: headers,
            timeout: 10000
        });
        
        const html = pageResponse.data;
        let nonce = "";

        // Super strong Regex to find nonce anywhere in WordPress HTML
        const nonceRegex = /["']?nonce["']?\s*[:=]\s*["']([a-f0-9]{10})["']/i;
        const match = html.match(nonceRegex);

        if (match && match[1]) {
            nonce = match[1];
            console.log(`✅ Nonce Found: ${nonce}`);
        } else {
            // Agar HTML aa gaya par nonce nahi mila
            return res.status(500).json({
                success: false,
                error: "Nonce bypass fail. Website layout changed or blocked.",
                html_snippet: html.substring(0, 200) // Checking ki Cloudflare page toh nahi aaya
            });
        }

        // 2. Hidden API (admin-ajax) par POST request
        console.log("🚀 Sending POST request to Hidden API...");
        const payload = qs.stringify({
            action: 'ff_get_player_info',
            uid: uid,
            region: 'IND',
            nonce: nonce
        });

        const apiResponse = await axios.post('https://freefirenation.com/wp-admin/admin-ajax.php', payload, {
            headers: {
                ...headers,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': 'https://freefirenation.com',
                'Referer': 'https://freefirenation.com/free-fire-player-info-tool/',
                'Cookie': pageResponse.headers['set-cookie'] ? pageResponse.headers['set-cookie'].join('; ') : '' // Pass cookies for security
            },
            timeout: 10000
        });

        const data = apiResponse.data;

        if (!data.success || !data.data || !data.data.basicInfo) {
            return res.status(404).json({
                success: false,
                error: "Player nahi mila ya UID galat hai."
            });
        }

        const basicInfo = data.data.basicInfo;

        // 3. Clean JSON Output
        return res.json({
            success: true,
            data: {
                Name: basicInfo.nickname || "Unknown",
                UID: uid,
                Level: basicInfo.level || 0,
                Likes: basicInfo.liked || basicInfo.likes || 0,
                Region: data.data.detected_region || "IND",
                Account_Created: basicInfo.createAt || "Unknown",
                Ban_Status: data.data.ban_check ? data.data.ban_check.status : "Unknown"
            },
            developer: "@ZeroSpade"
        });

    } catch (error) {
        let errorMsg = "Server Fetch Error.";
        // Agar error 503 hai, mtlb Cloudflare ne block kar diya
        if (error.response && error.response.status === 503) {
            errorMsg = "Cloudflare Turnstile (Anti-Bot) ne block kar diya. Puppeteer is mandatory for this site.";
        }
        
        console.error("❌ Error:", error.message);
        return res.status(500).json({
            success: false,
            error: errorMsg,
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Fast API Server is running on port ${PORT}`);
});
