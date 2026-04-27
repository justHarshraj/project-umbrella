const axios = require('axios');

/**
 * WattTime Service to handle authentication and fetching grid data.
 */
class WattTimeService {
    constructor() {
        this.token = null;
        this.tokenExpiry = null;
    }

    /**
     * Authenticates with WattTime API to get a Bearer Token.
     */
    async login() {
        try {
            const response = await axios.get('https://api2.watttime.org/v2/login', {
                auth: {
                    username: process.env.WATTTIME_USER,
                    password: process.env.WATTTIME_PASS
                }
            });
            this.token = response.data.token;
            this.tokenExpiry = Date.now() + 25 * 60 * 1000; 
            return this.token;
        } catch (error) {
            console.error('WattTime Login Error:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with WattTime API');
        }
    }

    async getToken() {
        if (!this.token || Date.now() > this.tokenExpiry) {
            await this.login();
        }
        return this.token;
    }

    /**
     * Finds the greenest region among a list of Balancing Authorities (BAs).
     */
    async findGreenestRegion() {
        try {
            const token = await this.getToken();
            
            // A selection of major BAs: California, Texas, Mid-Atlantic/Midwest
            const regions = [
                { id: 'CAISO', name: 'California (CAISO)' },
                { id: 'ERCOT', name: 'Texas (ERCOT)' },
                { id: 'PJM', name: 'East Coast (PJM)' },
                { id: 'ISONE', name: 'New England (ISO-NE)' }
            ];

            console.log("Comparing grid health across regions...");
            
            // Fetch indices for all regions in parallel
            const gridChecks = await Promise.all(regions.map(async (reg) => {
                try {
                    const response = await axios.get('https://api2.watttime.org/v2/index', {
                        params: { ba: reg.id },
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    return {
                        region: reg.name,
                        id: reg.id,
                        emissionRating: response.data.percent, // 0-100, where 0 is cleanest
                        point: response.data.point
                    };
                } catch (e) {
                    console.error(`Failed to fetch for ${reg.id}:`, e.message);
                    return null;
                }
            }));

            // Filter out failures and find the one with the lowest emissionRating
            const validChecks = gridChecks.filter(c => c !== null);
            if (validChecks.length === 0) throw new Error("No grid data available");

            const greenest = validChecks.reduce((prev, curr) => 
                (prev.emissionRating < curr.emissionRating) ? prev : curr
            );

            console.log(`Greenest region found: ${greenest.region} (${greenest.emissionRating}%)`);
            return greenest;

        } catch (error) {
            console.error('Grid Comparison Error:', error.message);
            // Fallback to a default region if API fails (e.g. missing credentials)
            return { region: "Global (Carbon Average)", emissionRating: 50 };
        }
    }

    async getGridEmissions(latitude, longitude) {
        const token = await this.getToken();
        try {
            const baResponse = await axios.get('https://api2.watttime.org/v2/ba-from-loc', {
                params: { latitude, longitude },
                headers: { Authorization: `Bearer ${token}` }
            });
            const ba = baResponse.data.abbreviation;

            const indexResponse = await axios.get('https://api2.watttime.org/v2/index', {
                params: { ba },
                headers: { Authorization: `Bearer ${token}` }
            });

            return {
                ba,
                percent: indexResponse.data.percent,
                point: indexResponse.data.point,
                timestamp: indexResponse.data.point_time
            };
        } catch (error) {
            console.error('WattTime Data Error:', error.response?.data || error.message);
            throw new Error('Failed to fetch grid data from WattTime');
        }
    }
}

const service = new WattTimeService();

module.exports = {
    findGreenestRegion: () => service.findGreenestRegion(),
    getGridEmissions: (lat, lon) => service.getGridEmissions(lat, lon)
};
