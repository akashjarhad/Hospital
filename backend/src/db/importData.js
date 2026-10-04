const fs = require('fs');
const path = require('path');
const { pool, query, initDB, getConnectionStatus } = require('../config/db');

/**
 * Universal Importer for Real Clinical Data
 * Usage:
 *   node src/db/importData.js path/to/patients.json
 *   node src/db/importData.js path/to/patients.csv
 */
async function importData() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.log('📖 Usage: node src/db/importData.js <path-to-json-or-csv-file>');
    console.log('   Example: node src/db/importData.js data/real_patients.json');
    process.exit(0);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ File not found at: ${resolvedPath}`);
    process.exit(1);
  }

  await initDB();
  const isPostgres = getConnectionStatus();
  console.log(`🚀 Ingesting real dataset into ${isPostgres ? 'PostgreSQL Database' : 'InMemory Clinical Store'}...\n`);

  const fileContent = fs.readFileSync(resolvedPath, 'utf8');
  let records = [];

  if (filePath.endsWith('.json')) {
    records = JSON.parse(fileContent);
    if (!Array.isArray(records)) records = [records];
  } else if (filePath.endsWith('.csv')) {
    const lines = fileContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = values[idx] || null; });
      records.push(obj);
    }
  }

  let importedCount = 0;
  for (const patient of records) {
    const uid = patient.unique_health_id || patient.abha_id || `P-${Date.now().toString().slice(-5)}`;
    const name = patient.name || patient.full_name || 'Anonymous Patient';
    const dob = patient.dob || '1985-01-01';
    const gender = patient.gender || 'Other';
    const bloodGroup = patient.blood_group || 'O+';
    const phone = patient.phone || '+91-9000000000';
    const emergencyName = patient.emergency_contact_name || 'Emergency Contact';
    const emergencyPhone = patient.emergency_contact_phone || phone;
    const history = patient.medical_history || '';
    const allergies = patient.allergies || '';

    try {
      const res = await query(
        `INSERT INTO patients (unique_health_id, name, dob, gender, blood_group, phone, emergency_contact_name, emergency_contact_phone, medical_history, allergies)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, name, unique_health_id`,
        [uid, name, dob, gender, bloodGroup, phone, emergencyName, emergencyPhone, history, allergies]
      );
      console.log(`✓ Imported Patient: ${name} (ABHA: ${uid}) -> ID: ${res.rows[0]?.id}`);
      importedCount++;
    } catch (err) {
      console.error(`⚠️ Failed to import record ${name}:`, err.message);
    }
  }

  console.log(`\n🎉 Successfully imported ${importedCount} real patient record(s)!`);
  process.exit(0);
}

importData();
