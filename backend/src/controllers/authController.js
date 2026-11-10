const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');
const { recordAuditLog, extractReqMeta } = require('../utils/auditLogger');

/**
 * POST /api/auth/login
 * Authenticates doctor, hospital admin, system admin, or patient, returning scoped JWT.
 */
const login = async (req, res) => {
  const { email, username, identifier, login_id, health_id, unique_health_id, phone, password } = req.body;
  const loginIdentifier = String(identifier || email || username || login_id || health_id || unique_health_id || phone || '').trim().toLowerCase();
  const { ipAddress, userAgent } = extractReqMeta(req);

  if (!loginIdentifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email/Username and password are required.'
    });
  }

  try {
    const sql = `
      SELECT 
        u.id, u.name, u.email, u.username, u.password_hash, u.role, u.specialty, u.license_number, u.phone,
        h.id as hospital_id, h.name as hospital_name, h.code as hospital_code, h.city as hospital_city
      FROM users u
      LEFT JOIN hospitals h ON u.hospital_id = h.id
      LEFT JOIN patients p ON p.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1) 
         OR LOWER(u.username) = LOWER($1)
         OR LOWER(COALESCE(u.phone, '')) = LOWER($1)
         OR LOWER(COALESCE(p.unique_health_id, '')) = LOWER($1)
         OR LOWER(COALESCE(p.phone, '')) = LOWER($1)
    `;
    const result = await query(sql, [loginIdentifier]);

    if (result.rows.length === 0) {
      await recordAuditLog({
        userId: null,
        role: 'ANONYMOUS',
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        purpose: 'Authentication Attempt with Nonexistent Account',
        result: 'DENIED',
        ipAddress,
        userAgent,
        metadata: { attempted_identifier: loginIdentifier }
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email/username or password.'
      });
    }

    const user = result.rows[0];

    // Verify password hash (safe against bcrypt hash or plaintext fallback for seeded/test fixtures)
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.password_hash);
    } catch (e) {
      isPasswordValid = false;
    }
    if (!isPasswordValid && user.password_hash === password) {
      isPasswordValid = true;
    }

    if (!isPasswordValid) {
      await recordAuditLog({
        userId: user.id,
        role: user.role,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        purpose: 'Failed Password Authentication',
        result: 'DENIED',
        ipAddress,
        userAgent,
        metadata: { attempted_identifier: loginIdentifier }
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email/username or password.'
      });
    }

    // If user is a patient, lookup their patient record
    let patientProfile = null;
    if (user.role.toUpperCase() === 'PATIENT') {
      const patRes = await query('SELECT * FROM patients WHERE user_id = $1', [user.id]);
      if (patRes.rows.length > 0) {
        patientProfile = patRes.rows[0];
      } else if (user.patient_id) {
        const patById = await query('SELECT * FROM patients WHERE id = $1', [user.patient_id]);
        if (patById.rows.length > 0) {
          patientProfile = patById.rows[0];
        }
      }
    }

    // Sign JWT payload containing user details & role
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role.toUpperCase(),
      specialty: user.specialty,
      license_number: user.license_number,
      hospital_id: user.hospital_id || null,
      hospital_name: user.hospital_name || null,
      hospital_code: user.hospital_code || null,
      patient_id: patientProfile ? patientProfile.id : null,
      unique_health_id: patientProfile ? patientProfile.unique_health_id : null
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    // Record successful login in audit log
    await recordAuditLog({
      userId: user.id,
      role: user.role,
      action: 'LOGIN',
      patientId: patientProfile ? patientProfile.id : null,
      purpose: `${user.role.toUpperCase()} Authentication to MedTransfer Portal`,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: {
        hospital_node: user.hospital_code || 'N/A',
        auth_type: 'Password'
      }
    });

    return res.status(200).json({
      success: true,
      message: `Welcome ${user.name} (${user.role.toUpperCase()})`,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role.toUpperCase(),
        specialty: user.specialty,
        license_number: user.license_number,
        patient_id: patientProfile ? patientProfile.id : null,
        unique_health_id: patientProfile ? patientProfile.unique_health_id : null
      },
      hospital: user.hospital_id ? {
        id: user.hospital_id,
        name: user.hospital_name,
        code: user.hospital_code,
        city: user.hospital_city
      } : null,
      patient: patientProfile
    });
  } catch (err) {
    console.error('Error in login controller:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
};

/**
 * POST /api/auth/logout
 * Logs out user and records audit trail
 */
const logout = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  if (req.user) {
    await recordAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'LOGOUT',
      patientId: req.user.patient_id || null,
      purpose: 'User Initiated Session Termination',
      result: 'SUCCESS',
      ipAddress,
      userAgent
    });
  }
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
};

