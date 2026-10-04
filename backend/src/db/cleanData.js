const { pool, initDB, clearDummyData, getConnectionStatus } = require('../config/db');

async function cleanDatabase() {
  console.log('🧹 MedTransfer: Cleaning Dummy & Synthetic Data...\n');

  const connected = await initDB();

  if (connected) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log('🗑️  Purging synthetic patient & transfer tables in PostgreSQL...');

      // Truncate dependent clinical and transfer tables
      await client.query(`
        TRUNCATE TABLE 
          research_evaluation_entries,
          research_evaluation_runs,
          ai_audit_events,
          ai_critical_information,
          transfer_complexity_results,
          security_anomalies,
          ai_search_logs,
          data_quality_issues,
          ai_record_relevance,
          ai_handover_summaries,
          notifications,
          emergency_access,
          consents,
          transfer_requests,
          documents,
          patient_allergies,
          medications,
          tests,
          visits,
          patients
        CASCADE;
      `);

      // Remove synthetic demo patients from users table (keep doctor/admin staff)
      await client.query(`
        DELETE FROM users WHERE role = 'PATIENT';
      `);

      await client.query('COMMIT');
      console.log('\x1b[32m%s\x1b[0m', '✅ PostgreSQL database successfully cleaned! All dummy patient records removed.');
      console.log('ℹ️  Clinician & Hospital Admin accounts remain active for real data entry.\n');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Error cleaning PostgreSQL database:', err.message);
    } finally {
      client.release();
    }
  } else {
    clearDummyData();
    console.log('\x1b[32m%s\x1b[0m', '✅ In-Memory store cleaned! All synthetic patient records removed.');
    console.log('ℹ️  Clinician & Hospital Admin accounts remain active for real data entry.\n');
  }

  process.exit(0);
}

cleanDatabase();
