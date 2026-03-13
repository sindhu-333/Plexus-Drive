const os = require('os');
const fs = require('fs');
const path = require('path');

// Function to get current network IP
function getCurrentNetworkIP() {
    const networkInterfaces = os.networkInterfaces();
    
    for (const interfaceName of Object.keys(networkInterfaces)) {
        const addresses = networkInterfaces[interfaceName];
        for (const address of addresses) {
            // Skip internal and IPv6 addresses
            if (address.family === 'IPv4' && !address.internal && address.address !== '127.0.0.1') {
                return address.address;
            }
        }
    }
    return 'localhost'; // Fallback
}

// Update .env file with current IP
function updateEnvFile() {
    const currentIP = getCurrentNetworkIP();
    const envPath = path.join(__dirname, '.env');
    
    console.log(`🌐 Current network IP detected: ${currentIP}`);
    
    // Check if .env already exists and has ngrok URLs
    let existingContent = '';
    if (fs.existsSync(envPath)) {
        existingContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Don't overwrite if ngrok URLs are already configured
    if (existingContent.includes('ngrok')) {
        console.log(`🌐 Ngrok URLs detected in .env - preserving existing configuration`);
        console.log(`📱 Frontend available via existing ngrok tunnel`);
        console.log(`🔧 Backend available via existing ngrok tunnel`);
        return;
    }
    
    const envContent = `VITE_API_URL=http://${currentIP}:5000/api
VITE_BACKEND_URL=http://${currentIP}:5000
`;
    
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated .env file with IP: ${currentIP}`);
    console.log(`📱 Frontend will be available at: http://${currentIP}:3000`);
    console.log(`🔧 Backend will be available at: http://${currentIP}:5000`);
}

// Run the update
updateEnvFile();

module.exports = { getCurrentNetworkIP, updateEnvFile };