/**
 * GET /api/auth/me
 * Returns current authenticated user, verified hospital info, and patient profile if applicable
 */
const getMe = async (req, res) => {
  try {
    const sql = `
      SELECT 
        u.id, u.name, u.email, u.role, u.specialty, u.license_number, u.phone, u.created_at,
        h.id as hospital_id, h.name as hospital_name, h.code as hospital_code, h.address as hospital_address,
        h.city as hospital_city, h.phone as hospital_phone, h.emergency_contact as hospital_emergency_contact
      FROM users u
      LEFT JOIN hospitals h ON u.hospital_id = h.id
      WHERE u.id = $1
    `;
    const result = await query(sql, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }

    const row = result.rows[0];

    // If patient, load their clinical summary
    let patientProfile = null;
    if (row.role.toUpperCase() === 'PATIENT') {
      const patRes = await query('SELECT * FROM patients WHERE user_id = $1', [row.id]);
      if (patRes.rows.length > 0) {
        patientProfile = patRes.rows[0];
      } else if (req.user.patient_id) {
        const patById = await query('SELECT * FROM patients WHERE id = $1', [req.user.patient_id]);
        if (patById.rows.length > 0) {
          patientProfile = patById.rows[0];
        }
      }
    }

    return res.status(200).json({
      success: true,
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role.toUpperCase(),
        specialty: row.specialty,
        license_number: row.license_number,
        phone: row.phone,
        created_at: row.created_at,
        patient_id: patientProfile ? patientProfile.id : null,
        unique_health_id: patientProfile ? patientProfile.unique_health_id : null
      },
      hospital: row.hospital_id ? {
        id: row.hospital_id,
        name: row.hospital_name,
        code: row.hospital_code,
        address: row.hospital_address,
        city: row.hospital_city,
        phone: row.hospital_phone,
        emergency_contact: row.hospital_emergency_contact
      } : null,
      patient: patientProfile
    });
  } catch (err) {
    console.error('Error in getMe controller:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
};

/**
 * POST /api/auth/register
 * Admin registration of new clinical staff
 */
/**
 * POST /api/auth/register/patient
 * Public self-registration for new patients
 */
const registerPatient = async (req, res) => {
  const {
    first_name,
    last_name,
    name,
    full_name,
    date_of_birth,
    dob,
    birth_date,
    birthDate,
    gender,
    email,
    phone,
    phone_number,
    username,
    identifier,
    password,
    confirm_password,
    address,
    emergency_contact,
    emergency_contact_name,
    emergency_contact_phone,
    blood_group,
    medical_history,
    allergies,
    unique_health_id,
    health_id,
    patient_code
  } = req.body;
  const { ipAddress, userAgent } = extractReqMeta(req);

  // Flexible name resolution
  let cleanFirstName = String(first_name || '').trim();
  let cleanLastName = String(last_name || '').trim();
  const rawFullName = String(name || full_name || '').trim();
  if ((!cleanFirstName || !cleanLastName) && rawFullName) {
    const parts = rawFullName.split(/\s+/);
    cleanFirstName = cleanFirstName || parts[0] || '';
    cleanLastName = cleanLastName || (parts.length > 1 ? parts.slice(1).join(' ') : 'Patient');
  }
  if (!cleanLastName && cleanFirstName) {
    cleanLastName = 'Patient';
  }
  const resolvedFullName = rawFullName || `${cleanFirstName} ${cleanLastName}`.trim();

  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanUsername = String(username || identifier || (cleanEmail ? cleanEmail.split('@')[0] : '') || cleanFirstName.toLowerCase() || '').trim().toLowerCase();
  const cleanDob = date_of_birth || dob || birth_date || birthDate;
  const cleanGender = gender || 'Other';
  const cleanPhone = phone || phone_number || '';
  const cleanEmergencyContactName = emergency_contact_name || emergency_contact || 'Family Contact';
  const cleanEmergencyContactPhone = emergency_contact_phone || cleanPhone || '';

  if (!cleanFirstName || !cleanEmail || !password || !cleanDob) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: first_name, email, password, date_of_birth.'
    });
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.'
    });
  }

  if (password.length < 4) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 4 characters long.'
    });
  }

  if (confirm_password && password !== confirm_password) {
    return res.status(400).json({
      success: false,
      message: 'Password and Confirm Password do not match.'
    });
  }

  try {
    const existing = await query('SELECT id, email, username FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)', [cleanEmail, cleanUsername]);
    if (existing.rows.length > 0) {
      const match = existing.rows[0];
      const isEmail = match.email && match.email.toLowerCase() === cleanEmail;
      return res.status(409).json({
        success: false,
        message: isEmail ? 'An account with this email address already exists.' : 'This username is already taken. Please choose another.'
      });
    }

    const passwordHash = password.startsWith('$2a$') || password.startsWith('$2b$') ? password : await bcrypt.hash(password, 10);
    const healthId = unique_health_id || health_id || patient_code || `ABHA-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const insertUserSql = `
      INSERT INTO users (hospital_id, name, email, username, password_hash, role, specialty, license_number, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, email, username, role, created_at
    `;
    const userRes = await query(insertUserSql, [
      null,
      resolvedFullName,
      cleanEmail,
      cleanUsername,
      passwordHash,
      'PATIENT',
      'Verified Patient Account',
      healthId,
      cleanPhone
    ]);
    const newUser = userRes.rows[0];

    const insertPatientSql = `
      INSERT INTO patients (user_id, unique_health_id, name, dob, gender, blood_group, phone, emergency_contact_name, emergency_contact_phone, medical_history, allergies)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const patRes = await query(insertPatientSql, [
      newUser.id,
      healthId,
      resolvedFullName,
      cleanDob,
      cleanGender,
      blood_group || 'O+',
      cleanPhone,
      cleanEmergencyContactName,
      cleanEmergencyContactPhone,
      medical_history || 'No prior chronic conditions recorded during registration.',
      allergies || 'None known'
    ]);

    const createdPatient = patRes.rows[0];
    if (newUser) {
      newUser.patient_id = createdPatient ? createdPatient.id : null;
    }

    await recordAuditLog({
      userId: newUser.id,
      role: 'PATIENT',
      action: 'PATIENT_REGISTERED',
      patientId: createdPatient?.id || null,
      purpose: 'Patient Self-Registration & ABHA Health Identity Creation',
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { unique_health_id: healthId, username: cleanUsername, email: cleanEmail }
    });

    return res.status(201).json({
      success: true,
      message: 'Patient account created successfully. Please login to continue.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role,
        unique_health_id: healthId,
        patient_id: createdPatient?.id
      }
    });
  } catch (err) {
    console.error('Error in registerPatient controller:', err);
    return res.status(500).json({
      success: false,
      message: 'Database error while registering patient account.'
    });
  }
};

