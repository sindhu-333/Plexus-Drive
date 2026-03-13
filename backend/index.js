require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const winston = require('winston');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const shareRoutes = require('./routes/shares');
const userRoutes = require('./routes/user');
const folderRoutes = require('./routes/folders');
const notificationRoutes = require('./routes/notifications');
const aiRoutes = require('./routes/ai');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'plexus-drive-backend' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

const app = express();

// Basic security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
}));
app.use(cookieParser());

// Dynamic CORS configuration for development and production
const corsOriginFunction = (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allowed origins list
    const allowedOrigins = [
        process.env.FRONTEND_URL,
        process.env.PRODUCTION_URL,
        'https://plexus-drive.netlify.app', // Add your actual Netlify URL
        'https://plexus-drive.vercel.app',  // Add your actual Vercel URL if using
    ].filter(Boolean); // Remove undefined values
    
    if (process.env.NODE_ENV === 'development') {
        // Allow localhost on any port
        if (origin.match(/^https?:\/\/localhost:\d+$/)) {
            return callback(null, true);
        }
        // Allow any local network IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        if (origin.match(/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+):\d+$/)) {
            return callback(null, true);
        }
        // Allow ngrok domains for development
        if (origin.match(/^https:\/\/[\w-]+\.ngrok-free\.dev$/)) {
            return callback(null, true);
        }
        // Allow configured frontend URLs
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
    } else {
        // Production: only allow specific origins
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
    }
    
    console.log('❌ CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
};

app.use(cors({
    origin: corsOriginFunction,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Range'],
    exposedHeaders: ['Set-Cookie', 'Content-Range', 'Accept-Ranges', 'Content-Length'],
    optionsSuccessStatus: 200,
    preflightContinue: false
}));

// Additional CORS middleware to ensure headers are set correctly
app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // Check if origin is allowed using the same logic as corsOriginFunction
    const isAllowedOrigin = !origin || 
        (process.env.NODE_ENV === 'development' && (
            origin.match(/^https?:\/\/localhost:\d+$/) ||
            origin.match(/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+):\d+$/) ||
            origin.match(/^https:\/\/[\w-]+\.ngrok-free\.dev$/) ||
            origin === process.env.FRONTEND_URL
        )) ||
        (process.env.NODE_ENV !== 'development' && origin === process.env.FRONTEND_URL);
    
    if (isAllowedOrigin) {
        if (origin) {
            res.header('Access-Control-Allow-Origin', origin);
        }
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
        res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin,Range');
    }
    
    // Handle preflight requests explicitly
    if (req.method === 'OPTIONS') {
        if (isAllowedOrigin) {
            return res.sendStatus(200);
        } else {
            return res.sendStatus(403);
        }
    }
    next();
});

// CSRF protection (optional in production)
const enableCsrfProtection = process.env.ENABLE_CSRF === 'true';
if (process.env.NODE_ENV === 'production' && enableCsrfProtection) {
    const csrfProtection = csurf({ cookie: true });
    app.use((req, res, next) => {
        if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
            return next();
        }
        csrfProtection(req, res, next);
    });
    
    // Route to get CSRF token (only in production)
    app.get('/api/csrf-token', (req, res) => {
        res.json({ csrfToken: req.csrfToken() });
    });
} else {
    // Skip CSRF in development (and in production unless explicitly enabled)
    app.use((req, res, next) => {
        if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
            return next();
        }
        next();
    });
    
    // For development, return a dummy CSRF token
    app.get('/api/csrf-token', (req, res) => {
        res.json({ csrfToken: 'development-token' });
    });
}
app.use(express.json());

// Rate limiting (relaxed for development)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 100 : 5, // More lenient in development
    message: 'Too many login attempts, please try again later'
});

// Apply rate limiting to auth routes (disabled for development)
// app.use('/api/auth', authLimiter);

// Basic security headers
app.use((req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    next();
});

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));
// Serve public assets (for email logos, etc.)
app.use('/public', express.static('public'));

// Health check endpoint for monitoring and deployment platforms
app.get('/health', async (req, res) => {
    try {
        // Check database connection
        const { pool } = require('./db');
        await pool.query('SELECT 1');
        
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            database: 'connected'
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Plexus Drive API',
        version: '1.0.0',
        status: 'running'
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/user', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/ai', aiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(err.stack);
    
    // Handle CSRF token errors
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({
            message: process.env.NODE_ENV === 'production'
                ? 'Invalid request'
                : 'CSRF token validation failed'
        });
    }

    // Handle other errors
    res.status(err.status || 500).json({
        message: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

const PORT = process.env.PORT || 5000;

// Add process handlers to prevent exits
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`);
    console.log(`✅ Backend server is running on http://localhost:${PORT}`);
    
    // Get network IP dynamically
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let networkIP = 'localhost';
    
    for (const interfaceName of Object.keys(networkInterfaces)) {
        const addresses = networkInterfaces[interfaceName];
        for (const address of addresses) {
            if (address.family === 'IPv4' && !address.internal && address.address !== '127.0.0.1') {
                networkIP = address.address;
                break;
            }
        }
        if (networkIP !== 'localhost') break;
    }
    
    console.log(`🌐 Network access available at http://${networkIP}:${PORT}`);
});
