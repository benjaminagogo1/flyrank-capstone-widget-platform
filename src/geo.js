const timeoutMs = Number(
      process.env.GEO_TIMEOUT_MS || 3000
    );
    
    async function requestJson(url) {
      const controller = new AbortController();
    
      const timer = setTimeout(
        () => controller.abort(),
        timeoutMs
      );
    
      try {
        const response = await fetch(url, {
          signal: controller.signal
        });
    
        if (!response.ok) {
          throw new Error(
            `Geo provider returned ${response.status}`
          );
        }
    
        return response.json();
      } finally {
        clearTimeout(timer);
      }
    }
    
    async function primaryProvider(ip) {
      if (process.env.GEO_DOWN === "primary") {
        throw new Error("Primary provider disabled");
      }
    
      if (process.env.GEO_DOWN === "both") {
        throw new Error("Primary provider disabled");
      }
    
      const data = await requestJson(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city`
      );
    
      if (data.status !== "success") {
        throw new Error("Primary geo lookup failed");
      }
    
      return {
        provider: "ip-api.com",
        country: data.country || null,
        city: data.city || null
      };
    }
    
    async function fallbackProvider(ip) {
      if (process.env.GEO_DOWN === "both") {
        throw new Error("Fallback provider disabled");
      }
    
      const data = await requestJson(
        `https://ipapi.co/${encodeURIComponent(ip)}/json/`
      );
    
      if (data.error) {
        throw new Error("Fallback geo lookup failed");
      }
    
      return {
        provider: "ipapi.co",
        country: data.country_name || null,
        city: data.city || null
      };
    }
    
    async function enrichIp(ip, providers = [
      primaryProvider,
      fallbackProvider
    ]) {
      for (const provider of providers) {
        try {
          return await provider(ip);
        } catch (error) {
          console.error(
            "geo provider failed:",
            error.message
          );
        }
      }
    
      return null;
    }
    
    module.exports = {
      primaryProvider,
      fallbackProvider,
      enrichIp
    };