/**
 * POST /api/auth/register/doctor
 * Public self-registration for new medical doctors with hospital association
 */
const registerDoctor = async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    phone,
    username,
    password,
    confirm_password,
    medical_specialization,
    specialization,
    specialty,
    medical_registration_number,
    medical_license_number,
    license_number,
    hospital_id,
    experience_years,
    years_of_experience,
    qualification,
    profile_photo
  } = req.body;
  const { ipAddress, userAgent } = extractReqMeta(req);

  const cleanFirstName = String(first_name || '').trim();
  const cleanLastName = String(last_name || '').trim();
  const fullName = cleanFirstName && cleanLastName ? `Dr. ${cleanFirstName} ${cleanLastName}` : (req.body.name || `Dr. ${cleanFirstName}`);
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanUsername = String(username || cleanEmail.split('@')[0] || '').trim().toLowerCase();
  const cleanSpecialty = medical_specialization || specialization || specialty || 'General Medicine';
  const cleanLicense = medical_registration_number || medical_license_number || license_number;
  const cleanHospitalId = Number.parseInt(hospital_id, 10);

  if (!cleanFirstName || !cleanLastName || !cleanEmail || !cleanUsername || !password || !cleanLicense) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: first_name, last_name, email, username, password, medical license number.'
    });
  }

  // Hospital affiliation determines the doctor's record access scope, so it must
  // be stated explicitly rather than defaulted to an arbitrary node.
  if (!Number.isInteger(cleanHospitalId) || cleanHospitalId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'An affiliated hospital node must be selected.'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address.'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long.'
    });
  }

  if (confirm_password && password !== confirm_password) {
    return res.status(400).json({
      success: false,
      message: 'Password and Confirm Password do not match.'
    });
  }

  try {
    const hospitalExists = await query('SELECT id FROM hospitals WHERE id = $1', [cleanHospitalId]);
    if (hospitalExists.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'The selected hospital node is not registered on the exchange.'
      });
    }

    const existing = await query('SELECT id, email, username FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)', [cleanEmail, cleanUsername]);
    if (existing.rows.length > 0) {
      const match = existing.rows[0];
      const isEmail = match.email && match.email.toLowerCase() === cleanEmail;
      return res.status(409).json({
        success: false,
        message: isEmail ? 'An account with this email address already exists.' : 'This username is already taken. Please choose another.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertSql = `
      INSERT INTO users (hospital_id, name, email, username, password_hash, role, specialty, license_number, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, email, username, role, specialty, license_number, hospital_id, created_at
    `;
    const result = await query(insertSql, [
      cleanHospitalId,
      fullName,
      cleanEmail,
      cleanUsername,
      passwordHash,
      'DOCTOR',
      cleanSpecialty,
      cleanLicense,
      phone || null
    ]);
    const newDoc = result.rows[0];

    await recordAuditLog({
      userId: newDoc.id,
      role: 'DOCTOR',
      action: 'DOCTOR_REGISTERED',
      purpose: 'Doctor Self-Registration with Hospital Affiliation',
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: {
        specialty: cleanSpecialty,
        license_number: cleanLicense,
        hospital_id: cleanHospitalId,
        experience_years: experience_years || years_of_experience || null,
        qualification: qualification || null
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Doctor account created successfully. Your account is verified with your affiliated hospital.',
      user: newDoc
    });
  } catch (err) {
    console.error('Error in registerDoctor controller:', err);
    return res.status(500).json({
      success: false,
      message: 'Database error while registering doctor account.'
    });
  }
};

/**
 * POST /api/auth/register
 * Admin registration of new clinical staff
 */
const register = async (req, res) => {
  const { hospital_id, name, email, username, password, role, specialty, license_number, phone } = req.body;
  const { ipAddress, userAgent } = extractReqMeta(req);

  if (!name || !email || !password || !role) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: name, email, password, role.'
    });
  }

  const validRoles = ['DOCTOR', 'HOSPITAL_ADMIN', 'SYSTEM_ADMIN', 'PATIENT'];
  if (!validRoles.includes(role.toUpperCase())) {
    return res.status(400).json({
      success: false,
      message: `Role must be one of: ${validRoles.join(', ')}`
    });
  }

  try {
    const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email address already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertSql = `
      INSERT INTO users (hospital_id, name, email, username, password_hash, role, specialty, license_number, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, email, username, role, specialty, license_number, hospital_id, created_at
    `;
    const result = await query(insertSql, [
      hospital_id ? parseInt(hospital_id, 10) : null,
      name.trim(),
      email.trim(),
      username || email.split('@')[0],
      passwordHash,
      role.toUpperCase(),
      specialty || null,
      license_number || null,
      phone || null
    ]);

    await recordAuditLog({
      userId: req.user ? req.user.id : null,
      role: req.user ? req.user.role : 'SYSTEM',
      action: 'USER_REGISTERED',
      purpose: `Registration of new user account (${role.toUpperCase()})`,
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { registered_email: email, role }
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Error in register controller:', err);
    return res.status(500).json({
      success: false,
      message: 'Database error while registering user.'
    });
  }
};

/**
 * POST /api/auth/register/admin
 * Public registration for hospital operations lead / admin
 */
const registerAdmin = async (req, res) => {
  const { name, email, username, password, confirm_password, hospital_id, phone } = req.body;
  const { ipAddress, userAgent } = extractReqMeta(req);

  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanUsername = String(username || (cleanEmail ? cleanEmail.split('@')[0] : '') || '').trim().toLowerCase();
  const cleanHospitalId = hospital_id ? parseInt(hospital_id, 10) : 1;

  if (!cleanName || !cleanEmail || !password) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: name, email, password.'
    });
  }

  if (confirm_password && password !== confirm_password) {
    return res.status(400).json({
      success: false,
      message: 'Password and Confirm Password do not match.'
    });
  }

  try {
    const existing = await query('SELECT id, email, username FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)', [cleanEmail, cleanUsername]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email or username already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertSql = `
      INSERT INTO users (hospital_id, name, email, username, password_hash, role, specialty, license_number, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, email, username, role, specialty, license_number, hospital_id, created_at
    `;
    const result = await query(insertSql, [
      cleanHospitalId,
      cleanName,
      cleanEmail,
      cleanUsername,
      passwordHash,
      'HOSPITAL_ADMIN',
      'Hospital Operations Lead',
      `ADM-${cleanHospitalId}-${Math.floor(100 + Math.random() * 900)}`,
      phone || null
    ]);

    const newAdmin = result.rows[0];

    await recordAuditLog({
      userId: newAdmin.id,
      role: 'HOSPITAL_ADMIN',
      action: 'ADMIN_REGISTERED',
      purpose: 'Hospital Administrator Registration',
      result: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { hospital_id: cleanHospitalId }
    });

    return res.status(201).json({
      success: true,
      message: 'Hospital Administrator account created successfully.',
      user: newAdmin
    });
  } catch (err) {
    console.error('Error in registerAdmin:', err);
    return res.status(500).json({
      success: false,
      message: 'Database error while registering administrator.'
    });
  }
};

module.exports = {
  login,
  logout,
  getMe,
  register,
  registerPatient,
  registerDoctor,
  registerAdmin
};
