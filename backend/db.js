const { Pool } = require('pg');

// Use DATABASE_URL in production (from hosting platform)
// Falls back to local config in development
const pool = new Pool(
    process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false // Required for most cloud databases
            }
        }
        : {
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'plexus_db',
            password: process.env.DB_PASSWORD || '2004.',
            port: parseInt(process.env.DB_PORT || '5432'),
        }
);

pool.on('connect', () => {
    console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err.message);
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection test failed:', err.message);
    } else {
        console.log('✅ Database connection test passed:', res.rows[0].now);
    }
});

module.exports = { pool };

