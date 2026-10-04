const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { initDB, getConnectionStatus } = require('./config/db');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Standard Middlewares
app.use(cors());
app.use(express.json({ limit: '1mb', strict: true }));
app.use(morgan('dev'));

// Routes Registration
const authRoutes = require('./routes/authRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const patientRoutes = require('./routes/patientRoutes');
const transferRoutes = require('./routes/transferRoutes');
const consentRoutes = require('./routes/consentRoutes');
const emergencyRoutes = require('./routes/emergencyRoutes');
const documentRoutes = require('./routes/documentRoutes');
const auditRoutes = require('./routes/auditRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const visitRoutes = require('./routes/visitRoutes');
const testRoutes = require('./routes/testRoutes');
const securityRoutes = require('./routes/securityRoutes');
const dataQualityRoutes = require('./routes/dataQualityRoutes');
const researchRoutes = require('./routes/researchRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/consents', consentRoutes);
app.use('/api/emergency-access', emergencyRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/data-quality', dataQualityRoutes);
app.use('/api/research', researchRoutes);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    system: 'Secure Consent-Based Inter-Hospital Patient Data Exchange System',
    version: '2.0.0 (Full Architecture)',
    security: {
      encryption: 'AES-256-GCM',
      signatures: 'HMAC-SHA256',
      interoperability: 'HL7 FHIR R4 Conceptual Mapping',
      audit: 'Append-Only Relational Trail'
    },
    database: {
      connected: getConnectionStatus(),
      engine: 'PostgreSQL Hybrid Relational Engine'
    },
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Secure Consent-Based Inter-Hospital Patient Data Exchange API Server is running.',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/login',
      hospitals: '/api/hospitals',
      patients: '/api/patients',
      transfers: '/api/transfers',
      consents: '/api/consents',
      emergency: '/api/emergency-access/request',
      audit: '/api/audit-logs'
    }
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found.` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error occurred.'
  });
});

// Start Server and Initialize DB
const server = app.listen(PORT, async () => {
  console.log(`\n🏥 ========================================================`);
  console.log(`🏥 Secure Consent-Based Inter-Hospital Data Exchange Server`);
  console.log(`🏥 URL: http://localhost:${PORT}`);
  console.log(`🏥 ========================================================\n`);
  
  await initDB();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`ℹ️ Port ${PORT} is already in use; attaching to existing running server instance.`);
  } else {
    console.error('Server error:', err);
  }
});

module.exports = { app, server };
